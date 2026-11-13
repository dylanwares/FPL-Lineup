import { useEffect, useState } from "react";
import type { TokenMetric } from "@/components/pitch/PlayerToken";
import { FdrPill } from "@/components/ui/FdrPill";
import { xpFor, type GameData, type Player } from "@/data/model";
import type { PlayerFixturePoints } from "@/lib/fpl/types";
import { fixtureMetrics } from "./model";

/** Gameweek rows: a fixture pill per match ("Blank" for none), then a value on the right. */
function GwRow({ gw, metrics, children }: { gw: number; metrics: TokenMetric[]; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="w-9 shrink-0 text-xs text-muted tabular-nums">GW{gw}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1">
        {metrics.length === 0 ? (
          <FdrPill difficulty={null} className="px-2">
            Blank
          </FdrPill>
        ) : (
          metrics.map((m, i) => (
            <FdrPill key={i} difficulty={m.difficulty} className="px-2">
              {m.label}
            </FdrPill>
          ))
        )}
      </span>
      {children}
    </li>
  );
}

/** A player's next `count` gameweeks from `gw`: fixtures by difficulty, and projected points. */
export function FixtureXpList({
  data,
  player,
  gw,
  count = 5,
}: {
  data: GameData;
  player: Player;
  gw: number;
  count?: number;
}) {
  const gws = Array.from({ length: count }, (_, i) => gw + i).filter((g) => g <= data.events.length);
  return (
    <ul className="flex flex-col gap-1.5">
      {gws.map((g) => {
        const xp = xpFor(data, player, g);
        return (
          <GwRow key={g} gw={g} metrics={fixtureMetrics(data, player.team, g)}>
            <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
              {xp == null ? "–" : xp.toFixed(1)}
            </span>
          </GwRow>
        );
      })}
    </ul>
  );
}

/** Responses are cached for the session: points only change once a gameweek. */
const historyCache = new Map<number, Promise<PlayerFixturePoints[]>>();

function fetchHistory(id: number): Promise<PlayerFixturePoints[]> {
  let p = historyCache.get(id);
  if (!p) {
    p = fetch(`/api/player/${id}/history`).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<PlayerFixturePoints[]>;
    });
    // A failure isn't kept, so reopening the sheet tries again.
    p.catch(() => historyCache.delete(id));
    historyCache.set(id, p);
  }
  return p;
}

/** The player's points per fixture: undefined while loading, null if it failed. */
function usePlayerHistory(id: number): PlayerFixturePoints[] | null | undefined {
  const [state, setState] = useState<{ id: number; history: PlayerFixturePoints[] | null }>();
  useEffect(() => {
    let live = true;
    fetchHistory(id).then(
      (history) => live && setState({ id, history }),
      () => live && setState({ id, history: null }),
    );
    return () => {
      live = false;
    };
  }, [id]);
  return state?.id === id ? state.history : undefined;
}

/** Points coloured like fixture difficulty, but the other way round: green for a haul, red for a blank. */
function pointsTone(points: number): number {
  return points >= 9 ? 1 : points >= 6 ? 2 : points >= 4 ? 3 : points >= 2 ? 4 : 5;
}

/** Fixture pills from what the player actually played, so a mid-season move shows the old club's games. */
function playedMetrics(data: GameData, played: PlayerFixturePoints[]): TokenMetric[] {
  return played.map((p) => {
    const f = data.fixturesByGw[p.gw]?.find((x) => x.id === p.fixture);
    const short = data.teamById.get(p.opponent)?.short ?? "?";
    const label = p.home ? short : short.toLowerCase();
    return {
      label: played.length > 1 ? label : `${label} (${p.home ? "H" : "a"})`,
      difficulty: f ? (p.home ? f.homeDifficulty : f.awayDifficulty) : null,
    };
  });
}

/**
 * A player's last `count` gameweeks before `gw` (none later than the current
 * one): fixtures by difficulty, and the points scored, coloured by how good a return it was.
 */
export function PastPointsList({
  data,
  player,
  gw,
  count = 5,
}: {
  data: GameData;
  player: Player;
  gw: number;
  count?: number;
}) {
  const history = usePlayerHistory(player.id);
  const last = Math.min(gw - 1, data.currentGw ?? 0);
  const gws = Array.from({ length: count }, (_, i) => last - count + 1 + i).filter((g) => g >= 1);

  if (gws.length === 0) return <p className="text-xs text-muted">No gameweeks played yet.</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {gws.map((g) => {
        const played = history?.filter((h) => h.gw === g) ?? [];
        const points = played.length ? played.reduce((sum, p) => sum + p.points, 0) : null;
        return (
          <GwRow
            key={g}
            gw={g}
            metrics={played.length ? playedMetrics(data, played) : fixtureMetrics(data, player.team, g)}
          >
            {points == null ? (
              <span className="w-8 shrink-0 text-right font-semibold text-muted tabular-nums">
                {history === undefined ? "…" : "–"}
              </span>
            ) : (
              <FdrPill difficulty={pointsTone(points)} className="w-8 shrink-0 text-xs">
                {points}
              </FdrPill>
            )}
          </GwRow>
        );
      })}
    </ul>
  );
}

/** Recent form beside what's coming: last five gameweeks' points on the left, the next five's xP on the right. */
export function FixtureColumns({ data, player, gw }: { data: GameData; player: Player; gw: number }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-x-4">
      <section>
        <ColumnHeading>Last 5 · points</ColumnHeading>
        <PastPointsList data={data} player={player} gw={gw} />
      </section>
      <section>
        <ColumnHeading>Next 5 · xP</ColumnHeading>
        <FixtureXpList data={data} player={player} gw={gw} />
      </section>
    </div>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">{children}</h3>
  );
}
