// T2 · The UI monkey (CHAOS_TESTING.md §4), phase-1 groups: navigation, lifecycle (incl. hard
// reload), display and favorites, with storage faults armed at random.
//
// Real-time mode: the seed fixes the sequence of actions, waits and faults, so a failing seed
// usually reproduces; timing can still differ between runs.
//
//   CHAOS_SEED=<n>     replay a run
//   CHAOS_STEPS=<n>    steps per run (default 500)
//   CHAOS_MINUTES=<n>  run for this long instead (e.g. 30 for the phase-1 exit run)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Page, TestInfo } from "@playwright/test";
import { expect, test } from "@playwright/test";
import type { Action, MonkeyContext } from "./harness.ts";
import {
  checkInvariants,
  checkpoint,
  installLongTaskObserver,
  InvariantFailure,
  rng,
  saveArtifacts,
  uiSnapshot,
  watchErrors,
} from "./harness.ts";

const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];
const SIZES = [
  { width: 1180, height: 820 }, // iPad 10th gen, landscape
  { width: 820, height: 1180 }, // portrait
  { width: 1366, height: 1024 }, // iPad Pro 12.9, landscape
  { width: 1024, height: 1366 },
  { width: 744, height: 1133 }, // iPad mini, portrait
];
/** I2 budget. Re-laying out a song after a resize is the heaviest thing phase 1 does. */
const MAX_TASK_MS = 200;

async function clickIfVisible(ctx: MonkeyContext, selector: string): Promise<boolean> {
  const el = ctx.page.locator(selector).first();
  if (!(await el.isVisible().catch(() => false))) return false;
  await el.click({ timeout: 3000 });
  return true;
}

async function ensurePanel(ctx: MonkeyContext): Promise<void> {
  if (!(await ctx.page.locator(".song-panel").isVisible())) {
    await ctx.page.click('[data-action="toggle-songs"]');
  }
}

async function closeSettings(ctx: MonkeyContext): Promise<void> {
  // Any full-screen page (settings, chord finder, editor, practice tools) is closed first.
  for (let i = 0; i < 3; i++) {
    const page = ctx.page.locator(".settings-page").first();
    if (!(await page.isVisible().catch(() => false))) return;
    if (
      await ctx.page
        .locator('[data-action="editor-cancel"]')
        .isVisible()
        .catch(() => false)
    ) {
      await ctx.page.click('[data-action="editor-cancel"]');
    } else {
      await page
        .locator("button", { hasText: /^Done$/ })
        .first()
        .click();
    }
  }
}

