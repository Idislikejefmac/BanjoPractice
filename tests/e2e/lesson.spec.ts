// F36 / F37 roll lesson end to end: the picture, the four steps, saved step.
// Set LESSON_SHOTS to a folder to also save screenshots there (for looking at the design).
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openLesson(page: Page, roll = "forward") {
  await page.click(`[data-song="exercise:${roll}"][data-section="exercises"]`);
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("roll-lesson")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
});

test("shows the roll as finger lanes with everything visible at step 1", async ({ page }) => {
  await openLesson(page);
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
  const notes = page.locator(".lane-note");
  await expect(notes).toHaveCount(8);
  await expect(page.locator(".lane-note .badge-T")).toHaveCount(3);
  await expect(page.locator(".lane-note .badge-hidden")).toHaveCount(0);
  await expect(page.locator(".lesson-cue")).toContainText("Listen for the thumb");
});

test("Next hides the second half; Peek reveals it; the step is saved", async ({ page }) => {
  await openLesson(page);
  await page.click('[data-action="lesson-next"]');
  await expect(page.getByTestId("lesson-step")).toContainText("Step 2 of 4");
  await expect(page.locator(".lane-note .badge-hidden")).toHaveCount(4);
  await page.click('[data-action="lesson-reveal"]');
  await expect(page.locator(".lane-note .badge-hidden")).toHaveCount(0);
  await page.click('[data-action="lesson-reveal"]');
  await expect(page.locator(".lane-note .badge-hidden")).toHaveCount(4);

  // Saved: a reload comes back at step 2, and other rolls are untouched.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("lesson-step")).toContainText("Step 2 of 4");
  await openLesson(page, "backward");
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
});

test("Back, Next, the dots and a swipe all move between steps, and stop at the ends", async ({
  page,
}) => {
  await openLesson(page);
  const step = page.getByTestId("lesson-step");
  await expect(page.locator('[data-action="lesson-prev"]')).toBeDisabled();
  await page.click('[data-action="lesson-step-3"]');
  await expect(step).toContainText("Step 3 of 4");
  await page.click('[data-action="lesson-prev"]');
  await expect(step).toContainText("Step 2 of 4");
  await page.click('[data-action="lesson-step-4"]');
  await expect(page.locator('[data-action="lesson-next"]')).toBeDisabled();

  // A sideways swipe on the panel (right = back, left = on).
  // Swipe across the lanes: the header can re-wrap when the step name changes length.
  const box = (await page.locator(".lesson-rule").boundingBox())!;
  const y = box.y + box.height / 2;
  const swipe = async (from: number, to: number) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 6 });
    await page.mouse.up();
  };
  await swipe(400, 700);
  await expect(step).toContainText("Step 3 of 4");
  await swipe(700, 400);
  await expect(step).toContainText("Step 4 of 4");
  // A short drag does nothing.
  await swipe(400, 430);
  await expect(step).toContainText("Step 4 of 4");
});

test("a song that isn't a roll exercise has no lesson", async ({ page }) => {
  await page.click('[data-song="cripple-creek"][data-section="builtin"]');
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("roll-lesson")).toHaveCount(0);
});

for (const width of [744, 820, 1180]) {
  test(`the lesson fits without sideways scrolling at ${width} wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 1000 ? 1100 : 820 });
    await openLesson(page);
    await page.click('[data-action="lesson-next"]');
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
    // Every button is a comfortable target (48 px or more).
    for (const sel of ["lesson-next", "lesson-reveal", "lesson-step-2"]) {
      const box = await page.locator(`[data-action="${sel}"]`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.width).toBeGreaterThanOrEqual(48);
    }
    const dir = process.env.LESSON_SHOTS;
    if (dir) await page.screenshot({ path: `${dir}/lesson-${width}.png` });
  });
}

test("a roll opens in its two-measure lesson, which loops, at 60 beats a minute", async ({
  page,
}) => {
  await openLesson(page);
  await expect(page.locator('[data-action="view-learn"]')).toHaveAttribute("aria-pressed", "true");
  const info = await page.evaluate(() => {
    const t = window.__banjoTest!;
    return {
      id: t.store.currentSong.value!.id,
      abc: t.store.currentSong.value!.abc,
      repeat: t.store.practice.value.autoRepeat,
    };
  });
  expect(info.id).toBe("lesson:forward");
  expect(info.abc).toContain("Q:1/4=60");
  expect(info.repeat).toBe(true);
  await expect(page.locator(".notation .abcjs-chord")).toHaveCount(2);
});

test("the switch goes to the full exercise and back, and each roll remembers its own view", async ({
  page,
}) => {
  await openLesson(page);
  await page.click('[data-action="view-full"]');
  await expect(page.getByTestId("roll-lesson")).toHaveCount(0);
  expect(await page.locator(".notation .abcjs-chord").count()).toBeGreaterThan(2);
  const id = () => page.evaluate(() => window.__banjoTest!.store.currentSong.value!.id);
  expect(await id()).toBe("exercise:forward");
  expect(await page.evaluate(() => window.__banjoTest!.store.practice.value.autoRepeat)).toBe(
    false,
  );

  // Remembered: opening it again, and after a reload, goes straight to the full exercise.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  expect(await id()).toBe("exercise:forward");
  await page.click('[data-song="exercise:forward"][data-section="exercises"]');
  expect(await id()).toBe("exercise:forward");
  // Another roll still starts in its lesson, and the panel marks the roll as current.
  await openLesson(page, "backward");
  expect(await id()).toBe("lesson:backward");
  await expect(
    page.locator('[data-song="exercise:backward"][data-section="exercises"]'),
  ).toHaveAttribute("aria-current", "page");
  // And back to the lesson, with the step kept.
  await page.click('[data-song="exercise:forward"][data-section="exercises"]');
  await page.click('[data-action="view-learn"]');
  expect(await id()).toBe("lesson:forward");
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
});

test("the lesson's chord comes from the same list, fills both measures and is saved", async ({
  page,
}) => {
  await openLesson(page);
  await page.click('[data-action="lesson-chord"]');
  await page.click('.chord-option[data-chord="D7"]');
  await expect(page.locator(".notation .abcjs-chord")).toHaveText(["D7", "D7"]);
  await expect(page.locator('[data-action="lesson-chord"]')).toContainText("D7");
  // Touching a chord letter in the notation opens the same list.
  await page.locator(".notation .abcjs-chord").nth(1).click();
  await page.click('.chord-option[data-chord="C"]');
  await expect(page.locator(".notation .abcjs-chord")).toHaveText(["C", "C"]);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator(".notation .abcjs-chord")).toHaveText(["C", "C"]);
  // The full exercise's own chords are untouched.
  await page.click('[data-action="view-full"]');
  expect(
    await page.evaluate(() => window.__banjoTest!.store.settings.value.exerciseChords),
  ).toEqual({});
});
