import type { ChipName, SeasonRules } from "@/config/rules";
import { nextFreeTransfers, sellingPrice } from "@/engine/money";
import type {
  FixturePoints,
  FplBootstrapSlim,
  FplEntry,
  FplHistory,
  FplPicks,
  FplTransfer,
  PastPicks,
  TeamImport,
} from "./types";

const CHIPS = new Set<string>(["wildcard", "freehit", "bboost", "3xc"]);

export class TeamImportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TeamImportError";
  }
}

export function chipsUsed(history: FplHistory): { name: ChipName; gw: number }[] {
  return history.chips
    .filter((c) => CHIPS.has(c.name))
    .map((c) => ({ name: c.name as ChipName, gw: c.event }))
    .sort((a, b) => a.gw - b.gw);
}

/** Converts FPL picks (positions 1–15) to slot order. */
export function picksToSlots(picks: FplPicks["picks"]): Pick<PastPicks, "slots" | "captain" | "vice"> {
  const sorted = [...picks].sort((a, b) => a.position - b.position);
  return {
    slots: sorted.map((p) => p.element),
    captain: sorted.find((p) => p.is_captain)?.element ?? sorted[0].element,
    vice: sorted.find((p) => p.is_vice_captain)?.element ?? sorted[1].element,
  };
}

export function toPastPicks(gw: number, raw: FplPicks, live: Record<number, FixturePoints[]>): PastPicks {
  const chip = raw.active_chip && CHIPS.has(raw.active_chip) ? (raw.active_chip as ChipName) : null;
  const picks = picksToSlots(raw.picks);
  const playerPoints = Object.fromEntries(picks.slots.map((id) => [id, live[id] ?? []]));
  return { gw, ...picks, chip, points: raw.entry_history.points, playerPoints };
}

/**
 * Free transfers going into `planFromGw`, replayed from the entry's history:
 * none before the first deadline, then +1 a week up to the cap, spent by
 * transfers, kept through Wildcard and Free Hit weeks.
 */
export function deriveFreeTransfers(
  entry: FplEntry,
  history: FplHistory,
  planFromGw: number,
  rules: SeasonRules,
): number {
  const chipByGw = new Map(chipsUsed(history).map((c) => [c.gw, c.name]));
  const transfersByGw = new Map(history.current.map((h) => [h.event, h.event_transfers]));
  let ft = 0; // the first gameweek has unlimited transfers before its deadline
  for (let gw = entry.started_event; gw < planFromGw; gw++) {
    const made = gw === entry.started_event ? 0 : (transfersByGw.get(gw) ?? 0);
    ft = nextFreeTransfers(ft, made, chipByGw.get(gw) ?? null, gw + 1, rules);
  }
  return ft;
}

/**
 * Purchase price per current squad player: the most recent transfer in
 * (ignoring Free Hit weeks, whose squads reverted), or the season-start price
 * for players held since the initial squad.
 */
export function derivePurchasePrices(
  squad: number[],
  transfers: FplTransfer[],
  freeHitGws: Set<number>,
  bootstrap: FplBootstrapSlim,
): Record<number, number> {
  const now = new Map(bootstrap.elements.map((e) => [e.id, e]));
  const latestIn = new Map<number, FplTransfer>();
  for (const t of transfers) {
    if (freeHitGws.has(t.event)) continue;
    const seen = latestIn.get(t.element_in);
    if (!seen || t.event > seen.event || (t.event === seen.event && t.time > seen.time)) {
      latestIn.set(t.element_in, t);
    }
  }
  const out: Record<number, number> = {};
  for (const id of squad) {
    const t = latestIn.get(id);
    const el = now.get(id);
    out[id] = t ? t.element_in_cost : el ? el.now_cost - el.cost_change_start : 0;
  }
  return out;
}

/**
 * Builds the planning snapshot. `picks` are for the current gameweek; when it
 * was a Free Hit, `prePicks` (the week before) give the squad that reverts.
 */
export function buildTeamImport(
  input: {
    entry: FplEntry;
    history: FplHistory;
    transfers: FplTransfer[];
    picks: FplPicks;
    prePicks?: FplPicks;
    bootstrap: FplBootstrapSlim;
  },
  rules: SeasonRules,
  now = Date.now(),
): TeamImport {
  const { entry, history, transfers, bootstrap } = input;
  const currentGw = entry.current_event;
  const nextGw = bootstrap.events.find((e) => e.is_next)?.id;
  if (!currentGw) throw new TeamImportError("This team hasn't played a gameweek yet.", 409);
  if (!nextGw) throw new TeamImportError("The season has finished, so there's nothing left to plan.", 409);

  const used = chipsUsed(history);
  const freeHitGws = new Set(used.filter((c) => c.name === "freehit").map((c) => c.gw));

  // After a Free Hit the squad reverts to the previous week's.
  const revert = input.picks.active_chip === "freehit";
  if (revert && !input.prePicks) throw new TeamImportError("Missing picks before the Free Hit.", 500);
  const source = revert ? input.prePicks! : input.picks;
  const { slots, captain, vice } = picksToSlots(source.picks);

  const purchase = derivePurchasePrices(slots, transfers, freeHitGws, bootstrap);
  const current = new Map(bootstrap.elements.map((e) => [e.id, e.now_cost]));
  const prices: TeamImport["prices"] = {};
  for (const id of slots) {
    const nowCost = current.get(id) ?? purchase[id];
    prices[id] = { purchase: purchase[id], selling: sellingPrice(purchase[id], nowCost) };
  }

  return {
    entryId: entry.id,
    teamName: entry.name,
    managerName: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    importedAt: now,
    startedGw: entry.started_event,
    currentGw,
    planFromGw: nextGw,
    slots,
    captain,
    vice,
    bank: source.entry_history.bank,
    freeTransfers: deriveFreeTransfers(entry, history, nextGw, rules),
    prices,
    chipsUsed: used,
    history: history.current.map((h) => ({
      gw: h.event,
      points: h.points,
      transfers: h.event_transfers,
      cost: h.event_transfers_cost,
      bank: h.bank,
    })),
  };
}
