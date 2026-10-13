import { chipAvailability } from "./chips";
import { nextFreeTransfers, sellingPrice, transferCost } from "./money";
import { canSwap, clubCounts, isStarter } from "./squad";
import type { ChipUse, EngineContext, GwState, Move, Plan, Slots, Warning } from "./types";
import { STARTERS } from "./types";

/** What one gameweek starts from: the previous gameweek's end (or the snapshot). */
interface Carry {
  slots: Slots;
  captain: number;
  vice: number;
  purchase: Record<number, number>;
  bank: number;
  freeTransfers: number;
  chipsUsed: ChipUse[];
}

function movesByGw(moves: Move[]): Map<number, Move[]> {
  const map = new Map<number, Move[]>();
  for (const m of moves) {
    const list = map.get(m.gw);
    if (list) list.push(m);
    else map.set(m.gw, [m]);
  }
  return map;
}

/** Folds one gameweek's moves onto its starting state. Pure. */
export function computeGw(gw: number, start: Carry, moves: Move[], ctx: EngineContext): GwState {
  const { rules } = ctx;
  const warnings: Warning[] = [];
  const invalid = (move: Move, reason: string) => warnings.push({ kind: "invalid-move", move, reason });

  let slots = start.slots.slice();
  let { captain, vice } = start;
  let chip: GwState["chip"] = null;

  for (const move of moves) {
    switch (move.type) {
      case "chip": {
        if (move.chip === null) {
          chip = null;
        } else if (chipAvailability(move.chip, gw, start.chipsUsed, rules) !== "available") {
          invalid(move, "Chip not available this gameweek");
        } else {
          chip = move.chip;
        }
        break;
      }
      case "transfer": {
        const i = slots.indexOf(move.out);
        if (i < 0) invalid(move, "Player is not in the squad");
        else if (slots.includes(move.in)) invalid(move, "Player is already in the squad");
        else if (ctx.position(move.in) !== ctx.position(move.out)) invalid(move, "Positions differ");
        else {
          // The new player takes the same slot, armband included.
          slots[i] = move.in;
          if (captain === move.out) captain = move.in;
          if (vice === move.out) vice = move.in;
        }
        break;
      }
      case "sub": {
        if (!canSwap(slots, move.a, move.b, ctx.position, rules)) {
          invalid(move, "Not a valid substitution");
          break;
        }
        const ia = slots.indexOf(move.a);
        const ib = slots.indexOf(move.b);
        slots = slots.slice();
        [slots[ia], slots[ib]] = [slots[ib], slots[ia]];
        // An armband moved to the bench passes to the player coming in.
        for (const [benched, incoming] of [
          [move.a, move.b],
          [move.b, move.a],
        ] as const) {
          if (slots.indexOf(benched) >= STARTERS) {
            if (captain === benched) captain = incoming;
            if (vice === benched) vice = incoming;
          }
        }
        break;
      }
      case "captain":
      case "vice": {
        if (!isStarter(slots, move.player)) {
          invalid(move, "Only starters can wear the armband");
          break;
        }
        if (move.type === "captain") {
          if (vice === move.player) vice = captain;
          captain = move.player;
        } else {
          if (captain === move.player) captain = vice;
          vice = move.player;
        }
        break;
      }
    }
  }

  // Economics come from the net change over the week, so chains (A→B→C) count
  // once and buying back a player sold this week cancels both moves.
  const startSet = new Set(start.slots);
  const endSet = new Set(slots);
  const sold = start.slots.filter((id) => !endSet.has(id));
  const bought = slots.filter((id) => !startSet.has(id));

  let bank = start.bank;
  const purchase = { ...start.purchase };
  for (const id of sold) {
    bank += sellingPrice(start.purchase[id] ?? ctx.price(id), ctx.price(id));
    delete purchase[id];
  }
  for (const id of bought) {
    bank -= ctx.price(id);
    purchase[id] = ctx.price(id);
  }

  const transfers = bought.length;
  const cost = transferCost(start.freeTransfers, transfers, chip, rules);
  const chipsUsed = chip ? [...start.chipsUsed, { name: chip, gw }] : start.chipsUsed;

  if (bank < 0) warnings.push({ kind: "over-budget", amount: -bank });
  for (const [team, count] of clubCounts(slots, ctx.team)) {
    if (count > rules.squad.maxPerClub) warnings.push({ kind: "club-limit", team, count });
  }

  return {
    gw,
    slots,
    captain,
    vice,
    purchase,
    bank,
    freeTransfers: start.freeTransfers,
    transfers,
    cost,
    chip,
    chipsUsed,
    sold,
    bought,
    warnings,
  };
}

