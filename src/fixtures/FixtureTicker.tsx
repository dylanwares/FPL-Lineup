"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "@/components/ui/Icons";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Segmented } from "@/components/ui/Segmented";
import type { GameData } from "@/data/model";
import { stateAt } from "@/engine/plan";
import { readPref, writePref } from "@/lib/prefs";
import { planResult } from "@/planner/model";
import { usePlanner } from "@/planner/store";
import {
  firstTickerGw,
  lastTickerStart,
  RANGES,
  sortRows,
  squadCounts,
  tickerRows,
  type Range,
  type TickerCell,
  type TickerSort,
} from "./ticker";

const RANGE_KEY = "fpl-lineup:ticker-range";
const SORT_KEY = "fpl-lineup:ticker-sort";

/** The Fixtures tab: every club's next 5 or 8 gameweeks, coloured by FPL difficulty. */
export function FixtureTicker() {
  const data = usePlanner((s) => s.data);
  const dataError = usePlanner((s) => s.dataError);

  return (
    <section aria-labelledby="ticker-title" className="flex flex-col gap-3 py-4">
      <h1 id="ticker-title" className="sr-only">
        Fixtures
      </h1>
      {data ? (
        <Ticker data={data} />
      ) : dataError ? (
        <GlassPanel className="p-5 text-sm text-muted">
          Couldn’t load the fixtures. Check your connection.
        </GlassPanel>
      ) : (
        <div className="glass h-[36rem] animate-pulse rounded-2xl" />
      )}
    </section>
  );
}

function Ticker({ data }: { data: GameData }) {
  const plan = usePlanner((s) => s.plan);
  const [range, setRange] = useState<Range>(() => readPref(RANGE_KEY, RANGES, 5));
  const [sort, setSort] = useState<TickerSort>(() => readPref(SORT_KEY, ["easy", "name"] as const, "easy"));
  const [wanted, setStart] = useState<number | null>(null);
  const [mine, setMine] = useState(false);

  const first = firstTickerGw(data);
  const last = lastTickerStart(data, range);
  const start = Math.min(last, Math.max(first, wanted ?? first));

  // The squad in the active plan at the first gameweek shown.
  const counts = useMemo(() => {
    if (!plan) return null;
    const slots = stateAt(planResult(plan, data), start)?.slots ?? plan.base.slots;
    return squadCounts(data, slots);
  }, [plan, data, start]);

  const rows = useMemo(() => {
    const all = sortRows(tickerRows(data, start, range), sort);
    return mine && counts ? all.filter((r) => counts.has(r.team.id)) : all;
  }, [data, start, range, sort, mine, counts]);

  const gws = rows[0]?.cells.map((c) => c.gw) ?? [];
  const end = Math.min(data.events.length, start + range - 1);
  const flip = useFlip(rows.map((r) => r.team.id).join());

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">Fixture ticker</p>
          <p className="font-display text-xl font-bold">
            GW{start}
            {end > start && `–${end}`}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Earlier gameweeks"
            disabled={start <= first}
            onClick={() => setStart(start - 1)}
            className="glass-pill grid size-10 place-items-center rounded-xl text-fg disabled:opacity-35"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Later gameweeks"
            disabled={start >= last}
            onClick={() => setStart(start + 1)}
            className="glass-pill grid size-10 place-items-center rounded-xl text-fg disabled:opacity-35"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Gameweeks shown"
          value={range}
          options={RANGES.map((r) => [r, `${r} GWs`])}
          onChange={(r) => {
            setRange(r);
            writePref(RANGE_KEY, r);
          }}
        />
        <Segmented
          label="Sort teams"
          value={sort}
          options={[
            ["easy", "Easiest"],
            ["name", "A–Z"],
          ]}
          onChange={(s) => {
            setSort(s);
            writePref(SORT_KEY, s);
          }}
        />
        <button
          type="button"
          aria-pressed={mine && !!counts}
          disabled={!counts}
          title={counts ? undefined : "Enter your FPL team ID on the Planner tab first"}
          onClick={() => setMine(!mine)}
          className={`${mine && counts ? "accent-soft" : "glass-pill text-fg"} h-9 rounded-xl px-3.5 text-[13px] font-semibold disabled:opacity-40`}
        >
          My squad
        </button>
      </div>

      <div className="glass rounded-2xl p-1.5">
        <table className="w-full table-fixed border-separate border-spacing-[3px] text-center">
          <thead>
            <tr className="text-[10px] font-semibold text-muted">
              <th scope="col" className="w-[3.4rem] pb-1 text-left font-semibold">
                <span className="pl-1">Team</span>
              </th>
              {gws.map((gw) => (
                <th key={gw} scope="col" className="pb-1 font-semibold">
                  GW{gw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const count = counts?.get(row.team.id) ?? 0;
              return (
                <tr key={row.team.id} ref={flip(row.team.id)} data-team={row.team.short}>
                  <th scope="row" className="pl-1 text-left font-normal">
                    <span className="flex items-center gap-1">
                      <span className="text-xs font-bold" title={row.team.name}>
                        {row.team.short}
                      </span>
                      {count > 0 && (
                        <span
                          className="grid size-4 place-items-center rounded-full bg-mint/20 text-[9px] font-bold text-mint"
                          aria-label={`${count} of your players`}
                          title={`${count} of your players`}
                        >
                          {count}
                        </span>
                      )}
                    </span>
                    <span className="block text-[9px] text-faint tabular-nums" title="Average difficulty">
                      {row.score.toFixed(1)}
                    </span>
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.gw} className="p-0">
                      <Cell cell={cell} data={data} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-muted">No teams to show.</p>}
      </div>

      <Legend />
    </>
  );
}

function Cell({ cell, data }: { cell: TickerCell; data: GameData }) {
  if (cell.fixtures.length === 0) {
    return (
      <div className="grid h-9 place-items-center rounded-md border border-dashed border-[var(--line)]">
        <span className="sr-only">Blank</span>
      </div>
    );
  }
  const double = cell.fixtures.length > 1;
  return (
    <div className="flex h-9 flex-col gap-px overflow-hidden rounded-md">
      {cell.fixtures.map((f, i) => {
        const team = data.teamById.get(f.opponent);
        const short = team?.short ?? "?";
        return (
          <div
            key={i}
            title={`${team?.name ?? "Unknown"} (${f.home ? "home" : "away"}), difficulty ${f.difficulty}`}
            className={`fdr-${f.difficulty} grid flex-1 place-items-center font-semibold ${double ? "text-[8.5px] leading-none" : "text-[10px]"}`}
          >
            {f.home ? short : short.toLowerCase()}
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-muted">
      <span className="flex items-center gap-1">
        Easy
        {[1, 2, 3, 4, 5].map((d) => (
          <span key={d} className={`fdr-${d} inline-block h-3 w-4 rounded-sm`} />
        ))}
        Hard
      </span>
      <span>HOME in capitals, away in lower case</span>
    </div>
  );
}

/**
 * Animates rows to their new places when the order changes (FLIP), so a
 * re-sort or filter reads as movement rather than a jump.
 */
function useFlip(order: string) {
  const els = useRef(new Map<number, HTMLElement>());
  const tops = useRef(new Map<number, number>());

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<number, number>();
    for (const [id, el] of els.current) {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);
      const before = tops.current.get(id);
      if (!reduce && before !== undefined && before !== top && el.offsetParent) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: "none" }], {
          duration: 320,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    tops.current = next;
  }, [order]);

  return (id: number) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
}
