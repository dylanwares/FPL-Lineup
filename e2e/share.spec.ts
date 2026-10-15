import { expect, test } from "./fixtures";

test("share: previews the lineup and saves it as a 1080×1350 PNG", async ({ page, planner }) => {
  await page.getByRole("button", { name: "Share lineup" }).click();
  const dialog = page.getByRole("dialog", { name: "Share lineup" });
  await expect(
    dialog.getByRole("img", { name: `Test XI lineup for gameweek ${planner.nextGw}` }),
  ).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Save image" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe(`fpl-lineup-gw${planner.nextGw}.png`);
  const png = await (await download.createReadStream()).toArray();
  const bytes = Buffer.concat(png);
  // PNG header: width and height are big-endian at bytes 16 and 20.
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1080, 1350]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
