// R3: every line of music fills the column, on every iPad size, with the song list open or
// closed, and the number of measures on a line follows the room there is.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { viaSettings } from "../helpers/ui.ts";

const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];

// A song with words: long ones under eighth notes, and half-note measures with short ones.
const WORDS = "strength-ened through-out straight-ened stretched thought-ful bright-ness screeched";
const SHORT = "Oh, the | sun and | rain will";
const WORDY = [
  "X:1",
  "T:Wordy",
  "M:4/4",
  "L:1/8",
  "Q:1/4=90",
  "K:G",
  '"G"G A B c d e f g|"C"E4 G4|"G"G4 B4|"D"A4 F4|"G"G A B c d e f g|"C"E4 G4|"G"G4 B4|"D"A4 F4|',
  `w:${WORDS} scratched | ${SHORT} | ${WORDS} scratched | ${SHORT}`,
  '"G"G A B c d e f g|"C"E4 G4|"G"G4 B4|"D"A4 F4|"G"G A B c d e f g|"C"E4 G4|"G"G4 B4|"G"G8|]',
  `w:${WORDS} scratched | ${SHORT} | ${WORDS} scratched | Oh, the | sun and | rain`,
  "",
].join("\n");

interface LineReport {
  measures: number;
  /** Where the tab staff ends, as a fraction of the column's width. */
  fill: number;
  /** How far anything drawn runs past the column (px). */
  over: number;
  /** Least gap between two words on the same row (px). */
  wordGap: number;
  /** Notes with no tab slot within 4 px under them. */
  misses: number;
}

async function report(page: Page): Promise<{ lines: LineReport[]; pageOver: number }> {
  return page.evaluate(() => {
    const column = document.querySelector(".song-lines")!.getBoundingClientRect();
    const lines = [...document.querySelectorAll(".song-line")].map((line) => {
      const rects = (sel: string) =>
        [...line.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
      const drawn = rects(".notation svg *, svg.tab *").filter((r) => r.width > 0);
      const words = rects(".notation .abcjs-lyric").sort((a, b) => a.left - b.left);
      let wordGap = Infinity;
      words.forEach((a, i) => {
        for (const b of words.slice(i + 1)) {
          if (Math.abs(a.top - b.top) < 3) wordGap = Math.min(wordGap, b.left - a.right);
        }
      });
      const fretX = rects(".tab-fret").map((r) => r.left + r.width / 2);
      const misses = rects(".notation .abcjs-notehead").filter((r) => {
        const cx = r.left + r.width / 2;
        return Math.min(...fretX.map((x) => Math.abs(x - cx))) > 4;
      }).length;
      return {
        measures: line.querySelectorAll("svg.tab .tab-measure").length,
        fill:
          (Math.max(...rects("svg.tab .tab-bar").map((r) => r.right)) - column.left) / column.width,
        over: Math.max(...drawn.map((r) => r.right)) - column.right,
        wordGap,
        misses,
      };
    });
    return { lines, pageOver: document.documentElement.scrollWidth - window.innerWidth };
  });
}

async function addWordy(page: Page) {
  await page.waitForFunction(() => window.__banjoTest !== undefined);
  await page.evaluate((abc) => {
    window.__banjoTest!.store.saveSong({
      schemaVersion: 1,
      id: "wordy",
      title: "Wordy",
      source: "user",
      abc,
      tags: [],
    });
  }, WORDY);
}

/** Opens a song and leaves the song list open or closed (it is an overlay under 900 px). */
async function open(page: Page, selector: string, panel: boolean) {
  await page.waitForFunction(() => window.__banjoTest !== undefined);
  await page.evaluate(() => window.__banjoTest!.store.toggleSongPanel(true));
  await page.click(selector);
  await page.waitForSelector("svg.tab");
  await page.evaluate((o) => window.__banjoTest!.store.toggleSongPanel(o), panel);
  // The column's width is read after a 150 ms debounce, then the lines are laid out again.
  await page.waitForTimeout(700);
}

const IPADS = [
  [1024, 768],
  [1180, 820],
  [1366, 1024],
  [820, 1180],
  [744, 1133],
] as const;

for (const [w, h] of IPADS) {
  test(`every line fills the column at ${w}x${h}, song list open or closed (R3)`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await addWordy(page);
    await page.goto("/");
    const songs = [
      ...SONGS.map((id) => `[data-song="${id}"][data-section="builtin"]`),
      '[data-song="wordy"][data-section="mine"]',
    ];
    for (const panel of w >= 900 ? [true, false] : [false]) {
      for (const song of songs) {
        await open(page, song, panel);
        const r = await report(page);
        const where = `${song} at ${w}x${h}, song list ${panel ? "open" : "closed"}`;
        expect(r.pageOver, `${where}: page scrolls sideways`).toBe(0);
        expect(r.lines.length, where).toBeGreaterThan(0);
        r.lines.forEach((line, i) => {
          const at = `${where}, line ${i + 1} of ${r.lines.length} (${JSON.stringify(line)})`;
          expect(line.fill, `${at}: empty space on the right`).toBeGreaterThan(0.95);
          expect(line.over, `${at}: runs past the right edge`).toBeLessThanOrEqual(2);
          expect(line.wordGap, `${at}: words collide`).toBeGreaterThan(1);
          expect(line.misses, `${at}: notes and tab out of line`).toBe(0);
        });
      }
    }
  });
}

