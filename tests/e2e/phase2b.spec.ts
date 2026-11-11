// Phase 2b practice modes, end to end: F26–F31, F33, F34.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openSong(page: Page, id: string) {
  await page.click(`[data-song="${id}"][data-section="builtin"]`);
  await page.waitForSelector("svg.tab");
}
const noAudio = (browserName: string) => browserName === "webkit" && process.platform === "win32";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
});

test("part loops: one tap loops the A or B part (F26)", async ({ page }) => {
  await openSong(page, "cripple-creek");
  await page.click('[data-action="loop"]');
  await page.click('[data-part-loop="B"]');
  await expect(page.locator('[data-action="loop"]')).toHaveText("Loop 5–8");
  await page.click('[data-part-loop="A"]');
  await expect(page.locator('[data-action="loop"]')).toHaveText("Loop 1–4");
});

test("step mode: Next note moves one note at a time (F28)", async ({ page, browserName }) => {
  test.skip(noAudio(browserName), "stepping sounds the note: no Web Audio in WebKit on Windows");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="loop"]');
  await page.click('[data-action="step-mode"]');
  await expect(page.locator('[data-action="step-next"]')).toBeVisible();
  await page.click('[data-action="step-next"]');
  await expect(page.locator(".tab-fret.step-current").first()).toHaveAttribute("data-slot", "0");
  await page.click('[data-action="step-next"]');
  await expect(page.locator(".tab-fret.step-current").first()).toHaveAttribute("data-slot", "1");
  // The pedal steps too (right = next, left = back).
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".tab-fret.step-current").first()).toHaveAttribute("data-slot", "2");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".tab-fret.step-current").first()).toHaveAttribute("data-slot", "1");
  await page.click('[data-action="step-exit"]');
  await expect(page.locator('[data-action="play"]')).toBeVisible();
  await expect(page.locator(".tab-fret.step-current")).toHaveCount(0);
});

test("tap tempo sets the tempo from four taps (F33)", async ({ page }) => {
  await openSong(page, "old-joe-clark");
  await page.click('[data-action="tempo"]');
  // Tap every 500 ms (120 bpm), timed in the page so slow test clicks don't skew it.
  await page.evaluate(async () => {
    const btn = document.querySelector<HTMLButtonElement>('[data-action="tap-tempo"]')!;
    for (let i = 0; i < 4; i++) {
      btn.click();
      await new Promise((r) => setTimeout(r, 500));
    }
  });
  const bpm = Number(await page.locator('[data-action="tempo"]').textContent());
  expect(bpm).toBeGreaterThan(95);
  expect(bpm).toBeLessThan(125);
});

test("notation can be shown in the tab's key when using a capo (F34)", async ({ page }) => {
  await openSong(page, "cripple-creek");
  await page.selectOption('[data-action="key"]', "2");
  await expect
    .poll(() => page.locator(".song-line").first().locator(".abcjs-key-signature path").count())
    .toBe(3);
  await page.click('[data-action="mixer"]');
  await page.locator('button[name="notationKey"]', { hasText: "As the tab" }).click();
  await expect(page.locator('[data-testid="notation-key"]')).toContainText("G major");
  await expect
    .poll(() => page.locator(".song-line").first().locator(".abcjs-key-signature path").count())
    .toBe(1);
  // The capo instruction still says what to do: the sound is still in A.
  await expect(page.locator('[data-testid="capo-instruction"]')).toContainText("Capo 2");
});

test("echo mode leaves Dad a silent 'your turn' phrase, with a beat light (F29, F31)", async ({
  page,
  browserName,
}) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="loop"]');
  await page.locator('button[name="echoMeasures"]', { hasText: "1 measure" }).click();
  await page.click(".practice-panel >> text=Done");
  await page.click('[data-action="tempo"]');
  await page.click("text=120");
  await page.click(".practice-panel >> text=Done");
  await page.click('[data-action="metronome"]'); // count-in → click on
  await page.click('[data-action="play"]');
  await expect(page.locator(".beat-light")).toBeVisible();
  await expect(page.locator(".your-turn-label")).toBeVisible({ timeout: 8000 });
  await page.click('[data-action="play"]');
  await expect(page.locator(".your-turn-label")).toHaveCount(0);
});

test("step mode: says what the note under the cursor is for (F39)", async ({
  page,
  browserName,
}) => {
  test.skip(noAudio(browserName), "stepping sounds the note: no Web Audio in WebKit on Windows");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="loop"]');
  await page.click('[data-action="step-mode"]');
  await expect(page.getByTestId("step-reason")).toHaveCount(0);
  await page.click('[data-action="step-next"]');
  const box = page.getByTestId("step-reason");
  await expect(box).toBeVisible();
  await expect(box).toContainText("note 1");
  await expect(box).toContainText(/string \d, fret \d+/);
  await page.click('[data-action="step-next"]');
  await expect(box).toContainText("note 2");
  await page.click('[data-action="step-exit"]');
  await expect(page.getByTestId("step-reason")).toHaveCount(0);
});
