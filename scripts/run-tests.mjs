// Runs a Playwright suite so that it is never silent and never leaves servers behind.
//
//   node scripts/run-tests.mjs e2e   [playwright args]     (npm run e2e)
//   node scripts/run-tests.mjs chaos [playwright args]     (npm run chaos)
//   node scripts/run-tests.mjs spike [playwright args]     (npm run spike:s0)
//   --stall-min <n>   give up when nothing has happened for n minutes (default 10; at least
//                     CHAOS_MINUTES + 5 for a long monkey run)
//   --max-min <n>     give up after n minutes in all (default: no limit)
//
// What it does that a bare `playwright test` doesn't:
//  1. Frees the preview ports (4173-4175) first, so a server left by an earlier run can't be
//     reused: a stale server serves an old build and the run tests the wrong code.
//  2. Streams every test result as it happens (the list reporter), and writes the same events,
//     with times, to test-logs/<suite>-progress.log (tests/reporters/progress.mjs).
//  3. Prints a heartbeat every 30 s with the last event, so a long test is visibly alive.
//  4. Stops a run that has shown no sign of life for the stall time, and says which test it was in.
//  5. Takes a lock (test-logs/run.lock): a second run started while one is going is refused,
//     because it would free the first run's ports and clear its results folder (each suite writes
//     to its own test-results/<suite>/ folder as well).
//  6. Kills the whole process tree and frees the ports when it ends, however it ends.
//  7. Ends with a summary (also saved as test-logs/<suite>-summary.txt), and exits non-zero on any
//     failure, stall or time-out. Never pipe it through `tail`: that hides everything until the end.

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORTS = [4173, 4174, 4175];
const win = process.platform === "win32";

const SUITES = {
  e2e: { config: "playwright.config.ts", args: ["--grep-invert", "@spike"] },
  chaos: { config: "playwright.chaos.config.ts", args: [] },
  spike: { config: "playwright.config.ts", args: ["--grep", "@spike"] },
};

// --- arguments ------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const suiteName = argv.shift();
const suite = SUITES[suiteName];
if (!suite) {
  console.error(
    `Usage: node scripts/run-tests.mjs <${Object.keys(SUITES).join("|")}> [options] [playwright args]`,
  );
  process.exit(2);
}
const take = (flag, fallback) => {
  const i = argv.indexOf(flag);
  if (i < 0) return fallback;
  const v = Number(argv[i + 1]);
  argv.splice(i, 2);
  return v;
};
const longRun = Number(process.env.CHAOS_MINUTES ?? 0);
const stallMs = take("--stall-min", Math.max(10, longRun > 0 ? longRun + 5 : 0)) * 60_000;
const maxMs = take("--max-min", 0) * 60_000;
const passthrough = argv[0] === "--" ? argv.slice(1) : argv;

// --- ports and process trees ----------------------------------------------------------------
function listeners(port) {
  if (win) {
    const out = spawnSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" }).stdout ?? "";
    const pids = new Set();
    for (const line of out.split("\n")) {
      const cols = line.trim().split(/\s+/);
      if (cols[3] === "LISTENING" && cols[1]?.endsWith(`:${port}`)) pids.add(Number(cols[4]));
    }
    return [...pids];
  }
  const out =
    spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout ?? "";
  return out.split("\n").filter(Boolean).map(Number);
}

