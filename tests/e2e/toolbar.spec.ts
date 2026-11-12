// F1 · The control bar is two rows, not tall: Rolls, Loop, Tab only and the other playback
// settings are in the ⚙ page, the song list has its own ‹ › tabs, and each volume slider sits
// just to the right of its button. Everything stays finger-sized.
import { expect, test } from "@playwright/test";
import { viaSettings } from "../helpers/ui.ts";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.waitForSelector(".toolbar");
  await page.click('[data-song="cripple-creek"]');
  await page.waitForSelector("svg.tab");
});

test("the bar is short, with no Songs, Tab only, Rolls, Loop or ⋯ buttons in it", async ({
  page,
}) => {
  const height = await page.locator(".toolbar").evaluate((e) => e.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(120); // was about 175
  for (const action of ["toggle-songs", "toggle-view", "rolls", "loop", "mixer"]) {
    await expect(page.locator(`.toolbar [data-action="${action}"]`)).toHaveCount(0);
  }
  await expect(page.locator(".toolbar").getByText("☰ Songs")).toHaveCount(0);
  // They are one touch away in the ⚙ page, which takes him back to the song.
  await page.click('[data-action="settings"]');
  for (const action of ["toggle-view", "rolls", "loop", "mixer"]) {
    await expect(page.locator(`.settings-page [data-action="${action}"]`)).toBeVisible();
  }
});

test("every button in the bar is at least 44 px, and each slider sits right of its button", async ({
  page,
}) => {
  const buttons = page.locator(".toolbar button, .toolbar select");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(8);
  for (let i = 0; i < count; i++) {
    const box = (await buttons.nth(i).boundingBox())!;
    expect(box.height, `button ${i}`).toBeGreaterThanOrEqual(44);
    expect(box.width, `button ${i}`).toBeGreaterThanOrEqual(44);
  }
  for (const [part, slider] of [
    ['[data-part="melody"]', 'input[name="mix-melody"]'],
    ['[data-part="chords"]', 'input[name="mix-chords"]'],
    ['[data-part="banjo"]', 'input[name="mix-banjo"]'],
    ['[data-action="metronome"]', 'input[name="mix-click"]'],
    ['[data-action="tempo"]', 'input[name="tempo-slider"]'],
  ] as const) {
    const b = (await page.locator(part).boundingBox())!;
    const s = (await page.locator(slider).boundingBox())!;
    expect(s.x, slider).toBeGreaterThanOrEqual(b.x + b.width - 1); // to the right
    expect(Math.abs(s.y + s.height / 2 - (b.y + b.height / 2)), slider).toBeLessThan(b.height / 2); // same row
  }
});

test("the song list opens and closes with the ‹ › tabs; a loop shows in the bar until cleared", async ({
  page,
}) => {
  await page.click('[data-action="hide-songs"]');
  await expect(page.locator(".song-panel")).toBeHidden();
  await page.click('[data-action="show-songs"]');
  await expect(page.locator(".song-panel")).toBeVisible();

  await expect(page.locator('[data-action="loop-active"]')).toHaveCount(0);
  await viaSettings(page, "loop");
  await page.selectOption('select[name="loopFrom"]', "2");
  await page.selectOption('select[name="loopTo"]', "3");
  await expect(page.locator('[data-action="loop-active"]')).toHaveText("Loop 2–3");
  await page.click('[data-action="clear-loop"]');
  await expect(page.locator('[data-action="loop-active"]')).toHaveCount(0);
});
