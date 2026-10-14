"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy, Pencil, Refresh, Trash } from "@/components/ui/Icons";
import { PillButton } from "@/components/ui/PillButton";
import type { Plan } from "@/engine/types";
import { MAX_PLAN_NAME, uniquePlanName } from "./model";
import {
  closePlanUi,
  createPlan,
  deleteCurrentPlan,
  duplicatePlan,
  openPlanUi,
  refreshTeamFromMenu,
  renamePlan,
  selectPlan,
  usePlanner,
} from "./store";

const changes = (plan: Plan) =>
  plan.moves.length === 0 ? "No changes" : `${plan.moves.length} change${plan.moves.length === 1 ? "" : "s"}`;

/** The plan dropdown, the ⋯ menu and the name / rename / delete dialogs (loaded on first use). */
export function PlanMenus() {
  const ui = usePlanner((s) => s.planUi);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePlanUi();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  switch (ui) {
    case "list":
      return <PlanList />;
    case "actions":
      return <PlanActions />;
    case "create":
      return <CreateDialog />;
    case "rename":
      return <RenameDialog />;
    case "delete":
      return <DeleteDialog />;
    default:
      return null;
  }
}

/** A menu under the plan bar; a tap outside closes it. */
function Popover({
  label,
  role,
  align,
  children,
}: {
  label: string;
  role: "listbox" | "menu";
  align: "full" | "end";
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[aria-selected="true"], button')?.focus();
  }, []);
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fixed inset-0 z-40 cursor-default"
        onClick={closePlanUi}
      />
      {/* .glass-strong sets position: relative (unlayered, so it beats `absolute`): position a wrapper instead. */}
      <div className={`absolute top-12 z-50 ${align === "full" ? "inset-x-0" : "right-0 w-60"}`}>
        <div
          ref={panel}
          role={role}
          aria-label={label}
          className="glass-strong fade-in flex max-h-[60vh] flex-col overflow-y-auto rounded-xl p-1.5"
          // Opaque: the glass fill over the page colour, so the gameweek header can't show through.
          style={{ background: "linear-gradient(var(--glass-solid), var(--glass-solid)), var(--bg)" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

const ITEM =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-[var(--line)] focus-visible:bg-[var(--line)] outline-none";

function PlanList() {
  const plans = usePlanner((s) => s.plans);
  const current = usePlanner((s) => s.plan?.id);
  return (
    <Popover label="Plans" role="listbox" align="full">
      {plans.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={p.id === current}
          className={ITEM}
          onClick={() => selectPlan(p.id)}
        >
          <span className="grid size-4 shrink-0 place-items-center text-mint">
            {p.id === current && <Check className="size-4" />}
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
          <span className="shrink-0 text-xs text-muted">{changes(p)}</span>
        </button>
      ))}
    </Popover>
  );
}

function PlanActions() {
  const refreshing = usePlanner((s) => s.refreshing);
  return (
    <Popover label="More options" role="menu" align="end">
      <button type="button" role="menuitem" className={ITEM} onClick={() => openPlanUi("rename")}>
        <Pencil className="size-4 text-muted" /> Rename
      </button>
      <button type="button" role="menuitem" className={ITEM} onClick={duplicatePlan}>
        <Copy className="size-4 text-muted" /> Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${ITEM} text-injured`}
        onClick={() => openPlanUi("delete")}
      >
        <Trash className="size-4" /> Delete
      </button>
      <div role="separator" className="mx-2 my-1 h-px bg-[var(--line)]" />
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={refreshing}
        onClick={() => void refreshTeamFromMenu()}
      >
        <Refresh className={`size-4 text-muted ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing…" : "Refresh team from FPL"}
      </button>
    </Popover>
  );
}

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="fade-in absolute inset-0 bg-black/55"
        onClick={closePlanUi}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-dialog-title"
        className="glass-strong toast-in relative flex w-full max-w-sm flex-col gap-4 rounded-2xl p-5"
      >
        <h2 id="plan-dialog-title" className="font-display text-lg font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** New: the plan is only created once it has a name; Cancel leaves nothing behind. */
function CreateDialog() {
  const plans = usePlanner((s) => s.plans);
  return (
    <NameDialog
      title="Name your plan"
      hint="Starts from your current squad with no changes."
      initial={uniquePlanName(plans, "New plan")}
      submit="Create"
      onSubmit={createPlan}
    />
  );
}

function RenameDialog() {
  const name = usePlanner((s) => s.plan?.name ?? "");
  return <NameDialog title="Rename plan" initial={name} submit="Save" onSubmit={renamePlan} />;
}

function NameDialog({
  title,
  hint,
  initial,
  submit,
  onSubmit,
}: {
  title: string;
  hint?: string;
  initial: string;
  submit: string;
  onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.select(), []);

  return (
    <Dialog title={title}>
      {hint && <p className="-mt-2 text-sm text-muted">{hint}</p>}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
      >
        <input
          ref={input}
          aria-label="Plan name"
          value={value}
          maxLength={MAX_PLAN_NAME}
          onChange={(e) => setValue(e.target.value)}
          className="glass-pill h-11 rounded-xl px-3.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan)]"
        />
        <div className="flex justify-end gap-2">
          <PillButton size="sm" onClick={closePlanUi}>
            Cancel
          </PillButton>
          <PillButton size="sm" variant="neon" type="submit" disabled={!value.trim()}>
            {submit}
          </PillButton>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog() {
  const plan = usePlanner((s) => s.plan);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => cancel.current?.focus(), []);
  if (!plan) return null;

  return (
    <Dialog title={`Delete “${plan.name}”?`}>
      <p className="text-sm text-muted">
        {plan.moves.length
          ? `Its ${changes(plan).toLowerCase()} will be deleted with it.`
          : "It has no planned changes."}
      </p>
      <div className="flex justify-end gap-2">
        <PillButton ref={cancel} size="sm" onClick={closePlanUi}>
          Cancel
        </PillButton>
        <PillButton size="sm" className="text-injured" onClick={deleteCurrentPlan}>
          Delete
        </PillButton>
      </div>
    </Dialog>
  );
}
