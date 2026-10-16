"use client";

import { useAccount } from "@/account/account";
import { getDb, readTeam, type PlanSync } from "@/data/db";
import type { Plan } from "@/engine/types";
import { rebasePlan, uniquePlanName } from "@/planner/model";
import { connect, reloadPlans, showToast, usePlanner } from "@/planner/store";
import { useSyncStatus } from "./status";
import { scheduleSync } from "./trigger";

/*
 * Plan sync for signed-in users. Every edit is saved on the device first;
 * this brings the device and the account level, in two steps:
 *
 * 1. Pull: plans changed on the server since the last sync replace the
 *    device's copies, unless the device has unsynced edits to the same plan
 *    (a conflict: both are kept, the device's as a copy).
 * 2. Push: plans edited here go up with the server version they were based
 *    on. If the server has moved on, the same keep-both rule applies.
 *
 * Plans made before signing in join the account on the first sync. An empty,
 * untouched "Main plan" isn't uploaded when the account already has plans
 * for that team, so signing in on a new device doesn't add clutter.
 */

interface ServerPlan extends Plan {
  version: number;
  deletedAt: number | null;
  /** When the server last wrote it (the sync cursor); `updatedAt` is when it was last edited. */
  syncedAt: number;
}

const DEFAULT_NAME = "Main plan";
const cursorKey = (userId: string) => `fpl-lineup:sync-cursor:${userId}`;

let running: Promise<void> | null = null;
/** Consecutive failures, for backing off retries. */
let failures = 0;
let again = false;

/** Syncs now; if a sync is already running, one more follows it. */
export function sync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(res.status, body);
  return body as T;
}

async function syncOnce() {
  const userId = useAccount.getState().userId;
  if (!userId || useAccount.getState().status !== "signed-in") return;
  if (!navigator.onLine) return useSyncStatus.setState({ state: "offline" });
  useSyncStatus.setState({ state: "syncing" });

  try {
    let changed = await pull(userId);
    changed = (await push(userId)) || changed;
    await linkTeam().catch((err: unknown) => console.warn("Couldn't link team", err));
    useSyncStatus.setState({ state: "synced", at: Date.now() });
    failures = 0;
    await afterChange(changed);
  } catch (err) {
    if (err instanceof HttpError && err.status === 401) {
      // The session ended on the server (signed out elsewhere, or expired).
      useSyncStatus.setState({ state: "idle" });
      useAccount.setState({ status: "signed-out", email: null, userId: null });
      return;
    }
    console.warn("Plan sync failed", err);
    useSyncStatus.setState({ state: navigator.onLine ? "error" : "offline" });
    // Offline waits for the "online" event; a server hiccup retries, backing off to 5 minutes.
    if (navigator.onLine) scheduleSync(Math.min(5 * 60_000, 10_000 * 2 ** failures++));
  }
}

let autoOpened = false;

/**
 * The planner reflects what sync changed. A device with no team yet opens
 * the account's, once per visit (so "Change FPL team" isn't undone). On a
 * new device the first sync can finish before the app has its game data, so
 * that waits for boot, without holding up sync.
 */
async function afterChange(changed: boolean) {
  const { phase } = usePlanner.getState();
  if (phase === "ready" && changed) return reloadPlans();
  if (autoOpened || (phase !== "connect" && phase !== "booting")) return;
  autoOpened = true;
  void afterBoot().then((p) => {
    if (p === "connect") void openAccountTeam().catch(() => {});
  });
}

/** The planner's phase once it has finished booting (never resolves if boot fails). */
function afterBoot(): Promise<string> {
  const now = usePlanner.getState().phase;
  if (now !== "booting") return Promise.resolve(now);
  return new Promise((resolve) => {
    const stop = usePlanner.subscribe((s) => {
      if (s.phase === "booting") return;
      stop();
      resolve(s.phase);
    });
  });
}

/* ---------------- Pull ---------------- */

