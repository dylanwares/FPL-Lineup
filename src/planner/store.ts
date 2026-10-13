import { create } from "zustand";
import { readPlans, readTeam, writePlan, writeTeam } from "@/data/db";
import { loadGameData } from "@/data/load";
import type { GameData } from "@/data/model";
import { addMove, resetGw, stateAt } from "@/engine/plan";
import { canSwap } from "@/engine/squad";
import type { Move, Plan } from "@/engine/types";
import type { PastPicks, TeamImport } from "@/lib/fpl/types";
import { engineContext, newPlan, planResult, rebasePlan } from "./model";

const ENTRY_KEY = "fpl-lineup:entry";

export type Phase = "booting" | "connect" | "importing" | "ready";
export type PastState = PastPicks | "loading" | "error";
export type Mode = "none" | "sub" | "transfer";

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
  /** Sub or Transfer mode; stays on after each move. */
  mode: Mode;
  /** Sub mode: the player picked first. Transfer mode: the player being sold (opens the player list). */
  selected: number | null;
  /** The mode was started from a player's sheet for one move: it switches off after that move (or a cancel). */
  oneShot: boolean;
  toasts: Toast[];
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
  mode: "none",
  selected: null,
  oneShot: false,
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
  set({
    phase: "connect",
    team: null,
    plan: null,
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
  set({ plan, selected: null });
  persistPlan(plan);
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
  const state = currentState();
  if (!state || !data) return;
  const ctx = engineContext(data);
  if (!canSwap(state.slots, selected, id, ctx.position, ctx.rules)) return set({ selected: id });

  applyMove({ type: "sub", a: selected, b: id });
  clearSelection();
  set({ toasts: [] }); // the "tap a player to swap" prompt is done
  const after = currentState();
  if (after && after.captain !== state.captain)
    showToast(`Captain's armband passed to ${playerName(after.captain)}`);
  else if (after && after.vice !== state.vice)
    showToast(`Vice-captaincy passed to ${playerName(after.vice)}`);
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

/** Clears every move in the gameweek on screen, with Undo. */
export function resetCurrentGw() {
  const { plan, gw } = get();
  if (!plan || !plan.moves.some((m) => m.gw === gw)) return;
  const before = plan;
  const next = resetGw(plan, gw);
  set({ plan: next, selected: null });
  persistPlan(next);
  showToast(`GW${gw} reset`, { label: "Undo", run: () => restorePlan(before) });
}
