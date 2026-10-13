"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Kit } from "@/components/Kit";
import { FdrPill } from "@/components/ui/FdrPill";
import { Close } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { getRules } from "@/config/rules";
import {
  budgetFor,
  candidatesFor,
  DEFAULT_FILTERS,
  type Candidate,
  type CandidateFilters,
  type SortKey,
} from "./candidates";
import { useGwView } from "./hooks";
import { fixtureMetrics, formatPrice } from "./model";
import { buyPlayer, clearSelection, usePlanner } from "./store";

const ROW_HEIGHT = 60;

const SORTS: { key: SortKey; label: string }[] = [
  { key: "xp", label: "Projected pts" },
  { key: "price", label: "Price" },
  { key: "form", label: "Form" },
  { key: "points", label: "Total points" },
  { key: "selected", label: "Selected by" },
];

const PRICE_STEPS = Array.from({ length: 23 }, (_, i) => 40 + i * 5); // £4.0m … £15.0m

function formatValue(sort: SortKey, value: number | null): string {
  if (value == null) return "–";
  switch (sort) {
    case "xp":
    case "form":
      return value.toFixed(1);
    case "price":
      return formatPrice(value);
    case "points":
      return String(value);
    case "selected":
      return `${value.toFixed(1)}%`;
  }
}

/** Transfer mode's bottom sheet: pick a replacement for the selected player. Loaded on demand. */
export default function PlayerList() {
  const out = usePlanner((s) => s.selected);
  const data = usePlanner((s) => s.data);
  const gw = usePlanner((s) => s.gw);
  const view = useGwView();
  const [filters, setFilters] = useState<CandidateFilters>(DEFAULT_FILTERS);
  const query = useDeferredValue(filters.query);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && clearSelection();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const state = view.kind === "plan" ? view.state : null;
  const candidates = useMemo(
    () =>
      data && state && out !== null
        ? candidatesFor(data, state, out, gw, { ...filters, query }, getRules(data.season).squad.maxPerClub)
        : [],
    [data, state, out, gw, filters, query],
  );

  // The React Compiler isn't enabled, so nothing auto-memoises around this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  // New filters: back to the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [filters.sort, filters.team, filters.maxPrice, filters.affordable, query]);

  if (!data || !state || out === null) return null;
  const outPlayer = data.playerById.get(out);
  if (!outPlayer) return null;
  const budget = budgetFor(data, state, out);
  const update = (patch: Partial<CandidateFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const teams = [...data.teams].sort((a, b) => a.name.localeCompare(b.name));
  const selectClass =
    "h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--glass-solid)] px-2 text-xs font-medium text-fg outline-none focus:border-mint";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close player list"
        className="fade-in absolute inset-0 bg-black/55"
        onClick={clearSelection}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-title"
        className="glass-strong sheet-in relative flex h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl"
      >
        <header className="flex flex-col gap-3 border-b border-[var(--line)] px-4 pt-3 pb-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--line)]" />
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 id="list-title" className="font-display text-lg leading-tight font-bold">
                Replace {outPlayer.name}
              </h2>
              <p className="text-xs text-muted">
                Budget <span className={budget < 0 ? "text-magenta" : "text-fg"}>{formatPrice(budget)}</span>{" "}
                · bank plus ≈selling price · GW{gw}
              </p>
            </div>
            <PillButton size="icon" aria-label="Close" onClick={clearSelection}>
              <Close className="size-4" />
            </PillButton>
          </div>

          <input
            type="search"
            placeholder={`Search ${outPlayer.pos === "GKP" ? "goalkeepers" : outPlayer.pos === "DEF" ? "defenders" : outPlayer.pos === "MID" ? "midfielders" : "forwards"}`}
            aria-label="Search players"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            className="h-10 rounded-xl border border-[var(--line)] bg-[var(--glass-solid)] px-3.5 text-sm outline-none placeholder:text-faint focus:border-mint"
          />
          <div className="flex gap-2">
            <select
              aria-label="Team"
              className={selectClass}
              value={filters.team ?? ""}
              onChange={(e) => update({ team: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">All teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Maximum price"
              className={selectClass}
              value={filters.maxPrice ?? ""}
              onChange={(e) => update({ maxPrice: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Any price</option>
              {PRICE_STEPS.map((p) => (
                <option key={p} value={p}>
                  Up to {formatPrice(p)}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort by"
              className={selectClass}
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as SortKey })}
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {candidates.length} player{candidates.length === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2 font-medium">
              Only show affordable
              <input
                type="checkbox"
                checked={filters.affordable}
                onChange={(e) => update({ affordable: e.target.checked })}
                className="size-4 accent-[var(--mint)]"
              />
            </span>
          </label>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {candidates.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted">No players match these filters.</p>
          ) : (
            <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
              {virtualizer.getVirtualItems().map((item) => (
                <li
                  key={item.key}
                  className="absolute inset-x-0 top-0"
                  style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                >
                  <Row candidate={candidates[item.index]} sort={filters.sort} gw={gw} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ candidate, sort, gw }: { candidate: Candidate; sort: SortKey; gw: number }) {
  const data = usePlanner((s) => s.data)!;
  const { player, value, reasons } = candidate;
  const team = data.teamById.get(player.team)!;
  const metrics = fixtureMetrics(data, player.team, gw);
  const flagged = player.status !== "a";

  return (
    <button
      type="button"
      onClick={() => buyPlayer(player.id)}
      data-player={player.name}
      className={`flex h-full w-full items-center gap-3 border-b border-[var(--line)] px-4 text-left transition-colors hover:bg-[var(--line)] ${
        reasons.length ? "opacity-55" : ""
      }`}
    >
      <Kit kit={team.kit} goalkeeper={player.pos === "GKP"} className="size-9 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-sm font-semibold ${flagged ? "text-doubt" : ""}`}>
            {player.name}
          </span>
          <span className="shrink-0 text-[11px] text-muted">{team.short}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {reasons.length ? (
            <span className="truncate text-[11px] text-magenta">{reasons.join(" · ")}</span>
          ) : metrics.length ? (
            metrics.map((m, i) => (
              <FdrPill key={i} difficulty={m.difficulty} className="px-1.5 text-[10px] leading-4">
                {m.label}
              </FdrPill>
            ))
          ) : (
            <FdrPill difficulty={null} className="px-1.5 text-[10px] leading-4">
              Blank
            </FdrPill>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-semibold tabular-nums">{formatValue(sort, value)}</span>
        {sort !== "price" && (
          <span className="text-[11px] text-muted tabular-nums">{formatPrice(player.price)}</span>
        )}
      </span>
    </button>
  );
}
