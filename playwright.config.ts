import type { ReporterDescription } from "@playwright/test";
import { defineConfig, devices } from "@playwright/test";

// E2E and chaos tests run against the production build (vite preview).
// WebKit is the closest stand-in for iPad Safari available off a Mac; spike S0 checks whether
// Web Audio and service workers work in it on Windows (npm run spike:s0).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: 0,
  reporter: [
    ["list"],
    ["./tests/reporters/progress.mjs"],
    ...(process.env.CI ? ([["github"], ["html", { open: "never" }]] as ReporterDescription[]) : []),
  ],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["iPad Pro 11"] } },
  ],
  webServer: {
    // The test build: it adds the draft fixture songs (tests/fixtures/songs) the suites use.
    command: "npm run build:chaos && npx vite preview --outDir dist-chaos --port 4173 --strictPort",
    url: "http://localhost:4173",
    // Never reuse a server already on the port: it may serve an old build (scripts/run-tests.mjs
    // frees the ports first). REUSE_SERVER=1 allows it for quick local reruns.
    reuseExistingServer: process.env.REUSE_SERVER === "1",
    timeout: 120_000,
  },
});
