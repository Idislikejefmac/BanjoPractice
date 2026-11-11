// F36 / F37 roll lesson end to end: the picture, the fade ladder, saved progress.
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

test("three 'Got it' fade the second half; 'Show me' reveals it; progress is saved", async ({
  page,
}) => {
  await openLesson(page);
  for (let i = 0; i < 3; i++) await page.click('[data-action="lesson-got-it"]');
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

test("two 'Again' step back, and 'Start over' returns to full help", async ({ page }) => {
  await openLesson(page);
  for (let i = 0; i < 3; i++) await page.click('[data-action="lesson-got-it"]');
  await page.click('[data-action="lesson-again"]');
  await page.click('[data-action="lesson-again"]');
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
  for (let i = 0; i < 6; i++) await page.click('[data-action="lesson-got-it"]');
  await expect(page.getByTestId("lesson-step")).toContainText("Step 3 of 4");
  await page.click('[data-action="lesson-reset"]');
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
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
    for (let i = 0; i < 3; i++) await page.click('[data-action="lesson-got-it"]');
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
    // Every button is a comfortable target (48 px or more).
    for (const sel of ["lesson-got-it", "lesson-again", "lesson-reveal", "lesson-reset"]) {
      const box = await page.locator(`[data-action="${sel}"]`).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      expect(box!.width).toBeGreaterThanOrEqual(48);
    }
    const dir = process.env.LESSON_SHOTS;
    if (dir) await page.screenshot({ path: `${dir}/lesson-${width}.png` });
  });
}
