/** The crowned FPL Lineup wordmark: neon crown, Unbounded lettering. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 26"
        className="h-[22px] w-auto drop-shadow-[0_0_6px_rgb(46_230_166/0.3)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="crown-gradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="var(--mint)" />
            <stop offset="1" stopColor="var(--cyan)" />
          </linearGradient>
        </defs>
        <path d="M3 20 1 5l8.5 7L16 1l6.5 11L31 5l-2 15Z" fill="url(#crown-gradient)" />
        <rect x="3" y="21.5" width="26" height="3.5" rx="1.75" fill="url(#crown-gradient)" />
        <circle cx="16" cy="13.5" r="2" fill="var(--bg)" opacity="0.55" />
      </svg>
      <span className="font-display text-[15px] leading-none font-bold tracking-tight uppercase">
        FPL <span className="neon-text">Lineup</span>
      </span>
    </span>
  );
}
