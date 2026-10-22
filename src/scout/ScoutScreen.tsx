"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Kit } from "@/components/Kit";
import { setTabSearch, TAB_PATHS } from "@/components/nav";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ChevronDown } from "@/components/ui/Icons";
import { fixturesFor, type GameData, type Player } from "@/data/model";
import { stateAt } from "@/engine/plan";
import { isEmptySlot } from "@/engine/types";
import { formatPrice, planResult } from "@/planner/model";
import { usePlanner } from "@/planner/store";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersFromSearch,
  filtersToSearch,
  POSITIONS,
  scoutRows,
  type ScoutFilters,
  type ScoutRow,
} from "./filter";
import {
  COLUMN_SET_IDS,
  COLUMN_SETS,
  RUN_GWS,
  scoutContext,
  statDef,
  statGroups,
  visibleStats,
  type ScoutContext,
  type StatId,
} from "./stats";

const ROW_HEIGHT = 52;
const PRICE_STEPS = Array.from({ length: 24 }, (_, i) => 35 + i * 5); // £3.5m … £15.0m
const OWNED_STEPS = [20, 10, 5, 2, 1];
const MINUTE_STEPS = [90, 270, 450, 900, 1350];

/** The Scout tab: every player, filtered and sorted by any stat. */
export function ScoutScreen({ active }: { active: boolean }) {
  const data = usePlanner((s) => s.data);
  const dataError = usePlanner((s) => s.dataError);

  return (
    <section aria-labelledby="scout-title" className="flex flex-col gap-3 py-4">
      <h1 id="scout-title" className="sr-only">
        Scout
      </h1>
      {data ? (
        <Scout data={data} active={active} />
      ) : dataError ? (
        <GlassPanel className="p-5 text-sm text-muted">
          Couldn’t load the players. Check your connection.
        </GlassPanel>
      ) : (
        <div className="glass h-[36rem] animate-pulse rounded-2xl" />
      )}
    </section>
  );
}

