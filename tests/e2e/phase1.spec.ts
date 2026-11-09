// Phase 1 ("Read") features, end to end: F1–F5, F20, F22, F24, F25, F35 and offline.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function openSong(page: Page, id: string) {
  await page.click(`[data-song="${id}"][data-section="builtin"]`);
  await page.waitForSelector("svg.tab");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
});

test("every built-in song opens with notation, tab and finger badges (F3–F5)", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  for (const id of SONGS) {
    await openSong(page, id);
    await expect(page.locator(".toolbar-title")).not.toHaveText("Banjo Practice");
    await expect(page.locator(".notation svg").first()).toBeVisible();
    expect(await page.locator(".tab-badge").count()).toBeGreaterThan(20);
    expect(await page.locator(".tab-fret.melody").count()).toBeGreaterThan(10);
    await expect(page.locator(".song-note.warn")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("tab-only view and size are one tap away and are remembered (F22)", async ({ page }) => {
  await page.goto("/");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="toggle-view"]');
  await expect(page.locator(".notation")).toHaveCount(0);
  await expect(page.locator(".tab-chord").first()).toBeVisible();
  const before = await page
    .locator(".tab-fret")
    .first()
    .evaluate((e) => e.getBoundingClientRect().height);
  await page.click('[data-action="bigger"]');
  await expect
    .poll(() =>
      page
        .locator(".tab-fret")
        .first()
        .evaluate((e) => e.getBoundingClientRect().height),
    )
    .toBeGreaterThan(before);
  await page.waitForTimeout(700); // past the session debounce
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator(".toolbar-title")).toHaveText("Cripple Creek");
  await expect(page.locator(".notation")).toHaveCount(0);
  await expect(page.locator('[data-action="toggle-view"]')).toHaveAttribute("aria-pressed", "true");
});

test("favorites and recently played survive a reload (F24)", async ({ page }) => {
  await page.goto("/");
  await page.click('[data-favorite="old-joe-clark"]');
  await expect(page.locator('[data-song="old-joe-clark"][data-section="favorites"]')).toBeVisible();
  await openSong(page, "wildwood-flower");
  await openSong(page, "cripple-creek");
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('[data-song="old-joe-clark"][data-section="favorites"]')).toBeVisible();
  const recent = page.locator('[data-section="recent"]');
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toHaveAttribute("data-song", "cripple-creek");
});

test("a hard reload returns to the same song and place (F35, I16)", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 500 });
  await page.goto("/");
  await openSong(page, "will-the-circle-be-unbroken");
  const lines = page.locator(".song-line");
  expect(await lines.count()).toBeGreaterThan(3);
  const target = lines.nth(2);
  const targetMeasure = await target.getAttribute("data-first-measure");
  await target.evaluate((el) => {
    const toolbar = document.querySelector(".toolbar")!.getBoundingClientRect().height;
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - toolbar);
  });
  await page.waitForTimeout(100);
  // No waiting for the debounce: the localStorage mirror must already have it.
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator(".toolbar-title")).toHaveText("Will the Circle Be Unbroken");
  await expect
    .poll(() =>
      page.evaluate((m) => {
        const el = document.querySelector(`.song-line[data-first-measure="${m}"]`);
        const toolbar = document.querySelector(".toolbar")!.getBoundingClientRect().height;
        return el ? Math.abs(el.getBoundingClientRect().top - toolbar) : 999;
      }, targetMeasure),
    )
    .toBeLessThanOrEqual(2);
});

test("the toolbar stays on screen while scrolling (F1, I3)", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 600 });
  await page.goto("/");
  await page.click('[data-action="toggle-songs"]');
  await page.click('[data-action="toggle-songs"]');
  await openSong(page, "old-joe-clark");
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(200);
  const box = await page.locator(".toolbar").boundingBox();
  expect(box?.y).toBe(0);
  await expect(page.locator('[data-action="settings"]')).toBeInViewport();
});

test("settings change the tab, and diagnostics can be shared (F20, F22, F25)", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await openSong(page, "cripple-creek");
  expect(await page.locator(".tab-roll").count()).toBeGreaterThan(0);
  await page.click('[data-action="settings"]');
  await page.locator('input[name="showRollNames"]').uncheck();
  await page.locator('input[name="colorBadges"]').uncheck();
  await page.locator('button[name="spikes"]', { hasText: "7, 9 and 10" }).click();
  await expect(page.locator(".settings-page")).toContainText("Version");
  if (browserName === "chromium") {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await page.click("text=Share diagnostics");
  await page.click("text=Done");
  await expect(page.locator(".tab-roll")).toHaveCount(0);
  await expect(page.locator(".shell")).toHaveClass(/grey-badges/);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator(".tab-roll")).toHaveCount(0);
});

test("songs open with no network once the app has loaded (offline)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await openSong(page, "wildwood-flower");
  expect(await page.locator(".tab-badge").count()).toBeGreaterThan(20);
  await context.setOffline(false);
});