test("more measures go on a line when there is more room (R3)", async ({ page }) => {
  const most = async (w: number, h: number, panel: boolean) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await open(page, '[data-song="old-joe-clark"][data-section="builtin"]', panel);
    return Math.max(...(await report(page)).lines.map((l) => l.measures));
  };
  const narrow = await most(1024, 768, true);
  const middle = await most(1180, 820, false);
  const wide = await most(1366, 1024, false);
  expect(narrow).toBeGreaterThanOrEqual(2);
  expect(middle).toBeGreaterThan(narrow);
  expect(middle).toBeGreaterThanOrEqual(4);
  expect(wide).toBeGreaterThanOrEqual(middle);

  // A bigger size setting needs more room for each measure.
  await page.evaluate(() => window.__banjoTest!.store.updateSettings({ size: 3 }));
  await page.waitForTimeout(700);
  const big = await report(page);
  expect(Math.max(...big.lines.map((l) => l.measures))).toBeLessThan(wide);
  for (const line of big.lines) {
    expect(line.fill).toBeGreaterThan(0.95);
    expect(line.over).toBeLessThanOrEqual(2);
  }
});

// Regression: abcjs was handed the staff width divided by the scale, which it then divided
// again, so a line that filled the column was drawn 1/scale too wide, taken for crowded and
// cut in half until it was under two-thirds full (when abcjs stops stretching it).
test("a full line of notation ends at the column's right edge", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await open(page, '[data-song="wildwood-flower"][data-section="builtin"]', false);
  const staff = await page.evaluate(() => {
    const column = document.querySelector(".song-lines")!.getBoundingClientRect();
    return [...document.querySelectorAll(".song-line")].map((line) => {
      const right = Math.max(
        ...[...line.querySelectorAll(".notation .abcjs-staff")].map(
          (e) => e.getBoundingClientRect().right,
        ),
      );
      return column.right - right;
    });
  });
  expect(staff.length).toBeLessThanOrEqual(3);
  for (const gap of staff) {
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThan(12);
  }
});

test("the tab-only view fills the column too", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await page.goto("/");
  await open(page, '[data-song="cripple-creek"][data-section="builtin"]', false);
  await viaSettings(page, "toggle-view");
  await page.waitForTimeout(500);
  const r = await report(page);
  expect(r.pageOver).toBe(0);
  expect(Math.max(...r.lines.map((l) => l.measures))).toBeGreaterThanOrEqual(4);
  for (const line of r.lines) {
    expect(line.fill).toBeGreaterThan(0.95);
    expect(line.over).toBeLessThanOrEqual(2);
  }
});
