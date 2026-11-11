// Phase 2 ("Play") features, end to end: F6–F11, F13. Sound itself is checked by the chaos
// suite's audio probes; here we check what Dad sees. Playwright's WebKit on Windows has no
// Web Audio (spike S0), so playback tests run there only on Linux.
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

test("Play counts in, follows the music measure by measure, and Stop clears it (F7, F8, F10)", async ({
  page,
  browserName,
}) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "cripple-creek");
  await page.locator('input[name="tempo-slider"]').fill("110");
  await page.click('[data-action="play"]');
  await expect(page.locator(".count-in")).toBeVisible();
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Stop");
  await expect(page.locator('.measure-highlight[data-measure="1"]').first()).toBeVisible({
    timeout: 6000,
  });
  await expect(page.locator('.measure-highlight[data-measure="2"]').first()).toBeVisible({
    timeout: 6000,
  });
  // Exactly one measure is highlighted (on both staves, as one box per line) (I5).
  await expect(page.locator(".measure-highlight")).toHaveCount(1);
  // The finger badge of the note being played is ringed (F30), and only that moment's note.
  await expect(page.locator(".tab-badge.play-now").first()).toBeVisible({ timeout: 3000 });
  expect(await page.locator(".tab-badge.play-now").count()).toBeLessThanOrEqual(2);
  // The old strip of big finger letters above the tab is gone.
  await expect(page.locator(".finger-strip")).toHaveCount(0);
  await page.click('[data-action="play"]');
  await expect(page.locator(".measure-highlight")).toHaveCount(0, { timeout: 500 });
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Play");
});

test("tempo is per song; parts and metronome are preferences, all remembered (F6, F9)", async ({
  page,
}) => {
  await openSong(page, "old-joe-clark");
  await expect(page.locator('[data-action="tempo"]')).toHaveText("100");
  // The slider next to the number sets the tempo; the number itself opens the tempo panel (F9).
  await page.locator('input[name="tempo-slider"]').fill("98");
  await expect(page.locator('[data-action="tempo"]')).toHaveText("98");
  await page.locator('input[name="tempo-slider"]').fill("90");
  const held = 90;
  await expect(page.locator('[data-action="tempo"]')).toHaveText("90");
  await page.click('[data-action="tempo"]');
  await expect(page.locator(".practice-panel")).toBeVisible();
  await page.click(".practice-panel .big-button");
  await page.click('[data-part="banjo"]');
  await page.click('[data-action="metronome"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator('[data-action="tempo"]')).toHaveText(String(held));
  await expect(page.locator('[data-part="banjo"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-action="metronome"]')).toHaveText("Click on");
  // Another song keeps its own tempo, but the mix (banjo off, click on) is his preference and
  // follows him there.
  await openSong(page, "cripple-creek");
  await expect(page.locator('[data-action="tempo"]')).toHaveText("100");
  await expect(page.locator('[data-part="banjo"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator('[data-action="metronome"]')).toHaveText("Click on");
});

test("changing the key keeps the tab, adds a capo, and transposes the notation (F11)", async ({
  page,
}) => {
  await openSong(page, "cripple-creek");
  const firstFret = () => page.locator(".tab-fret").first().textContent();
  expect(await firstFret()).toBe("0");
  await page.selectOption('[data-action="key"]', "2");
  await expect(page.locator('[data-testid="capo-instruction"]')).toHaveText(
    "Capo 2 · tune 5th string up to A",
  );
  await expect(page.locator(".song-meta")).toContainText("Key of A major");
  // Actual frets: the open strings are now at the capo, fret 2.
  await expect.poll(firstFret).toBe("2");
  // The notation's key signature has three sharps now.
  await expect
    .poll(() => page.locator(".song-line").first().locator(".abcjs-key-signature path").count())
    .toBe(3);
  // Counting from the capo shows the tab as written.
  await page.click('[data-action="settings"]');
  await page.locator('button[name="fretNumbering"]', { hasText: "Count from the capo" }).click();
  await page.click("text=Done");
  await expect.poll(firstFret).toBe("0");
});

test("a section loop shows on the toolbar and can be cleared (F8)", async ({ page }) => {
  await openSong(page, "will-the-circle-be-unbroken");
  await page.click('[data-action="loop"]');
  await page.selectOption('select[name="loopFrom"]', "3");
  await page.selectOption('select[name="loopTo"]', "4");
  await expect(page.locator('[data-action="loop"]')).toHaveText("Loop 3–4");
  await page.click('[data-action="clear-loop"]');
  await expect(page.locator('[data-action="loop"]')).toHaveText("Loop");
});

test("a looped section plays only its measures (F8)", async ({ page, browserName }) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="loop"]');
  await page.selectOption('select[name="loopFrom"]', "2");
  await page.selectOption('select[name="loopTo"]', "2");
  await page.click("text=Done");
  await page.click('[data-action="metronome"]'); // count-in → click on
  await page.click('[data-action="metronome"]'); // → off: no count-in
  await page.click('[data-action="tempo"]');
  await page.click("text=120");
  await page.click(".practice-panel >> text=Done");
  await page.click('[data-action="play"]');
  const seen = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const m = await page
      .locator(".measure-highlight")
      .first()
      .getAttribute("data-measure")
      .catch(() => null);
    if (m) seen.add(m);
    await page.waitForTimeout(200);
  }
  await page.click('[data-action="play"]');
  expect([...seen]).toEqual(["2"]);
});

