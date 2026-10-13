/**
 * Night-stadium half pitch: floodlit stripes, glowing neon markings and an LED
 * ad board that brands shared screenshots. Goal at the top, as in FPL.
 * Players go in `children`, one element per formation row (GK row first).
 */
export function Pitch({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`pitch relative overflow-hidden rounded-2xl shadow-[0_12px_32px_rgb(0_0_0/0.35)] ring-1 ring-white/8 ${className}`}
    >
      <AdBoard />
      <div className="relative aspect-[400/470]">
        <PitchLines />
        <div className="absolute inset-0 flex flex-col justify-around pt-1 pb-6">{children}</div>
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
      <div className="ad-board-text flex w-full items-center justify-center gap-2.5 font-display text-[8.5px] font-bold tracking-[0.22em] whitespace-nowrap uppercase">
        {[0, 1, 2].map(item)}
      </div>
    </div>
  );
}

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
      {/* touchlines + goal line, halfway line, centre circle */}
      <path d="M12 470V8h376v462" />
      <path d="M12 458h376" />
      <circle cx="200" cy="458" r="58" />
      {/* goal, six-yard box, penalty box, spot and arc */}
      <rect x="172" y="2" width="56" height="6" />
      <rect x="152" y="8" width="96" height="30" />
      <rect x="92" y="8" width="216" height="90" />
      <circle cx="200" cy="70" r="2.2" fill="var(--pitch-line)" stroke="none" />
      <path d="M162 98a46 46 0 0 0 76 0" />
      {/* corner arcs */}
      <path d="M12 18a10 10 0 0 0 10-10M378 8a10 10 0 0 0 10 10" />
    </svg>
  );
}
