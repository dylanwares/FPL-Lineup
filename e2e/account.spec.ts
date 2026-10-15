import { expect, test } from "./fixtures";

const USER = { id: "4b9f1c1e-0000-4000-8000-000000000001", email: "fan@example.com" };

test("sign in with an emailed code, then sign out", async ({ page, planner }) => {
  void planner;
  // Neon Auth, mocked: no real emails in tests.
  let signedIn = false;
  const sent: unknown[] = [];
  await page.route("**/api/auth/get-session", (r) =>
    r.fulfill({ json: signedIn ? { user: USER, session: { userId: USER.id } } : null }),
  );
  await page.route("**/api/auth/email-otp/send-verification-otp", async (r) => {
    sent.push(r.request().postDataJSON());
    await r.fulfill({ json: { success: true } });
  });
  await page.route("**/api/auth/sign-in/email-otp", async (r) => {
    const { otp } = r.request().postDataJSON();
    if (otp !== "123456")
      return r.fulfill({ status: 400, json: { code: "INVALID_OTP", message: "Invalid OTP" } });
    signedIn = true;
    await r.fulfill({ json: { token: "t", user: USER } });
  });
  await page.route("**/api/auth/sign-out", async (r) => {
    signedIn = false;
    await r.fulfill({ json: { success: true } });
  });

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: /Sign in/ }).click();
  const sheet = page.getByRole("dialog", { name: "Sign in" });
  await sheet.getByLabel("Email").fill(USER.email);
  await sheet.getByRole("button", { name: "Email me a code" }).click();
  expect(sent).toEqual([{ email: USER.email, type: "sign-in" }]);

  const codeSheet = page.getByRole("dialog", { name: "Enter your code" });
  await expect(codeSheet).toContainText(USER.email);
  await expect(codeSheet.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();
  // A wrong code says so; a full right code signs in on its own (no button press).
  await codeSheet.getByLabel("Sign-in code").fill("000000");
  await expect(codeSheet.getByRole("alert")).toContainText("That code isn't right");
  await codeSheet.getByLabel("Sign-in code").fill("123456");
  await expect(codeSheet).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Signed in" })).toContainText(USER.email);

  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menu", { name: "Account" })).toContainText(USER.email);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Signed out" })).toBeVisible();
  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("menuitem", { name: /Sign in/ })).toBeVisible();
});
