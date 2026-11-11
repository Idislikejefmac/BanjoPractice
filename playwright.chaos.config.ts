import type { ReporterDescription } from "@playwright/test";
import { defineConfig, devices } from "@playwright/test";

// Chaos tests (CHAOS_TESTING.md): the UI monkey and fault scenarios run against the test build
// with chaos hooks (dist-chaos), and the production smoke run (T6) against the real
// production build (dist), which has no hooks.
//
//   npm run chaos                         500 monkey steps per engine + fault scenarios
//   CHAOS_SEED=123 npm run chaos          replay a seed
//   CHAOS_MINUTES=30 npm run chaos -- --project=chaos-chromium   a long run
// One random seed per run, shared with the worker processes (see monkey.spec.ts).
process.env.CHAOS_RUN_SEED ??= String(Math.floor(Math.random() * 2 ** 31));

export default defineConfig({
  testDir: "tests/chaos",
  timeout: 0,
  retries: 0,
  workers: 1,
  reporter: [
    ["list"],
    ["./tests/reporters/progress.mjs"],
    ...(process.env.CI ? ([["github"]] as ReporterDescription[]) : []),
  ],
  use: { trace: "retain-on-failure", actionTimeout: 10_000, navigationTimeout: 20_000 },
  projects: [
    {
      name: "chaos-chromium",
      testIgnore: /prod-smoke/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4174" },
    },
    {
      name: "chaos-webkit",
      testIgnore: /prod-smoke/,
      use: { ...devices["iPad Pro 11"], baseURL: "http://localhost:4174" },
    },
    {
      name: "prod-smoke",
      testMatch: /prod-smoke/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4175" },
    },
  ],
  webServer: [
    {
      command:
        "npm run build:chaos && npx vite preview --outDir dist-chaos --port 4174 --strictPort",
      url: "http://localhost:4174",
      // Never reuse a server already on the port: it may serve an old build (scripts/run-tests.mjs
      // frees the ports first). REUSE_SERVER=1 allows it for quick local reruns.
      reuseExistingServer: process.env.REUSE_SERVER === "1",
      timeout: 180_000,
    },
    {
      command: "npm run build && npx vite preview --port 4175 --strictPort",
      url: "http://localhost:4175",
      // Never reuse a server already on the port: it may serve an old build (scripts/run-tests.mjs
      // frees the ports first). REUSE_SERVER=1 allows it for quick local reruns.
      reuseExistingServer: process.env.REUSE_SERVER === "1",
      timeout: 180_000,
    },
  ],
});
