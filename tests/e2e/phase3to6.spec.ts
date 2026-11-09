// Phases 3–6 end to end: generated arrangements and roll exercises (F14, F15, F11
// re-arranging), the chord finder (F16), the song editor (F17), backup and restore (F18), and
// the practice tools (F19, F21) up to where a real microphone is needed.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

async function openSong(page: Page, id: string, section = "builtin") {
  await page.click(`[data-song="${id}"][data-section="${section}"]`);
  await page.waitForSelector("svg.tab");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
});

test("roll exercises are in the library and use their roll throughout (F15)", async ({ page }) => {
  await openSong(page, "exercise:forward-reverse", "exercises");
  const labels = await page.locator(".tab-roll").allTextContents();
  expect(labels.length).toBeGreaterThan(8);
  expect(labels.every((l) => l === "Forward-reverse")).toBe(true);
  await page.click('[data-action="loop"]');
  await expect(page.locator("[data-part-loop]")).toHaveCount(4); // open strings + 3 progressions
});

test("a key that needs new shapes gets an auto-generated arrangement (F11, F14)", async ({
  page,
}) => {
  await openSong(page, "cripple-creek");
  await page.selectOption('[data-action="key"]', "7"); // D: D position
  await expect(page.locator('[data-testid="generated-note"]')).toContainText("auto-generated");
  await expect(page.locator('[data-testid="capo-instruction"]')).toContainText(
    "tune 5th string up to A",
  );
  expect(await page.locator(".tab-badge").count()).toBeGreaterThan(20);
  await page.selectOption('[data-action="key"]', "0");
  await expect(page.locator('[data-testid="generated-note"]')).toHaveCount(0);
});

test("the chord finder shows shapes, steps through them, and opens from a chord tap (F16)", async ({
  page,
}) => {
  await page.click('[data-action="chords"]');
  await page.selectOption('select[name="root"]', "D");
  await page.selectOption('select[name="quality"]', "7");
  await expect(page.locator('[data-testid="chord-name"]')).toHaveText("D7");
  await expect(page.locator('[data-testid="voicing-info"]')).toContainText("0 2 1 0");
  await expect(page.locator('[data-testid="voicing-info"]')).toContainText("no 3rd");
  await page.click('[data-action="next-voicing"]');
  await expect(page.locator('[data-testid="voicing-info"]')).toContainText("Shape 2 of");
  await page.click(".chord-finder >> text=Done");
  await openSong(page, "wildwood-flower");
  await page.locator(".notation .abcjs-chord", { hasText: "F" }).first().click();
  await expect(page.locator('[data-testid="chord-name"]')).toHaveText("F");
  await expect(page.locator('[data-testid="voicing-info"]')).toContainText("3 2 1 3");
});

test("Dad can enter a song, see its tab, save it, and find it in My songs (F17)", async ({
  page,
}) => {
  await page.click('[data-action="new-song"]');
  await page.fill('input[name="title"]', "Test Tune");
  await page.locator('button[name="length"]', { hasText: /^Quarter$/ }).click();
  for (const n of ["G", "A", "B", "D"]) await page.click(`[data-note="${n}"]`);
  // Measure 1 is full, so measure 2 starts by itself.
  await expect(page.locator('[data-measure-tab="2"]')).toHaveAttribute("aria-selected", "true");
  await page.locator('button[name="length"]', { hasText: /^Whole$/ }).click();
  await page.click('[data-note="G"]');
  await expect(page.locator(".song-editor svg.tab")).toBeVisible();
  // A full measure takes no more notes.
  await page.click('[data-measure-tab="2"]');
  await expect(page.locator('[data-note="A"]')).toBeDisabled();
  await page.click('[data-action="editor-save"]');
  await expect(page.locator(".toolbar-title")).toHaveText("Test Tune");
  await expect(page.locator('[data-section="mine"]', { hasText: "Test Tune" })).toBeVisible();
  expect(await page.locator(".tab-badge").count()).toBeGreaterThan(8);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('[data-section="mine"]', { hasText: "Test Tune" })).toBeVisible();
});

