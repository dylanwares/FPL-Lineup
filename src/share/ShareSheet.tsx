"use client";

import { useEffect, useMemo, useState } from "react";
import { Close, Download, Share } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import { formationRows } from "@/engine/squad";
import { STARTERS } from "@/engine/types";
import { useGwView } from "@/planner/hooks";
import { CHIP_NAMES, engineContext } from "@/planner/model";
import { scoredIn, tokenProps, type Role } from "@/planner/PitchView";
import { usePlanner } from "@/planner/store";
import { renderShareImage, type SceneInput, type SceneToken } from "./render";

type Result = { blob: Blob; url: string; file: File } | "error" | null;

/**
 * Share lineup: a preview of the image for the gameweek on screen, with Share
 * (the system share sheet, where it takes files) and Save. Sharing waits for
 * a tap here because browsers only allow it straight after one.
 */
export default function ShareSheet({ onClose }: { onClose: () => void }) {
  const scene = useScene();
  const [result, setResult] = useState<Result>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scene) return;
    let live = true;
    let url = "";
    renderShareImage(scene).then(
      (blob) => {
        url = URL.createObjectURL(blob);
        const file = new File([blob], `fpl-lineup-gw${scene.gw}.png`, { type: "image/png" });
        if (live) setResult({ blob, url, file });
        else URL.revokeObjectURL(url);
      },
      () => live && setResult("error"),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [scene, attempt]);

  // Escape closes; the planner's arrow-key shortcuts stay off while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  const ready = result && result !== "error" ? result : null;
  const canShare =
    !!ready && typeof navigator.canShare === "function" && navigator.canShare({ files: [ready.file] });

  async function share() {
    if (!ready || !scene) return;
    try {
      await navigator.share({ files: [ready.file], title: `${scene.teamName} · GW${scene.gw}` });
    } catch (err) {
      // Closing the share sheet isn't a failure; anything else falls back to saving.
      if ((err as DOMException).name !== "AbortError") save();
    }
  }

  function save() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready.url;
    a.download = ready.file.name;
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fade-in absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="glass-strong sheet-in relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] sm:rounded-3xl"
      >
        <header className="flex items-center justify-between">
          <h2 id="share-title" className="font-display text-lg font-bold">
            Share lineup
          </h2>
          <PillButton size="icon" aria-label="Close" onClick={onClose}>
            <Close className="size-4" />
          </PillButton>
        </header>

        <div className="mx-auto aspect-[4/5] w-full max-w-[min(100%,calc(58dvh*0.8))] overflow-hidden rounded-xl bg-[#0a0710] ring-1 ring-white/10">
          {ready ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob preview
            <img
              src={ready.url}
              alt={`${scene?.teamName} lineup for gameweek ${scene?.gw}`}
              className="size-full"
            />
          ) : result === "error" ? (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted">Couldn’t create the image.</p>
              <PillButton
                size="sm"
                onClick={() => {
                  setResult(null);
                  setAttempt(attempt + 1);
                }}
              >
                Try again
              </PillButton>
            </div>
          ) : (
            <div className="grid size-full animate-pulse place-items-center text-sm text-muted">
              Drawing your lineup…
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {canShare && (
            <PillButton variant="neon" className="flex-1 justify-center" onClick={() => void share()}>
              <Share className="size-4" /> Share
            </PillButton>
          )}
          <PillButton
            variant={canShare ? "glass" : "neon"}
            className="flex-1 justify-center"
            disabled={!ready}
            onClick={save}
          >
            <Download className="size-4" /> Save image
          </PillButton>
        </div>
      </div>
    </div>
  );
}

/** The gameweek on screen, as the pitch shows it: same squad, pills, armbands and kits or photos. */
function useScene(): SceneInput | null {
  const view = useGwView();
  const data = usePlanner((s) => s.data);
  const team = usePlanner((s) => s.team);
  const gw = usePlanner((s) => s.gw);
  const metric = usePlanner((s) => s.metric);
  const photos = usePlanner((s) => s.photos);
  const past = usePlanner((s) => s.past[gw]);
  // The view object is new each render; the squad inside it only changes with the plan.
  const squad =
    view.kind === "plan"
      ? view.state
      : view.kind === "past" && view.picks && typeof view.picks === "object"
        ? view.picks
        : null;

  return useMemo(() => {
    if (!data || !team || !squad) return null;

    const { slots, captain, vice } = squad;
    const isPast = gw < team.planFromGw;
    const token = (id: number, withRole: boolean): SceneToken => {
      const role: Role = withRole ? (id === captain ? "C" : id === vice ? "V" : undefined) : undefined;
      const { photo, ...props } = tokenProps(data, id, gw, role, metric, photos, scoredIn(past, id, isPast));
      return { ...props, photoCode: photo ? data.playerById.get(id)?.code : undefined };
    };
    return {
      teamName: team.teamName,
      gw,
      chip: squad.chip ? CHIP_NAMES[squad.chip] : null,
      rows: formationRows(slots, engineContext(data).position).map((row) => row.map((id) => token(id, true))),
      bench: slots.slice(STARTERS).map((id) => token(id, false)),
    };
  }, [squad, data, team, gw, metric, photos, past]);
}
