// F45 · Touch a chord letter in a roll exercise, pick another chord of the key from the sheet
// that slides up, and that measure's chord and roll change. Exercises have no melody.
// Set LESSON_SHOTS to a folder to also save screenshots there.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openExercise(page: Page, roll = "forward") {
  if (!(await page.locator(".song-panel").isVisible())) {
    await page.click('[data-action="toggle-songs"]');
  }
  await page.click(`[data-song="exercise:${roll}"][data-section="exercises"]`);
  await page.waitForSelector("svg.tab");
}

const chords = (page: Page) => page.locator(".notation .abcjs-chord");
const chordTexts = async (page: Page) =>
  (await chords(page).allTextContents()).map((t) => t.trim());
/** The tab's roll frets under each measure, as text, to see that a measure was re-arranged. */
const tabText = async (page: Page) =>
  (await page.locator("svg.tab").evaluateAll((els) => els.map((e) => e.innerHTML))).join("|");

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.waitForSelector(".toolbar");
});

test("touch a measure's chord letter, slide to another chord of the key, and the measure changes", async ({
  page,
}) => {
  await openExercise(page);
  const before = await chordTexts(page);
  expect(before.slice(0, 6)).toEqual(["G", "G", "G", "C", "D", "G"]);
  // The chord letter is large and bold.
  const style = await chords(page)
    .nth(3)
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: parseFloat(s.fontSize), weight: s.fontWeight };
    });
  expect(style.size).toBeGreaterThanOrEqual(24);
  expect(Number(style.weight)).toBeGreaterThanOrEqual(700);
  const tabBefore = await tabText(page);

  await chords(page).nth(3).click(); // the C of the second part
  await expect(page.getByTestId("chord-sheet")).toBeVisible();
  // It is not the chord finder, and only chords of the key are on offer.
  await expect(page.locator(".chord-finder")).toHaveCount(0);
  await expect(page.locator(".chord-option")).toHaveText([
    /G\s*I$/,
    /Am\s*ii$/,
    /Bm\s*iii$/,
    /C\s*IV$/,
    /D\s*V$/,
    /Em\s*vi$/,
    /F\s*♭VII$/,
  ]);
  await expect(page.locator('.chord-option[data-chord="C"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const dir = process.env.LESSON_SHOTS;
  if (dir) {
    await page.waitForTimeout(400); // let the sheet finish sliding up
    await page.screenshot({ path: `${dir}/chord-sheet.png` });
  }
  await page.click('.chord-option[data-chord="Em"]');
  await expect(page.getByTestId("chord-sheet")).toHaveCount(0);

  const after = await chordTexts(page);
  expect(after.map((c, i) => (c === before[i] ? "" : `${i}:${c}`)).filter(Boolean)).toEqual([
    "3:Em",
  ]);
  expect(await tabText(page)).not.toBe(tabBefore); // the roll was arranged again for Em

  // Another roll has the same chord there, and it is still there after a reload.
  await openExercise(page, "backward");
  expect((await chordTexts(page))[3]).toBe("Em");
  await page.reload();
  await page.waitForSelector("svg.tab");
  expect((await chordTexts(page))[3]).toBe("Em");
});

test("the first part (open strings) has no changeable chords", async ({ page }) => {
  await openExercise(page);
  await chords(page).nth(0).click();
  await expect(page.getByTestId("chord-sheet")).toHaveCount(0);
  await expect(page.locator(".notation .abcjs-chord.changeable").first()).toBeVisible();
  const first = await chords(page).nth(0).getAttribute("class");
  expect(first).not.toContain("changeable");
});

test("a touch just beside the letter still counts, and a touch outside the sheet closes it", async ({
  page,
}) => {
  await openExercise(page);
  await chords(page).nth(4).scrollIntoViewIfNeeded();
  const box = (await chords(page).nth(4).boundingBox())!;
  await page.mouse.click(box.x + box.width + 8, box.y + box.height / 2);
  await expect(page.getByTestId("chord-sheet")).toBeVisible();
  await page.mouse.click(10, 10); // on the dimmed page
  await expect(page.getByTestId("chord-sheet")).toHaveCount(0);
});

test("the chord names follow the key he plays in", async ({ page }) => {
  await openExercise(page);
  await page.selectOption('[data-action="key"]', "2"); // key of A
  expect((await chordTexts(page)).slice(3, 5)).toEqual(["D", "E"]);
  await chords(page).nth(3).click();
  await expect(page.locator(".chord-option")).toHaveText([
    /A\s*I$/,
    /Bm\s*ii$/,
    /C♯m\s*iii$|C#m\s*iii$/,
    /D\s*IV$/,
    /E\s*V$/,
    /F♯m\s*vi$|F#m\s*vi$/,
    /G\s*♭VII$/,
  ]);
  await page.click('.chord-option[data-chord="Am"]'); // the chord named for the key of A: Bm
  expect((await chordTexts(page))[3]).toBe("Bm");
});

test("exercises have no melody: the switch is greyed out", async ({ page }) => {
  await openExercise(page);
  await expect(page.locator('[data-part="melody"]')).toBeDisabled();
  await expect(page.locator('[data-part="chords"]')).toBeEnabled();
  await page.click('[data-song="old-joe-clark"]');
  await page.waitForSelector("svg.tab");
  await expect(page.locator('[data-part="melody"]')).toBeEnabled();
  await expect(page.locator('[data-part="melody"]')).toHaveAttribute("aria-pressed", "true");
});

test("changing a chord while it plays doesn't stop it; the new chord is used as it comes round", async ({
  page,
}) => {
  await openExercise(page);
  await page.click('[data-action="repeat"]'); // loop, so a measure already played comes round again
  await page.click('[data-action="play"]');
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Stop");
  await expect(page.locator(".measure-highlight")).toBeVisible();
  await chords(page).nth(5).scrollIntoViewIfNeeded();
  await chords(page).nth(5).click(); // a measure ahead (or behind, when looping)
  await page.click('.chord-option[data-chord="Em"]');
  await page.waitForTimeout(1200);
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Stop");
  expect((await chordTexts(page))[5]).toBe("Em");
  await page.click('[data-action="play"]'); // stop
});
