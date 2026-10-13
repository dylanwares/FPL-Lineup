"use client";

import { useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ChevronDown } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { connect, usePlanner } from "./store";

export function ConnectScreen() {
  const importing = usePlanner((s) => s.phase === "importing");
  const error = usePlanner((s) => s.importError);
  const [value, setValue] = useState("");
  const id = Number(value);
  const valid = /^\d{1,10}$/.test(value) && id > 0;

  return (
    <section className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold tracking-[0.3em] text-muted uppercase">FPL planner</span>
        <h1 className="font-display text-3xl leading-tight font-bold">
          Plan every <span className="neon-text">gameweek</span>
        </h1>
        <p className="text-sm text-muted">
          Load your team, then plan transfers, captains and chips for every gameweek to GW38. No sign-up
          needed.
        </p>
      </div>

      <GlassPanel className="p-5">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !importing) void connect(id);
          }}
        >
          <label htmlFor="entry-id" className="text-xs font-semibold text-muted">
            Your FPL team ID
          </label>
          <input
            id="entry-id"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 1234567"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))}
            aria-invalid={!!error}
            aria-describedby={error ? "entry-error" : undefined}
            className="h-12 rounded-xl border border-[var(--line)] bg-[var(--glass-solid)] px-4 text-lg font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-faint focus:border-mint"
          />
          {error && (
            <p id="entry-error" role="alert" className="text-sm text-injured">
              {error}
            </p>
          )}
          <PillButton type="submit" variant="neon" disabled={!valid || importing} className="justify-center">
            {importing ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading your team…
              </>
            ) : (
              "Load my team"
            )}
          </PillButton>
        </form>

        <details className="group mt-4 border-t border-[var(--line)] pt-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between text-muted">
            Where do I find my team ID?
            <ChevronDown className="size-4 transition group-open:rotate-180" />
          </summary>
          <p className="mt-2 leading-relaxed text-muted">
            Sign in at{" "}
            <a
              href="https://fantasy.premierleague.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg underline-offset-2 hover:underline focus-visible:underline"
            >
              fantasy.premierleague.com
            </a>{" "}
            and open the{" "}
            <span className="text-fg">Points</span> tab. Your ID is the number after{" "}
            <span className="text-fg">/entry/</span> in the address bar, for example …/entry/
            <span className="font-semibold text-mint">1234567</span>/event/6.
          </p>
        </details>
      </GlassPanel>
    </section>
  );
}
