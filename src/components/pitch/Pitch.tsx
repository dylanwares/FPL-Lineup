/**
 * Night-stadium half pitch: floodlit stripes, glowing neon markings and an LED
 * ad board that brands shared screenshots. Goal at the top, as in FPL.
 * Players go in `children`, one element per formation row (GK row first).
 */
export function Pitch({
  children,
  mode = null,
  corner,
  className = "",
}: {
  children: React.ReactNode;
  /** Pinned to the pitch's top-right corner, beside the goalkeeper (e.g. the expected points). */
  corner?: React.ReactNode;
  /** The active mode, outlined round the pitch: mint for subs, violet for transfers. */
  mode?: "sub" | "transfer" | null;
  className?: string;
}) {
  const ring =
    mode === "transfer"
      ? "ring-2 ring-violet"
      : mode === "sub"
        ? "ring-2 ring-mint/70"
        : "ring-1 ring-white/8";
  return (
    <div
      className={`pitch relative overflow-hidden rounded-2xl shadow-[0_12px_32px_rgb(0_0_0/0.35)] transition-shadow ${ring} ${className}`}
    >
      <AdBoard />
      <div className="relative aspect-[400/470]">
        <PitchLines />
        <div className="absolute inset-0 flex flex-col justify-around pt-1 pb-6">{children}</div>
        {/* In the strip between the penalty box and the touchline, below the goal line: even gaps, scaled in %. */}
        {corner && <div className="absolute top-[3.2%] right-[4.6%]">{corner}</div>}
      </div>
    </div>
  );
}

/** One formation row: players spread evenly across the width. */
export function PitchRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start justify-evenly px-1">{children}</div>;
}

function AdBoard() {
  const item = (key: number) => (
    <span key={key} className="flex items-center gap-2.5">
      <span className="text-[#2ee6a6]">FPL Lineup</span>
      <span className="text-white/20">◆</span>
      <span className="text-white/55">fpllineup.com</span>
    </span>
  );
  return (
    <div className="ad-board flex h-7 items-center overflow-hidden">
      <div className="ad-board-text w-full overflow-hidden font-display text-[8.5px] font-bold tracking-[0.22em] whitespace-nowrap uppercase">
        {/* Two identical groups; the track slides by exactly one group for a seamless loop. */}
        <div className="ad-board-track flex w-max">
          {[0, 1].map((group) => (
            <div key={group} className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={group === 1}>
              {[0, 1, 2].map(item)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * The markings on a 400×470 half pitch, goal at the top (shared with the
 * share image's canvas): touchlines and goal line, halfway line, centre
 * circle, goal, six-yard box, penalty box, arc and corner arcs. The penalty
 * spot is drawn separately.
 */
export const PITCH_LINES = [
  "M12 470V8h376v462",
  "M12 458h376",
  "M142 458a58 58 0 1 0 116 0a58 58 0 1 0-116 0",
  "M172 2h56v6h-56Z",
  "M152 8h96v30h-96Z",
  "M92 8h216v90h-216Z",
  "M162 98a46 46 0 0 0 76 0",
  "M12 18a10 10 0 0 0 10-10M378 8a10 10 0 0 0 10 10",
];
export const PENALTY_SPOT = { x: 200, y: 70, r: 2.2 };

function PitchLines() {
  return (
    <svg
      viewBox="0 0 400 470"
      className="pitch-lines absolute inset-0 size-full"
      fill="none"
      stroke="var(--pitch-line)"
      strokeWidth="2"
      aria-hidden="true"
    >
      {PITCH_LINES.map((d) => (
        <path key={d} d={d} />
      ))}
      <circle
        cx={PENALTY_SPOT.x}
        cy={PENALTY_SPOT.y}
        r={PENALTY_SPOT.r}
        fill="var(--pitch-line)"
        stroke="none"
      />
    </svg>
  );
}