function readCursor(userId: string): number | undefined {
  try {
    const raw = localStorage.getItem(cursorKey(userId));
    return raw ? Number(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeCursor(userId: string, at: number) {
  try {
    localStorage.setItem(cursorKey(userId), String(at));
  } catch {
    // Storage blocked: the next sync just pulls everything again.
  }
}

async function pull(userId: string): Promise<boolean> {
  const since = readCursor(userId);
  const { plans } = await api<{ plans: ServerPlan[] }>(`/api/plans${since ? `?since=${since}` : ""}`);
  let changed = false;
  for (const remote of plans) changed = (await applyRemote(remote, userId)) || changed;
  const latest = Math.max(since ?? 0, ...plans.map((p) => p.syncedAt));
  if (latest > 0) writeCursor(userId, latest);
  return changed;
}

/** A plan from the server, re-fitted to this device's squad if the server's copy is older. */
async function fitToTeam(plan: Plan): Promise<Plan> {
  const team = await readTeam(plan.entryId).catch(() => undefined);
  return team && plan.base.gw < team.planFromGw ? rebasePlan(plan, team) : plan;
}

const strip = (p: ServerPlan): Plan => ({
  id: p.id,
  entryId: p.entryId,
  name: p.name,
  base: p.base,
  moves: p.moves,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

/**
 * Takes one server plan into the device. Returns whether anything here
 * changed. `conflict` says the device's copy is known to differ (an upload
 * was just refused), so it's kept as a copy.
 */
async function applyRemote(remote: ServerPlan, userId: string, conflict = false): Promise<boolean> {
  const incoming = remote.deletedAt ? null : await fitToTeam(strip(remote));
  const db = await getDb();
  const tx = db.transaction(["plans", "planSync"], "readwrite");
  const plans = tx.objectStore("plans");
  const syncs = tx.objectStore("planSync");
  const [local, rec] = await Promise.all([plans.get(remote.id), syncs.get(remote.id)]);
  const clean = (version: number): PlanSync => ({
    id: remote.id,
    owner: userId,
    version,
    dirty: false,
    deleted: false,
    rev: rec?.rev ?? 0,
  });

  // Already in step.
  if (!conflict && rec?.owner === userId && rec.version === remote.version) {
    await tx.done;
    return false;
  }

  const editedHere = !!local && (conflict || (!!rec?.dirty && !rec.deleted));
  if (editedHere) {
    // Edited on both sides: keep ours as a copy, take theirs as the plan.
    const siblings = await plans.index("by-entry").getAll(local.entryId);
    const copy: Plan = {
      ...local,
      id: crypto.randomUUID(),
      name: uniquePlanName(siblings, `${local.name} (this device)`.slice(0, 40)),
    };
    void plans.put(copy);
    void syncs.put({ id: copy.id, owner: null, version: null, dirty: true, deleted: false, rev: 1 });
    showToast(`“${local.name}” was also changed on another device. Kept both.`);
  }

  if (incoming) {
    void plans.put(incoming);
    void syncs.put(clean(remote.version));
  } else {
    void plans.delete(remote.id);
    void syncs.delete(remote.id);
  }
  await tx.done;
  return true;
}

/* ---------------- Push ---------------- */

async function push(userId: string): Promise<boolean> {
  const db = await getDb();
  const [allPlans, recs] = await Promise.all([db.getAll("plans"), db.getAll("planSync")]);
  const byId = new Map(recs.map((r) => [r.id, r]));
  // Plans already in the account (the pull has just brought in any from other devices).
  const owned = new Set(recs.filter((r) => r.owner === userId && !r.deleted).map((r) => r.id));
  // Teams the account had plans for before this sync uploaded anything.
  const accountTeams = new Set(allPlans.filter((p) => owned.has(p.id)).map((p) => p.entryId));
  let changed = false;

  // Deletions first, then plans that are new to the account or edited here.
  for (const rec of recs) if (rec.deleted) changed = (await pushDelete(rec, userId)) || changed;
  for (const plan of allPlans) {
    const rec = byId.get(plan.id);
    if (rec && rec.owner === userId && !rec.dirty) continue;
    const accountPlans = allPlans.filter(
      (p) => p.entryId === plan.entryId && p.id !== plan.id && owned.has(p.id),
    );
    changed =
      (await pushPlan(plan, rec, userId, accountPlans, owned, accountTeams.has(plan.entryId))) || changed;
  }
  return changed;
}

async function pushDelete(rec: PlanSync, userId: string): Promise<boolean> {
  const db = await getDb();
  if (rec.owner === userId && rec.version !== null) {
    try {
      await api(`/api/plans/${rec.id}?version=${rec.version}`, { method: "DELETE" });
    } catch (err) {
      // Changed on another device after we deleted it: theirs comes back on the next pull.
      if (!(err instanceof HttpError && (err.status === 409 || err.status === 404))) throw err;
      if (err.status === 409) {
        const { current } = err.body as { current: ServerPlan };
        await db.delete("planSync", rec.id);
        return applyRemote(current, userId);
      }
    }
  }
  await db.delete("planSync", rec.id);
  return false;
}

/**
 * Uploads one plan. `accountPlans` are the account's other plans for the same
 * team; `owned` collects the ids now in the account. `accountHadTeam` says
 * the account already had plans for this team from elsewhere.
 */
async function pushPlan(
  plan: Plan,
  rec: PlanSync | undefined,
  userId: string,
  accountPlans: Plan[],
  owned: Set<string>,
  accountHadTeam: boolean,
): Promise<boolean> {
  const db = await getDb();
  const mine = rec?.owner === userId;
  let changed = false;

  if (!mine) {
    // Signing in on another device: its untouched starter plan isn't worth uploading.
    if (plan.name === DEFAULT_NAME && plan.moves.length === 0 && accountHadTeam) {
      const tx = db.transaction(["plans", "planSync"], "readwrite");
      void tx.objectStore("plans").delete(plan.id);
      void tx.objectStore("planSync").delete(plan.id);
      await tx.done;
      return true;
    }
    // A plan synced to a different account is copied into this one under a new id.
    if (rec?.owner) {
      plan = { ...plan, id: crypto.randomUUID() };
      changed = true;
    }
    const name = uniquePlanName(accountPlans, plan.name);
    if (name !== plan.name) {
      plan = { ...plan, name };
      changed = true;
    }
    if (changed) {
      const tx = db.transaction(["plans", "planSync"], "readwrite");
      if (rec && rec.id !== plan.id) void tx.objectStore("plans").delete(rec.id);
      void tx.objectStore("plans").put(plan);
      await tx.done;
    }
  }

  const rev = rec?.rev ?? 0;
  try {
    const { plan: saved } = await api<{ plan: ServerPlan }>(`/api/plans/${plan.id}`, {
      method: "PUT",
      body: JSON.stringify({ plan, baseVersion: mine ? rec!.version : null }),
    });
    // Only clear "unsynced" if nothing was edited while the upload was in flight.
    const tx = db.transaction("planSync", "readwrite");
    const now = await tx.store.get(plan.id);
    void tx.store.put({
      id: plan.id,
      owner: userId,
      version: saved.version,
      dirty: (now?.rev ?? rev) !== rev,
      deleted: false,
      rev: now?.rev ?? rev,
    });
    if (rec && rec.id !== plan.id) void tx.store.delete(rec.id);
    await tx.done;
    owned.add(plan.id);
  } catch (err) {
    if (!(err instanceof HttpError) || (err.status !== 409 && err.status !== 404)) throw err;
    if (err.status === 409) {
      // The server moved on: keep both (the same as a conflict found while pulling).
      const { current } = err.body as { current: ServerPlan };
      await applyRemote(current, userId, true);
    } else {
      // Not ours on the server (or long gone): upload it as a new plan next time.
      const tx = db.transaction(["plans", "planSync"], "readwrite");
      void tx.objectStore("plans").delete(plan.id);
      const copy = { ...plan, id: crypto.randomUUID() };
      void tx.objectStore("plans").put(copy);
      void tx.objectStore("planSync").delete(plan.id);
      await tx.done;
      again = true;
    }
    return true;
  }
  return changed;
}

/* ---------------- Teams ---------------- */

let linked: string | null = null;

/** The team on screen is linked to the account, so a new device can open it straight away. */
async function linkTeam() {
  const team = usePlanner.getState().team;
  if (!team) return;
  const key = `${useAccount.getState().userId}:${team.entryId}:${team.teamName}`;
  if (linked === key) return;
  await api(`/api/teams/${team.entryId}`, { method: "PUT", body: JSON.stringify({ label: team.teamName }) });
  linked = key;
}

/** A device with no team yet: open the account's, the one with the most recent plan edit. */
async function openAccountTeam() {
  const { teams } = await api<{ teams: { entryId: number; label: string }[] }>("/api/teams");
  if (teams.length === 0) return;
  const plans = await (await getDb()).getAll("plans");
  const latest = plans
    .filter((p) => teams.some((t) => t.entryId === p.entryId))
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (usePlanner.getState().phase === "connect") await connect(latest?.entryId ?? teams[0].entryId);
}
