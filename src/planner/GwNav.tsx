"use client";

import { GlassPanel } from "@/components/ui/GlassPanel";
import { ChevronLeft, ChevronRight } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { useNow } from "./hooks";
import { formatCountdown, formatDeadline } from "./model";
import { stepGw, usePlanner } from "./store";

const HOUR = 3_600_000;

export function GwNav() {
  const gw = usePlanner((s) => s.gw);
  const first = usePlanner((s) => s.team?.startedGw ?? 1);
  const planFrom = usePlanner((s) => s.team?.planFromGw ?? 1);
  const events = usePlanner((s) => s.data?.events);
  if (!events) return null;
  const event = events[gw - 1];

  return (
    <GlassPanel as="nav" aria-label="Gameweek" className="flex flex-col items-center gap-3 px-3 pt-4 pb-3.5">
      <div className="flex w-full items-center justify-between">
        <PillButton
          variant="soft"
          size="sm"
          aria-label="Previous gameweek"
          disabled={gw <= first}
          onClick={() => stepGw(-1)}
        >
          <ChevronLeft className="size-4" />
          Prev
        </PillButton>
        <div className="text-center" aria-live="polite">
          <div className="text-[10px] font-semibold tracking-[0.32em] text-muted uppercase">Gameweek</div>
          <div className="font-display text-4xl leading-none font-bold tabular-nums">{gw}</div>
        </div>
        <PillButton
          variant="soft"
          size="sm"
          aria-label="Next gameweek"
          disabled={gw >= events.length}
          onClick={() => stepGw(1)}
        >
          Next
          <ChevronRight className="size-4" />
        </PillButton>
      </div>
      {event && (
        <GwStatus
          deadline={event.deadline}
          finished={event.finished}
          planned={gw >= planFrom}
          upcoming={gw === planFrom}
        />
      )}
    </GlassPanel>
  );
}

function GwStatus({
  deadline,
  finished,
  planned,
  upcoming,
}: {
  deadline: number;
  finished: boolean;
  planned: boolean;
  /** The next gameweek to be played (the plan's first). */
  upcoming: boolean;
}) {
  const now = useNow();
  // Future gameweeks have no dot; the next one warns as its deadline nears.
  let dot: string | null = null;
  let label: React.ReactNode;
  if (planned && deadline > now) {
    if (upcoming) {
      const left = deadline - now;
      dot = left < HOUR ? "bg-injured" : left < 24 * HOUR ? "bg-urgent" : "bg-mint";
    }
    // Only the next gameweek counts down; later ones just show their deadline date.
    label = upcoming ? (
      <>
        <span className="font-semibold tabular-nums">{formatCountdown(deadline - now)}</span>
        <span className="text-muted">· {formatDeadline(deadline)}</span>
      </>
    ) : (
      <>
        <span className="text-muted">Deadline</span>
        <span className="font-semibold">{formatDeadline(deadline)}</span>
      </>
    );
  } else if (planned) {
    dot = "bg-doubt";
    label = <span className="text-muted">Deadline passed · refresh your team</span>;
  } else {
    dot = finished ? "bg-faint" : "bg-doubt";
    label = <span className="text-muted">{finished ? "Finished" : "In progress"} · your actual team</span>;
  }
  return (
    <div className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
      {dot && <span className={`size-2 rounded-full ${dot}`} />}
      {label}
    </div>
  );
}
