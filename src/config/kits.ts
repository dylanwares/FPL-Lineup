/**
 * Generic kits drawn in each club's colours (no licensed shirt imagery).
 * Keyed by FPL team `code`, which stays stable across seasons, unlike team `id`.
 */
export type KitStyle = "plain" | "stripes" | "sleeves" | "hoops";

export interface Kit {
  style: KitStyle;
  /** Body colour. */
  primary: string;
  /** Stripes, sleeves or hoops colour (trim on plain kits). */
  secondary: string;
  /** Goalkeeper shirt colour. */
  gk: string;
}

export const KITS: Record<number, Kit & { name: string }> = {
  3: { style: "sleeves", primary: "#EF0107", secondary: "#FFFFFF", gk: "#F7E733", name: "Arsenal" },
  7: { style: "sleeves", primary: "#670E36", secondary: "#95BFE5", gk: "#F97316", name: "Aston Villa" },
  91: { style: "stripes", primary: "#DA291C", secondary: "#111111", gk: "#3BB273", name: "Bournemouth" },
  94: { style: "stripes", primary: "#E30613", secondary: "#FFFFFF", gk: "#F7E733", name: "Brentford" },
  36: { style: "stripes", primary: "#0057B8", secondary: "#FFFFFF", gk: "#F97316", name: "Brighton" },
  8: { style: "plain", primary: "#034694", secondary: "#FFFFFF", gk: "#F7E733", name: "Chelsea" },
  9: { style: "plain", primary: "#59CBE8", secondary: "#FFFFFF", gk: "#F97316", name: "Coventry City" },
  31: { style: "stripes", primary: "#1B458F", secondary: "#C4122E", gk: "#F7E733", name: "Crystal Palace" },
  11: { style: "plain", primary: "#003399", secondary: "#FFFFFF", gk: "#F7E733", name: "Everton" },
  54: { style: "plain", primary: "#FFFFFF", secondary: "#111111", gk: "#3BB273", name: "Fulham" },
  88: { style: "stripes", primary: "#F5A12D", secondary: "#111111", gk: "#4C9FE0", name: "Hull City" },
  40: { style: "plain", primary: "#3A64A3", secondary: "#FFFFFF", gk: "#F7E733", name: "Ipswich Town" },
  2: { style: "plain", primary: "#FFFFFF", secondary: "#1D428A", gk: "#3BB273", name: "Leeds" },
  14: { style: "plain", primary: "#C8102E", secondary: "#FFFFFF", gk: "#F7E733", name: "Liverpool" },
  43: { style: "plain", primary: "#6CABDD", secondary: "#FFFFFF", gk: "#F97316", name: "Man City" },
  1: { style: "plain", primary: "#DA291C", secondary: "#FFFFFF", gk: "#3BB273", name: "Man Utd" },
  4: { style: "stripes", primary: "#241F20", secondary: "#FFFFFF", gk: "#F7E733", name: "Newcastle" },
  17: { style: "plain", primary: "#DD0000", secondary: "#FFFFFF", gk: "#F97316", name: "Nott'm Forest" },
  6: { style: "plain", primary: "#FFFFFF", secondary: "#132257", gk: "#F7E733", name: "Spurs" },
  56: { style: "stripes", primary: "#EB172B", secondary: "#FFFFFF", gk: "#F97316", name: "Sunderland" },
};

export const FALLBACK_KIT: Kit = {
  style: "plain",
  primary: "#9CA3AF",
  secondary: "#FFFFFF",
  gk: "#F7E733",
};

export function kitFor(teamCode: number): Kit {
  return KITS[teamCode] ?? FALLBACK_KIT;
}
