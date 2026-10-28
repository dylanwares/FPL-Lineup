"use client";

import { useEffect, useState } from "react";
import { Kit } from "@/components/Kit";
import { FlagIcon } from "@/components/ui/Badges";
import { FdrPill } from "@/components/ui/FdrPill";
import { Close, EyeOff } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import type { Kit as KitColours } from "@/config/kits";
import { xpFor, type GameData, type Player } from "@/data/model";
import { fixtureMetrics, formatPrice, playerFlag, POSITION_NAMES } from "@/planner/model";
import { closeSpotlight, usePlanner } from "@/planner/store";
import { scoutContext, statDef, type StatId } from "@/scout/stats";

/** Next to the four everyone gets (price, form, points, owned): the numbers that matter for the position. */
const HEADLINE: Record<Player["pos"], StatId[]> = {
  GKP: ["saves", "cleanSheets", "saves90", "xgc90"],
  DEF: ["cleanSheets", "defCon90", "xgi90", "bonus"],
  MID: ["goals", "assists", "xgi90", "bonus"],
  FWD: ["goals", "assists", "xg", "xgi90"],
};

const LABELS: Partial<Record<StatId, string>> = {
  goals: "Goals",
  assists: "Assists",
  saves: "Saves",
  cleanSheets: "Clean sheets",
  saves90: "Saves / 90",
  xgc90: "xGC / 90",
  xgi90: "xGI / 90",
  defCon90: "DC / 90",
};

const FIXTURE_GWS = 5;

/*
 * Player spotlight, for content: one player full-screen in a 9:16 frame over
 * the app, blurred out behind. The top and bottom of the frame are left empty
 * for captions added in an editor. It's always the dark look (like the share
 * image), so the colours are fixed rather than theme tokens. A tap on the
 * backdrop hides the buttons for a clean recording; Reveal blurs the player
 * for a "guess who" and a tap on them brings them back.
 */
