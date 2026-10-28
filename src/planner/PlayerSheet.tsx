"use client";

import { useEffect, useRef } from "react";
import { Kit } from "@/components/Kit";
import { FlagIcon } from "@/components/ui/Badges";
import { Close, EyeOff, Spotlight, Swap, Transfer } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { sellingPrice } from "@/engine/money";
import { canSwap, isStarter } from "@/engine/squad";
import { FixtureXpList } from "./FixtureXpList";
import { useGwView } from "./hooks";
import { playerList } from "./lazy-parts";
import { engineContext, formatPrice, playerFlag, POSITION_NAMES } from "./model";
import {
  closeSheet,
  hidePlayer,
  openSpotlight,
  removePlayer,
  setCaptain,
  setVice,
  startMoveFor,
  usePlanner,
} from "./store";

/** The Sub / Transfer / Remove row: slightly smaller text and padding so a bigger icon fits three across. */
const ACTION = "justify-center gap-1.5! px-2! text-[13px]!";

export function PlayerSheet() {
  const id = usePlanner((s) => s.sheetPlayer);
  if (id == null) return null;
  return <Sheet id={id} />;
}

function Sheet({ id }: { id: number }) {
  const data = usePlanner((s) => s.data)!;
  const gw = usePlanner((s) => s.gw);
  const view = useGwView();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const player = data.playerById.get(id);
  const team = player && data.teamById.get(player.team);
  if (!player || !team) return null;

  const state = view.kind === "plan" ? view.state : null;
  const starter = state ? isStarter(state.slots, id) : false;
  const owned = state ? state.slots.includes(id) : false;
  const ctx = engineContext(data);
  const canSub =
    !!state && owned && state.slots.some((other) => canSwap(state.slots, id, other, ctx.position, ctx.rules));
  const purchase = state?.purchase[id];
  const flag = playerFlag(player);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        className="fade-in absolute inset-0 bg-black/55"
        onClick={closeSheet}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="glass-strong sheet-in relative w-full max-w-lg rounded-t-2xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--line)]" />
        <div className="flex items-start gap-3">
          <Kit kit={team.kit} goalkeeper={player.pos === "GKP"} className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="sheet-title" className="font-display text-xl leading-tight font-bold">
              {player.name}
            </h2>
            <p className="text-sm text-muted">
              {team.name} · {POSITION_NAMES[player.pos]}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <PillButton size="icon" aria-label="Spotlight player" onClick={() => openSpotlight(id)}>
              <Spotlight className="size-4" />
            </PillButton>
            <PillButton size="icon" aria-label="Hide player" onClick={() => hidePlayer(id)}>
              <EyeOff className="size-4" />
            </PillButton>
            <PillButton size="icon" aria-label="Close" onClick={closeSheet}>
              <Close className="size-4" />
            </PillButton>
          </div>
        </div>

        {player.news && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--line)] px-3 py-2 text-xs">
            {flag && <FlagIcon flag={flag} className="mt-px shrink-0" />}
            {player.news}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat label="Price" value={formatPrice(player.price)} />
          <Stat
            label="Sells for"
            value={purchase != null ? `≈${formatPrice(sellingPrice(purchase, player.price))}` : "–"}
          />
          <Stat label="Form" value={player.form.toFixed(1)} />
          <Stat label="Owned" value={`${player.selectedBy.toFixed(1)}%`} />
        </dl>

        <h3 className="mt-5 mb-2 text-[10px] font-semibold tracking-[0.2em] text-muted uppercase">
          Fixtures & projected points
        </h3>
        <FixtureXpList data={data} player={player} gw={gw} />

        {state && owned && (
          <div className="mt-5 flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <PillButton className={ACTION} disabled={!canSub} onClick={() => startMoveFor(id, "sub")}>
                <Swap className="size-5" />
                Sub
              </PillButton>
              <PillButton
                className={ACTION}
                onPointerEnter={() => void playerList.preload().catch(() => {})}
                onClick={() => {
                  void playerList.preload().catch(() => {});
                  startMoveFor(id, "transfer");
                }}
              >
                <Transfer className="size-5" />
                Transfer
              </PillButton>
              <PillButton className={ACTION} onClick={() => removePlayer(id)}>
                <Close className="size-5" />
                Remove
              </PillButton>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <PillButton
                variant="neon"
                className="justify-center"
                disabled={!starter || state.captain === id}
                onClick={() => {
                  setCaptain(id);
                  closeSheet();
                }}
              >
                {state.captain === id ? "Captain" : "Make captain"}
              </PillButton>
              <PillButton
                className="justify-center"
                disabled={!starter || state.vice === id}
                onClick={() => {
                  setVice(id);
                  closeSheet();
                }}
              >
                {state.vice === id ? "Vice-captain" : "Make vice"}
              </PillButton>
            </div>
            {!starter && state.slots.includes(id) && (
              <p className="text-center text-xs text-muted">Bench players can’t wear the armband.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--line)] px-1 py-2">
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
