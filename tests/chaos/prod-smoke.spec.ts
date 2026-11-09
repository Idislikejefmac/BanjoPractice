// T6 · Production smoke (CHAOS_TESTING.md §9, DEVELOPMENT.md §13): the DOM-only invariants
// against the real production build, which has no chaos hooks (the chaos build is not
// byte-identical to production).
import { expect, test } from "@playwright/test";
import type { MonkeyContext } from "./harness.ts";
import {
  checkInvariants,
  installLongTaskObserver,
  rng,
  uiSnapshot,
  watchErrors,
} from "./harness.ts";

const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];

test("production build: no hooks, and the DOM invariants hold", async ({ page }) => {
  const errors: string[] = [];
  watchErrors(page, errors);
  await installLongTaskObserver(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.waitForSelector(".toolbar");
  expect(await page.evaluate(() => "__banjoTest" in window || "__banjoChaos" in window)).toBe(
    false,
  );
  const random = rng(7);
  const ctx: MonkeyContext = {
    page,
    random,
    hooks: false,
    errors,
    pick: (items) => items[Math.floor(random() * items.length)]!,
  };
  for (let i = 0; i < 40; i++) {
    const id = ctx.pick(SONGS);
    if (!(await page.locator(".song-panel").isVisible())) {
      await page.click('[data-action="toggle-songs"]');
    }
    await page.click(`[data-song="${id}"][data-section="builtin"]`);
    await page.waitForSelector("svg.tab");
    if (random() < 0.3) await page.click('[data-action="toggle-view"]');
    await page.evaluate((f) => window.scrollTo(0, f * document.body.scrollHeight), random());
    if (random() < 0.2) {
      const before = await uiSnapshot(page);
      await page.reload();
      await page.waitForSelector("svg.tab");
      await expect.poll(async () => (await uiSnapshot(page)).title).toBe(before.title);
    }
    await checkInvariants(ctx, 200);
  }
});
