import { computeGw, type Carry, type PlanResult } from "./plan";
import { canSwap } from "./squad";
import {
  BENCH_GK_SLOT,
  emptySlot,
  isEmptySlot,
  STARTERS,
  type EngineContext,
  type GwState,
  type Move,
  type Plan,
} from "./types";

/**
 * Rewrites one gameweek's moves as the fewest steps that reach the same end
 * state, in the order you'd make them in the FPL app:
 *
 *   chip → transfers (out → in) → subs (XI, then bench order) → captain → vice
 *
 * Undone work disappears (a swap and its reverse, a buyback), chains collapse
 * (A→B→C becomes A→C) and repeated armband changes keep only the last.
 * The result is replayed and only returned if it reproduces the same squad,
 * starting XI, bench order, armbands, chip and transfer count; otherwise
 * `null`, and the caller keeps the original moves.
 */
export function compactGw(gw: number, start: Carry, moves: Move[], ctx: EngineContext): Move[] | null {
  const end = computeGw(gw, start, moves, ctx);
  const steps: Move[] = [];

  if (end.chip) steps.push({ type: "chip", gw, chip: end.chip });

  // Transfers: pair each slot that changed hands with what it ends up holding,
  // in the same position. Removing a player and leaving the slot empty is one
  // step; any other pair is a transfer (out of an empty slot fills it), plus a
  // removal if the slot ends up empty. Slots are taken in starting-slot and
  // final-slot order, so the incoming player usually lands straight in the
  // slot they finish in.
  const startSet = new Set(start.slots);
  const endSet = new Set(end.slots);
  for (const pos of ["GKP", "DEF", "MID", "FWD"] as const) {
    let outs = start.slots
      .filter((id) => !endSet.has(id) && ctx.position(id) === pos)
      .sort((a, b) => start.slots.indexOf(a) - start.slots.indexOf(b));
    let ins = end.slots
      .filter((id) => !startSet.has(id) && ctx.position(id) === pos)
      .sort((a, b) => end.slots.indexOf(a) - end.slots.indexOf(b));
    if (outs.length !== ins.length) return null;
    const removed = outs.filter((id) => ins.includes(emptySlot(id)));
    for (const player of removed) steps.push({ type: "remove", gw, player });
    outs = outs.filter((id) => !removed.includes(id));
    ins = ins.filter((id) => !removed.includes(-id));
    outs.forEach((out, i) => {
      const into = ins[i];
      const player = isEmptySlot(into) ? -into : into;
      steps.push({ type: "transfer", gw, out, in: player });
      if (isEmptySlot(into)) steps.push({ type: "remove", gw, player });
    });
  }

  // Subs: first make the starting XI the right set of players, then fix the bench order.
  let slots = computeGw(gw, start, steps, ctx).slots;
  const targetXi = new Set(end.slots.slice(0, STARTERS));
  const sub = (a: number, b: number) => {
    steps.push({ type: "sub", gw, a, b });
    const i = slots.indexOf(a);
    const j = slots.indexOf(b);
    slots = slots.slice();
    [slots[i], slots[j]] = [slots[j], slots[i]];
  };

  for (let guard = 0; guard < STARTERS; guard++) {
    const comingOn = slots.slice(STARTERS).filter((id) => targetXi.has(id));
    const goingOff = slots.slice(0, STARTERS).filter((id) => !targetXi.has(id));
    if (comingOn.length === 0) break;
    // Of the legal swaps, prefer one that drops the outgoing player straight into
    // the bench spot they finish in (saving a reorder later), then like-for-like.
    const score = ([off, on]: readonly [number, number]) =>
      (slots.indexOf(on) === end.slots.indexOf(off) ? 2 : 0) +
      (ctx.position(off) === ctx.position(on) ? 1 : 0);
    const legal = goingOff
      .flatMap((off) => comingOn.map((on) => [off, on] as const))
      .filter(([off, on]) => canSwap(slots, off, on, ctx.position, ctx.rules))
      .sort((x, y) => score(y) - score(x));
    if (legal.length === 0) return null;
    sub(legal[0][0], legal[0][1]);
  }

  for (let k = BENCH_GK_SLOT + 1; k < slots.length; k++) {
    if (slots[k] !== end.slots[k]) {
      const want = end.slots[k];
      if (slots.indexOf(want) < STARTERS) return null;
      sub(slots[k], want);
    }
  }

  // Armbands last: transfers and subs may have moved them on.
  let state = computeGw(gw, start, steps, ctx);
  if (state.captain !== end.captain) {
    steps.push({ type: "captain", gw, player: end.captain });
    state = computeGw(gw, start, steps, ctx);
  }
  if (state.vice !== end.vice) {
    steps.push({ type: "vice", gw, player: end.vice });
    state = computeGw(gw, start, steps, ctx);
  }

  return sameOutcome(state, end) ? steps : null;
}

function sameOutcome(a: GwState, b: GwState): boolean {
  const xi = (s: GwState) => [...s.slots.slice(0, STARTERS)].sort((x, y) => x - y).join();
  return (
    xi(a) === xi(b) &&
    a.slots.slice(STARTERS).join() === b.slots.slice(STARTERS).join() &&
    a.captain === b.captain &&
    a.vice === b.vice &&
    a.chip === b.chip &&
    a.transfers === b.transfers &&
    a.bank === b.bank &&
    a.cost === b.cost &&
    a.warnings.every((w) => w.kind !== "invalid-move")
  );
}

/**
 * Compacts one gameweek of a plan in place of its moves (see compactGw).
 * `result` must be computePlan(plan, …) for this same plan. Moves in other
 * gameweeks are untouched, and the end state (and so every later gameweek)
 * is identical.
 */
export function compactPlanGw(plan: Plan, gw: number, result: PlanResult): Plan {
  const i = gw - plan.base.gw;
  const start = result.carries[i];
  if (!start || result.plan !== plan) return plan;
  const moves = plan.moves.filter((m) => m.gw === gw);
  const compact = compactGw(gw, start, moves, result.ctx);
  // Only ever an improvement: never more steps than were made.
  if (!compact || compact.length > moves.length || JSON.stringify(compact) === JSON.stringify(moves)) {
    return plan;
  }
  return { ...plan, moves: [...plan.moves.filter((m) => m.gw !== gw), ...compact] };
}
