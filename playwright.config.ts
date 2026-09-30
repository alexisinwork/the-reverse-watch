import { defineConfig, devices } from "@playwright/test";

process.env.SESSION_SECRET ??=
  "the-reserve-e2e-session-secret-longer-than-thirty-two-characters";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // Settings go in env (not "HOST=… npm run start"), so it also runs on
    // Windows.
    command: "npm run start",
    env: {
      HOST: "127.0.0.1",
      PORT: "4173",
      SESSION_SECRET: process.env.SESSION_SECRET,
    },
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
