import { expect, test } from "./fixtures";
test.use({ guide: true });
for (const [name, viewport] of [
  ["phone", { width: 360, height: 740 }],
  ["desktop", { width: 1280, height: 860 }],
] as const) {
  test("shots " + name, async ({ page, planner }) => {
    void planner;
    await page.setViewportSize(viewport);
    await expect(page.getByRole("button", { name: "Show me" })).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path:
        "/private/tmp/claude-501/-Users-dylan-Developer-FPL-Lineup/452ece9b-ebc4-4c54-b7ff-c7118ec820e6/scratchpad/guide-" +
        name +
        "-0.png",
    });
    await page.getByRole("button", { name: "Show me" }).click();
    for (let i = 1; i <= 5; i++) {
      await page.waitForTimeout(i === 3 ? 900 : i === 2 ? 1300 : 650);
      await page.screenshot({
        path:
          "/private/tmp/claude-501/-Users-dylan-Developer-FPL-Lineup/452ece9b-ebc4-4c54-b7ff-c7118ec820e6/scratchpad/guide-" +
          name +
          "-" +
          i +
          ".png",
      });
      if (i < 5) await page.getByRole("button", { name: "Next", exact: true }).click();
    }
  });
}
