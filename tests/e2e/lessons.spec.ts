// F47 · The Lessons screen: by instructor and by topic, foundations first, nuance on request, the
// "needs more information" filter, links to the roll lessons, and comfortable touch targets.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const JENS2 = "jens-lesson-02-forward-backward-roll";
const TONY1 = "tony-01-essential-banjo-rolls";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.waitForSelector(".toolbar");
});

const openLessons = async (page: Page) => {
  await page.click('[data-action="lessons"]');
  await expect(page.locator(".lessons-page")).toBeVisible();
};
const item = (page: Page, id: string) => page.locator(`[data-lesson="${id}"]`);

test("opens from the toolbar with a group for each instructor, and Done closes it", async ({
  page,
}) => {
  await openLessons(page);
  await expect(page.locator('[data-action="lessons-group-jens-kruger"]')).toContainText(
    "Jens Kruger",
  );
  await expect(page.locator('[data-action="lessons-group-tony-trischka"]')).toContainText(
    "Tony Trischka",
  );
  expect(await page.locator(".lesson-item").count()).toBeGreaterThanOrEqual(40);
  await page.click('[data-action="lessons-done"]');
  await expect(page.locator(".lessons-page")).toHaveCount(0);
});

test("a lesson shows the basics first, nuance only on request, and a link to the video", async ({
  page,
}) => {
  await openLessons(page);
  const l = item(page, JENS2);
  await expect(l.locator(".lesson-body")).toHaveCount(0);
  await l.locator('[data-action="lesson-toggle"]').click();
  await expect(l.locator('[data-action="lesson-toggle"]')).toHaveAttribute("aria-expanded", "true");
  await expect(l.locator(".lesson-points").first()).toContainText("thumb on the 3rd string");
  // The second layer is folded until he asks for it.
  await expect(l.locator(".lesson-nuance")).toHaveCount(0);
  await l.locator('[data-action="lesson-nuance"]').click();
  await expect(l.locator(".lesson-nuance")).toBeVisible();
  await expect(l.locator(".lesson-nuance")).toContainText("Sing along");
  const link = l.locator('[data-action="lesson-watch"]');
  await expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=Eb31RXfA9Mk");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(l.locator(".lesson-badge")).toHaveText("Complete");
});

test("'Needs more information' shows only the lessons that are not complete", async ({ page }) => {
  await openLessons(page);
  const all = await page.locator(".lesson-item").count();
  await page.click('[data-action="lessons-needs-more"]');
  const some = await page.locator(".lesson-item").count();
  expect(some).toBeGreaterThan(0);
  expect(some).toBeLessThan(all);
  await expect(page.locator(".lesson-badge", { hasText: /^Complete$/ })).toHaveCount(0);
  await expect(page.locator('[data-action="lessons-needs-more"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.click('[data-action="lessons-needs-more"]');
  expect(await page.locator(".lesson-item").count()).toBe(all);
});

test("by topic, a topic both instructors cover lists both, and folds away", async ({ page }) => {
  await openLessons(page);
  await page.click('[data-action="lessons-by-topic"]');
  const topic = page.locator('[data-topic="roll-forward-backward"]');
  await expect(topic).toContainText("both instructors");
  // A lesson with several topics is listed under each, so look inside this topic.
  await expect(topic.locator(`[data-lesson="${JENS2}"]`)).toBeVisible();
  await expect(topic.locator(`[data-lesson="${TONY1}"]`)).toBeVisible();
  await topic.locator('[data-action="topic-toggle"]').click();
  await expect(topic.locator(`[data-lesson="${JENS2}"]`)).toHaveCount(0);
});

test("'Also on this topic' takes him to the other instructor's lesson, opened", async ({
  page,
}) => {
  await openLessons(page);
  await item(page, JENS2).locator('[data-action="lesson-toggle"]').click();
  const related = item(page, JENS2).locator('[data-action="lesson-related"]').first();
  await expect(related).toContainText("Tony Trischka");
  const target = await related.getAttribute("data-related");
  await related.click();
  await expect(item(page, target!).locator(".lesson-body")).toBeVisible();
});

test("the roll lesson links to the instructors' lessons on that roll", async ({ page }) => {
  await page.click('[data-song="exercise:forward-reverse"][data-section="exercises"]');
  await page.waitForSelector("svg.tab");
  const links = page.getByTestId("roll-lesson-links");
  await expect(links).toContainText("Jens Kruger");
  await expect(links).toContainText("Tony Trischka");
  await links.locator(`[data-lesson-link="${JENS2}"]`).click();
  await expect(page.locator(".lessons-page")).toBeVisible();
  await expect(item(page, JENS2).locator(".lesson-body")).toBeVisible();
  // A roll no lesson states has no such line.
  await page.click('[data-action="lessons-done"]');
  await page.click('[data-song="exercise:index-leading"][data-section="exercises"]');
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("roll-lesson-links")).toHaveCount(0);
});

for (const width of [744, 1180]) {
  test(`the lessons fit and every control is a comfortable target at ${width} wide`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width < 1000 ? 1100 : 820 });
    await openLessons(page);
    await item(page, JENS2).locator('[data-action="lesson-toggle"]').click();
    for (const sel of [
      '[data-action="lessons-done"]',
      '[data-action="lessons-by-instructor"]',
      '[data-action="lessons-by-topic"]',
      '[data-action="lessons-needs-more"]',
      '[data-action="lessons-group-jens-kruger"]',
      '[data-action="lesson-toggle"]',
      '[data-action="lesson-nuance"]',
      '[data-action="lesson-watch"]',
    ]) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box!.height, sel).toBeGreaterThanOrEqual(48);
    }
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over).toBeLessThanOrEqual(0);
  });
}
