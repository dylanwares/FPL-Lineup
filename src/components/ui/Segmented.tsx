/** A row of mutually exclusive toggle buttons on one glass pill (e.g. "5 GWs | 8 GWs"). */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="glass-pill flex h-9 rounded-xl p-0.5">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
          className={`rounded-[0.6rem] px-3 text-[13px] font-semibold transition-colors ${v === value ? "accent-soft" : "text-muted"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
