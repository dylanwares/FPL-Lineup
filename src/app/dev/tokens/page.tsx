import type { Metadata } from "next";
import { Kit } from "@/components/Kit";
import { Bench } from "@/components/pitch/Bench";
import { Pitch, PitchRow } from "@/components/pitch/Pitch";
import { PlayerToken } from "@/components/pitch/PlayerToken";
import { CaptainBadge, FlagIcon } from "@/components/ui/Badges";
import { ChipTile } from "@/components/ui/ChipTile";
import { FdrPill } from "@/components/ui/FdrPill";
import { GlassPanel } from "@/components/ui/GlassPanel";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Shirt,
  Swap,
  Transfer,
  Trash,
} from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { StatTile } from "@/components/ui/StatTile";
import { KITS } from "@/config/kits";
import { MOCK_BENCH, MOCK_XI } from "./mock";

export const metadata: Metadata = { title: "Style guide", robots: { index: false } };

/* ------------------------------------------------------------------ */
/* Planner mock: every element of the planner screen, in spec order.   */
/* ------------------------------------------------------------------ */

function PlannerMock() {
  return (
    <div className="flex flex-col gap-3">
      {/* Plan bar */}
      <div className="flex items-center gap-2">
        <PillButton size="sm" className="min-w-0 flex-1 justify-between">
          <span className="flex min-w-0 items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-mint" />
            <span className="truncate">Free hit GW18</span>
          </span>
          <ChevronDown className="size-4 text-muted" />
        </PillButton>
        <PillButton size="icon" aria-label="New plan">
          <Plus />
        </PillButton>
        <PillButton size="icon" aria-label="Rename plan">
          <Pencil />
        </PillButton>
        <PillButton size="icon" aria-label="Delete plan">
          <Trash />
        </PillButton>
      </div>

      {/* Gameweek navigation */}
      <GlassPanel className="flex flex-col items-center gap-3 px-3 pt-4 pb-3.5">
        <div className="flex w-full items-center justify-between">
          <PillButton variant="soft" size="sm" aria-label="Previous gameweek">
            <ChevronLeft className="size-4" />
            Prev
          </PillButton>
          <div className="text-center">
            <div className="text-[10px] font-semibold tracking-[0.32em] text-muted uppercase">Gameweek</div>
            <div className="font-display text-4xl leading-none font-bold">7</div>
          </div>
          <PillButton variant="soft" size="sm" aria-label="Next gameweek">
            Next
            <ChevronRight className="size-4" />
          </PillButton>
        </div>
        <div className="glass-pill flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-mint" />
          </span>
          <span className="font-semibold tabular-nums">4d 21h 47m</span>
          <span className="text-muted">· Sat 17 Oct, 11:00</span>
        </div>
      </GlassPanel>

      {/* Metric row */}
      <div className="flex items-center gap-2">
        <PillButton size="sm" className="min-w-0 flex-1 justify-between">
          <span className="truncate">
            <span className="text-muted">Show </span>Projected points
          </span>
          <ChevronDown className="size-4 text-muted" />
        </PillButton>
        <div className="glass-pill flex rounded-xl p-1">
          <span className="accent-soft flex h-7 items-center gap-1 rounded-lg px-3 text-xs font-semibold">
            <Shirt className="size-3.5" />
            Shirts
          </span>
          <span className="flex h-7 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-muted">
            <Camera className="size-3.5" />
            Photos
          </span>
        </div>
      </div>

      {/* Stats row */}
      <GlassPanel className="grid grid-cols-3 divide-x divide-[var(--line)]">
        <StatTile label="Transfers" value="1/1" />
        <StatTile label="Bank" value="£0.4m" tone="good" />
        <StatTile label="Cost" value="0 pts" />
      </GlassPanel>

      {/* Chips row */}
      <div className="grid grid-cols-4 gap-2">
        <ChipTile label="Wildcard" state="available" detail="Available" />
        <ChipTile label="Free hit" state="used" detail="Used GW3" />
        <ChipTile label="Triple Cap" state="played" detail="Playing" />
        <ChipTile label="Bench Boost" state="available" detail="Available" />
      </div>

      {/* Pitch */}
      <Pitch>
        {MOCK_XI.map((row, i) => (
          <PitchRow key={i}>
            {row.map((p) => (
              <PlayerToken key={p.name} {...p} />
            ))}
          </PitchRow>
        ))}
      </Pitch>

      {/* Projected points */}
      <GlassPanel className="flex items-center justify-between px-5 py-3">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Projected</span>
        <span className="flex items-baseline gap-1.5">
          <span className="neon-text font-display text-2xl font-bold tabular-nums">71.6</span>
          <span className="text-xs text-muted">pts</span>
        </span>
      </GlassPanel>

      <Bench>
        {MOCK_BENCH.map((p) => (
          <PlayerToken key={p.name} {...p} />
        ))}
      </Bench>

      {/* Mode toggles */}
      <div className="grid grid-cols-2 gap-2">
        <PillButton className="justify-center">
          <Swap />
          Sub
        </PillButton>
        <PillButton pressed className="justify-center">
          <Transfer />
          Transfer
        </PillButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Design system reference                                             */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-bold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span
        className="size-9 shrink-0 rounded-xl ring-1 ring-[var(--line)]"
        style={{ background: `var(--${name})` }}
      />
      <code className="text-muted">--{name}</code>
    </div>
  );
}

