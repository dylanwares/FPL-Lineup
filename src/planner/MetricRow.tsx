"use client";

import { Camera, ChevronDown, Shirt } from "@/components/ui/Icons";
import { METRICS, type Metric } from "./metrics";
import { setMetric, setPhotos, usePlanner } from "./store";

const TOGGLE = "flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold";

/** What the pill under each player shows, and shirts or photos. */
export function MetricRow() {
  const metric = usePlanner((s) => s.metric);
  const photos = usePlanner((s) => s.photos);
  // Past gameweeks always show what each player scored; the metric doesn't apply.
  const past = usePlanner((s) => !!s.team && s.gw < s.team.planFromGw);
  const label = past ? "Points scored" : METRICS.find((m) => m.key === metric)?.label;

  return (
    <div className="flex items-center gap-2">
      {/* A native select (the phone's own picker) under a styled pill. */}
      <label
        className={`glass-pill relative flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-xl pr-2.5 pl-3.5 text-[13px] font-semibold focus-within:ring-2 focus-within:ring-[var(--cyan)] ${past ? "opacity-60" : ""}`}
      >
        <span className="min-w-0 truncate">
          <span className="text-muted">Show </span>
          {label}
        </span>
        {!past && <ChevronDown className="ml-auto size-4 shrink-0 text-muted" />}
        <select
          aria-label="Show under each player"
          value={metric}
          disabled={past}
          onChange={(e) => setMetric(e.target.value as Metric)}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
        >
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div role="group" aria-label="Player look" className="glass-pill flex shrink-0 rounded-xl p-1">
        <button
          type="button"
          aria-pressed={!photos}
          onClick={() => setPhotos(false)}
          className={`${TOGGLE} ${photos ? "text-muted" : "accent-soft"}`}
        >
          <Shirt className="size-3.5" />
          Shirts
        </button>
        <button
          type="button"
          aria-pressed={photos}
          onClick={() => setPhotos(true)}
          className={`${TOGGLE} ${photos ? "accent-soft" : "text-muted"}`}
        >
          <Camera className="size-3.5" />
          Photos
        </button>
      </div>
    </div>
  );
}
