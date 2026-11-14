// T3 · Saved chord patterns under faults (CHAOS_TESTING.md §6.1, §6.5, §6.6; F46). The patterns
// are part of the settings document, so they must survive a full disk, a reload before the save
// lands, damaged settings, and a seeded storm of saves, loads, renames, deletes and faults.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { checkpoint, rng, waitForSaves, watchErrors } from "./harness.ts";
import { toggleSongs } from "../helpers/ui.ts";

async function openExercise(page: Page, roll = "forward") {
  const panel = page.locator(".song-panel");
  if (!(await panel.isVisible())) await toggleSongs(page);
  await page.click(`[data-song="exercise:${roll}"][data-section="exercises"]`);
  await page.waitForSelector("svg.tab");
  if (!(await page.getByTestId("pattern-bar").isVisible())) {
    await page.click('[data-action="view-full"]');
  }
  await expect(page.getByTestId("pattern-bar")).toBeVisible();
}

async function start(page: Page, errors: string[]) {
  watchErrors(page, errors);
  page.on("dialog", (d) => void d.accept()); // "Delete the pattern?"
  await page.goto("/");
  await page.waitForSelector(".toolbar");
}

const CHORDS = ["Am", "C", "D7", "Em", "G7", "B7"];

async function setChord(page: Page, measure: number, chord: string) {
  await page.locator(".notation .abcjs-chord").nth(measure).click();
  await page.click(`.chord-option[data-chord="${chord}"]`);
}

async function saveAs(page: Page, name: string) {
  await page.click('[data-action="patterns-open"]');
  await page.fill("#pattern-name-input", name);
  await page.click('[data-action="pattern-save"]');
  await page.click('[data-action="pattern-close"]');
}

const patterns = (page: Page) =>
  page.evaluate(() => window.__banjoTest!.store.settings.value.chordPatterns.map((p) => p.name));

test("QuotaExceeded on saving a pattern: visible failure, kept, retried, saved (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await openExercise(page);
  await setChord(page, 5, "D7");
  await page.evaluate(() =>
    window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
  );
  await saveAs(page, "D7 version");
  await expect(page.locator(".notices")).toContainText("storage is full");
  // Kept in memory and still in use.
  expect(await patterns(page)).toEqual(["D7 version"]);
  await expect(page.getByTestId("pattern-name")).toHaveText("D7 version");
  await page.evaluate(() => window.__banjoChaos!.disarmAll());
  await waitForSaves(page);
  await expect(page.locator(".notices")).toHaveCount(0);
  await checkpoint(page);
  await page.reload();
  await page.waitForSelector(".toolbar");
  expect(await patterns(page)).toEqual(["D7 version"]);
  expect(errors).toEqual([]);
});

test("a hard reload right after saving, and after deleting, keeps the result (6.5)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await openExercise(page);
  await setChord(page, 5, "D7");
  await saveAs(page, "First");
  await page.reload(); // no waiting for the save
  await page.waitForSelector(".toolbar");
  expect(await patterns(page)).toEqual(["First"]);
  await openExercise(page);
  await page.click('[data-action="patterns-open"]');
  await page.locator("[data-pattern-delete]").first().click();
  await page.reload();
  await page.waitForSelector(".toolbar");
  expect(await patterns(page)).toEqual([]);
  await checkpoint(page);
  expect(errors).toEqual([]);
});

test("damaged saved patterns are dropped, the other settings and the app are fine (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.evaluate(async () => {
    const t = window.__banjoTest!;
    const good = t.store.settings.value;
    await t.services.storage.put("settings", "settings", {
      ...good,
      size: 2,
      chordPatterns: [{ id: "a", name: "  untidy ", chords: { "0": "Z" } }, 7, null],
      activeChordPattern: 12,
    });
  });
  await page.reload();
  await page.waitForSelector(".toolbar");
  expect(await patterns(page)).toEqual([]);
  expect(await page.evaluate(() => window.__banjoTest!.store.settings.value.size)).toBe(2);
  await openExercise(page);
  await expect(page.getByTestId("pattern-name")).toHaveText("standard");
  expect(errors).toEqual([]);
});

test("a seeded storm of pattern saves, loads, renames, deletes, reloads and disk faults (6.6)", async ({
  page,
}, testInfo) => {
  const seed = Number(process.env.CHAOS_SEED ?? 23);
  const random = rng(seed);
  const errors: string[] = [];
  await start(page, errors);
  await openExercise(page);
  const trace: string[] = [];
  let n = 0;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  try {
    for (let i = 0; i < 50; i++) {
      const r = random();
      if (r < 0.2) {
        const m = 2 + Math.floor(random() * 12);
        const chord = pick(CHORDS);
        trace.push(`chord ${m} ${chord}`);
        await setChord(page, m, chord);
      } else if (r < 0.4) {
        const name = `P${n++}`;
        trace.push(`save ${name}`);
        await saveAs(page, name);
      } else if (r < 0.55) {
        trace.push("load");
        await page.click('[data-action="patterns-open"]');
        const rows = page.locator("[data-pattern]"); // "Standard chords" is always there
        await rows.nth(Math.floor(random() * (await rows.count()))).click(); // closes the sheet
      } else if (r < 0.65) {
        trace.push("rename");
        await page.click('[data-action="patterns-open"]');
        const rename = page.locator("[data-pattern-rename]").first();
        if (await rename.isVisible()) {
          await rename.click();
          await page.fill("#pattern-name-input", `R${n++}`);
          await page.click('[data-action="pattern-save"]');
        }
        await page.click('[data-action="pattern-close"]');
      } else if (r < 0.75) {
        trace.push("delete");
        await page.click('[data-action="patterns-open"]');
        const del = page.locator("[data-pattern-delete]").first();
        if (await del.isVisible()) await del.click();
        await page.click('[data-action="pattern-close"]');
      } else if (r < 0.85) {
        trace.push("reload");
        await page.reload();
        await page.waitForSelector(".toolbar");
        await openExercise(page, pick(["forward", "backward", "forward-reverse"]));
      } else if (r < 0.93) {
        trace.push("arm-quota");
        await page.evaluate(() =>
          window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
        );
      } else {
        trace.push("disarm");
        await page.evaluate(() => window.__banjoChaos!.disarmAll());
      }
      await page.waitForTimeout(Math.floor(random() ** 3 * 300));
    }
    await checkpoint(page); // disarms faults, waits for saves, compares shown with stored
    const before = await page.evaluate(() => window.__banjoTest!.store.settings.value);
    await page.reload();
    await page.waitForSelector(".toolbar");
    const after = await page.evaluate(() => window.__banjoTest!.store.settings.value);
    expect(after.chordPatterns).toEqual(before.chordPatterns);
    expect(after.exerciseChords).toEqual(before.exerciseChords);
    expect(errors).toEqual([]);
  } catch (e) {
    testInfo.annotations.push({ type: "chaos-seed", description: String(seed) });
    console.log(`CHAOS_SEED=${seed} trace: ${trace.join(", ")}`);
    throw e;
  }
});
