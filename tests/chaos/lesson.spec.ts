// T3 · Roll-lesson progress under faults (CHAOS_TESTING.md §6.1, §6.5; LEARNING_SPEC.md F37).
// Progress is one document (meta/learning). It must survive a full disk, a reload mid-save,
// damaged records, a newer database, and a seeded storm of ratings, reloads and faults.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { checkpoint, rng, waitForSaves, watchErrors } from "./harness.ts";

async function openLesson(page: Page, roll = "forward") {
  const panel = page.locator(".song-panel");
  if (!(await panel.isVisible())) await page.click('[data-action="toggle-songs"]');
  await page.click(`[data-song="exercise:${roll}"][data-section="exercises"]`);
  await expect(page.getByTestId("roll-lesson")).toBeVisible();
}

async function start(page: Page, errors: string[]) {
  watchErrors(page, errors);
  await page.goto("/");
  await page.waitForSelector(".toolbar");
}

const step = (page: Page) => page.getByTestId("lesson-step");

test("QuotaExceeded on a rating: visible failure, kept, retried, saved (6.1)", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await openLesson(page);
  await page.evaluate(() =>
    window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
  );
  for (let i = 0; i < 3; i++) await page.click('[data-action="lesson-got-it"]');
  await expect(page.locator(".notices")).toContainText("storage is full");
  // The step still shows: the change is kept in memory.
  await expect(step(page)).toContainText("Step 2 of 4");
  await page.evaluate(() => window.__banjoChaos!.disarmAll());
  await waitForSaves(page);
  await expect(page.locator(".notices")).toHaveCount(0);
  await checkpoint(page);
  await page.reload();
  await page.waitForSelector(".toolbar");
  await openLesson(page);
  await expect(step(page)).toContainText("Step 2 of 4");
  expect(errors).toEqual([]);
});

test("a hard reload right after a rating keeps it (6.5)", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await openLesson(page);
  for (let i = 0; i < 3; i++) await page.click('[data-action="lesson-got-it"]');
  await page.reload(); // no waiting for the save
  await page.waitForSelector(".toolbar");
  await openLesson(page);
  await expect(step(page)).toContainText("Step 2 of 4");
  await checkpoint(page);
  expect(errors).toEqual([]);
});

test("damaged saved progress is ignored and the lesson still opens (6.1)", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.evaluate(async () => {
    const s = window.__banjoTest!.services.storage;
    await s.put("meta", "learning", {
      version: 1,
      rolls: { forward: "garbage", backward: { level: 3 }, __proto__: { level: 4 }, nope: 1 },
    });
  });
  await page.reload();
  await page.waitForSelector(".toolbar");
  await openLesson(page, "forward");
  await expect(step(page)).toContainText("Step 1 of 4");
  await openLesson(page, "backward");
  await expect(step(page)).toContainText("Step 3 of 4");
  expect(errors).toEqual([]);
});

test("progress written by a newer version of the app is not used (6.1)", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.evaluate(async () => {
    await window.__banjoTest!.services.storage.put("meta", "learning", {
      version: 2,
      rolls: { forward: { level: 4, gotItRun: 3, againRun: 0 } },
    });
  });
  await page.reload();
  await page.waitForSelector(".toolbar");
  await openLesson(page);
  await expect(step(page)).toContainText("Step 1 of 4");
  expect(errors).toEqual([]);
});

test("a seeded storm of ratings, reloads and disk faults ends with shown = stored (6.6)", async ({
  page,
}, testInfo) => {
  const seed = Number(process.env.CHAOS_SEED ?? 11);
  const random = rng(seed);
  const errors: string[] = [];
  await start(page, errors);
  await openLesson(page);
  const rolls = ["forward", "backward", "forward-reverse", "alternating-thumb"];
  const trace: string[] = [];
  try {
    for (let i = 0; i < 60; i++) {
      const r = random();
      if (r < 0.45) {
        const a = random() < 0.65 ? "lesson-got-it" : "lesson-again";
        trace.push(a);
        await page.click(`[data-action="${a}"]`);
      } else if (r < 0.55) {
        trace.push("lesson-reveal");
        await page.click('[data-action="lesson-reveal"]');
      } else if (r < 0.62) {
        trace.push("lesson-reset");
        await page.click('[data-action="lesson-reset"]');
      } else if (r < 0.75) {
        const roll = rolls[Math.floor(random() * rolls.length)]!;
        trace.push(`open ${roll}`);
        await openLesson(page, roll);
      } else if (r < 0.85) {
        trace.push("reload");
        await page.reload();
        await page.waitForSelector(".toolbar");
        await openLesson(page, rolls[Math.floor(random() * rolls.length)]!);
      } else if (r < 0.93) {
        trace.push("arm-quota");
        await page.evaluate(() =>
          window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
        );
      } else {
        trace.push("disarm");
        await page.evaluate(() => window.__banjoChaos!.disarmAll());
      }
      await page.waitForTimeout(Math.floor(random() ** 3 * 400));
    }
    await checkpoint(page); // disarms faults, waits for saves, compares shown with stored
    // And it survives one more reload.
    const before = await page.evaluate(() => window.__banjoTest!.store.learning.value);
    await page.reload();
    await page.waitForSelector(".toolbar");
    const after = await page.evaluate(() => window.__banjoTest!.store.learning.value);
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  } catch (e) {
    testInfo.annotations.push({ type: "chaos-seed", description: String(seed) });
    console.log(`CHAOS_SEED=${seed} trace: ${trace.join(", ")}`);
    throw e;
  }
});

test("a chord picked with a full disk is kept, saved when space returns, and survives a reload (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.click('[data-song="exercise:forward"][data-section="exercises"]');
  await page.waitForSelector("svg.tab");
  const chords = page.locator(".notation .abcjs-chord");
  await page.evaluate(() =>
    window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
  );
  await chords.nth(3).click();
  await page.click('.chord-option[data-chord="Am"]');
  await expect(page.locator(".notices")).toContainText("storage is full");
  await expect(chords.nth(3)).toHaveText("Am");
  await page.evaluate(() => window.__banjoChaos!.disarmAll());
  await waitForSaves(page);
  await checkpoint(page);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(chords.nth(3)).toHaveText("Am");
  expect(errors).toEqual([]);
});
