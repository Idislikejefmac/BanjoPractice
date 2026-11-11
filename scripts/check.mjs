// Chooses how much testing a change needs, then runs it.
//
//   npm run check                 pick the tier from the changed files (git), then run it
//   npm run check -- --dry        only say which tier and why
//   npm run check -- --tier full  force a tier: docs | quick | feature | full
//
// Tiers (each includes the one above it):
//   docs     prettier on the changed files. For notes and spec text only.
//   quick    + typecheck, ESLint on the changed files, and the unit tests that import them.
//            Seconds. For a small change inside one area, and for changes to tests or to pure
//            logic in src/core (the unit tests are the guard there).
//   feature  + the browser (e2e) suite on Chromium. About a minute. For changes to the screens
//            (src/ui, styles, render code) that don't touch how things are saved or played.
//   full     + `npm run verify` (all unit tests, build, bundle check), the e2e suite on both
//            engines, and the chaos suite. Many minutes. For changes to storage, the model,
//            playback, audio, the platform layer, build/PWA config, the test harness, or a change
//            that spans many files. Run it before a phase is pushed.
// Every browser run goes through scripts/run-tests.mjs: live progress, a heartbeat, a stall
// watchdog, and the preview servers are cleaned up.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
const forced = argv.includes("--tier") ? argv[argv.indexOf("--tier") + 1] : null;
const win = process.platform === "win32";
const npx = win ? "npx.cmd" : "npx";

const run = (cmd, args, label) => {
  console.log(`\n[check] ▶ ${label}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: win && cmd.endsWith(".cmd") });
  if (r.status !== 0) {
    console.error(`[check] ✗ ${label} failed (exit ${r.status}). Stopping here.`);
    process.exit(r.status ?? 1);
  }
};
const git = (args) =>
  spawnSync("git", args, { encoding: "utf8" }).stdout.split("\n").filter(Boolean);

// --- what changed ---------------------------------------------------------------------------
const IGNORED = /^(\.claude\/|test-logs\/|banjo-songs-abc\.md$|dist|test-results\/)/;
const changed = [
  ...new Set([
    ...git(["diff", "--name-only", "HEAD"]),
    ...git(["ls-files", "-o", "--exclude-standard"]),
  ]),
]
  .filter((f) => !IGNORED.test(f))
  .filter((f) => existsSync(f)); // a deleted file has nothing to check
const code = changed.filter((f) => /\.(ts|tsx|mjs|js)$/.test(f));
const prose = (f) => /\.md$/.test(f);

// --- the decision ---------------------------------------------------------------------------
const FULL_AREAS = [
  [
    /^src\/app\/(store|model|player|backup|services|practiceLog)/,
    "storage, the model or playback (src/app)",
  ],
  [/^src\/(platform|audio|chaos)\//, "the platform, audio or chaos layer"],
  [
    /^(vite\.config|package(-lock)?\.json|tsconfig|playwright|public\/|index\.html|scripts\/(run-tests|check))/,
    "build, PWA or test configuration",
  ],
  [/^tests\/(chaos\/harness|reporters\/)/, "the chaos harness"],
];
const SCREEN = /^src\/(ui|render)\/|\.css$/;
const MANY_SOURCE_FILES = 8;

function decide() {
  if (forced) return { tier: forced, why: "forced with --tier" };
  if (changed.length === 0)
    return { tier: "none", why: "nothing has changed since the last commit" };
  for (const [re, what] of FULL_AREAS) {
    const hit = changed.find((f) => re.test(f));
    if (hit) return { tier: "full", why: `${hit} touches ${what}` };
  }
  const source = changed.filter((f) => f.startsWith("src/"));
  if (source.length >= MANY_SOURCE_FILES)
    return {
      tier: "full",
      why: `${source.length} source files changed: a significant part of the product`,
    };
  if (changed.every(prose)) return { tier: "docs", why: "only notes and specs changed" };
  const screens = changed.find((f) => SCREEN.test(f));
  if (screens) return { tier: "feature", why: `${screens} changes what's on screen` };
  return { tier: "quick", why: "a small change to logic or tests, covered by the unit tests" };
}

const { tier, why } = decide();
console.log(`[check] ${changed.length} changed file(s). Tier: ${tier.toUpperCase()}. Why: ${why}.`);
if (dry || tier === "none") process.exit(0);
if (!["docs", "quick", "feature", "full"].includes(tier)) {
  console.error(`[check] unknown tier "${tier}"`);
  process.exit(2);
}

// --- the steps ------------------------------------------------------------------------------
run(
  npx,
  ["prettier", "--check", ...changed.filter((f) => /\.(ts|tsx|mjs|js|css|md|json|html)$/.test(f))],
  "prettier on the changed files",
);
if (tier === "docs") process.exit(0);

if (tier !== "full") {
  run(npx, ["tsc", "--noEmit"], "typecheck");
  if (code.length > 0) run(npx, ["eslint", ...code], "ESLint on the changed files");
  const related = code.filter((f) => /^(src|tests\/unit)\//.test(f));
  if (related.length > 0)
    run(
      npx,
      ["vitest", "related", "--run", ...related],
      "unit tests that import the changed files",
    );
}
if (tier === "feature")
  run("node", ["scripts/run-tests.mjs", "e2e", "--project=chromium"], "browser tests (Chromium)");

if (tier === "full") {
  run(npx, ["tsc", "--noEmit", "-p", "tsconfig.node.json"], "typecheck (node config)");
  run(npx, ["eslint", "src", "tests", "scripts"], "ESLint (src, tests, scripts)");
  run(npx, ["prettier", "--check", "src", "tests", "scripts"], "prettier (everything)");
  run(npx, ["vitest", "run"], "all unit tests");
  run(npx, ["tsc", "--noEmit"], "typecheck");
  run(npx, ["vite", "build"], "production build");
  run("node", ["scripts/check-prod-bundle.mjs", "dist"], "production bundle check");
  run(
    "node",
    ["scripts/run-tests.mjs", "e2e", "--project=chromium", "--project=webkit"],
    "browser tests (Chromium and WebKit)",
  );
  run(
    "node",
    ["scripts/run-tests.mjs", "chaos"],
    "chaos suite (Chromium, WebKit and production smoke)",
  );
}
console.log(`\n[check] ✓ ${tier} tier passed.`);
