"use client";

import { useEffect, useRef, useState } from "react";
import { Kit } from "@/components/Kit";
import { goTo } from "@/components/nav";
import { FlagIcon } from "@/components/ui/Badges";
import { Close, Spotlight, Star, Transfer } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { getRules } from "@/config/rules";
import type { Player } from "@/data/model";
import { stateAt } from "@/engine/plan";
import { FixtureXpList } from "@/planner/FixtureXpList";
import { formatPrice, planResult, playerFlag, POSITION_NAMES } from "@/planner/model";
import { openSpotlight, plannableGw, setGw, transferPlayer, usePlanner } from "@/planner/store";
import { statDef, type ScoutContext, type StatId } from "./stats";
import { transferOptions, type TransferOption } from "./transfer";
import { toggleWatch, useWatchlist } from "./watchlist";

/** Plainer labels than the column headers, where those are cryptic. */
const LABELS: Partial<Record<StatId, string>> = {
  cleanSheets: "Clean sheets",
  goalsConceded: "Conceded",
  xgc90: "xGC per 90",
  defCon: "Def. contrib.",
  defCon90: "DC per 90",
  saves90: "Saves per 90",
  penaltiesSaved: "Pens saved",
  xgi90: "xGI per 90",
  gMinusXg: "Goals − xG",
  minsPct: "Minutes %",
  priceStart: "Price, season",
  priceGw: "Price, this GW",
  netTransfers: "Net transfers",
  selected: "Selected by",
};

type Section = [title: string, stats: StatId[]];

const ATTACK: Section = ["Attack", ["goals", "assists", "xg", "xa", "xgi90", "gMinusXg"]];
const SEASON: Section = ["Season", ["minutes", "starts", "minsPct", "bonus", "bps", "ict"]];
const MARKET: Section = ["Market", ["selected", "netTransfers", "priceGw", "priceStart"]];

