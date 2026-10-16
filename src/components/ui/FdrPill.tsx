/** The colour class for a fixture difficulty (1–5), or the neutral one for null. */
export function fdrTone(difficulty: number | null): string {
  return difficulty == null ? "fdr-blank" : `fdr-${Math.min(5, Math.max(1, difficulty))}`;
}

/** A fixture-difficulty coloured pill. `difficulty` null means a blank gameweek. */
export function FdrPill({
  difficulty,
  children,
  className = "",
}: {
  difficulty: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  const tone = fdrTone(difficulty);
  return (
    <span
      className={`${tone} inline-flex items-center justify-center rounded-md px-1.5 text-[10.5px] leading-[18px] font-semibold tabular-nums ${className}`}
    >
      {children}
    </span>
  );
}
