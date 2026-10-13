import type { Position } from "@/config/rules";
import { BOOTSTRAP_FORMAT, type BootstrapFile } from "./format";
import type { Fixture, GameData, GameEvent, Player, PlayerStatus, Team } from "./model";

const POSITIONS: Position[] = ["GKP", "DEF", "MID", "FWD"];

export function decodeBootstrap(file: BootstrapFile): GameData {
  if (file.format !== BOOTSTRAP_FORMAT) {
    throw new Error(`Unsupported bootstrap format ${file.format}`);
  }

  const events: GameEvent[] = file.events.deadline.map((deadline, i) => ({
    gw: i + 1,
    deadline: deadline * 1000,
    finished: file.events.finished[i] === 1,
  }));

  const t = file.teams;
  const teams: Team[] = t.id.map((id, i) => {
    const [style, primary, secondary, gk] = t.kit[i];
    return {
      id,
      code: t.code[i],
      name: t.name[i],
      short: t.short[i],
      kit: { style, primary, secondary, gk },
    };
  });
  const teamById = new Map(teams.map((team) => [team.id, team]));

  const p = file.players;
  const players: Player[] = p.id.map((id, i) => ({
    id,
    code: p.code[i],
    name: p.name[i],
    team: p.team[i],
    pos: POSITIONS[p.pos[i] - 1],
    price: p.price[i],
    status: p.status[i] as PlayerStatus,
    chance: p.chance[i] < 0 ? null : p.chance[i],
    news: p.news[i],
    form: p.form[i] / 10,
    selectedBy: p.sel[i] / 10,
    totalPoints: p.pts[i],
    index: i,
  }));
  const playerById = new Map(players.map((player) => [player.id, player]));

  const f = file.fixtures;
  const lastGw = events.length;
  const fixturesByGw: Fixture[][] = Array.from({ length: lastGw + 1 }, () => []);
  const teamGwFixtures = new Map<number, Fixture[]>();
  const fixtures: Fixture[] = f.id.map((id, i) => {
    const fixture: Fixture = {
      id,
      gw: f.gw[i] || null,
      home: f.h[i],
      away: f.a[i],
      homeDifficulty: f.hd[i],
      awayDifficulty: f.ad[i],
      kickoff: f.ko[i] ? f.ko[i] * 1000 : null,
      finished: f.fin[i] === 1,
      homeScore: f.hs[i] < 0 ? null : f.hs[i],
      awayScore: f.as[i] < 0 ? null : f.as[i],
    };
    const gw = fixture.gw ?? 0;
    fixturesByGw[gw]?.push(fixture);
    if (fixture.gw) {
      for (const team of [fixture.home, fixture.away]) {
        const key = team * 100 + fixture.gw;
        const list = teamGwFixtures.get(key);
        if (list) list.push(fixture);
        else teamGwFixtures.set(key, [fixture]);
      }
    }
    return fixture;
  });
  for (const list of teamGwFixtures.values()) {
    if (list.length > 1) list.sort((x, y) => (x.kickoff ?? 0) - (y.kickoff ?? 0));
  }

  return {
    season: file.season,
    generatedAt: file.generatedAt * 1000,
    currentGw: file.currentGw,
    nextGw: file.nextGw,
    events,
    teams,
    teamById,
    players,
    playerById,
    fixtures,
    fixturesByGw,
    teamGwFixtures,
    xpGws: file.xp.gws,
    xp: Int16Array.from(file.xp.values),
  };
}
