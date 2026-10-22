import { FdrPill } from "@/components/ui/FdrPill";
import { xpFor, type GameData, type Player } from "@/data/model";
import { fixtureMetrics } from "./model";

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
        const metrics = fixtureMetrics(data, player.team, g);
        const xp = xpFor(data, player, g);
        return (
          <li key={g} className="flex items-center gap-3 text-sm">
            <span className="w-10 text-xs text-muted tabular-nums">GW{g}</span>
            <span className="flex flex-1 gap-1">
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
            <span className="w-12 text-right font-semibold tabular-nums">
              {xp == null ? "–" : xp.toFixed(1)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
