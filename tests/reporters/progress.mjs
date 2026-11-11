// A Playwright reporter that writes one line per event, as it happens, to a log file
// (PROGRESS_LOG, default test-logs/progress.log). The test runner (scripts/run-tests.mjs) reads
// it for its heartbeat and its stall watchdog, so a run is never silent until the end.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const file = process.env.PROGRESS_LOG ?? "test-logs/progress.log";
mkdirSync(dirname(file), { recursive: true });
const t0 = Date.now();
const stamp = () => `[${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s]`;
const write = (line) => appendFileSync(file, `${stamp()} ${line}\n`);
const name = (test) => test.titlePath().filter(Boolean).slice(1).join(" › ");

export default class ProgressReporter {
  onBegin(_config, suite) {
    write(`BEGIN ${suite.allTests().length} tests`);
  }
  onTestBegin(test) {
    write(`START ${name(test)}`);
  }
  onTestEnd(test, result) {
    const err = result.error?.message?.split("\n")[0] ?? "";
    write(
      `${result.status.toUpperCase()} (${(result.duration / 1000).toFixed(1)}s) ${name(test)}${err ? ` — ${err}` : ""}`,
    );
  }
  onStdOut(chunk) {
    for (const l of String(chunk).split("\n")) if (l.trim()) write(`out: ${l.slice(0, 200)}`);
  }
  onStdErr(chunk) {
    for (const l of String(chunk).split("\n")) if (l.trim()) write(`err: ${l.slice(0, 200)}`);
  }
  onError(error) {
    write(`ERROR ${String(error.message ?? error).split("\n")[0]}`);
  }
  onEnd(result) {
    write(`END ${result.status}`);
  }
  printsToStdio() {
    return false;
  }
}
