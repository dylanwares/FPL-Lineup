import { Pitch, PitchRow } from "@/components/pitch/Pitch";
import { GlassPanel } from "@/components/ui/GlassPanel";

const ROWS = [1, 4, 4, 2];

function TokenSkeleton() {
  return (
    <div className="flex w-[68px] flex-col items-center gap-1 sm:w-[76px]">
      <div className="size-11 animate-pulse rounded-xl bg-white/10 sm:size-12" />
      <div className="h-[36px] w-full animate-pulse rounded-md bg-white/10" />
    </div>
  );
}

/** Server-rendered placeholder in the planner's real layout, so the page paints before data loads. */
export function PlannerSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-4" aria-busy="true" aria-label="Loading planner">
      <div className="h-9 animate-pulse rounded-xl bg-[var(--line)]" />
      <GlassPanel className="h-[132px]" />
      <GlassPanel className="h-[68px]" />
      <Pitch>
        {ROWS.map((n, i) => (
          <PitchRow key={i}>
            {Array.from({ length: n }, (_, j) => (
              <TokenSkeleton key={j} />
            ))}
          </PitchRow>
        ))}
      </Pitch>
    </div>
  );
}
