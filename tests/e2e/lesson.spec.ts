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

test("the fold button hides the lesson, leaves the tab, and is remembered across rolls", async ({
  page,
}) => {
  await openLesson(page);
  const fold = page.locator('[data-action="lesson-fold"]');
  await expect(fold).toHaveAttribute("aria-expanded", "true");
  await fold.click();
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".lane-note")).toHaveCount(0);
  await expect(page.locator("svg.tab").first()).toBeVisible();
  // Still folded on another roll; the step he was on is untouched.
  await page.click('[data-song="exercise:backward"][data-section="exercises"]');
  await expect(page.locator(".lane-note")).toHaveCount(0);
  await fold.click();
  await expect(page.locator(".lane-note")).toHaveCount(8);
  await expect(page.getByTestId("lesson-step")).toContainText("Step 1 of 4");
});
