import { defineConfig, devices } from "@playwright/test";

const frontendUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: frontendUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @disastar/backend run dev:e2e",
      url: "http://127.0.0.1:8787/api/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "pnpm --filter @disastar/frontend run dev:e2e",
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