/** The state the following gameweek starts from. A Free Hit squad reverts. */
function carryAfter(state: GwState, start: Carry, ctx: EngineContext): Carry {
  const freeTransfers = nextFreeTransfers(
    state.freeTransfers,
    state.transfers,
    state.chip,
    state.gw + 1,
    ctx.rules,
  );
  const squad = state.chip === "freehit" ? start : state;
  return {
    slots: squad.slots,
    captain: squad.captain,
    vice: squad.vice,
    purchase: squad.purchase,
    bank: squad.bank,
    freeTransfers,
    chipsUsed: state.chipsUsed,
  };
}

export interface PlanResult {
  plan: Plan;
  ctx: EngineContext;
  /** Index 0 is plan.base.gw. */
  states: GwState[];
  /** Starting carry per gameweek, kept so later edits can resume mid-season. */
  carries: Carry[];
}

/**
 * Computes every planned gameweek. Pass the previous result to reuse the
 * gameweeks before the earliest change: an edit in GW N recomputes N…38 only.
 */
export function computePlan(plan: Plan, ctx: EngineContext, prev?: PlanResult): PlanResult {
  const base = plan.base;
  const byGw = movesByGw(plan.moves);
  const states: GwState[] = [];
  const carries: Carry[] = [];

  let from = 0;
  if (prev && prev.ctx === ctx && prev.plan.base === base) {
    const prevByGw = movesByGw(prev.plan.moves);
    const total = prev.states.length;
    while (from < total && sameMoves(prevByGw.get(base.gw + from), byGw.get(base.gw + from))) from++;
    states.push(...prev.states.slice(0, from));
    carries.push(...prev.carries.slice(0, from));
    if (from === total) return { plan, ctx, states, carries };
  }

  let carry: Carry =
    from === 0
      ? {
          slots: base.slots,
          captain: base.captain,
          vice: base.vice,
          purchase: base.purchase,
          bank: base.bank,
          freeTransfers: base.freeTransfers,
          chipsUsed: base.chipsUsed,
        }
      : carryAfter(states[from - 1], carries[from - 1], ctx);

  for (let gw = base.gw + from; gw <= ctx.rules.lastGw; gw++) {
    const state = computeGw(gw, carry, byGw.get(gw) ?? [], ctx);
    states.push(state);
    carries.push(carry);
    carry = carryAfter(state, carry, ctx);
  }
  return { plan, ctx, states, carries };
}

function sameMoves(a: Move[] | undefined, b: Move[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return (a?.length ?? 0) === 0 && (b?.length ?? 0) === 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}

export function stateAt(result: PlanResult, gw: number): GwState | undefined {
  return result.states[gw - result.plan.base.gw];
}

/* ------------------------------------------------------------------ */
/* Editing: plans are immutable; each edit returns a new plan.         */
/* ------------------------------------------------------------------ */

/**
 * Adds a move, keeping the log compact: a captain, vice or chip move replaces
 * an earlier one of the same type in that gameweek.
 */
export function addMove(plan: Plan, move: Move, now = Date.now()): Plan {
  const replaces = move.type === "captain" || move.type === "vice" || move.type === "chip";
  const moves = replaces ? plan.moves.filter((m) => !(m.gw === move.gw && m.type === move.type)) : plan.moves;
  return { ...plan, moves: [...moves, move], updatedAt: now };
}

/** Removes the most recent move (Undo). */
export function undoMove(plan: Plan, now = Date.now()): Plan {
  if (plan.moves.length === 0) return plan;
  return { ...plan, moves: plan.moves.slice(0, -1), updatedAt: now };
}

/** Clears every move in one gameweek (Reset). */
export function resetGw(plan: Plan, gw: number, now = Date.now()): Plan {
  return { ...plan, moves: plan.moves.filter((m) => m.gw !== gw), updatedAt: now };
}