const ACTIONS: Action[] = [
  {
    name: "open-song",
    weight: 20,
    async run(ctx) {
      await closeSettings(ctx);
      await ensurePanel(ctx);
      const id = ctx.pick(SONGS);
      await ctx.page.click(`[data-song="${id}"][data-section="builtin"]`);
      return id;
    },
  },
  {
    name: "scroll",
    weight: 18,
    async run(ctx) {
      const fraction = ctx.random();
      await ctx.page.evaluate(
        (f) => window.scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)),
        fraction,
      );
      return fraction.toFixed(2);
    },
  },
  {
    name: "toggle-panel",
    weight: 6,
    async run(ctx) {
      await closeSettings(ctx);
      await ctx.page.click('[data-action="toggle-songs"]');
      return "";
    },
  },
  {
    name: "favorite",
    weight: 8,
    async run(ctx) {
      await closeSettings(ctx);
      await ensurePanel(ctx);
      const id = ctx.pick(SONGS);
      return (await clickIfVisible(ctx, `[data-favorite="${id}"]`)) ? id : null;
    },
  },
  {
    name: "tab-only",
    weight: 8,
    async run(ctx) {
      return (await clickIfVisible(ctx, '[data-action="toggle-view"]')) ? "" : null;
    },
  },
  {
    name: "size",
    weight: 6,
    async run(ctx) {
      const which = ctx.random() < 0.5 ? "bigger" : "smaller";
      const btn = ctx.page.locator(`[data-action="${which}"]`);
      if (await btn.isDisabled()) return null;
      await btn.click();
      return which;
    },
  },
  {
    name: "setting",
    weight: 6,
    async run(ctx) {
      if (!(await ctx.page.locator(".settings-page").isVisible())) {
        await ctx.page.click('[data-action="settings"]');
      }
      const name = ctx.pick(["showRollNames", "showAccents", "colorBadges", "keepAwake"]);
      await ctx.page.locator(`input[name="${name}"]`).click();
      if (ctx.random() < 0.5) {
        const group = ctx.pick(["fretNumbering", "spikes", "defaultView", "size"]);
        const buttons = ctx.page.locator(`button[name="${group}"]`);
        await buttons.nth(Math.floor(ctx.random() * (await buttons.count()))).click();
      }
      if (ctx.random() < 0.6) await ctx.page.click("text=Done");
      return name;
    },
  },
  {
    name: "reload",
    weight: 6,
    async run(ctx) {
      // I16: a hard reload (only pagehide fires) returns to the same song, view and place.
      const before = await uiSnapshot(ctx.page);
      await ctx.page.reload();
      await ctx.page.waitForSelector(".toolbar");
      if (before.title !== "Banjo Practice") await ctx.page.waitForSelector("svg.tab");
      await expect
        .poll(
          async () => {
            const after = await uiSnapshot(ctx.page);
            return (
              after.title === before.title &&
              after.tabOnly === before.tabOnly &&
              after.topLineLast >= before.topLine &&
              after.topLine <= Math.max(before.topLineLast, before.topLine)
            );
          },
          { timeout: 5000 },
        )
        .toBe(true)
        .catch(async () => {
          const after = await uiSnapshot(ctx.page);
          throw new InvariantFailure(
            "I16",
            `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`,
          );
        });
      return "";
    },
  },
  {
    name: "resize",
    weight: 5,
    async run(ctx) {
      const size = ctx.pick(SIZES);
      await ctx.page.setViewportSize(size);
      return `${size.width}x${size.height}`;
    },
  },
  {
    name: "visibility",
    weight: 3,
    async run(ctx) {
      // Background → foreground: the wake lock is re-acquired (P5).
      await ctx.page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("pagehide"));
        window.dispatchEvent(new Event("pageshow"));
      });
      return "";
    },
  },
  {
    name: "storage-fault",
    weight: 3,
    async run(ctx) {
      if (!ctx.hooks) return null;
      const kind = ctx.pick(["QuotaExceededError", "UnknownError", "slow"]);
      const probability = 0.2 + ctx.random() * 0.5;
      await ctx.page.evaluate(
        ([k, p]) =>
          window.__banjoChaos?.arm({
            service: "storage",
            op: "put",
            kind: k as string,
            probability: p as number,
            delayMs: 400,
          }),
        [kind, probability] as const,
      );
      return `${kind} p=${probability.toFixed(2)}`;
    },
  },
  {
    name: "play-stop",
    weight: 12,
    async run(ctx) {
      await closeSettings(ctx);
      return (await clickIfVisible(ctx, '[data-action="play"]')) ? "" : null;
    },
  },
  {
    name: "restart",
    weight: 3,
    async run(ctx) {
      return (await clickIfVisible(ctx, '[data-action="restart"]')) ? "" : null;
    },
  },
  {
    name: "tempo",
    weight: 8,
    async run(ctx) {
      const which = ctx.random() < 0.5 ? "slower" : "faster";
      const times = 1 + Math.floor(ctx.random() * 4);
      for (let i = 0; i < times; i++) {
        if (!(await clickIfVisible(ctx, `[data-action="${which}"]`))) return null;
      }
      return `${which} x${times}`;
    },
  },
  {
    name: "key",
    weight: 4,
    async run(ctx) {
      const select = ctx.page.locator('[data-action="key"]');
      if (!(await select.isVisible().catch(() => false))) return null;
      const shift = String(Math.floor(ctx.random() * 8));
      await select.selectOption(shift);
      return shift;
    },
  },
  {
    name: "part",
    weight: 5,
    async run(ctx) {
      const target = ctx.pick([
        '[data-part="melody"]',
        '[data-part="chords"]',
        '[data-part="banjo"]',
        '[data-action="metronome"]',
        '[data-action="repeat"]',
      ]);
      return (await clickIfVisible(ctx, target)) ? target : null;
    },
  },
  {
    name: "loop",
    weight: 3,
    async run(ctx) {
      if (!(await clickIfVisible(ctx, '[data-action="loop"]'))) return null;
      const from = ctx.page.locator('select[name="loopFrom"]');
      if (!(await from.isVisible().catch(() => false))) return null;
      if (ctx.random() < 0.3 && (await clickIfVisible(ctx, '[data-action="clear-loop"]'))) {
        await clickIfVisible(ctx, ".practice-panel .big-button");
        return "clear";
      }
      const options = await from.locator("option").allTextContents();
      const a = Math.floor(ctx.random() * options.length);
      const b = Math.floor(ctx.random() * options.length);
      await from.selectOption({ index: a });
      await ctx.page.locator('select[name="loopTo"]').selectOption({ index: b });
      await clickIfVisible(ctx, ".practice-panel .big-button");
      return `${a}-${b}`;
    },
  },
  {
    name: "pedal",
    weight: 3,
    async run(ctx) {
      const key = ctx.pick(["PageDown", "PageUp", "ArrowRight", "ArrowLeft", "Space", "Enter"]);
      await ctx.page.keyboard.press(key);
      return key;
    },
  },
  {
    name: "play-stop-storm",
    weight: 1,
    hostile: true,
    async run(ctx) {
      await closeSettings(ctx);
      const btn = ctx.page.locator('[data-action="play"]');
      if (!(await btn.isVisible().catch(() => false))) return null;
      for (let i = 0; i < 50; i++) await btn.click({ timeout: 3000 });
      return "x50";
    },
  },
  {
    name: "key-storm-while-playing",
    weight: 1,
    hostile: true,
    async run(ctx) {
      const select = ctx.page.locator('[data-action="key"]');
      if (!(await select.isVisible().catch(() => false))) return null;
      await clickIfVisible(ctx, '[data-action="play"]');
      for (let i = 0; i < 12; i++) await select.selectOption(String(i % 8));
      return "x12";
    },
  },
  {
    name: "pedal-repeat-storm",
    weight: 1,
    hostile: true,
    async run(ctx) {
      for (let i = 0; i < 30; i++) {
        await ctx.page.keyboard.down("PageDown");
        await ctx.page.waitForTimeout(33);
      }
      await ctx.page.keyboard.up("PageDown");
      return "30 Hz";
    },
  },
  {
    name: "chord-finder",
    weight: 3,
    async run(ctx) {
      await closeSettings(ctx);
      if (!(await ctx.page.locator(".chord-finder").isVisible())) {
        if (!(await clickIfVisible(ctx, '[data-action="chords"]'))) return null;
      }
      const roots = await ctx.page.locator('select[name="root"] option').allTextContents();
      await ctx.page
        .locator('select[name="root"]')
        .selectOption({ index: Math.floor(ctx.random() * roots.length) });
      const types = await ctx.page.locator('select[name="quality"] option').count();
      await ctx.page
        .locator('select[name="quality"]')
        .selectOption({ index: Math.floor(ctx.random() * types) });
      await clickIfVisible(ctx, '[data-action="next-voicing"]:not([disabled])');
      if (ctx.random() < 0.3) await clickIfVisible(ctx, '[data-action="strum"]');
      if (ctx.random() < 0.6) await clickIfVisible(ctx, ".chord-finder >> text=Done");
      return "";
    },
  },
  {
    name: "editor",
    weight: 3,
    async run(ctx) {
      await closeSettings(ctx);
      await clickIfVisible(ctx, ".chord-finder >> text=Done");
      if (!(await ctx.page.locator(".song-editor").isVisible())) {
        await ensurePanel(ctx);
        if (!(await clickIfVisible(ctx, '[data-action="new-song"]'))) return null;
      }
      const notes = 1 + Math.floor(ctx.random() * 6);
      for (let i = 0; i < notes; i++) {
        const letter = ctx.pick(["C", "D", "E", "F", "G", "A", "B", "rest"]);
        const btn = ctx.page.locator(`[data-note="${letter}"]`);
        if (await btn.isEnabled().catch(() => false)) await btn.click();
      }
      const r = ctx.random();
      if (r < 0.3) {
        await ctx.page
          .fill('input[name="title"]', `Monkey ${Math.floor(ctx.random() * 1000)}`)
          .catch(() => {});
        await clickIfVisible(ctx, '[data-action="editor-save"]');
        return "save";
      }
      if (r < 0.4) {
        // Hostile: save twice fast.
        await clickIfVisible(ctx, '[data-action="editor-save"]');
        await clickIfVisible(ctx, '[data-action="editor-save"]');
        return "save x2";
      }
      if (r < 0.6) {
        await clickIfVisible(ctx, '[data-action="editor-cancel"]');
        return "close";
      }
      return `${notes} notes`;
    },
  },
  {
    name: "practice-tools",
    weight: 2,
    async run(ctx) {
      await closeSettings(ctx);
      if (!(await ctx.page.locator('[data-tool="log"]').isVisible())) {
        if (!(await clickIfVisible(ctx, '[data-action="practice-tools"]'))) return null;
      }
      await clickIfVisible(ctx, `[data-tool="${ctx.pick(["tuner", "log", "recordings"])}"]`);
      await clickIfVisible(ctx, ".settings-page >> text=Done");
      return "";
    },
  },
  {
    name: "delete-playing-song",
    weight: 1,
    hostile: true,
    async run(ctx) {
      await closeSettings(ctx);
      await ensurePanel(ctx);
      const del = ctx.page.locator("[data-delete]").first();
      if (!(await del.isVisible().catch(() => false))) return null;
      const id = await del.getAttribute("data-delete");
      await ctx.page.click(`[data-song="${id}"][data-section="mine"]`);
      await clickIfVisible(ctx, '[data-action="play"]');
      ctx.page.once("dialog", (d) => void d.accept());
      await del.click();
      return id ?? "";
    },
  },
  {
    name: "rapid-toggle",
    weight: 2,
    hostile: true,
    async run(ctx) {
      await closeSettings(ctx);
      for (let i = 0; i < 20; i++) await ctx.page.click('[data-action="toggle-songs"]');
      return "x20";
    },
  },
  {
    name: "resize-storm",
    weight: 1,
    hostile: true,
    async run(ctx) {
      for (let i = 0; i < 10; i++) {
        await ctx.page.setViewportSize(ctx.pick(SIZES));
        await ctx.page.waitForTimeout(100);
      }
      return "x10";
    },
  },
  {
    name: "reload-mid-save",
    weight: 2,
    hostile: true,
    async run(ctx) {
      await closeSettings(ctx);
      await ensurePanel(ctx);
      const id = ctx.pick(SONGS);
      await ctx.page.click(`[data-favorite="${id}"]`);
      await ctx.page.reload();
      await ctx.page.waitForSelector(".toolbar");
      return id;
    },
  },
  {
    name: "favorite-storm",
    weight: 1,
    hostile: true,
    async run(ctx) {
      await closeSettings(ctx);
      await ensurePanel(ctx);
      for (let i = 0; i < 15; i++) {
        await ctx.page
          .locator(`[data-favorite="${ctx.pick(SONGS)}"]`)
          .first()
          .click();
      }
      return "x15";
    },
  },
];