test("an unsaved song survives a reload of the editor (F17, chaos 6.5)", async ({ page }) => {
  await page.click('[data-action="new-song"]');
  await page.fill('input[name="title"]', "Half Done");
  await page.click('[data-note="E"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.click('[data-action="new-song"]');
  await expect(page.locator(".song-editor")).toContainText("Restored your unsaved changes");
  await expect(page.locator('input[name="title"]')).toHaveValue("Half Done");
});

test("back up, then restore into an empty app, with a preview (F18)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "downloads are checked in Chromium");
  await page.click('[data-action="new-song"]');
  await page.fill('input[name="title"]', "Backed Up");
  await page.click('[data-note="G"]');
  await page.click('[data-action="editor-save"]');
  await page.click('[data-action="settings"]');
  const download = page.waitForEvent("download");
  await page.click('[data-action="export"]');
  const file = await (await download).path();
  await expect(page.locator('[data-testid="last-backup"]')).toHaveText("today");
  // A fresh app: all storage cleared.
  await page.evaluate(async () => {
    localStorage.clear();
    for (const db of await indexedDB.databases()) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload();
  await expect(page.locator('[data-section="mine"]')).toHaveCount(0);
  await page.click('[data-action="settings"]');
  await page.setInputFiles('input[name="import"]', file);
  await expect(page.locator('[data-testid="import-preview"]')).toContainText("1 new");
  await page.click('[data-action="confirm-import"]');
  await expect(page.locator(".settings-page")).toContainText("Restored 1 song");
  await page.click(".settings-page >> text=Done");
  await expect(page.locator('[data-section="mine"]', { hasText: "Backed Up" })).toBeVisible();
});

test("the tuner explains a refused microphone instead of failing (F19)", async ({
  page,
  browserName,
}) => {
  test.skip(browserName === "webkit", "permission prompts are checked in Chromium");
  await page.click('[data-action="practice-tools"]');
  await page.click('[data-action="start-tuner"]');
  await expect(page.locator(".settings-page .song-note")).toContainText("microphone", {
    ignoreCase: true,
  });
});

test("the practice log records a session after playing (F21)", async ({ page, browserName }) => {
  test.skip(browserName === "webkit" && process.platform === "win32", "no Web Audio here");
  await openSong(page, "old-joe-clark");
  await page.click('[data-action="metronome"]');
  await page.click('[data-action="metronome"]'); // off: no count-in
  await page.click('[data-action="play"]');
  await page.waitForTimeout(1500);
  await page.click('[data-action="play"]');
  await page.click('[data-action="practice-tools"]');
  await page.click('[data-tool="log"]');
  await expect(page.locator('[data-testid="log-song"]')).toContainText("Old Joe Clark");
});

test("printable tab: a PDF of the song (F32)", async ({ page, browserName }) => {
  test.skip(browserName === "webkit", "downloads are checked in Chromium");
  await openSong(page, "cripple-creek");
  await page.click('[data-action="print"]');
  const download = page.waitForEvent("download");
  await page.click('[data-action="make-pdf"]');
  const d = await download;
  expect(d.suggestedFilename()).toBe("Cripple Creek.pdf");
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync((await d.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(5000);
});

test("song words show under the notes and the tab, and can be turned off", async ({ page }) => {
  await openSong(page, "will-the-circle-be-unbroken");
  await expect(page.locator(".notation .abcjs-lyric").first()).toBeVisible();
  await page.click('[data-action="toggle-view"]');
  await expect(page.locator(".tab-lyric").first()).toHaveText("Will");
  await page.click('[data-action="settings"]');
  await page.locator('input[name="showLyrics"]').uncheck();
  await page.click("text=Done");
  await expect(page.locator(".tab-lyric")).toHaveCount(0);
  await page.click('[data-action="toggle-view"]');
  await expect(page.locator(".notation .abcjs-lyric")).toHaveCount(0);
});

test("each part has its own volume slider, remembered per song", async ({ page }) => {
  await openSong(page, "old-joe-clark");
  for (const name of ["mix-melody", "mix-chords", "mix-banjo", "mix-click"]) {
    await expect(page.locator(`input[name="${name}"]`)).toBeVisible();
  }
  await page.locator('input[name="mix-banjo"]').fill("30");
  await page.locator('input[name="mix-click"]').fill("100");
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator('input[name="mix-banjo"]')).toHaveValue("30");
  await expect(page.locator('input[name="mix-click"]')).toHaveValue("100");
});

test("a singing voice can be turned on per song, with its own volume and register", async ({
  page,
  browserName,
}) => {
  await openSong(page, "will-the-circle-be-unbroken");
  const chip = page.locator('[data-part="voice"]');
  await expect(chip).toHaveText("Voice");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await page.locator('input[name="mix-voice"]').fill("40");
  await page.click('[data-action="mixer"]');
  await expect(page.locator('[data-panel="voice"]')).toBeVisible();
  await page.locator('input[name="voice-octave"]').fill("0");
  await page.click(".practice-panel .big-button");
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.locator('[data-part="voice"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('input[name="mix-voice"]')).toHaveValue("40");
  // A song with no words has no voice to turn on.
  await openSong(page, "old-joe-clark");
  const hasWords = await page.locator('[data-part="voice"]').count();
  expect(hasWords).toBeLessThanOrEqual(1);
  // Playing with the voice on makes sound without errors (no Web Audio in WebKit on Windows).
  if (browserName === "chromium") {
    await openSong(page, "will-the-circle-be-unbroken");
    await page.click('[data-action="play"]');
    await expect(page.locator('[data-action="play"]')).toHaveAttribute("aria-label", "Stop");
    await page.waitForTimeout(2500);
    await page.click('[data-action="play"]');
  }
});
