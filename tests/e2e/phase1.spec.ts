// Phase 1 ("Read") features, end to end: F1–F5, F20, F22, F24, F25, F35 and offline.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { viaSettings, toggleSongs } from "../helpers/ui.ts";

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
  await viaSettings(page, "toggle-view");
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
  // Narrow enough, beside the song list, for two measures on a line: enough lines to scroll.
  await page.setViewportSize({ width: 950, height: 500 });
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
  await toggleSongs(page);
  await toggleSongs(page);
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

test("a song says which rolls are enabled, and its button opens the rolls panel", async ({
  page,
}) => {
  await page.goto("/");
  await openSong(page, "cripple-creek");
  const line = page.getByTestId("rolls-line");
  await expect(line).toContainText("The rolls enabled for this song are Forward");
  await page.click('[data-action="change-rolls"]');
  await expect(page.locator('[data-panel="rolls"]')).toBeVisible();
  await page.click('[data-roll-preset="Forward only"]');
  await expect(line).toContainText("are Forward. To change");
  // Saved with the song: a reload keeps it, and another song is untouched.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("rolls-line")).toContainText("are Forward. To change");
  await openSong(page, "old-joe-clark");
  await expect(page.getByTestId("rolls-line")).toContainText("Forward, ");
});

test("the beginner / experienced switch changes the rolls and the generated tab (C6, guide §3.1)", async ({
  page,
}) => {
  await page.goto("/");
  await openSong(page, "old-joe-clark");
  // In this key the tab is generated (new shapes), so the hand it's written for matters.
  await page.evaluate(() => window.__banjoTest!.store.updatePractice({ keyShift: 7 }));
  const thumbOn2 = () =>
    page.evaluate(
      () =>
        window
          .__banjoTest!.player.tab()!
          .measures!.flatMap((m) => m.notes)
          .filter((n) => n.finger === "T" && n.string === 2).length,
    );
  const line = page.getByTestId("rolls-line");
  // A beginner by default: no Foggy Mountain roll, the thumb never on the 2nd string.
  await expect(line).not.toContainText("Foggy Mountain");
  expect(await thumbOn2()).toBe(0);
  await page.click('[data-action="settings"]');
  await page.locator('button[name="playerLevel"]', { hasText: "An experienced player" }).click();
  await page.click("text=Done");
  await expect(line).toContainText("Foggy Mountain");
  expect(await thumbOn2()).toBeGreaterThan(0);
  // Kept as a setting across a reload.
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForSelector("svg.tab");
  await expect(page.getByTestId("rolls-line")).toContainText("Foggy Mountain");
});

test("every measure of a song names its chord, in bold letters", async ({ page }) => {
  await page.goto("/");
  await openSong(page, "wildwood-flower");
  // The song writes a chord only where it changes; the notation names it in every measure.
  const written = await page.evaluate(() => {
    const abc = window.__banjoTest!.store.currentSong.value!.abc;
    const music = abc.split(/\r?\n/).filter((line) => !/^[A-Za-z]:/.test(line));
    return (music.join(" ").match(/"[^"]+"/g) ?? []).length;
  });
  const shown = await page.locator(".notation .abcjs-chord").count();
  expect(shown).toBeGreaterThanOrEqual(written);
  const weight = await page
    .locator(".notation .abcjs-chord")
    .first()
    .evaluate((e) => getComputedStyle(e).fontWeight);
  expect(Number(weight)).toBeGreaterThanOrEqual(600);
});

for (const song of ["cripple-creek", "wildwood-flower", "will-the-circle-be-unbroken"]) {
  test(`${song}: chord letters sit at one height above the staff on every line`, async ({
    page,
  }) => {
    await page.goto("/");
    await openSong(page, song);
    const gaps = await page.evaluate(() =>
      [...document.querySelectorAll(".notation")].flatMap((n) => {
        const staff = n.querySelector(".abcjs-staff");
        const chords = [...n.querySelectorAll(".abcjs-chord")];
        if (!staff || chords.length === 0) return [];
        const tops = chords.map((c) => Math.round(c.getBoundingClientRect().top));
        const staffTop = staff.getBoundingClientRect().top;
        // Within a line, every chord is level; across lines, the gap to the staff is the same.
        return [
          { level: Math.max(...tops) - Math.min(...tops), gap: staffTop - Math.min(...tops) },
        ];
      }),
    );
    expect(gaps.length).toBeGreaterThan(1);
    for (const g of gaps) expect(g.level).toBeLessThanOrEqual(1);
    const spread = Math.max(...gaps.map((g) => g.gap)) - Math.min(...gaps.map((g) => g.gap));
    expect(spread).toBeLessThanOrEqual(4); // the old uneven heights differed by 8 to 25 px
  });
}

for (const [name, label] of [
  ["a ^ annotation", '"^Chorus"'],
  ["a bare word", '"Chorus"'],
] as const) {
  test(`a section label (${name}) does not move the chords: one height on every line`, async ({
    page,
  }) => {
    const abc = (label: string) =>
      [
        "X:1",
        "T:Label test",
        "M:4/4",
        "L:1/8",
        "K:G",
        `${label}"G"GABc d2 B2|"C"cdef g2 e2|"G"dBGB d2 g2|"D"agfe d4|`,
        `"G"GABc d2 B2|"C"cdef g2 e2|"G"dBGB d2 g2|"D"f2 d2 A2 B2|`,
        `${label.replace("Chorus", "Verse")}"G"g2 g2 d2 B2|"C"e2 e2 c2 A2|"G"B2 G2 d4|"D"A2 F2 D4|`,
        `"G"gabg d2 B2|"C"e2 e2 c2 A2|"G"B2 G2 "D"A2 B2|"G"B2 G2 d4|]`,
        "",
      ].join("\n");
    await page.goto("/");
    await page.waitForSelector(".toolbar");
    await page.evaluate((text) => {
      const t = window.__banjoTest!;
      const base = t.store.songList.value.find((s) => s.id === "cripple-creek")!;
      const { tab: _tab, ...rest } = base as unknown as Record<string, unknown>;
      void _tab;
      t.store.songList.value = [
        ...t.store.songList.value,
        {
          ...rest,
          id: "label-test",
          title: "Label test",
          source: "user",
          abc: text,
          tags: [],
        } as never,
      ];
      t.store.openSong("label-test");
    }, abc(label));
    await page.waitForSelector("svg.tab");
    await page.waitForTimeout(500);
    const gaps = await page.evaluate(() =>
      [...document.querySelectorAll(".notation")].map((n) => {
        const staff = n.querySelector(".abcjs-staff")!.getBoundingClientRect().top;
        return [...n.querySelectorAll(".abcjs-chord")].map((c) =>
          Math.round(staff - c.getBoundingClientRect().top),
        );
      }),
    );
    expect(gaps.length).toBeGreaterThan(3);
    const all = gaps.flat();
    // Chords on one line are level, and every line's are at (nearly) the same height.
    for (const row of gaps) expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1);
    expect(Math.max(...all) - Math.min(...all)).toBeLessThanOrEqual(5);
    // The words are still shown, as part labels, not as chords.
    expect(await page.locator(".notation").first().textContent()).toContain("Chorus");
    expect(await page.locator(".abcjs-chord", { hasText: "Chorus" }).count()).toBe(0);
  });
}