/** The stat sections that matter for each position, most relevant first. */
const SECTIONS: Record<Player["pos"], Section[]> = {
  GKP: [
    ["Goalkeeping", ["saves", "saves90", "penaltiesSaved", "cleanSheets", "goalsConceded", "xgc90"]],
    SEASON,
    MARKET,
  ],
  DEF: [["Defence", ["cleanSheets", "goalsConceded", "xgc90", "defCon", "defCon90"]], ATTACK, SEASON, MARKET],
  MID: [ATTACK, ["Defence", ["cleanSheets", "defCon", "defCon90"]], SEASON, MARKET],
  FWD: [ATTACK, ["Defence", ["defCon", "defCon90"]], SEASON, MARKET],
};

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** Scout's player sheet: the player's numbers, a watchlist star, and a transfer into the plan. */
export function ScoutSheet({ ctx, id, onClose }: { ctx: ScoutContext; id: number; onClose: () => void }) {
  const { data } = ctx;
  const panel = useRef<HTMLDivElement>(null);
  const watched = useWatchlist((s) => s.ids.includes(id));

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const player = data.playerById.get(id);
  const team = player && data.teamById.get(player.team);
  if (!player || !team) return null;

  const flag = playerFlag(player);
  const setPieces = (
    [
      ["Penalties", player.stats.penOrder],
      ["Corners & indirect FKs", player.stats.cornerOrder],
      ["Direct free kicks", player.stats.fkOrder],
    ] as const
  ).filter(([, order]) => order > 0);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="fade-in absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="scout-sheet-title"
        tabIndex={-1}
        className="glass-strong sheet-in relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl outline-none"
      >
        <div className="px-5 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
          <div className="flex items-start gap-3">
            <Kit kit={team.kit} goalkeeper={player.pos === "GKP"} className="size-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 id="scout-sheet-title" className="font-display text-xl leading-tight font-bold">
                {player.name}
              </h2>
              <p className="text-sm text-muted">
                {team.name} · {POSITION_NAMES[player.pos]}
              </p>
            </div>
            <PillButton
              size="icon"
              aria-label="Spotlight player"
              onClick={() => {
                openSpotlight(id);
                onClose();
              }}
            >
              <Spotlight className="size-4" />
            </PillButton>
            <PillButton
              size="icon"
              pressed={watched}
              aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
              onClick={() => toggleWatch(id)}
            >
              <Star filled={watched} className="size-4" />
            </PillButton>
            <PillButton size="icon" aria-label="Close" onClick={onClose}>
              <Close className="size-4" />
            </PillButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {player.news && (
            <p className="mb-3 flex items-start gap-2 rounded-xl bg-[var(--line)] px-3 py-2 text-xs">
              {flag && <FlagIcon flag={flag} className="mt-px shrink-0" />}
              {player.news}
            </p>
          )}

          <dl className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Price" value={formatPrice(player.price)} />
            <Stat label="Form" value={player.form.toFixed(1)} />
            <Stat label="Points" value={String(player.totalPoints)} />
            <Stat label="PPG" value={statDef("ppg").format(player.stats.ppg)} />
          </dl>

          <TransferIn ctx={ctx} player={player} onDone={onClose} />

          <Heading>Fixtures & projected points</Heading>
          <FixtureXpList data={data} player={player} gw={ctx.gw} />

          {SECTIONS[player.pos].map(([title, ids]) => (
            <section key={title}>
              <Heading>{title}</Heading>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {ids.map((sid) => {
                  const def = statDef(sid);
                  const value = def.get(player, ctx);
                  return (
                    <Stat
                      key={sid}
                      label={LABELS[sid] ?? def.short}
                      title={def.label}
                      value={value == null ? "–" : def.format(value)}
                    />
                  );
                })}
              </dl>
            </section>
          ))}

          {setPieces.length > 0 && (
            <>
              <Heading>Set pieces</Heading>
              <ul className="flex flex-col gap-1 text-sm">
                {setPieces.map(([label, order]) => (
                  <li key={label} className="flex justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold">{ordinal(order)} choice</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Buying the player into the plan: pick who goes out (same position), and the
 * transfer lands in the planner's gameweek with the planner's own Undo toast.
 */
function TransferIn({ ctx, player, onDone }: { ctx: ScoutContext; player: Player; onDone: () => void }) {
  const { data } = ctx;
  const plan = usePlanner((s) => s.plan);
  const team = usePlanner((s) => s.team);
  usePlanner((s) => s.gw); // plannableGw() reads it
  const [open, setOpen] = useState(false);

  const gw = plannableGw();
  if (!plan || !team || gw == null) {
    return (
      <p className="mt-4 rounded-xl bg-[var(--line)] px-3 py-2.5 text-xs text-muted">
        Enter your FPL team ID on the{" "}
        <button type="button" className="font-semibold text-fg underline" onClick={() => goTo("planner")}>
          Planner
        </button>{" "}
        to plan transfers from here.
      </p>
    );
  }

  const state = stateAt(planResult(plan, data), gw);
  if (!state) return null;
  const options = transferOptions(data, state, player, getRules(data.season).squad.maxPerClub);
  if (options === null) {
    return (
      <PillButton className="mt-4 w-full justify-center" onClick={() => goTo("planner")}>
        In your squad for GW{gw} · View in planner
      </PillButton>
    );
  }

  const transfer = (option: TransferOption) => {
    if (usePlanner.getState().gw !== gw) setGw(gw);
    transferPlayer(option.out, player.id);
    onDone();
    goTo("planner");
  };

  if (!open) {
    return (
      <PillButton variant="neon" className="mt-4 w-full justify-center" onClick={() => setOpen(true)}>
        <Transfer className="size-5" />
        Transfer in for GW{gw}
      </PillButton>
    );
  }

  return (
    <section className="mt-4">
      <Heading className="mt-0!">Who goes out? · GW{gw}</Heading>
      <ul className="flex flex-col overflow-hidden rounded-xl border border-[var(--line)]">
        {options.map((o) => {
          const outTeam = data.teamById.get(o.outPlayer.team);
          return (
            <li key={o.out} className="border-t border-[var(--line)] first:border-t-0">
              <button
                type="button"
                onClick={() => transfer(o)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--line)] ${o.reasons.length ? "opacity-60" : ""}`}
              >
                {o.empty || !outTeam ? (
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-dashed border-[var(--line)] text-xs text-muted">
                    +
                  </span>
                ) : (
                  <Kit kit={outTeam.kit} goalkeeper={o.outPlayer.pos === "GKP"} className="size-8 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {o.empty ? `Empty slot (was ${o.outPlayer.name})` : o.outPlayer.name}
                  </span>
                  <span
                    className={`block truncate text-[11px] ${o.reasons.length ? "text-magenta" : "text-muted"}`}
                  >
                    {o.reasons.length ? o.reasons.join(" · ") : `Budget ${formatPrice(o.budget)}`}
                  </span>
                </span>
                <Transfer className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      {options.length === 0 && <p className="text-xs text-muted">No one in this position to replace.</p>}
    </section>
  );
}

function Heading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={`mt-5 mb-2 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase ${className}`}>
      {children}
    </h3>
  );
}

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-xl bg-[var(--line)] px-1 py-2" title={title}>
      <dt className="truncate text-[10px] text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