const NEON = ["mint", "cyan", "magenta", "violet"];
const CHROME = ["bg", "fg", "muted", "faint", "doubt", "injured"];

export default function StyleGuidePage() {
  return (
    <div className="flex flex-col gap-10 py-6">
      <header className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold tracking-[0.3em] text-muted uppercase">Electric FPL</span>
        <h1 className="font-display text-3xl leading-tight font-bold">
          Style <span className="neon-text">guide</span>
        </h1>
        <p className="text-sm text-muted">
          A static mock of the planner, then the building blocks. Toggle the theme in the header to check the
          light variant.
        </p>
      </header>

      <Section title="Planner">
        <PlannerMock />
      </Section>

      <Section title="Colour">
        <div className="h-10 rounded-xl bg-[image:var(--grad-primary)]" />
        <div className="grid grid-cols-2 gap-2.5">
          {[...NEON, ...CHROME].map((n) => (
            <Swatch key={n} name={n} />
          ))}
        </div>
      </Section>

      <Section title="Type">
        <GlassPanel className="flex flex-col gap-2 p-5">
          <p className="font-display text-2xl font-bold">Unbounded Bold</p>
          <p className="font-display text-base font-bold">Display — titles, gameweek, big numbers</p>
          <p className="text-sm">Inter — interface text, labels and lists. Numbers: 0123456789 £8.5m</p>
          <p className="text-sm text-muted">Muted secondary text for supporting details.</p>
        </GlassPanel>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <PillButton>Glass</PillButton>
          <PillButton variant="neon">Neon</PillButton>
          <PillButton variant="soft">Soft</PillButton>
          <PillButton variant="hot">Hot</PillButton>
          <PillButton pressed>Pressed</PillButton>
          <PillButton disabled>Disabled</PillButton>
          <PillButton size="icon" aria-label="Add">
            <Plus />
          </PillButton>
        </div>
      </Section>

      <Section title="Chips">
        <div className="grid grid-cols-3 gap-2">
          <ChipTile label="Wildcard" state="available" detail="Available" />
          <ChipTile label="Bench Boost" state="played" detail="Playing" />
          <ChipTile label="Free hit" state="used" detail="Used GW3" />
        </div>
      </Section>

      <Section title="Fixture difficulty">
        <div className="flex flex-wrap items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((d) => (
            <FdrPill key={d} difficulty={d} className="px-3">
              FDR {d}
            </FdrPill>
          ))}
          <FdrPill difficulty={null} className="px-3">
            Blank
          </FdrPill>
        </div>
      </Section>

      <Section title="Badges & stats">
        <div className="flex items-center gap-3">
          <CaptainBadge role="C" />
          <CaptainBadge role="V" />
          <FlagIcon flag="doubt" />
          <FlagIcon flag="injured" />
        </div>
        <GlassPanel className="grid grid-cols-3 divide-x divide-[var(--line)]">
          <StatTile label="Transfers" value="3/1" />
          <StatTile label="Bank" value="-£0.6m" tone="danger" />
          <StatTile label="Cost" value="-8 pts" tone="danger" />
        </GlassPanel>
      </Section>

      <Section title="Player states">
        <div className="pitch flex items-start justify-evenly rounded-2xl px-2 pt-5 pb-4">
          <PlayerToken name="Default" kit={KITS[14]} metrics={[{ label: "eve (a)", difficulty: 3 }]} />
          <PlayerToken
            name="Selected"
            kit={KITS[43]}
            selected
            metrics={[{ label: "ars (a)", difficulty: 4 }]}
          />
          <PlayerToken name="Dimmed" kit={KITS[3]} dimmed metrics={[{ label: "BOU (H)", difficulty: 2 }]} />
          <PlayerToken name="Blank" kit={KITS[91]} metrics={[]} />
          <PlayerToken
            name="Injured"
            kit={KITS[1]}
            flag="injured"
            metrics={[{ label: "CHE (H)", difficulty: 3 }]}
          />
        </div>
      </Section>

      <Section title="Kits">
        <GlassPanel className="grid grid-cols-5 gap-x-2 gap-y-4 p-4">
          {Object.entries(KITS).map(([code, kit]) => (
            <div key={code} className="flex flex-col items-center gap-1">
              <div className="flex items-end">
                <Kit kit={kit} className="size-10" />
                <Kit kit={kit} goalkeeper className="-ml-1 size-6" />
              </div>
              <span className="w-full truncate text-center text-[10px] text-muted">{kit.name}</span>
            </div>
          ))}
        </GlassPanel>
      </Section>
    </div>
  );
}
