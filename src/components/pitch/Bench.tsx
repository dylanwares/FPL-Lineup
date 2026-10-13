import { Children } from "react";

const LABELS = ["GK", "1", "2", "3"];

/** The four substitutes in priority order, on a glass strip below the pitch. Pass four player tokens. */
export function Bench({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Bench" className="glass rounded-2xl px-2 pt-2.5 pb-3">
      <h3 className="mb-1.5 px-2 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">Bench</h3>
      <div className="flex items-start justify-evenly">
        {Children.toArray(children).map((child, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--line)] px-1 text-[9px] font-bold text-muted tabular-nums">
              {LABELS[i]}
            </span>
            {child}
          </div>
        ))}
      </div>
    </section>
  );
}
