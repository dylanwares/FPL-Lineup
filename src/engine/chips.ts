import type { ChipName, ChipWindow, SeasonRules } from "@/config/rules";
import type { PlanResult } from "./plan";
import type { ChipUse, Plan } from "./types";

export type ChipAvailability = "available" | "used" | "unavailable";

/**
 * Whether a chip can be played in a gameweek, given the chips already used.
 * Each copy in the rules is usable once inside its window; "used" means every
 * copy whose window covers this gameweek has gone, "unavailable" means no
 * copy's window covers it, or the chip was played the gameweek before and
 * can't be played back to back (Free Hit).
 */
export function chipAvailability(
  name: ChipName,
  gw: number,
  used: ChipUse[],
  rules: SeasonRules,
): ChipAvailability {
  const copies = rules.chips.filter((c) => c.name === name);
  const covering = copies.filter((c) => gw >= c.window.start && gw <= c.window.stop);
  if (covering.length === 0) return "unavailable";
  if (rules.noConsecutive.includes(name) && used.some((u) => u.name === name && u.gw === gw - 1)) {
    return "unavailable";
  }
  const free = covering.some(
    (c) => !used.some((u) => u.name === name && u.gw >= c.window.start && u.gw <= c.window.stop),
  );
  return free ? "available" : "used";
}

/** What a chip's tile shows for one planned gameweek. */
export type ChipStatus =
  | { kind: "played" }
  | { kind: "available" }
  /** Playable here, but it's planned in these other gameweeks: playing it here moves it. */
  | { kind: "planned"; gws: number[] }
  | { kind: "used"; gw: number }
  /** Can't be played here; `from` is the next gameweek it can be (null: not again this season). */
  | { kind: "unavailable"; from: number | null };

const covers = (w: ChipWindow, gw: number) => gw >= w.start && gw <= w.stop;

/**
 * Whether a chip planned in `other` stops it being played in `gw`, or the
 * other way round: both sit in the same copy's window, or they're back to
 * back for a chip that can't be played in consecutive gameweeks.
 */
function clashes(name: ChipName, gw: number, other: number, rules: SeasonRules): boolean {
  if (rules.noConsecutive.includes(name) && Math.abs(other - gw) === 1) return true;
  return rules.chips.some((c) => c.name === name && covers(c.window, gw) && covers(c.window, other));
}

/** Other planned gameweeks this chip is played in that would clash with playing it in `gw`. */
function plannedClashes(name: ChipName, gw: number, result: PlanResult): number[] {
  const { rules } = result.ctx;
  return result.states
    .filter((s) => s.gw !== gw && s.chip === name && clashes(name, gw, s.gw, rules))
    .map((s) => s.gw);
}

/**
 * The tile status of a chip in a planned gameweek. Chips already played for
 * real count as used; chips only planned elsewhere show as "planned" so the
 * user can move them here in one tap.
 */
export function chipStatus(name: ChipName, gw: number, result: PlanResult): ChipStatus {
  const i = gw - result.plan.base.gw;
  const state = result.states[i];
  const { rules } = result.ctx;
  if (!state) return { kind: "unavailable", from: null };
  if (state.chip === name) return { kind: "played" };

  const moved = plannedClashes(name, gw, result);
  const used = result.carries[i].chipsUsed.filter((u) => !(u.name === name && moved.includes(u.gw)));
  const availability = chipAvailability(name, gw, used, rules);
  if (availability === "available")
    return moved.length ? { kind: "planned", gws: moved } : { kind: "available" };
  // A used copy explains more than the back-to-back rule does.
  if (chipAvailability(name, gw, used, { ...rules, noConsecutive: [] }) === "used") {
    const use = used.find(
      (u) =>
        u.name === name &&
        rules.chips.some((c) => c.name === name && covers(c.window, gw) && covers(c.window, u.gw)),
    );
    return { kind: "used", gw: use?.gw ?? gw };
  }
  // Inside a window but straight after the same chip (Free Hit): next gameweek.
  if (rules.chips.some((c) => c.name === name && covers(c.window, gw)))
    return { kind: "unavailable", from: gw + 1 };
  const next = rules.chips
    .filter((c) => c.name === name && c.window.start > gw)
    .reduce<number | null>((min, c) => (min === null || c.window.start < min ? c.window.start : min), null);
  return { kind: "unavailable", from: next };
}

/**
 * Plays a chip in `gw`, replacing any other chip that gameweek. A clashing
 * plan of the same chip in another gameweek is taken off there, so the chip
 * moves here. Returns null if the chip can't be played in `gw`.
 */
export function playChip(
  plan: Plan,
  name: ChipName,
  gw: number,
  result: PlanResult,
  now = Date.now(),
): { plan: Plan; movedFrom: number[] } | null {
  const status = chipStatus(name, gw, result);
  if (status.kind !== "available" && status.kind !== "planned") return null;
  const movedFrom = status.kind === "planned" ? status.gws : [];
  const moves = plan.moves.filter(
    (m) => !(m.type === "chip" && (m.gw === gw || (m.chip === name && movedFrom.includes(m.gw)))),
  );
  return {
    plan: { ...plan, moves: [...moves, { type: "chip", gw, chip: name }], updatedAt: now },
    movedFrom,
  };
}

/** Takes the chip off a gameweek. */
export function cancelChip(plan: Plan, gw: number, now = Date.now()): Plan {
  const moves = plan.moves.filter((m) => !(m.type === "chip" && m.gw === gw));
  return moves.length === plan.moves.length ? plan : { ...plan, moves, updatedAt: now };
}