const randomSeed = Number(process.env.CHAOS_SEED ?? Math.floor(Math.random() * 2 ** 31));
const defaultSteps = Number(process.env.CHAOS_STEPS ?? 500);
const defaultMinutes = Number(process.env.CHAOS_MINUTES ?? 0);

/** Fixed-seed traces of past failures (CLAUDE.md): replayed on every run. */
const regressionDir = new URL("./regressions/", import.meta.url);
const regressions = existsSync(regressionDir)
  ? readdirSync(regressionDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({
        file: f,
        ...(JSON.parse(readFileSync(new URL(f, regressionDir), "utf8")) as Regression),
      }))
  : [];

interface Regression {
  seed: number;
  steps: number;
  engine?: string;
  note: string;
}

for (const r of process.env.CHAOS_SEED ? [] : regressions) {
  test(`regression ${r.file} (seed ${r.seed})`, async ({ page, browserName }, testInfo) => {
    await runMonkey(page, browserName, testInfo, r.seed, r.steps, 0);
  });
}

test(`UI monkey (seed ${randomSeed})`, async ({ page, browserName }, testInfo) => {
  await runMonkey(page, browserName, testInfo, randomSeed, defaultSteps, defaultMinutes);
});

async function runMonkey(
  page: Page,
  browserName: string,
  testInfo: TestInfo,
  seed: number,
  steps: number,
  minutes: number,
): Promise<void> {
  test.setTimeout(minutes > 0 ? (minutes + 10) * 60_000 : 30 * 60_000);
  console.log(`CHAOS_SEED=${seed} mode=real-time engine=${browserName}`);
  const random = rng(seed + (browserName === "webkit" ? 1 : 0));
  const errors: string[] = [];
  watchErrors(page, errors);
  await installLongTaskObserver(page);
  const ctx: MonkeyContext = {
    page,
    random,
    hooks: true,
    errors,
    pick: (items) => items[Math.floor(random() * items.length)]!,
  };
  await page.setViewportSize(SIZES[0]!);
  await page.goto(`/?chaosSeed=${seed}`);
  await page.waitForSelector(".toolbar");

  const total = ACTIONS.reduce((n, a) => n + a.weight, 0);
  const trace: { step: number; action: string; detail: string }[] = [];
  const deadline = minutes > 0 ? Date.now() + minutes * 60_000 : Infinity;
  let step = 0;
  try {
    while (minutes > 0 ? Date.now() < deadline : step < steps) {
      step++;
      let r = random() * total;
      const action = ACTIONS.find((a) => (r -= a.weight) < 0) ?? ACTIONS[0]!;
      const detail = await action.run(ctx);
      if (detail === null) continue;
      trace.push({ step, action: action.name, detail });
      // Random wait, skewed short (0–1,500 ms).
      await page.waitForTimeout(Math.floor(random() ** 3 * 1500));
      await checkInvariants(ctx, MAX_TASK_MS);
      if (step % 100 === 0) await checkpoint(page);
    }
    await checkpoint(page);
  } catch (e) {
    const dir = saveArtifacts(`${browserName}-seed-${seed}`, {
      "repro.json": { seed, engine: browserName, failedAtStep: step, error: String(e), trace },
      "diagnostics.txt": await page
        .evaluate(() => window.__banjoTest?.services.diagnostics.report() ?? "")
        .catch(() => ""),
      "storage.json": await page
        .evaluate(() => window.__banjoTest?.dumpStorage())
        .catch(() => ({})),
      "faults.json": await page.evaluate(() => window.__banjoChaos?.log()).catch(() => []),
    });
    await page
      .screenshot({ path: `${dir}screenshot.png`.replace(/^\/([A-Z]:)/, "$1") })
      .catch(() => {});
    testInfo.annotations.push({ type: "chaos-seed", description: String(seed) });
    throw e;
  }
  console.log(`CHAOS_SEED=${seed} passed ${step} steps`);
}
