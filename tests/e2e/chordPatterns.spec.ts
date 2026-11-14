// F46: saved chord patterns for the roll exercises.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openExercise(page: Page, roll = "forward") {
  await page.click(`[data-song="exercise:${roll}"][data-section="exercises"]`);
  await page.waitForSelector("svg.tab");
  // A roll opens in its two-measure lesson first; the patterns belong to the full exercise.
  if (!(await page.getByTestId("pattern-bar").isVisible())) {
    await page.click('[data-action="view-full"]');
  }
  await expect(page.getByTestId("pattern-bar")).toBeVisible();
}

const chords = (page: Page) => page.locator(".notation .abcjs-chord");
const chordTexts = async (page: Page) =>
  (await chords(page).allTextContents()).map((t) => t.trim());

/** Changes one measure's chord, as he does: touch the letter, then the chord. */
async function setChord(page: Page, measure: number, chord: string) {
  await chords(page).nth(measure).click();
  await page.click(`.chord-option[data-chord="${chord}"]`);
}

const bar = (page: Page) => page.getByTestId("pattern-name");
const openSheet = (page: Page) => page.click('[data-action="patterns-open"]');

async function saveAs(page: Page, name: string) {
  await openSheet(page);
  await page.fill("#pattern-name-input", name);
  await page.click('[data-action="pattern-save"]');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
});

test("the exercise says which chords are in use, and sheet music has no patterns", async ({
  page,
}) => {
  await openExercise(page);
  await expect(bar(page)).toHaveText("standard");
  await setChord(page, 3, "Am");
  await expect(bar(page)).toHaveText("your own");
  await page.click('[data-song="cripple-creek"][data-section="builtin"]');
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("pattern-bar")).toHaveCount(0);
});

test("save, change, update, load, rename and delete a pattern; it survives a reload", async ({
  page,
}) => {
  await openExercise(page);
  const standard = await chordTexts(page);

  // Save the D7 version.
  await setChord(page, 5, "D7");
  const d7 = await chordTexts(page);
  expect(d7).not.toEqual(standard);
  await saveAs(page, "  D7   version ");
  await expect(bar(page)).toHaveText("D7 version"); // tidied, now in use
  await expect(page.getByTestId("pattern-sheet")).toBeVisible(); // stays open to show it saved
  await page.click('[data-action="pattern-close"]');

  // Change a measure: it says so, and Update puts the change into the pattern.
  await setChord(page, 6, "Em");
  await expect(page.getByTestId("pattern-bar")).toContainText("(changed)");
  const changed = await chordTexts(page);
  await openSheet(page);
  await page.click('[data-action="pattern-update"]');
  await expect(page.locator('[data-action="pattern-update"]')).toHaveCount(0);
  await page.click('[data-action="pattern-close"]');
  await expect(page.getByTestId("pattern-bar")).not.toContainText("(changed)");

  // Standard chords, then back to the pattern.
  await openSheet(page);
  await page.click('[data-pattern="standard"]');
  await expect(bar(page)).toHaveText("standard");
  expect(await chordTexts(page)).toEqual(standard);
  await openSheet(page);
  await page.locator('[data-pattern]:not([data-pattern="standard"])').first().click();
  await expect(bar(page)).toHaveText("D7 version");
  expect(await chordTexts(page)).toEqual(changed);

  // Saved: a reload comes back to the same chords and the same pattern, on any roll.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await openExercise(page, "backward");
  await expect(bar(page)).toHaveText("D7 version");
  expect(await chordTexts(page)).toEqual(changed);

  // Rename.
  await openSheet(page);
  await page.locator("[data-pattern-rename]").first().click();
  await page.fill("#pattern-name-input", "Dominant");
  await page.click('[data-action="pattern-save"]');
  await page.click('[data-action="pattern-close"]');
  await expect(bar(page)).toHaveText("Dominant");

  // Delete (the chords stay as they are, but are no longer a saved pattern).
  page.once("dialog", (d) => void d.accept());
  await openSheet(page);
  await page.locator("[data-pattern-delete]").first().click();
  await expect(page.locator("[data-pattern-delete]")).toHaveCount(0);
  await page.click('[data-action="pattern-close"]');
  await expect(bar(page)).toHaveText("your own");
  expect(await chordTexts(page)).toEqual(changed);
});

test("a name already in use, or an empty one, is refused with a reason", async ({ page }) => {
  await openExercise(page);
  await setChord(page, 5, "D7");
  await saveAs(page, "Mine");
  await expect(bar(page)).toHaveText("Mine");
  await page.fill("#pattern-name-input", "mine");
  await page.click('[data-action="pattern-save"]');
  await expect(page.getByTestId("pattern-problem")).toContainText("already a pattern");
  await page.fill("#pattern-name-input", "   ");
  await page.click('[data-action="pattern-save"]');
  await expect(page.getByTestId("pattern-problem")).toContainText("name");
  await expect(page.locator("[data-pattern-delete]")).toHaveCount(1);
});

test("the sheet's controls are comfortable touch targets", async ({ page }) => {
  await openExercise(page);
  await setChord(page, 5, "D7");
  await saveAs(page, "Big buttons");
  for (const sel of [
    '[data-action="pattern-save"]',
    "[data-pattern-rename]",
    "[data-pattern-delete]",
    '[data-pattern="standard"]',
    '[data-action="pattern-close"]',
  ]) {
    const box = await page.locator(sel).first().boundingBox();
    expect(box!.height, sel).toBeGreaterThanOrEqual(48);
    expect(box!.width, sel).toBeGreaterThanOrEqual(44);
  }
  // Nothing sticks out sideways.
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(0);
});
