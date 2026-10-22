import type { ChipName } from "../../src/config/rules";
import { fetchJson } from "../../src/lib/fetch-json";
import type { DataSource, SourceData } from "./sources";

const BASE = "https://fantasy.premierleague.com/api";

interface FplBootstrap {
  events: {
    id: number;
    deadline_time_epoch: number;
    finished: boolean;
    is_current: boolean;
    is_next: boolean;
  }[];
  teams: { id: number; code: number; name: string; short_name: string }[];
  elements: {
    id: number;
    code: number;
    web_name: string;
    team: number;
    element_type: 1 | 2 | 3 | 4;
    now_cost: number;
    status: string;
    chance_of_playing_next_round: number | null;
    news: string;
    form: string;
    selected_by_percent: string;
    total_points: number;
    ep_next: string | null;
    minutes: number;
    starts: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    defensive_contribution: number;
    clearances_blocks_interceptions: number;
    recoveries: number;
    tackles: number;
    dreamteam_count: number;
    expected_goals: string;
    expected_assists: string;
    expected_goal_involvements: string;
    expected_goals_conceded: string;
    points_per_game: string;
    ict_index: string;
    influence: string;
    creativity: string;
    threat: string;
    transfers_in_event: number;
    transfers_out_event: number;
    cost_change_event: number;
    cost_change_start: number;
    penalties_order: number | null;
    corners_and_indirect_freekicks_order: number | null;
    direct_freekicks_order: number | null;
  }[];
  chips: { name: string; start_event: number; stop_event: number }[];
}

interface FplFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number;
  team_a_difficulty: number;
  kickoff_time: string | null;
  finished: boolean;
  team_h_score: number | null;
  team_a_score: number | null;
}

const CHIP_NAMES = new Set<string>(["wildcard", "freehit", "bboost", "3xc"]);

const num = (s: string | null | undefined) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function normaliseFpl(bs: FplBootstrap, fixtures: FplFixture[]): SourceData {
  return {
    events: bs.events.map((e) => ({
      gw: e.id,
      deadline: e.deadline_time_epoch,
      finished: e.finished,
      isCurrent: e.is_current,
      isNext: e.is_next,
    })),
    teams: bs.teams.map((t) => ({ id: t.id, code: t.code, name: t.name, short: t.short_name })),
    players: bs.elements.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.web_name,
      team: e.team,
      pos: e.element_type,
      price: e.now_cost,
      status: e.status,
      chance: e.chance_of_playing_next_round,
      news: e.news,
      form: num(e.form),
      selectedBy: num(e.selected_by_percent),
      totalPoints: e.total_points,
      epNext: e.ep_next == null ? null : num(e.ep_next),
      stats: {
        minutes: e.minutes,
        starts: e.starts,
        goals: e.goals_scored,
        assists: e.assists,
        cleanSheets: e.clean_sheets,
        goalsConceded: e.goals_conceded,
        ownGoals: e.own_goals,
        penaltiesSaved: e.penalties_saved,
        penaltiesMissed: e.penalties_missed,
        yellowCards: e.yellow_cards,
        redCards: e.red_cards,
        saves: e.saves,
        bonus: e.bonus,
        bps: e.bps,
        defCon: e.defensive_contribution,
        cbi: e.clearances_blocks_interceptions,
        recoveries: e.recoveries,
        tackles: e.tackles,
        dreamteam: e.dreamteam_count,
        xg: num(e.expected_goals),
        xa: num(e.expected_assists),
        xgi: num(e.expected_goal_involvements),
        xgc: num(e.expected_goals_conceded),
        ppg: num(e.points_per_game),
        ict: num(e.ict_index),
        influence: num(e.influence),
        creativity: num(e.creativity),
        threat: num(e.threat),
        transfersIn: e.transfers_in_event,
        transfersOut: e.transfers_out_event,
        priceChangeGw: e.cost_change_event,
        priceChangeStart: e.cost_change_start,
        penOrder: e.penalties_order,
        cornerOrder: e.corners_and_indirect_freekicks_order,
        fkOrder: e.direct_freekicks_order,
      },
    })),
    fixtures: fixtures.map((f) => ({
      id: f.id,
      gw: f.event,
      home: f.team_h,
      away: f.team_a,
      homeDifficulty: f.team_h_difficulty,
      awayDifficulty: f.team_a_difficulty,
      kickoff: f.kickoff_time ? Math.floor(Date.parse(f.kickoff_time) / 1000) : null,
      finished: f.finished,
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
    })),
    chips: bs.chips
      .filter((c) => CHIP_NAMES.has(c.name))
      .map((c) => ({ name: c.name as ChipName, start: c.start_event, stop: c.stop_event })),
  };
}

export const fplApiSource: DataSource = {
  name: "FPL API",
  async load() {
    const [bs, fixtures] = await Promise.all([
      fetchJson<FplBootstrap>(`${BASE}/bootstrap-static/`),
      fetchJson<FplFixture[]>(`${BASE}/fixtures/`),
    ]);
    return normaliseFpl(bs, fixtures);
  },
};
