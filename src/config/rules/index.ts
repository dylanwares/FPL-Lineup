import { rules2026_27 } from "./2026-27";
import type { SeasonRules } from "./types";

export type * from "./types";

const RULES: Record<string, SeasonRules> = {
  [rules2026_27.season]: rules2026_27,
};

export const CURRENT_SEASON = rules2026_27.season;

export function getRules(season: string = CURRENT_SEASON): SeasonRules {
  const rules = RULES[season];
  if (!rules) throw new Error(`No rules configured for season ${season}`);
  return rules;
}