export default function Spotlight() {
  const id = usePlanner((s) => s.spotlight);
  const data = usePlanner((s) => s.data);
  const [chrome, setChrome] = useState(true);
  const [hidden, setHidden] = useState(false);

  // Escape closes; the planner's arrow-key shortcuts stay off while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSpotlight();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  const player = id != null ? data?.playerById.get(id) : undefined;
  const team = player && data?.teamById.get(player.team);
  if (!data || !player || !team) return null;

  const ctx = scoutContext(data);
  const flag = playerFlag(player);
  const stats: [string, string][] = [
    ["Price", formatPrice(player.price)],
    ["Form", player.form.toFixed(1)],
    ["Points", String(player.totalPoints)],
    ["Owned", `${player.selectedBy.toFixed(1)}%`],
    ...HEADLINE[player.pos].map((sid): [string, string] => {
      const def = statDef(sid);
      const value = def.get(player, ctx);
      return [LABELS[sid] ?? def.short, value == null ? "–" : def.format(value)];
    }),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name} spotlight`}
      data-testid="spotlight"
      className="fade-in fixed inset-0 z-50 flex justify-center bg-[#0a0710]/60 backdrop-blur-2xl"
      onClick={() => setChrome(!chrome)}
    >
      <div
        className="@container relative flex aspect-[9/16] h-dvh max-w-full flex-col items-center px-[7cqw] text-[#f2f0f7] sm:shadow-[0_0_0_1px_rgb(255_255_255/0.06)]"
        style={{
          background: `radial-gradient(60% 38% at 50% 40%, ${team.kit.primary}26, transparent 70%)`,
        }}
      >
        {/* Caption space above. */}
        <div className="flex-[22]" />

        <button
          type="button"
          aria-label={hidden ? "Reveal player" : player.name}
          className="flex w-full flex-col items-center"
          onClick={(e) => {
            e.stopPropagation();
            if (hidden) setHidden(false);
          }}
        >
          <span
            className={`flex flex-col items-center transition-[filter] duration-500 ease-out ${hidden ? "blur-[14px]" : ""}`}
            data-hidden={hidden || undefined}
          >
            <Photo player={player} kit={team.kit} />
            <span
              className={`mt-[3cqw] block max-w-full font-display leading-none font-bold tracking-tight text-balance break-words ${player.name.length > 11 ? "text-[7cqw]" : "text-[9cqw]"}`}
            >
              {player.name}
            </span>
          </span>
          <span className="mt-[2.5cqw] flex items-center gap-[1.5cqw] text-[3.6cqw] text-[#a09bb5]">
            {flag && <FlagIcon flag={flag} className="size-[3.6cqw]" />}
            {team.name} · {POSITION_NAMES[player.pos]}
          </span>
        </button>

        <dl className="mt-[6cqw] grid w-full grid-cols-4 gap-[2cqw] text-center">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="rounded-[3cqw] bg-white/[0.06] px-[1cqw] py-[2.4cqw] ring-1 ring-white/[0.07]"
            >
              <dt className="truncate text-[2.6cqw] text-[#a09bb5]">{label}</dt>
              <dd className="mt-[0.6cqw] text-[4.6cqw] leading-tight font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <Fixtures data={data} player={player} gw={ctx.gw} />

        {/* Caption space below. */}
        <div className="flex-[20]" />
        <p className="pb-[4cqw] text-[2.8cqw] text-[#a09bb5]/80">fpllineup.com</p>
      </div>

      {chrome && (
        <div className="absolute top-0 right-0 flex gap-2 p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <PillButton
            size="icon"
            pressed={hidden}
            aria-label={hidden ? "Reveal player" : "Hide player"}
            onClick={(e) => {
              e.stopPropagation();
              setHidden(!hidden);
            }}
          >
            <EyeOff className="size-4" />
          </PillButton>
          <PillButton
            size="icon"
            aria-label="Close spotlight"
            onClick={(e) => {
              e.stopPropagation();
              closeSpotlight();
            }}
          >
            <Close className="size-4" />
          </PillButton>
        </div>
      )}
      {chrome && (
        <p className="pointer-events-none absolute top-0 left-0 max-w-[50vw] p-4 pt-[max(env(safe-area-inset-top),1rem)] text-xs text-white/50">
          Tap the background to hide the buttons
        </p>
      )}
    </div>
  );
}

/** The large photo, falling back to the smaller one and then the kit. */
function Photo({ player, kit }: { player: Player; kit: KitColours }) {
  const sources = [`/api/photo/${player.code}?size=xl`, `/api/photo/${player.code}`];
  const [attempt, setAttempt] = useState(0);
  if (attempt >= sources.length) {
    return <Kit kit={kit} goalkeeper={player.pos === "GKP"} className="size-[42cqw]" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a proxied remote PNG; the image optimiser would add a server hop
    <img
      key={attempt}
      src={sources[attempt]}
      alt=""
      width={500}
      height={500}
      draggable={false}
      className="block size-[62cqw] [mask-image:linear-gradient(to_bottom,black_80%,transparent)] object-contain object-bottom"
      onError={() => setAttempt(attempt + 1)}
    />
  );
}

/** The next gameweeks: one column each, a difficulty pill per match (none in a blank) over the projected points. */
function Fixtures({ data, player, gw }: { data: GameData; player: Player; gw: number }) {
  const gws = Array.from({ length: FIXTURE_GWS }, (_, i) => gw + i).filter(
    (g) => g < data.fixturesByGw.length,
  );
  if (gws.length === 0) return null;
  return (
    <ol
      className="mt-[6cqw] grid w-full gap-[2cqw]"
      style={{ gridTemplateColumns: `repeat(${gws.length}, 1fr)` }}
    >
      {gws.map((g) => {
        const fixtures = fixtureMetrics(data, player.team, g);
        const xp = xpFor(data, player, g);
        return (
          <li key={g} className="flex flex-col items-center gap-[1.2cqw]">
            <span className="text-[2.6cqw] font-semibold tracking-[0.15em] text-[#a09bb5]">GW{g}</span>
            <span className="flex w-full flex-col gap-[0.8cqw]">
              {fixtures.length === 0 ? (
                <FdrPill difficulty={null} className="w-full text-[2.8cqw]! leading-[6cqw]!">
                  Blank
                </FdrPill>
              ) : (
                fixtures.map((f, i) => (
                  <FdrPill
                    key={i}
                    difficulty={f.difficulty}
                    className="w-full text-[2.8cqw]! leading-[6cqw]!"
                  >
                    {f.label}
                  </FdrPill>
                ))
              )}
            </span>
            <span className="text-[3.6cqw] font-semibold tabular-nums">
              {xp == null ? "–" : xp.toFixed(1)}
              <span className="ml-[0.5cqw] text-[2.4cqw] font-normal text-[#a09bb5]">xP</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