function Scout({ data, active }: { data: GameData; active: boolean }) {
  const plan = usePlanner((s) => s.plan);
  const [filters, setFilters] = useState<ScoutFilters>(() =>
    location.pathname === TAB_PATHS.scout ? filtersFromSearch(data, location.search) : DEFAULT_FILTERS,
  );
  const [panel, setPanel] = useState(false);
  const query = useDeferredValue(filters.query);
  const update = (patch: Partial<ScoutFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const ctx = scoutContext(data);

  useEffect(() => setTabSearch("scout", filtersToSearch(data, filters)), [data, filters]);

  // The squad in the active plan for the first gameweek shown.
  const owned = useMemo(() => {
    if (!plan) return null;
    const slots = stateAt(planResult(plan, data), ctx.gw)?.slots ?? plan.base.slots;
    return new Set(slots.filter((id) => !isEmptySlot(id)));
  }, [plan, data, ctx.gw]);

  const rows = useMemo(
    () => scoutRows(ctx, { ...filters, query, hideOwned: filters.hideOwned && !!owned }, owned ?? undefined),
    [ctx, filters, query, owned],
  );

  const stats = visibleStats(filters.cols, filters.sort);
  const fixtures = !!(COLUMN_SETS[filters.cols] as { fixtures?: boolean }).fixtures;
  const sortBy = (id: StatId) =>
    update(id === filters.sort ? { reverse: !filters.reverse } : { sort: id, reverse: false });
  const filterCount = activeFilterCount(filters);

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <input
          type="search"
          placeholder="Search players or clubs"
          aria-label="Search players or clubs"
          value={filters.query}
          onChange={(e) => update({ query: e.target.value })}
          className="h-11 rounded-xl border border-[var(--line)] bg-[var(--glass-solid)] px-3.5 text-sm outline-none placeholder:text-faint focus:border-mint"
        />

        <div className="flex items-center gap-2">
          <div role="group" aria-label="Positions" className="glass-pill flex h-9 flex-1 rounded-xl p-0.5">
            <Toggle pressed={filters.pos.length === 0} onClick={() => update({ pos: [] })} className="flex-1">
              All
            </Toggle>
            {POSITIONS.map((pos) => (
              <Toggle
                key={pos}
                pressed={filters.pos.includes(pos)}
                onClick={() =>
                  update({
                    pos: filters.pos.includes(pos)
                      ? filters.pos.filter((p) => p !== pos)
                      : [...filters.pos, pos],
                  })
                }
                className="flex-1"
              >
                {pos}
              </Toggle>
            ))}
          </div>
          <button
            type="button"
            aria-expanded={panel}
            aria-controls="scout-filters"
            onClick={() => setPanel(!panel)}
            className={`${filterCount ? "accent-soft" : "glass-pill text-fg"} flex h-9 shrink-0 items-center gap-1 rounded-xl px-3 text-[13px] font-semibold`}
          >
            Filters{filterCount > 0 && ` · ${filterCount}`}
            <ChevronDown className={`size-3.5 transition-transform ${panel ? "rotate-180" : ""}`} />
          </button>
        </div>

        {panel && (
          <FilterPanel
            data={data}
            filters={filters}
            update={update}
            hasPlan={!!owned}
            onReset={() =>
              setFilters({
                ...DEFAULT_FILTERS,
                query: filters.query,
                pos: filters.pos,
                sort: filters.sort,
                reverse: filters.reverse,
                cols: filters.cols,
              })
            }
          />
        )}

        <div
          role="group"
          aria-label="Columns"
          className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 [&::-webkit-scrollbar]:hidden"
        >
          {COLUMN_SET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={filters.cols === id}
              onClick={() => update({ cols: id })}
              className={`${filters.cols === id ? "accent-soft" : "glass-pill text-muted"} h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold`}
            >
              {COLUMN_SETS[id].label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted">
          <span aria-live="polite" className="whitespace-nowrap">
            {rows.length} player{rows.length === 1 ? "" : "s"}
          </span>
          <label className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0">Sort</span>
            <select
              aria-label="Sort by"
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as StatId, reverse: false })}
              className="h-8 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--glass-solid)] px-2 text-xs font-medium text-fg outline-none focus:border-mint"
            >
              {statGroups().map(([group, ids]) => (
                <optgroup key={group} label={group}>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {statDef(id).label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button
              type="button"
              aria-label={filters.reverse ? "Sort in natural order" : "Reverse sort order"}
              title="Reverse"
              onClick={() => update({ reverse: !filters.reverse })}
              className="glass-pill grid size-8 shrink-0 place-items-center rounded-lg text-fg"
            >
              <ChevronDown
                className={`size-3.5 transition-transform ${(statDef(filters.sort).asc ?? false) !== filters.reverse ? "rotate-180" : ""}`}
              />
            </button>
          </label>
        </div>
      </div>

      <Table
        ctx={ctx}
        rows={rows}
        stats={stats}
        fixtures={fixtures}
        filters={filters}
        sortBy={sortBy}
        active={active}
      />
    </>
  );
}

function Toggle({
  pressed,
  onClick,
  className = "",
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded-[0.6rem] px-2 text-[12.5px] font-semibold transition-colors ${pressed ? "accent-soft" : "text-muted"} ${className}`}
    >
      {children}
    </button>
  );
}

function FilterPanel({
  data,
  filters,
  update,
  hasPlan,
  onReset,
}: {
  data: GameData;
  filters: ScoutFilters;
  update: (patch: Partial<ScoutFilters>) => void;
  hasPlan: boolean;
  onReset: () => void;
}) {
  const teams = useMemo(() => [...data.teams].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const num = (v: string) => (v ? Number(v) : null);
  const selectClass =
    "h-9 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--glass-solid)] px-2 text-xs font-medium text-fg outline-none focus:border-mint";

  return (
    <GlassPanel id="scout-filters" className="grid grid-cols-2 gap-x-2.5 gap-y-2 p-3 text-xs">
      <Field label="Club">
        <select
          className={selectClass}
          value={filters.team ?? ""}
          onChange={(e) => update({ team: num(e.target.value) })}
        >
          <option value="">All clubs</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Selected by">
        <select
          className={selectClass}
          value={filters.maxOwned ?? ""}
          onChange={(e) => update({ maxOwned: num(e.target.value) })}
        >
          <option value="">Any</option>
          {OWNED_STEPS.map((o) => (
            <option key={o} value={o}>
              Under {o}%
            </option>
          ))}
        </select>
      </Field>
      <Field label="Min price">
        <select
          className={selectClass}
          value={filters.minPrice ?? ""}
          onChange={(e) => update({ minPrice: num(e.target.value) })}
        >
          <option value="">Any</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              {formatPrice(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Max price">
        <select
          className={selectClass}
          value={filters.maxPrice ?? ""}
          onChange={(e) => update({ maxPrice: num(e.target.value) })}
        >
          <option value="">Any</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              {formatPrice(p)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Minutes played">
        <select
          className={selectClass}
          value={filters.minMinutes || ""}
          onChange={(e) => update({ minMinutes: num(e.target.value) ?? 0 })}
        >
          <option value="">Any</option>
          {MINUTE_STEPS.map((m) => (
            <option key={m} value={m}>
              {m}+
            </option>
          ))}
        </select>
      </Field>
      <Field label="Set pieces">
        <select
          className={selectClass}
          value={filters.setPiece ?? ""}
          onChange={(e) => update({ setPiece: (e.target.value || null) as ScoutFilters["setPiece"] })}
        >
          <option value="">Any</option>
          <option value="pen">On penalties</option>
          <option value="any">On any set piece</option>
        </select>
      </Field>
      <Field label={`Fixtures, next ${RUN_GWS}`}>
        <select
          className={selectClass}
          value={filters.fixtures ?? ""}
          onChange={(e) => update({ fixtures: (e.target.value || null) as ScoutFilters["fixtures"] })}
        >
          <option value="">Any</option>
          <option value="double">Has a double</option>
          <option value="noBlank">No blanks</option>
        </select>
      </Field>
      <div className="flex flex-col justify-end gap-1.5">
        <Check checked={filters.available} onChange={(available) => update({ available })}>
          Available only
        </Check>
        <Check
          checked={filters.hideOwned && hasPlan}
          disabled={!hasPlan}
          onChange={(hideOwned) => update({ hideOwned })}
        >
          Hide my squad
        </Check>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="col-span-2 mt-1 h-8 rounded-lg text-xs font-semibold text-muted hover:text-fg"
      >
        Reset filters
      </button>
    </GlassPanel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function Check({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex items-center gap-2 font-medium ${disabled ? "opacity-40" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--mint)]"
      />
      {children}
    </label>
  );
}

/* ---------------- Table ---------------- */

function Table({
  ctx,
  rows,
  stats,
  fixtures,
  filters,
  sortBy,
  active,
}: {
  ctx: ScoutContext;
  rows: ScoutRow[];
  stats: StatId[];
  fixtures: boolean;
  filters: ScoutFilters;
  sortBy: (id: StatId) => void;
  active: boolean;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);

  // The virtualiser needs the list's offset from the top of the page, which
  // moves when the filter panel opens (the page resizes, so watch the body).
  useLayoutEffect(() => {
    const el = list.current;
    if (!el || !active) return;
    const measure = () => setMargin(el.getBoundingClientRect().top + window.scrollY);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [active]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: margin,
    enabled: active,
  });

  const grid = fixtures
    ? "grid-cols-[minmax(0,1fr)_repeat(5,1.8rem)_2.5rem]"
    : "grid-cols-[minmax(0,1fr)_repeat(4,2.9rem)]";
  const gws = Array.from({ length: RUN_GWS }, (_, i) => ctx.gw + i).filter(
    (g) => g <= ctx.data.events.length,
  );
  const statCols = fixtures ? stats.slice(0, 1) : stats;

  return (
    <div role="table" aria-label="Players" aria-rowcount={rows.length + 1} className="glass rounded-2xl">
      {/* .glass-strong sets position: relative, so the sticky goes on a wrapper. */}
      <div role="rowgroup" className="sticky top-[calc(max(env(safe-area-inset-top),0.75rem)+3.75rem)] z-10">
        <div
          role="row"
          // Opaque (the glass tint over the page colour): rows scroll under it and showed through.
          style={{ background: "linear-gradient(var(--glass-solid), var(--glass-solid)), var(--bg)" }}
          className={`glass-strong grid ${grid} items-center gap-1 rounded-t-2xl px-3 py-2 text-[10px] font-semibold text-muted`}
        >
          <span role="columnheader">Player</span>
          {fixtures &&
            gws.map((gw) => (
              <span key={gw} role="columnheader" className="text-center">
                GW{gw}
              </span>
            ))}
          {statCols.map((id) => {
            const sorted = filters.sort === id;
            const def = statDef(id);
            const ascending = (def.asc ?? false) !== filters.reverse;
            return (
              <span
                key={id}
                role="columnheader"
                aria-sort={sorted ? (ascending ? "ascending" : "descending") : "none"}
                className="text-right"
              >
                <button
                  type="button"
                  title={def.label}
                  onClick={() => sortBy(id)}
                  className={`w-full truncate text-right ${sorted ? "text-mint" : "hover:text-fg"}`}
                >
                  {def.short}
                  {sorted && (ascending ? " ↑" : " ↓")}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      <div ref={list} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <Row
            key={item.key}
            row={rows[item.index]}
            ctx={ctx}
            grid={grid}
            stats={statCols}
            gws={fixtures ? gws : null}
            sort={filters.sort}
            style={{ height: item.size, transform: `translateY(${item.start - margin}px)` }}
          />
        ))}
      </div>
      {rows.length === 0 && (
        <p className="p-6 text-center text-sm text-muted">No players match these filters.</p>
      )}
    </div>
  );
}

const POSITION_NAMES = { GKP: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };

function Row({
  row,
  ctx,
  grid,
  stats,
  gws,
  sort,
  style,
}: {
  row: ScoutRow;
  ctx: ScoutContext;
  grid: string;
  stats: StatId[];
  gws: number[] | null;
  sort: StatId;
  style: React.CSSProperties;
}) {
  const { player, owned } = row;
  const team = ctx.data.teamById.get(player.team)!;
  const flagged = player.status !== "a";

  return (
    <div
      role="row"
      data-player={player.name}
      style={style}
      className={`absolute inset-x-0 top-0 grid ${grid} items-center gap-1 border-t border-[var(--line)] px-3`}
    >
      <span role="rowheader" className="flex min-w-0 items-center gap-2">
        <Kit kit={team.kit} goalkeeper={player.pos === "GKP"} className="size-7 shrink-0" />
        <span className="min-w-0">
          <span className="flex items-center gap-1">
            {owned && (
              <span className="size-1.5 shrink-0 rounded-full bg-mint" title="In your squad">
                <span className="sr-only">In your squad: </span>
              </span>
            )}
            <span className={`truncate text-[13px] font-semibold ${flagged ? "text-doubt" : ""}`}>
              {player.name}
            </span>
          </span>
          <span className="block truncate text-[11px] text-muted">
            {team.short} {POSITION_NAMES[player.pos]}{" "}
            <span className="text-fg">{formatPrice(player.price)}</span>
          </span>
        </span>
      </span>
      {gws?.map((gw) => (
        <FixtureCell key={gw} ctx={ctx} player={player} gw={gw} />
      ))}
      {stats.map((id) => {
        const value = statDef(id).get(player, ctx);
        return (
          <span
            key={id}
            role="cell"
            className={`text-right text-[13px] tabular-nums ${id === sort ? "font-semibold" : "text-muted"}`}
          >
            {value == null ? "–" : statDef(id).format(value)}
          </span>
        );
      })}
    </div>
  );
}

function FixtureCell({ ctx, player, gw }: { ctx: ScoutContext; player: Player; gw: number }) {
  const list = fixturesFor(ctx.data, player.team, gw);
  if (list.length === 0) {
    return (
      <span
        role="cell"
        className="grid h-8 place-items-center rounded-md border border-dashed border-[var(--line)]"
      >
        <span className="sr-only">Blank</span>
      </span>
    );
  }
  return (
    <span role="cell" className="flex h-8 flex-col gap-px overflow-hidden rounded-md">
      {list.map((f) => {
        const home = f.home === player.team;
        const opp = ctx.data.teamById.get(home ? f.away : f.home);
        const short = opp?.short ?? "?";
        return (
          <span
            key={f.id}
            title={`${opp?.name ?? "Unknown"} (${home ? "home" : "away"})`}
            className={`fdr-${home ? f.homeDifficulty : f.awayDifficulty} grid flex-1 place-items-center font-semibold ${list.length > 1 ? "text-[8px] leading-none" : "text-[9px]"}`}
          >
            {home ? short : short.toLowerCase()}
          </span>
        );
      })}
    </span>
  );
}
