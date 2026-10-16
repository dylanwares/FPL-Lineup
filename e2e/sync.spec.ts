import { expect as baseExpect, test, type BrowserContext, type Page } from "@playwright/test";
import { mockTeam } from "./fixtures";

/*
 * Two devices signed in to one account. The account server is faked here
 * (in memory, with the real API's version and conflict rules), so this tests
 * the device side of sync: uploads, pulls, merging and auto-opening a team.
 */

// Two browsers per test, each sync waiting out the 2 s edit debounce: allow for a busy machine.
test.describe.configure({ timeout: 60_000 });
const expect = baseExpect.configure({ timeout: 10_000 });

const USER = { id: "4b9f1c1e-0000-4000-8000-000000000001", email: "fan@example.com" };

interface ServerPlan {
  id: string;
  entryId: number;
  name: string;
  version: number;
  updatedAt: number;
  syncedAt: number;
  deletedAt: number | null;
  [key: string]: unknown;
}

function fakeAccount() {
  const plans = new Map<string, ServerPlan>();
  const teams = new Map<number, string>();
  let clock = Date.now();
  const tick = () => ++clock;

  async function install(ctx: BrowserContext) {
    await ctx.route("**/api/auth/get-session", (r) => r.fulfill({ json: { user: USER, session: {} } }));
    await ctx.route(/\/api\/plans(\?.*)?$/, (r) => {
      const raw = new URL(r.request().url()).searchParams.get("since");
      const list = [...plans.values()].filter((p) =>
        raw === null ? !p.deletedAt : p.syncedAt > Number(raw),
      );
      return r.fulfill({ json: { plans: list } });
    });
    await ctx.route(/\/api\/plans\/[0-9a-f-]+(\?.*)?$/, async (r) => {
      const url = new URL(r.request().url());
      const id = url.pathname.split("/").pop()!;
      const current = plans.get(id);
      if (r.request().method() === "DELETE") {
        const version = Number(url.searchParams.get("version"));
        if (!current || current.deletedAt) return r.fulfill({ status: 404, json: {} });
        if (current.version !== version) return r.fulfill({ status: 409, json: { current } });
        const gone = { ...current, deletedAt: tick(), version: version + 1, syncedAt: clock };
        plans.set(id, gone);
        return r.fulfill({ json: { plan: gone } });
      }
      const { plan, baseVersion } = r.request().postDataJSON();
      if (baseVersion === null ? current : !current || current.version !== baseVersion || current.deletedAt) {
        return current ? r.fulfill({ status: 409, json: { current } }) : r.fulfill({ status: 404, json: {} });
      }
      const saved = { ...plan, version: (current?.version ?? 0) + 1, syncedAt: tick(), deletedAt: null };
      plans.set(id, saved);
      return r.fulfill({ json: { plan: saved } });
    });
    await ctx.route("**/api/teams", (r) =>
      r.fulfill({ json: { teams: [...teams].map(([entryId, label]) => ({ entryId, label })) } }),
    );
    await ctx.route(/\/api\/teams\/\d+$/, (r) => {
      const entryId = Number(new URL(r.request().url()).pathname.split("/").pop());
      teams.set(entryId, r.request().postDataJSON().label);
      return r.fulfill({ json: { entryId } });
    });
  }

  const names = () =>
    [...plans.values()]
      .filter((p) => !p.deletedAt)
      .map((p) => p.name)
      .sort();
  return { plans, teams, install, names };
}

const planButton = (page: Page) => page.getByRole("button", { name: /Switch plan/ });

async function newPlan(page: Page, name: string) {
  await page.getByRole("button", { name: "New plan" }).click();
  await page.getByLabel("Plan name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(planButton(page)).toContainText(name);
}

test("plans sync between two signed-in devices", async ({ page, context, browser }, info) => {
  const account = fakeAccount();

  // Phone: loads a team, which (signed in) uploads its plan and links the team.
  await account.install(context);
  await mockTeam(page);
  await page.goto("/");
  await page.getByLabel("Your FPL team ID").fill("1");
  await page.getByRole("button", { name: "Load my team" }).click();
  await expect(planButton(page)).toContainText("Main plan");
  await newPlan(page, "Wildcard");
  await expect.poll(account.names).toEqual(["Main plan", "Wildcard"]);
  expect([...account.teams.keys()]).toEqual([1]);

  // Laptop, brand new: signing in opens the account's team and its plans, no ID needed.
  const laptopContext = await browser.newContext({ baseURL: info.project.use.baseURL });
  await account.install(laptopContext);
  const laptop = await laptopContext.newPage();
  await mockTeam(laptop);
  await laptop.goto("/");
  await expect(planButton(laptop)).toContainText("Wildcard"); // the most recently edited
  await planButton(laptop).click();
  await expect(laptop.getByRole("listbox", { name: "Plans" }).getByRole("option")).toHaveCount(2);
  await laptop.keyboard.press("Escape");
  // Its own starter plan wasn't uploaded on top of the account's.
  expect(account.names()).toEqual(["Main plan", "Wildcard"]);

  // A rename on the laptop reaches the phone when it next syncs (here: coming back online).
  await laptop.getByRole("button", { name: "More options" }).click();
  await laptop.getByRole("menuitem", { name: "Rename" }).click();
  await laptop.getByLabel("Plan name").fill("Wildcard GW9");
  await laptop.getByRole("button", { name: "Save" }).click();
  await expect.poll(account.names).toEqual(["Main plan", "Wildcard GW9"]);

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(planButton(page)).toContainText("Wildcard GW9");

  // Edited on both before either synced: both versions are kept.
  await laptop.route(/\/api\/plans/, (r) => r.abort()); // the laptop is offline for a bit
  await laptop.getByRole("button", { name: "More options" }).click();
  await laptop.getByRole("menuitem", { name: "Rename" }).click();
  await laptop.getByLabel("Plan name").fill("Laptop version");
  await laptop.getByRole("button", { name: "Save" }).click();

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("Plan name").fill("Phone version");
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(account.names).toEqual(["Main plan", "Phone version"]);

  await laptop.unroute(/\/api\/plans/);
  await laptop.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(laptop.getByRole("status").filter({ hasText: "Kept both" })).toBeVisible();
  await expect.poll(account.names).toEqual(["Laptop version (this device)", "Main plan", "Phone version"]);

  await laptopContext.close();
});

test("deleting a plan on one device removes it on the other", async ({ page, context, browser }, info) => {
  const account = fakeAccount();
  await account.install(context);
  await mockTeam(page);
  await page.goto("/");
  await page.getByLabel("Your FPL team ID").fill("1");
  await page.getByRole("button", { name: "Load my team" }).click();
  await newPlan(page, "Doomed");
  await expect.poll(account.names).toEqual(["Doomed", "Main plan"]);

  const otherContext = await browser.newContext({ baseURL: info.project.use.baseURL });
  await account.install(otherContext);
  const other = await otherContext.newPage();
  await mockTeam(other);
  await other.goto("/");
  await expect(planButton(other)).toContainText("Doomed");

  await page.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect.poll(account.names).toEqual(["Main plan"]);

  await other.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(planButton(other)).toContainText("Main plan");
  await otherContext.close();
});
