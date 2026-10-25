import { defineConfig, devices } from "@playwright/test";

/** Opt-in integration checks against the two servers started by dev:partners. */
export default defineConfig({
  testDir: "./tests/partners",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: { baseURL: "http://localhost:8080", trace: "retain-on-failure" },
  projects: [{ name: "local-chromium", use: { ...devices["Desktop Chrome"] } }],
});
