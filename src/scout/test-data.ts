import { KITS } from "@/config/kits";
import { decodeBootstrap } from "@/data/decode";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "@/data/format";

/**
 * Three teams, GW7 next. Alpha doubles in GW7, Gamma blanks in GW8.
 * xP in GW7 is the player's price / 10; Fwd Z has no projection.
 */
const K = KITS[3];
export function scoutTestData() {
  type P = [id: number, name: string, team: number, pos: number, price: number, status: string];
  const players: P[] = [
    [1, "Keeper", 1, 1, 45, "a"],
    [2, "Back", 2, 2, 50, "a"],
    [3, "Ødegaard", 1, 3, 85, "d"],
    [4, "Injured Mid", 2, 3, 60, "i"],
    [5, "Fwd A", 3, 4, 90, "a"],
    [6, "Fwd Z", 2, 4, 60, "a"],
  ];
  const n = players.length;
  const k = K;
  const file: BootstrapFile = {
    format: BOOTSTRAP_FORMAT,
    season: "2026-27",
    generatedAt: 0,
    currentGw: 6,
    nextGw: 7,
    events: { deadline: Array(38).fill(0), finished: Array.from({ length: 38 }, (_, i) => (i < 6 ? 1 : 0)) },
    teams: {
      id: [1, 2, 3],
      code: [3, 14, 43],
      name: ["Alpha", "Beta", "Gamma"],
      short: ["ALP", "BET", "GAM"],
      kit: Array(3).fill(["plain", k.primary, k.secondary, k.gk]),
    },
    players: {
      id: players.map((p) => p[0]),
      code: players.map((p) => p[0]),
      name: players.map((p) => p[1]),
      team: players.map((p) => p[2]),
      pos: players.map((p) => p[3]),
      price: players.map((p) => p[4]),
      status: players.map((p) => p[5]).join(""),
      chance: Array(n).fill(-1),
      news: Array(n).fill(""),
      form: Array(n).fill(0),
      sel: [300, 50, 400, 10, 150, 20], // ×10
      pts: [30, 20, 50, 5, 45, 0],
      stats: {
        minutes: [540, 450, 500, 60, 400, 0],
        goals: [0, 1, 4, 0, 6, 0],
        xg: [0, 50, 300, 0, 650, 0], // ×100
        penOrder: [0, 0, 1, 0, 0, 0],
        cornerOrder: [0, 1, 0, 0, 0, 0],
      },
    },
    // GW7: ALP v BET and ALP v GAM (Alpha's double). GW8: ALP v BET (Gamma blanks).
    fixtures: {
      id: [1, 2, 3],
      gw: [7, 7, 8],
      h: [1, 1, 1],
      a: [2, 3, 2],
      hd: [2, 2, 2],
      ad: [4, 4, 4],
      ko: [1, 2, 3],
      fin: [0, 0, 0],
      hs: [-1, -1, -1],
      as: [-1, -1, -1],
    },
    xp: {
      gws: 38,
      values: players.flatMap((p) =>
        Array.from({ length: 38 }, (_, g) => (g === 6 && p[0] !== 6 ? p[4] * 10 : -1)),
      ),
    },
  };
  return decodeBootstrap(file);
}
