import { create } from "zustand";
import type { ChipName } from "@/config/rules";
import { deletePlan as deleteStoredPlan, readPlans, readTeam, writePlan, writeTeam } from "@/data/db";
import { loadGameData } from "@/data/load";
import type { GameData } from "@/data/model";
import { cancelChip, playChip } from "@/engine/chips";
import { addMove, removeMove, resetGw, stateAt } from "@/engine/plan";
import { compactPlanGw } from "@/engine/compact";
import { canSwap } from "@/engine/squad";
import type { Move, Plan } from "@/engine/types";
import type { PastPicks, TeamImport } from "@/lib/fpl/types";
import { DEFAULT_METRIC, isMetric, type Metric } from "./metrics";
import {
  CHIP_NAMES,
  copyPlan,
  engineContext,
  MAX_PLAN_NAME,
  newPlan,
  planResult,
  rebasePlan,
  uniquePlanName,
} from "./model";

const ENTRY_KEY = "fpl-lineup:entry";
const METRIC_KEY = "fpl-lineup:metric";
const PHOTOS_KEY = "fpl-lineup:photos";
const planKey = (entryId: number) => `fpl-lineup:plan:${entryId}`;

export type Phase = "booting" | "connect" | "importing" | "ready";
export type PastState = PastPicks | "loading" | "error";
export type Mode = "none" | "sub" | "transfer";
/** The plan dropdown, the ⋯ menu, or one of the plan dialogs. */
export type PlanUi = "list" | "actions" | "create" | "rename" | "delete" | null;

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export interface PlannerState {
  phase: Phase;
  data: GameData | null;
  dataError: string | null;
  team: TeamImport | null;
  /** The plan on screen. */
  plan: Plan | null;
  /** Every plan for this team, in creation order (includes `plan`). */
  plans: Plan[];
  planUi: PlanUi;
  /** The pill under each player. */
  metric: Metric;
  /** Player photos instead of shirts. */
  photos: boolean;
  /** The gameweek on screen. */
  gw: number;
  /** Player whose sheet is open. */
  sheetPlayer: number | null;
  importError: string | null;
  /** A background re-import (after a deadline) failed. */
  refreshError: string | null;
  refreshing: boolean;
  past: Record<number, PastState>;
  /** Sub or Transfer mode; stays on after each move. */
  mode: Mode;
  /** Sub mode: the player picked first. Transfer mode: the player being sold (opens the player list). */
  selected: number | null;
  /** The mode was started from a player's sheet for one move: it switches off after that move (or a cancel). */
  oneShot: boolean;
  /** Press-and-hold drag: the player being dragged, and the player under the finger. */
  dragFrom: number | null;
  dragOver: number | null;
  toasts: Toast[];
}