function imageName(pid) {
  if (win) {
    const out =
      spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" })
        .stdout ?? "";
    return (out.split(",")[0] ?? "").replace(/"/g, "").toLowerCase();
  }
  return (
    spawnSync("ps", ["-o", "comm=", "-p", String(pid)], { encoding: "utf8" }).stdout ?? ""
  ).trim();
}

function killTree(pid) {
  if (win) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

/** Frees the preview ports. Only node processes are killed; anything else is reported and left. */
function freePorts(why) {
  let blocked = false;
  for (const port of PORTS) {
    for (const pid of listeners(port)) {
      const name = imageName(pid);
      if (name.includes("node")) {
        console.log(`[runner] ${why}: stopping node process ${pid} listening on port ${port}`);
        killTree(pid);
      } else {
        console.error(
          `[runner] port ${port} is held by ${name || "an unknown process"} (pid ${pid}): not mine to kill`,
        );
        blocked = true;
      }
    }
  }
  return !blocked;
}

// --- run ------------------------------------------------------------------------------------
mkdirSync(join(root, "test-logs"), { recursive: true });
const progressFile = join(root, "test-logs", `${suiteName}-progress.log`);
const fullFile = join(root, "test-logs", `${suiteName}-output.log`);
const summaryFile = join(root, "test-logs", `${suiteName}-summary.txt`);
writeFileSync(progressFile, "");
writeFileSync(fullFile, "");

// --- one run at a time ---------------------------------------------------------------------
const lockFile = join(root, "test-logs", "run.lock");
if (existsSync(lockFile)) {
  const [pid, who] = readFileSync(lockFile, "utf8").split(" ");
  let alive = false;
  try {
    process.kill(Number(pid), 0);
    alive = true;
  } catch {
    /* the run that wrote it is gone: a stale lock */
  }
  if (alive) {
    console.error(
      `[runner] refusing to start: a ${who?.trim()} run (pid ${pid}) is still going, and a second run would free its ports and clear its results. Wait for it, or stop it first.`,
    );
    process.exit(2);
  }
}
writeFileSync(lockFile, `${process.pid} ${suiteName}`);
const unlock = () => {
  try {
    if (readFileSync(lockFile, "utf8").startsWith(`${process.pid} `)) unlinkSync(lockFile);
  } catch {
    /* already gone */
  }
};
process.on("exit", unlock);

if (!freePorts("before the run")) {
  console.error("[runner] cannot start: a port it needs is in use by something else.");
  process.exit(2);
}

const cli = createRequire(join(root, "package.json")).resolve("@playwright/test/cli");
const args = [
  cli,
  "test",
  "-c",
  suite.config,
  ...(passthrough.some((a) => a.startsWith("--grep")) ? [] : suite.args),
  ...(passthrough.some((a) => a.startsWith("--output"))
    ? []
    : ["--output", `test-results/${suiteName}`]),
  ...passthrough,
];
console.log(`[runner] ${suiteName}: playwright ${args.slice(1).join(" ")}`);
console.log(`[runner] progress: ${progressFile}`);

const started = Date.now();
const child = spawn(process.execPath, args, {
  cwd: root,
  env: { ...process.env, PROGRESS_LOG: progressFile, FORCE_COLOR: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
const tee = (stream, sink) =>
  stream.on("data", (d) => {
    sink.write(d);
    appendFileSync(fullFile, d);
  });
tee(child.stdout, process.stdout);
tee(child.stderr, process.stderr);

const mmss = (ms) =>
  `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const lastLine = () => {
  const lines = existsSync(progressFile)
    ? readFileSync(progressFile, "utf8").trim().split("\n")
    : [];
  return lines[lines.length - 1] ?? "(nothing yet)";
};
const lastActivity = () =>
  Math.max(existsSync(progressFile) ? statSync(progressFile).mtimeMs : 0, started);

let verdict = null; // "stalled" | "timed-out" | "interrupted"
const finish = (why) => {
  if (verdict) return;
  verdict = why;
  killTree(child.pid);
};

const beat = setInterval(() => {
  const quiet = Date.now() - lastActivity();
  console.log(
    `[runner ${mmss(Date.now() - started)}] alive; last sign of life ${Math.round(quiet / 1000)}s ago: ${lastLine().slice(0, 160)}`,
  );
  if (quiet > stallMs) {
    console.error(
      `[runner] STALLED: nothing for ${Math.round(quiet / 60000)} min. Last: ${lastLine()}`,
    );
    finish("stalled");
  } else if (maxMs > 0 && Date.now() - started > maxMs) {
    console.error(`[runner] TIMED OUT after ${mmss(Date.now() - started)}. Last: ${lastLine()}`);
    finish("timed-out");
  }
}, 30_000);

for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(sig, () => finish("interrupted"));

child.on("exit", (code) => {
  clearInterval(beat);
  freePorts("after the run");
  const events = readFileSync(progressFile, "utf8").split("\n");
  const count = (status) => events.filter((l) => new RegExp(`\\] ${status} \\(`).test(l)).length;
  const bad = events.filter((l) => /\] (FAILED|TIMEDOUT|INTERRUPTED) \(/.test(l));
  const begun = events.filter((l) => /\] START /.test(l)).length;
  const ended = events.filter((l) =>
    /\] (PASSED|FAILED|TIMEDOUT|SKIPPED|INTERRUPTED) \(/.test(l),
  ).length;
  const lines = [
    `suite: ${suiteName}   took ${mmss(Date.now() - started)}   playwright exit code ${code}${verdict ? `   (${verdict.toUpperCase()} by the runner)` : ""}`,
    `passed ${count("PASSED")}, failed ${count("FAILED") + count("TIMEDOUT")}, skipped ${count("SKIPPED")}, started but never finished ${Math.max(0, begun - ended)}`,
    ...bad.map((l) => `  ✗ ${l.replace(/^\[\s*\d+s\]\s*/, "")}`),
    verdict ? `last event: ${lastLine()}` : "",
    `logs: ${fullFile}`,
  ].filter(Boolean);
  const text = lines.join("\n");
  writeFileSync(summaryFile, text + "\n");
  console.log(`\n[runner] ================ SUMMARY ================\n${text}`);
  process.exit(verdict ? 2 : (code ?? 1));
});
