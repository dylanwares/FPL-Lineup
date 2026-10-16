import { deletePlan as deleteStoredPlan } from "@/data/db";
import type { Plan } from "@/engine/types";
import { scheduleSync } from "@/sync/trigger";
import { copyPlan, MAX_PLAN_NAME, newPlan, uniquePlanName } from "./model";
import {
  byCreated,
  commitPlan,
  persistPlan,
  refreshTeam,
  rememberPlanId,
  showToast,
  usePlanner,
} from "./store";

/*
 * Named-plan actions. Only the lazy plan menus call these, so they load with
 * them and stay out of first-load JS.
 */

const set = usePlanner.setState;
const get = usePlanner.getState;

/** Shows another of the team's plans. Undo toasts belong to the old plan, so they go. */
export function selectPlan(id: string) {
  const plan = get().plans.find((p) => p.id === id);
  set({ planUi: null });
  if (!plan || plan.id === get().plan?.id) return;
  rememberPlanId(plan);
  set({ plan, selected: null, sheetPlayer: null, dragFrom: null, dragOver: null, toasts: [] });
}

function addPlan(plan: Plan, message: string) {
  commitPlan(plan);
  rememberPlanId(plan);
  set({ selected: null, sheetPlayer: null, toasts: [] });
  showToast(message);
}

/** A new plan from the current squad with no moves, named in the "Name your plan" box. */
export function createPlan(name: string) {
  const { team, plans } = get();
  const trimmed = name.trim().slice(0, MAX_PLAN_NAME);
  set({ planUi: null });
  if (!team || !trimmed) return;
  const plan = newPlan(team, uniquePlanName(plans, trimmed));
  addPlan(plan, `Created ${plan.name}`);
}

/** A copy of the plan on screen, moves and all, to try another route. */
export function duplicatePlan() {
  const { plan, plans } = get();
  if (!plan) return;
  const copy = copyPlan(plan, uniquePlanName(plans, `${plan.name} copy`.slice(0, MAX_PLAN_NAME)));
  set({ planUi: null });
  addPlan(copy, `Duplicated as ${copy.name}`);
}

export function renamePlan(name: string) {
  const { plan } = get();
  const trimmed = name.trim().slice(0, MAX_PLAN_NAME);
  set({ planUi: null });
  if (!plan || !trimmed || trimmed === plan.name) return;
  commitPlan({ ...plan, name: trimmed, updatedAt: Date.now() });
}

/**
 * Deletes the plan on screen (after the confirm dialog) and opens the most
 * recently edited of the rest. Deleting the last plan leaves a fresh one.
 * Undo puts it back while the toast is up.
 */
export function deleteCurrentPlan() {
  const { plan, plans, team } = get();
  set({ planUi: null });
  if (!plan || !team) return;
  let rest = plans.filter((p) => p.id !== plan.id);
  const fresh = rest.length === 0 ? newPlan(team) : null;
  if (fresh) rest = [fresh];
  const next = rest.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a));

  deleteStoredPlan(plan.id).then(
    () => scheduleSync(),
    (err: unknown) => console.warn("Couldn't delete plan", err),
  );
  if (fresh) persistPlan(fresh);
  rememberPlanId(next);
  set({ plan: next, plans: rest, selected: null, sheetPlayer: null, toasts: [] });

  showToast(`Deleted ${plan.name}`, {
    label: "Undo",
    run: () => {
      if (fresh) deleteStoredPlan(fresh.id).catch(() => {});
      const restored = [...get().plans.filter((p) => p.id !== fresh?.id), plan].sort(byCreated);
      persistPlan(plan);
      rememberPlanId(plan);
      set({ plan, plans: restored, selected: null });
    },
  });
}

/** Refresh from the ⋯ menu: the menu closes and a toast confirms (errors show under the plan bar). */
export async function refreshTeamFromMenu() {
  set({ planUi: null });
  await refreshTeam();
  if (!get().refreshError) showToast("Team refreshed from FPL");
}