export const usePlanner = create<PlannerState>(() => ({
  phase: "booting",
  data: null,
  dataError: null,
  team: null,
  plan: null,
  plans: [],
  planUi: null,
  metric: DEFAULT_METRIC,
  photos: false,
  gw: 1,
  sheetPlayer: null,
  importError: null,
  refreshError: null,
  refreshing: false,
  past: {},
  mode: "none",
  selected: null,
  oneShot: false,
  dragFrom: null,
  dragOver: null,
  toasts: [],
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

function storedPlanId(entryId: number): string | null {
  try {
    return localStorage.getItem(planKey(entryId));
  } catch {
    return null;
  }
}

function rememberPlanId(plan: Plan) {
  try {
    localStorage.setItem(planKey(plan.entryId), plan.id);
  } catch {
    // Storage blocked: the most recently edited plan opens next time.
  }
}

const byCreated = (a: Plan, b: Plan) => a.createdAt - b.createdAt;

/** The plan to open: the one last on screen on this device, else the most recently edited. */
function pickPlan(plans: Plan[], entryId: number): Plan | undefined {
  const id = storedPlanId(entryId);
  return (
    plans.find((p) => p.id === id) ??
    plans.reduce<Plan | undefined>((a, b) => (!a || b.updatedAt > a.updatedAt ? b : a), undefined)
  );
}

/** Saves an edit to a plan, keeping the plan list in step. */
function commitPlan(next: Plan) {
  const { plans } = get();
  set({
    plan: next,
    plans: plans.some((p) => p.id === next.id)
      ? plans.map((p) => (p.id === next.id ? next : p))
      : [...plans, next].sort(byCreated),
  });
  persistPlan(next);
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
  loadViewPrefs();
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

  if (plans.length === 0) plans.push(newPlan(team));
  const plan = pickPlan(plans, entryId)!;
  set({ phase: "ready", team, plan, plans: plans.sort(byCreated), gw: team.planFromGw });
  if (isStale(team, get().data!)) void refreshTeam();
}

/** Imports a team by FPL ID and opens its plan (creating one on first import). */
export async function connect(entryId: number) {
  set({ phase: "importing", importError: null });
  try {
    const team = await fetchTeam(entryId);
    const stored = await readPlans(entryId).catch(() => [] as Plan[]);
    const plans = stored.length ? stored.map((p) => rebasePlan(p, team)) : [newPlan(team)];
    await writeTeam(team).catch(() => {});
    plans.forEach(persistPlan);
    rememberEntryId(entryId);
    const plan = pickPlan(plans, entryId)!;
    set({
      phase: "ready",
      team,
      plan,
      plans: plans.sort(byCreated),
      gw: team.planFromGw,
      past: {},
      sheetPlayer: null,
    });
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
    // Every plan for the team moves onto the new squad, not just the one on screen.
    const plans = get().plans.map((p) => rebasePlan(p, fresh));
    await writeTeam(fresh).catch(() => {});
    plans.forEach(persistPlan);
    const gw = Math.max(get().gw, fresh.planFromGw);
    const current = plans.find((p) => p.id === get().plan?.id) ?? plans[0];
    set({ team: fresh, plan: current, plans, gw, past: {}, refreshing: false });
  } catch (err) {
    set({ refreshing: false, refreshError: err instanceof Error ? err.message : String(err) });
  }
}

/** Forgets the team on this device (its plans stay saved for next time). */
export function disconnect() {
  rememberEntryId(null);
  set({
    phase: "connect",
    team: null,
    plan: null,
    plans: [],
    planUi: null,
    past: {},
    sheetPlayer: null,
    importError: null,
    mode: "none",
    selected: null,
    oneShot: false,
  });
}

export function setGw(gw: number) {
  const { team, data } = get();
  if (!team || !data) return;
  const last = data.events.length;
  const next = Math.min(last, Math.max(team.startedGw, gw));
  const past = next < team.planFromGw;
  // Past gameweeks are read-only, so modes switch off there.
  const leaveMode = past || get().oneShot;
  set({
    gw: next,
    sheetPlayer: null,
    selected: null,
    ...(leaveMode ? { mode: "none" as const, oneShot: false } : {}),
  });
  if (past) void loadPast(next);
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

/**
 * Applies a move to the gameweek on screen and saves the plan on the device.
 * The gameweek's moves are then compacted to the fewest steps with the same
 * result, so History reads as a short list to follow in the FPL app.
 */
export function applyMove(move: MoveInput) {
  const { plan, gw, data } = get();
  if (!plan) return;
  const target = move.gw ?? gw;
  let next = addMove(plan, { ...move, gw: target } as Move);
  if (data) next = compactPlanGw(next, target, planResult(next, data));
  commitPlan(next);
}

export function setCaptain(player: number) {
  applyMove({ type: "captain", player });
}

export function setVice(player: number) {
  applyMove({ type: "vice", player });
}

/* ---------------- Sub & transfer modes ---------------- */

let toastId = 0;

export function showToast(message: string, action?: Toast["action"]) {
  const toast = { id: ++toastId, message, action };
  // One toast at a time keeps the screen calm; a new move replaces the last message.
  set({ toasts: [toast] });
  return toast.id;
}

export function dismissToast(id: number) {
  set({ toasts: get().toasts.filter((t) => t.id !== id) });
}

/** Replaces the plan wholesale (Undo restores the plan as it was before a move). */
function restorePlan(plan: Plan) {
  set({ selected: null });
  commitPlan(plan);
}

/** Switches Sub or Transfer mode on (or off if it's already on). Only one mode at a time. */
export function toggleMode(mode: Exclude<Mode, "none">) {
  set({ mode: get().mode === mode ? "none" : mode, selected: null, sheetPlayer: null, oneShot: false });
}

export function exitMode() {
  set({ mode: "none", selected: null, oneShot: false });
}

/**
 * Starts a sub or transfer for one player, from their sheet: the player is
 * already picked, and the mode switches off again after the move.
 */
export function startMoveFor(player: number, mode: Exclude<Mode, "none">) {
  set({ mode, selected: player, sheetPlayer: null, oneShot: true });
  if (mode === "sub") {
    showToast(`Tap a highlighted player to swap with ${playerName(player)}`, {
      label: "Cancel",
      run: clearSelection,
    });
  }
}

/** Ends the current pick. A one-off move from the sheet also leaves the mode. */
export function clearSelection() {
  set(get().oneShot ? { selected: null, mode: "none", oneShot: false } : { selected: null });
}

function currentState() {
  const { plan, data, gw } = get();
  if (!plan || !data) return null;
  return stateAt(planResult(plan, data), gw) ?? null;
}

function playerName(id: number) {
  return get().data?.playerById.get(id)?.name ?? "player";
}

/**
 * A tap on a pitch or bench player. Outside the modes it opens the player
 * sheet; in Sub mode the first tap selects and the second swaps (or cancels);
 * in Transfer mode it picks the player to sell, which opens the player list.
 */
export function tapPlayer(id: number) {
  const { mode, selected, data, team, gw } = get();
  const readOnly = !team || gw < team.planFromGw;
  if (mode === "none" || readOnly) return openSheet(id);
  if (mode === "transfer") return set({ selected: selected === id ? null : id });

  if (selected === null) return set({ selected: id });
  if (selected === id) return clearSelection();
  if (!data || !swapPlayers(selected, id)) return set({ selected: id });
  clearSelection();
}

/**
 * Swaps two squad players in the gameweek on screen if that's a legal sub.
 * Reports armband handovers. Returns false (and changes nothing) otherwise.
 */
function swapPlayers(a: number, b: number): boolean {
  const { data } = get();
  const state = currentState();
  if (!state || !data) return false;
  const ctx = engineContext(data);
  if (!canSwap(state.slots, a, b, ctx.position, ctx.rules)) return false;

  applyMove({ type: "sub", a, b });
  set({ toasts: [] }); // any "tap a player to swap" prompt is done
  const after = currentState();
  if (after && after.captain !== state.captain)
    showToast(`Captain's armband passed to ${playerName(after.captain)}`);
  else if (after && after.vice !== state.vice)
    showToast(`Vice-captaincy passed to ${playerName(after.vice)}`);
  return true;
}

/* ---------------- Press-and-hold drag to sub ---------------- */

/** Whether players in the gameweek on screen can be dragged (planned gameweeks, outside Transfer mode). */
export function canDrag(): boolean {
  const { team, gw, mode } = get();
  return !!team && gw >= team.planFromGw && mode !== "transfer";
}

export function startDrag(id: number) {
  set({ dragFrom: id, dragOver: null, selected: null, sheetPlayer: null });
}

export function setDragOver(id: number | null) {
  if (get().dragOver !== id) set({ dragOver: id });
}

/** Drops on the player under the finger: subs them if legal, otherwise nothing changes. */
export function endDrag() {
  const { dragFrom, dragOver } = get();
  set({ dragFrom: null, dragOver: null });
  if (dragFrom !== null && dragOver !== null && dragOver !== dragFrom) swapPlayers(dragFrom, dragOver);
}

export function cancelDrag() {
  set({ dragFrom: null, dragOver: null });
}

/** Transfer mode: buys `incoming` for the selected player, keeping the slot. */
export function buyPlayer(incoming: number) {
  const { plan, selected } = get();
  if (!plan || selected === null) return;
  const before = plan;
  applyMove({ type: "transfer", out: selected, in: incoming });
  clearSelection();
  showToast(`Sold ${playerName(selected)}, bought ${playerName(incoming)}`, {
    label: "Undo",
    run: () => restorePlan(before),
  });
}

/** Removes one planned change (History's ×), with Undo. */
export function removeMoveAt(index: number, label: string) {
  const { plan } = get();
  if (!plan || !plan.moves[index]) return;
  const before = plan;
  const next = removeMove(plan, index);
  set({ selected: null });
  commitPlan(next);
  showToast(`Removed: ${label}`, { label: "Undo", run: () => restorePlan(before) });
}

/** Clears every move in the gameweek on screen, with Undo. */
export function resetCurrentGw() {
  const { plan, gw } = get();
  if (!plan || !plan.moves.some((m) => m.gw === gw)) return;
  const before = plan;
  const next = resetGw(plan, gw);
  set({ selected: null });
  commitPlan(next);
  showToast(`GW${gw} reset`, { label: "Undo", run: () => restorePlan(before) });
}

/* ---------------- Chips ---------------- */

const gwList = (gws: number[]) => gws.map((g) => `GW${g}`).join(", ");

/**
 * Plays a chip in the gameweek on screen, or cancels it if it's already
 * played there. A chip planned in a clashing gameweek moves here. With Undo.
 */
export function toggleChip(name: ChipName) {
  const { plan, data, gw, team } = get();
  if (!plan || !data || !team || gw < team.planFromGw) return;
  const result = planResult(plan, data);
  const state = stateAt(result, gw);
  if (!state) return;

  let next: Plan;
  let message: string;
  if (state.chip === name) {
    next = cancelChip(plan, gw);
    message = `${CHIP_NAMES[name]} cancelled for GW${gw}`;
  } else {
    const played = playChip(plan, name, gw, result);
    if (!played) return;
    next = played.plan;
    message = played.movedFrom.length
      ? `${CHIP_NAMES[name]} moved from ${gwList(played.movedFrom)} to GW${gw}`
      : state.chip
        ? `${CHIP_NAMES[name]} played in GW${gw} instead of ${CHIP_NAMES[state.chip]}`
        : `${CHIP_NAMES[name]} played in GW${gw}`;
  }
  next = compactPlanGw(next, gw, planResult(next, data));
  const before = plan;
  set({ selected: null });
  commitPlan(next);
  showToast(message, { label: "Undo", run: () => restorePlan(before) });
}

/* ---------------- Named plans ---------------- */

export function openPlanUi(ui: PlanUi) {
  set({ planUi: ui, sheetPlayer: null });
}

export function closePlanUi() {
  set({ planUi: null });
}

/** Shows another of the team's plans. Undo toasts belong to the old plan, so they go. */
export function selectPlan(id: string) {
  const plan = get().plans.find((p) => p.id === id);
  set({ planUi: null });
  if (!plan || plan.id === get().plan?.id) return;
  rememberPlanId(plan);
  set({ plan, selected: null, sheetPlayer: null, dragFrom: null, dragOver: null, toasts: [] });
}

function addPlan(plan: Plan, message: string) {
  commitPlan(plan);
  rememberPlanId(plan);
  set({ selected: null, sheetPlayer: null, toasts: [] });
  showToast(message);
}

/** A new plan from the current squad with no moves, named in the "Name your plan" box. */
export function createPlan(name: string) {
  const { team, plans } = get();
  const trimmed = name.trim().slice(0, MAX_PLAN_NAME);
  set({ planUi: null });
  if (!team || !trimmed) return;
  const plan = newPlan(team, uniquePlanName(plans, trimmed));
  addPlan(plan, `Created ${plan.name}`);
}

/** A copy of the plan on screen, moves and all, to try another route. */
export function duplicatePlan() {
  const { plan, plans } = get();
  if (!plan) return;
  const copy = copyPlan(plan, uniquePlanName(plans, `${plan.name} copy`.slice(0, MAX_PLAN_NAME)));
  set({ planUi: null });
  addPlan(copy, `Duplicated as ${copy.name}`);
}

export function renamePlan(name: string) {
  const { plan } = get();
  const trimmed = name.trim().slice(0, MAX_PLAN_NAME);
  set({ planUi: null });
  if (!plan || !trimmed || trimmed === plan.name) return;
  commitPlan({ ...plan, name: trimmed, updatedAt: Date.now() });
}

/**
 * Deletes the plan on screen (after the confirm dialog) and opens the most
 * recently edited of the rest. Deleting the last plan leaves a fresh one.
 * Undo puts it back while the toast is up.
 */
export function deleteCurrentPlan() {
  const { plan, plans, team } = get();
  set({ planUi: null });
  if (!plan || !team) return;
  let rest = plans.filter((p) => p.id !== plan.id);
  const fresh = rest.length === 0 ? newPlan(team) : null;
  if (fresh) rest = [fresh];
  const next = rest.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));

  deleteStoredPlan(plan.id).catch((err: unknown) => console.warn("Couldn't delete plan", err));
  if (fresh) persistPlan(fresh);
  rememberPlanId(next);
  set({ plan: next, plans: rest, selected: null, sheetPlayer: null, toasts: [] });

  showToast(`Deleted ${plan.name}`, {
    label: "Undo",
    run: () => {
      if (fresh) deleteStoredPlan(fresh.id).catch(() => {});
      const restored = [...get().plans.filter((p) => p.id !== fresh?.id), plan].sort(byCreated);
      persistPlan(plan);
      rememberPlanId(plan);
      set({ plan, plans: restored, selected: null });
    },
  });
}

/** Refresh from the ⋯ menu: the menu closes and a toast confirms (errors show under the plan bar). */
export async function refreshTeamFromMenu() {
  set({ planUi: null });
  await refreshTeam();
  if (!get().refreshError) showToast("Team refreshed from FPL");
}

/* ---------------- Metric and photos ---------------- */

/** The metric and Shirts/Photos choice from last time on this device. */
function loadViewPrefs() {
  try {
    const metric = localStorage.getItem(METRIC_KEY);
    set({
      metric: isMetric(metric) ? metric : DEFAULT_METRIC,
      photos: localStorage.getItem(PHOTOS_KEY) === "1",
    });
  } catch {
    // Storage blocked: defaults.
  }
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
}

export function setMetric(metric: Metric) {
  set({ metric });
  remember(METRIC_KEY, metric);
}

export function setPhotos(photos: boolean) {
  set({ photos });
  remember(PHOTOS_KEY, photos ? "1" : "0");
}
