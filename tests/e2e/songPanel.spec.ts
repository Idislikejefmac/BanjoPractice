// The song list: sections in a fixed order, each one foldable (the search stays on top).
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.waitForSelector(".song-panel .song-section");
});

test("sections are ordered: exercises, then my songs area, then the built-in songs", async ({
  page,
}) => {
  const titles = await page
    .locator(".song-panel .song-section")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const at = (t: string) => titles.indexOf(t);
  expect(at("Roll exercises")).toBeGreaterThanOrEqual(0);
  expect(at("Roll exercises")).toBeLessThan(at("Songs"));
  // The search box is the first thing in the panel.
  const first = await page.locator(".song-panel").evaluate((p) => p.firstElementChild?.className);
  expect(first).toContain("panel-head");
});

test("a section folds and opens, and a search opens it again", async ({ page }) => {
  const toggle = page.locator('[data-action="toggle-section-exercises"]');
  const rows = page.locator('[data-section="exercises"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(await rows.count()).toBeGreaterThan(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(rows).toHaveCount(0);
  await toggle.click();
  await expect(rows.first()).toBeVisible();
  const box = await toggle.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  // Fold it again; searching (the box only shows with many songs) opens its matches anyway.
  await toggle.click();
  if ((await page.locator(".song-search").count()) > 0) {
    await page.fill(".song-search", "forward");
    await expect(rows.first()).toBeVisible();
  }
});
