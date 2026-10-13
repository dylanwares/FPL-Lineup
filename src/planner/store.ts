import { create } from "zustand";
import { readPlans, readTeam, writePlan, writeTeam } from "@/data/db";
import { loadGameData } from "@/data/load";
import type { GameData } from "@/data/model";
import { addMove } from "@/engine/plan";
import type { Move, Plan } from "@/engine/types";
import type { PastPicks, TeamImport } from "@/lib/fpl/types";
import { newPlan, rebasePlan } from "./model";

const ENTRY_KEY = "fpl-lineup:entry";

export type Phase = "booting" | "connect" | "importing" | "ready";
export type PastState = PastPicks | "loading" | "error";

export interface PlannerState {
  phase: Phase;
  data: GameData | null;
  dataError: string | null;
  team: TeamImport | null;
  plan: Plan | null;
  /** The gameweek on screen. */
  gw: number;
  /** Player whose sheet is open. */
  sheetPlayer: number | null;
  importError: string | null;
  /** A background re-import (after a deadline) failed. */
  refreshError: string | null;
  refreshing: boolean;
  past: Record<number, PastState>;
}

export const usePlanner = create<PlannerState>(() => ({
  phase: "booting",
  data: null,
  dataError: null,
  team: null,
  plan: null,
  gw: 1,
  sheetPlayer: null,
  importError: null,
  refreshError: null,
  refreshing: false,
  past: {},
}));

const set = usePlanner.setState;
const get = usePlanner.getState;

/* ---------------- Device storage helpers ---------------- */

function storedEntryId(): number | null {
  try {
    const raw = localStorage.getItem(ENTRY_KEY);
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

function rememberEntryId(id: number | null) {
  try {
    if (id) localStorage.setItem(ENTRY_KEY, String(id));
    else localStorage.removeItem(ENTRY_KEY);
  } catch {
    // Storage blocked: the team is just not remembered.
  }
}

function persistPlan(plan: Plan) {
  writePlan(plan).catch((err: unknown) => console.warn("Couldn't save plan", err));
}

/* ---------------- Network ---------------- */

async function fetchTeam(entryId: number): Promise<TeamImport> {
  const res = await fetch(`/api/team/${entryId}`);
  const body = (await res.json().catch(() => ({}))) as TeamImport & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Couldn't load that team.");
  return body;
}

/** Whether the plan's first deadline has passed, so the squad needs re-importing. */
function isStale(team: TeamImport, data: GameData): boolean {
  const event = data.events[team.planFromGw - 1];
  return !event || event.deadline <= Date.now();
}

/* ---------------- Actions ---------------- */

/** Loads game data, then the remembered team and plan from the device. No network if both are cached. */
export async function boot() {
  try {
    const { data } = await loadGameData({ onUpdate: (fresh) => set({ data: fresh.data }) });
    set({ data, dataError: null });
  } catch (err) {
    set({ dataError: err instanceof Error ? err.message : String(err) });
    return;
  }

  const entryId = storedEntryId();
  if (!entryId) return set({ phase: "connect" });

  const [team, plans] = await Promise.all([
    readTeam(entryId).catch(() => undefined),
    readPlans(entryId).catch(() => [] as Plan[]),
  ]);
  if (!team) return connect(entryId);

  const plan = plans.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? newPlan(team);
  set({ phase: "ready", team, plan, gw: team.planFromGw });
  if (isStale(team, get().data!)) void refreshTeam();
}

/** Imports a team by FPL ID and opens its plan (creating one on first import). */
export async function connect(entryId: number) {
  set({ phase: "importing", importError: null });
  try {
    const team = await fetchTeam(entryId);
    const existing = (await readPlans(entryId).catch(() => [] as Plan[])).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )[0];
    const plan = existing ? rebasePlan(existing, team) : newPlan(team);
    await writeTeam(team).catch(() => {});
    persistPlan(plan);
    rememberEntryId(entryId);
    set({ phase: "ready", team, plan, gw: team.planFromGw, past: {}, sheetPlayer: null });
  } catch (err) {
    set({ phase: "connect", importError: err instanceof Error ? err.message : String(err) });
  }
}

/** Re-imports the current team (e.g. a deadline has passed) and rebases the plan. */
export async function refreshTeam() {
  const { team, plan } = get();
  if (!team || !plan) return;
  set({ refreshing: true, refreshError: null });
  try {
    const fresh = await fetchTeam(team.entryId);
    const rebased = rebasePlan(plan, fresh);
    await writeTeam(fresh).catch(() => {});
    persistPlan(rebased);
    const gw = Math.max(get().gw, fresh.planFromGw);
    set({ team: fresh, plan: rebased, gw, past: {}, refreshing: false });
  } catch (err) {
    set({ refreshing: false, refreshError: err instanceof Error ? err.message : String(err) });
  }
}

/** Forgets the team on this device (its plans stay saved for next time). */
export function disconnect() {
  rememberEntryId(null);
  set({ phase: "connect", team: null, plan: null, past: {}, sheetPlayer: null, importError: null });
}

export function setGw(gw: number) {
  const { team, data } = get();
  if (!team || !data) return;
  const last = data.events.length;
  const next = Math.min(last, Math.max(team.startedGw, gw));
  set({ gw: next, sheetPlayer: null });
  if (next < team.planFromGw) void loadPast(next);
}

export function stepGw(delta: number) {
  setGw(get().gw + delta);
}

/** Fetches the picks for a past gameweek once (read-only view). */
export async function loadPast(gw: number) {
  const { team, past } = get();
  if (!team || past[gw] === "loading" || (past[gw] && past[gw] !== "error")) return;
  set({ past: { ...get().past, [gw]: "loading" } });
  try {
    const res = await fetch(`/api/team/${team.entryId}/picks/${gw}`);
    if (!res.ok) throw new Error(String(res.status));
    const picks = (await res.json()) as PastPicks;
    set({ past: { ...get().past, [gw]: picks } });
  } catch {
    set({ past: { ...get().past, [gw]: "error" } });
  }
}

export function openSheet(player: number) {
  set({ sheetPlayer: player });
}

export function closeSheet() {
  set({ sheetPlayer: null });
}

/** A move without its gameweek (defaults to the one on screen). */
export type MoveInput = Move extends infer M
  ? M extends Move
    ? Omit<M, "gw"> & { gw?: number }
    : never
  : never;

/** Applies a move to the gameweek on screen and saves the plan on the device. */
export function applyMove(move: MoveInput) {
  const { plan, gw } = get();
  if (!plan) return;
  const next = addMove(plan, { ...move, gw: move.gw ?? gw } as Move);
  set({ plan: next });
  persistPlan(next);
}

export function setCaptain(player: number) {
  applyMove({ type: "captain", player });
}

export function setVice(player: number) {
  applyMove({ type: "vice", player });
}
