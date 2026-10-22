import type { Kit } from "../../src/config/kits";
import type { SeasonRules } from "../../src/config/rules";
import { BOOTSTRAP_FORMAT, STAT_KEYS, STAT_SCALES, type BootstrapFile } from "../../src/data/format";
import type { Projections, SourceData } from "./sources";

export interface BuildResult {
  file: BootstrapFile;
  warnings: string[];
}

const XP_MAX = 32767; // decoded into an Int16Array

/** Pure: normalised source data + projections → compact bootstrap file. */
export function buildBootstrap(
  src: SourceData,
  projections: Projections | null,
  rules: SeasonRules,
  kitFor: (teamCode: number) => Kit | undefined,
  generatedAt: number,
): BuildResult {
  const warnings: string[] = [];

  const events = [...src.events].sort((a, b) => a.gw - b.gw);
  if (events.length !== rules.lastGw) {
    warnings.push(`Expected ${rules.lastGw} gameweeks, source has ${events.length}`);
  }
  const currentGw = events.find((e) => e.isCurrent)?.gw ?? null;
  const nextGw = events.find((e) => e.isNext)?.gw ?? null;

  const teams = [...src.teams].sort((a, b) => a.id - b.id);
  const kits = teams.map((t) => {
    const kit = kitFor(t.code);
    if (!kit) {
      warnings.push(`No kit configured for ${t.name} (code ${t.code})`);
      return ["plain", "#9CA3AF", "#FFFFFF", "#F7E733"] as BootstrapFile["teams"]["kit"][number];
    }
    return [kit.style, kit.primary, kit.secondary, kit.gk] as BootstrapFile["teams"]["kit"][number];
  });

  const players = [...src.players].sort((a, b) => a.id - b.id);
  const gws = rules.lastGw;
  const xp: number[] = new Array(players.length * gws).fill(-1);
  let missingXp = 0;
  players.forEach((p, i) => {
    const row = projections?.get(p.id);
    if (row) {
      row.forEach((v, g) => {
        if (v != null && g < gws) xp[i * gws + g] = Math.min(XP_MAX, Math.max(0, Math.round(v * 100)));
      });
    } else {
      missingXp++;
      if (nextGw && p.epNext != null) xp[i * gws + nextGw - 1] = Math.round(p.epNext * 100);
    }
  });
  if (!projections) warnings.push("No projections loaded; using FPL ep_next for the next gameweek only");
  else if (missingXp)
    warnings.push(`${missingXp} players have no projections; using FPL ep_next for the next gameweek`);

  const fixtures = [...src.fixtures].sort((a, b) => a.id - b.id);

  warnings.push(...checkChips(src.chips, rules));

  const file: BootstrapFile = {
    format: BOOTSTRAP_FORMAT,
    season: rules.season,
    generatedAt,
    currentGw,
    nextGw,
    events: {
      deadline: events.map((e) => e.deadline),
      finished: events.map((e) => (e.finished ? 1 : 0)),
    },
    teams: {
      id: teams.map((t) => t.id),
      code: teams.map((t) => t.code),
      name: teams.map((t) => t.name),
      short: teams.map((t) => t.short),
      kit: kits,
    },
    players: {
      id: players.map((p) => p.id),
      code: players.map((p) => p.code),
      name: players.map((p) => p.name),
      team: players.map((p) => p.team),
      pos: players.map((p) => p.pos),
      price: players.map((p) => p.price),
      status: players.map((p) => (p.status.length === 1 ? p.status : "a")).join(""),
      chance: players.map((p) => p.chance ?? -1),
      news: players.map((p) => p.news),
      form: players.map((p) => Math.round(p.form * 10)),
      sel: players.map((p) => Math.round(p.selectedBy * 10)),
      pts: players.map((p) => p.totalPoints),
      stats: Object.fromEntries(
        STAT_KEYS.map((key) => [
          key,
          players.map((p) => Math.round((p.stats?.[key] ?? 0) * STAT_SCALES[key])),
        ]),
      ) as BootstrapFile["players"]["stats"],
    },
    fixtures: {
      id: fixtures.map((f) => f.id),
      gw: fixtures.map((f) => f.gw ?? 0),
      h: fixtures.map((f) => f.home),
      a: fixtures.map((f) => f.away),
      hd: fixtures.map((f) => f.homeDifficulty),
      ad: fixtures.map((f) => f.awayDifficulty),
      ko: fixtures.map((f) => f.kickoff ?? 0),
      fin: fixtures.map((f) => (f.finished ? 1 : 0)),
      hs: fixtures.map((f) => f.homeScore ?? -1),
      as: fixtures.map((f) => f.awayScore ?? -1),
    },
    xp: { gws, values: xp },
  };

  return { file, warnings };
}

/** Flags drift between FPL's chip windows and the rules config. */
export function checkChips(source: SourceData["chips"], rules: SeasonRules): string[] {
  const key = (c: { name: string; start: number; stop: number }) => `${c.name} GW${c.start}-${c.stop}`;
  const fromRules = rules.chips.map((c) => key({ name: c.name, ...c.window })).sort();
  const fromSource = source.map(key).sort();
  if (fromRules.join() === fromSource.join()) return [];
  return [
    `Chip windows differ from rules config ${rules.season}.\n  config: ${fromRules.join(", ")}\n  source: ${fromSource.join(", ")}`,
  ];
}