test("a page-turner pedal starts and stops playback (F13)", async ({ page, browserName }) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "wildwood-flower");
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Stop");
  await page.waitForTimeout(400);
  await page.keyboard.press("PageDown");
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Play");
});

test("WebKit on Windows says sound isn't available instead of failing", async ({
  page,
  browserName,
}) => {
  test.skip(!noAudio(browserName), "only where Web Audio is missing");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="play"]');
  await expect(page.locator(".notices")).toContainText("Sound isn't available");
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Play");
});

test("the song list steps aside when playback starts, and a tab brings it back", async ({
  page,
  browserName,
}) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "old-joe-clark");
  const list = page.locator(".song-panel");
  const content = page.locator("main.content");
  await expect(list).toBeVisible();
  const narrow = (await content.boundingBox())!.width;
  await page.click('[data-action="play"]');
  await expect(list).toBeHidden();
  await expect(page.locator('[data-action="show-songs"]')).toBeVisible();
  // The music gets the width the list had (less the slim tab).
  expect((await content.boundingBox())!.width).toBeGreaterThan(narrow + 200);
  // Opened again during playback, it stays open (it only steps aside when playback starts).
  await page.click('[data-action="show-songs"]');
  await expect(list).toBeVisible();
  await page.waitForTimeout(900);
  await expect(list).toBeVisible();
  await page.click('[data-action="hide-songs"]');
  await expect(list).toBeHidden();
  // Stopped, then played again: it steps aside again.
  await page.click('[data-action="play"]');
  await page.click('[data-action="toggle-songs"]');
  await expect(list).toBeVisible();
  await page.click('[data-action="play"]');
  await expect(list).toBeHidden();
  await page.click('[data-action="play"]');
});

test("pause, step back by measures, and Play counts in and carries on from there", async ({
  page,
  browserName,
}) => {
  test.skip(noAudio(browserName), "no Web Audio in Playwright WebKit on Windows");
  await openSong(page, "old-joe-clark");
  await page.locator('input[name="tempo-slider"]').fill("200");
  const highlighted = async () =>
    Number(await page.locator(".measure-highlight").first().getAttribute("data-measure"));
  await expect(page.locator('[data-action="measure-back"]')).toBeVisible();
  await expect(page.locator('[data-action="pause"]')).toHaveCount(0);
  await page.click('[data-action="play"]');
  await expect(page.locator('[data-action="pause"]')).toBeVisible();
  await expect(page.locator('.measure-highlight[data-measure="3"]').first()).toBeVisible({
    timeout: 9000,
  });
  // Pause: Dad "messed up". The sound stops, the measure stays marked, Play is offered again.
  await page.click('[data-action="pause"]');
  await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Play");
  await expect(page.locator(".measure-highlight")).toHaveCount(1);
  const paused = await highlighted();
  // Back one measure, twice.
  await page.click('[data-action="measure-back"]');
  await expect(
    page.locator(`.measure-highlight[data-measure="${paused - 1}"]`).first(),
  ).toBeVisible();
  await page.click('[data-action="measure-back"]');
  const target = paused - 2;
  await expect(page.locator(`.measure-highlight[data-measure="${target}"]`).first()).toBeVisible();
  // Play counts in, then carries on from that measure.
  await page.click('[data-action="play"]');
  await expect(page.locator(".count-in")).toBeVisible();
  await expect(page.locator(`.measure-highlight[data-measure="${target}"]`).first()).toBeVisible({
    timeout: 6000,
  });
  await page.click('[data-action="play"]'); // Stop
  await expect(page.locator(".measure-highlight")).toHaveCount(0, { timeout: 1000 });
});
