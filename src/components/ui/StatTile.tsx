const TONES = {
  default: "text-fg",
  good: "neon-text",
  danger: "text-magenta",
};

/** One labelled figure, e.g. Bank £0.4m. Place several inside a GlassPanel. */
export function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-3">
      <span className="text-[10px] font-medium tracking-[0.14em] text-muted uppercase">{label}</span>
      <span className={`font-display text-lg leading-none font-bold tabular-nums ${TONES[tone]}`}>
        {value}
      </span>
    </div>
  );
}
