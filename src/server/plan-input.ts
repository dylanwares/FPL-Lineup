import type { ChipName } from "@/config/rules";
import type { Move, Plan, Snapshot } from "@/engine/types";

/*
 * Checks a plan uploaded by a device before it's stored. Plans come from our
 * own client, but the API is public, so nothing is trusted: shapes, types and
 * sizes are all checked, and unknown fields are dropped.
 */

const MAX_MOVES = 2000;
const MAX_NAME = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class InputError extends Error {}

const fail = (what: string): never => {
  throw new InputError(`Invalid ${what}.`);
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const int = (v: unknown, what: string, min = -1e9, max = 1e9): number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fail(what);
const gw = (v: unknown) => int(v, "gameweek", 1, 38);
/** Player ids; negative ones are empty slots. */
const player = (v: unknown) => int(v, "player", -1e6, 1e6);

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

const CHIPS: readonly ChipName[] = ["wildcard", "freehit", "bboost", "3xc"];

function chip(v: unknown): ChipName {
  return CHIPS.includes(v as ChipName) ? (v as ChipName) : fail("chip");
}

function snapshot(v: unknown): Snapshot {
  if (!isObject(v)) return fail("squad");
  const slots = Array.isArray(v.slots) && v.slots.length === 15 ? v.slots.map(player) : fail("squad slots");
  if (!isObject(v.purchase) || Object.keys(v.purchase).length > 30) fail("purchase prices");
  const purchase: Record<number, number> = {};
  for (const [id, price] of Object.entries(v.purchase as object)) {
    purchase[int(Number(id), "purchase prices")] = int(price, "purchase prices", 0, 10000);
  }
  if (!Array.isArray(v.chipsUsed) || v.chipsUsed.length > 20) fail("chips used");
  return {
    gw: gw(v.gw),
    slots,
    captain: player(v.captain),
    vice: player(v.vice),
    bank: int(v.bank, "bank", -10000, 10000),
    freeTransfers: int(v.freeTransfers, "free transfers", 0, 20),
    purchase,
    chipsUsed: (v.chipsUsed as unknown[]).map((c) =>
      isObject(c) ? { name: chip(c.name), gw: gw(c.gw) } : fail("chips used"),
    ),
  };
}

function move(v: unknown): Move {
  if (!isObject(v)) return fail("move");
  const at = gw(v.gw);
  switch (v.type) {
    case "transfer":
      return { type: "transfer", gw: at, out: player(v.out), in: player(v.in) };
    case "remove":
      return { type: "remove", gw: at, player: player(v.player) };
    case "sub":
      return { type: "sub", gw: at, a: player(v.a), b: player(v.b) };
    case "captain":
    case "vice":
      return { type: v.type, gw: at, player: player(v.player) };
    case "chip":
      return { type: "chip", gw: at, chip: v.chip === null ? null : chip(v.chip) };
    default:
      return fail("move");
  }
}

/** The plan in an upload, cleaned, or an InputError. `id` is the one in the URL. */
export function parsePlan(v: unknown, id: string): Plan {
  if (!isObject(v)) return fail("plan");
  if (v.id !== id || !isUuid(id)) fail("plan id");
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > MAX_NAME) fail("plan name");
  if (!Array.isArray(v.moves) || v.moves.length > MAX_MOVES) fail("moves");
  return {
    id,
    entryId: int(v.entryId, "FPL team", 1, 1e9),
    name,
    base: snapshot(v.base),
    moves: (v.moves as unknown[]).map(move),
    createdAt: int(v.createdAt, "created time", 0, 1e14),
    updatedAt: int(v.updatedAt, "updated time", 0, 1e14),
  };
}

/** A version number from a request: a positive integer, or null for "new to the server". */
export function parseVersion(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return int(v, "version", 1, 1e9);
}
