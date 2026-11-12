// R3 / spike S2: tab slots line up under the notation's notes, for every built-in song, at
// several screen widths and sizes.
import { expect, test } from "@playwright/test";
import { toggleSongs } from "../helpers/ui.ts";

const SONGS = ["cripple-creek", "old-joe-clark", "wildwood-flower", "will-the-circle-be-unbroken"];

for (const width of [820, 1180]) {
  test(`notation and tab line up at ${width}px (R3)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const id of SONGS) {
      await page.click(`[data-song="${id}"][data-section="builtin"]`);
      if (width < 900) await expect(page.locator(".song-panel")).toBeHidden();
      await page.waitForSelector("svg.tab");
      const misses = await page.evaluate(() => {
        const out: string[] = [];
        for (const line of document.querySelectorAll(".song-line")) {
          const fretX = [...line.querySelectorAll(".tab-fret")].map((t) => {
            const r = t.getBoundingClientRect();
            return r.left + r.width / 2;
          });
          for (const head of line.querySelectorAll(".notation .abcjs-notehead")) {
            const r = head.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const nearest = Math.min(...fretX.map((x) => Math.abs(x - cx)));
            if (nearest > 4)
              out.push(`line ${line.getAttribute("data-first-measure")}: ${nearest.toFixed(1)}px`);
          }
        }
        return out;
      });
      expect(misses, `${id} misaligned notes`).toEqual([]);
      if (width < 900) await toggleSongs(page);
    }
  });
}
