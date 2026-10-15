import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the planner flows. FPL itself is mocked (see
 * e2e/fixtures.ts), so runs are deterministic.
 *
 * Locally, point at a running dev server to skip starting one:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 pnpm e2e
 * Uses the installed Edge locally; CI installs Playwright's Chromium.
 */
const external = process.env.PLAYWRIGHT_BASE_URL;
const port = 3200;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Dev servers compile on first request, so allow longer locally.
  timeout: process.env.CI ? 30_000 : 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: external ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    // A service worker's own fetches skip page.route mocks; the offline test opts back in.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "msedge" },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: process.env.CI ? `pnpm start --port ${port}` : `pnpm dev --port ${port}`,
        url: `http://localhost:${port}/api/version`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
