// T2 UI monkey harness (CHAOS_TESTING.md §3–§4): seeded actions, invariants after every step,
// checkpoints, and a saved repro on failure.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { STORE_VALIDATORS } from "../../src/app/model.ts";

/** mulberry32, the same PRNG as the chaos controller. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MonkeyContext {
  readonly page: Page;
  readonly random: () => number;
  readonly hooks: boolean;
  pick<T>(items: readonly T[]): T;
  /** Errors seen since the last check (I1). */
  readonly errors: string[];
}

export interface Action {
  readonly name: string;
  readonly weight: number;
  readonly hostile?: boolean;
  /** Returns a short description for the trace, or null if not possible right now. */
  run(ctx: MonkeyContext): Promise<string | null>;
}

export class InvariantFailure extends Error {
  readonly invariant: string;
  constructor(invariant: string, message: string) {
    super(`${invariant}: ${message}`);
    this.invariant = invariant;
  }
}

export function watchErrors(page: Page, errors: string[]): void {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
}

/** Long tasks (> 200 ms) since the last call; Chromium only (I2). */
export async function installLongTaskObserver(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: number[] };
    w.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__longTasks.push(e.duration);
      }).observe({ type: "longtask", buffered: true });
    } catch {
      // WebKit has no Long Tasks API.
    }
  });
}

export async function checkInvariants(ctx: MonkeyContext, maxTaskMs: number): Promise<void> {
  const { page } = ctx;
  // I1: no uncaught errors.
  if (ctx.errors.length > 0) throw new InvariantFailure("I1", ctx.errors.join("\n"));

  const state = await page.evaluate(() => {
    const root = document.getElementById("app");
    const toolbar = document.querySelector(".toolbar")?.getBoundingClientRect();
    const settings = document.querySelector('[data-action="settings"]')?.getBoundingClientRect();
    const w = window as unknown as { __longTasks?: number[] };
    const tasks = w.__longTasks?.splice(0) ?? [];
    return {
      rootChildren: root?.children.length ?? 0,
      rootText: (root?.textContent ?? "").trim().length,
      crashed: document.querySelector(".crash") !== null,
      toolbarTop: toolbar ? toolbar.top : null,
      toolbarHeight: toolbar ? toolbar.height : 0,
      settingsVisible:
        !!settings &&
        settings.top >= 0 &&
        settings.bottom <= window.innerHeight &&
        settings.left >= 0 &&
        settings.right <= window.innerWidth + 1,
      longest: tasks.length ? Math.max(...tasks) : 0,
    };
  });
  // I12: never a blank screen; an error screen is a failure too.
  if (state.rootChildren === 0 || state.rootText === 0)
    throw new InvariantFailure("I12", "blank screen");
  if (state.crashed) throw new InvariantFailure("I12", "error screen shown");
  // I3: toolbar reachable.
  if (state.toolbarTop === null || Math.abs(state.toolbarTop) > 1) {
    throw new InvariantFailure("I3", `toolbar not at the top (top=${state.toolbarTop})`);
  }
  if (!state.settingsVisible) throw new InvariantFailure("I3", "toolbar button off screen");
  if (ctx.hooks) await checkAudioInvariants(ctx);
  // I2: main thread never blocked > maxTaskMs (Chromium measures; WebKit reports 0).
  if (state.longest > maxTaskMs) {
    throw new InvariantFailure("I2", `main thread blocked for ${Math.round(state.longest)} ms`);
  }
}

/** What the UI shows right now, for I16 comparisons. */
export async function uiSnapshot(page: Page) {
  return page.evaluate(() => {
    const toolbar = document.querySelector(".toolbar")?.getBoundingClientRect().height ?? 0;
    const lines = [...document.querySelectorAll<HTMLElement>(".song-line")];
    const top = lines.find((l) => l.getBoundingClientRect().bottom > toolbar + 4);
    return {
      title: document.querySelector(".toolbar-title")?.textContent ?? "",
      tabOnly: document.querySelector('[data-action="toggle-view"]')?.getAttribute("aria-pressed"),
      // The line at the top of the screen (at the very top of the song, the first line).
      topLine: Number(top?.dataset.firstMeasure ?? 0),
      topLineLast: Number(top?.dataset.lastMeasure ?? 0),
      favorites: [...document.querySelectorAll('[data-favorite][aria-pressed="true"]')]
        .map((b) => b.getAttribute("data-favorite"))
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(),
    };
  });
}

/** Waits until no save is pending (faults must be disarmed first). */
export async function waitForSaves(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__banjoTest?.savesPending() === false, null, {
    timeout: 15_000,
  });
}

/** I6 + I7 checkpoint: storage matches what the UI shows, and every record is valid. */
export async function checkpoint(page: Page): Promise<void> {
  await page.evaluate(() => window.__banjoChaos?.disarmAll());
  await waitForSaves(page);
  const { dump, settings, songId, favorites } = await page.evaluate(async () => {
    const t = window.__banjoTest!;
    return {
      dump: await t.dumpStorage(),
      settings: t.store.settings.value,
      songId: t.store.session.value.songId,
      favorites: [...t.store.prefs.value.values()]
        .filter((p) => p.favorite)
        .map((p) => p.songId)
        .sort(),
    };
  });
  // I7: every record parses at the current schema.
  for (const [store, records] of Object.entries(dump)) {
    const validate = STORE_VALIDATORS[store];
    if (!validate) {
      if (Object.keys(records).length > 0 && !["diagnostics", "meta"].includes(store)) {
        throw new InvariantFailure("I7", `unexpected records in ${store}`);
      }
      continue;
    }
    for (const [key, value] of Object.entries(records)) {
      const problems = validate(value);
      if (problems.length)
        throw new InvariantFailure("I7", `${store}/${key}: ${problems.join(", ")}`);
    }
  }
  // I6: no data loss. What the app shows as saved is what storage holds.
  const storedFavorites = Object.values(dump.songPrefs ?? {})
    .filter((p) => (p as { favorite: boolean }).favorite)
    .map((p) => (p as { songId: string }).songId)
    .sort();
  if (JSON.stringify(storedFavorites) !== JSON.stringify(favorites)) {
    throw new InvariantFailure("I6", `favorites: shown ${favorites}, stored ${storedFavorites}`);
  }
  if (JSON.stringify(dump.settings?.settings) !== JSON.stringify(settings)) {
    // Settings never changed yet is fine: nothing stored, defaults shown.
    if (dump.settings?.settings !== undefined) {
      throw new InvariantFailure("I6", "settings in storage differ from the settings shown");
    }
  }
  const stored = dump.session?.session as { songId: string | null } | undefined;
  if (stored && stored.songId !== songId) {
    throw new InvariantFailure("I6", `session song: shown ${songId}, stored ${stored.songId}`);
  }
}

export function saveArtifacts(name: string, data: Record<string, unknown>): string {
  const dir = new URL(`./artifacts/${name}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  for (const [file, value] of Object.entries(data)) {
    writeFileSync(
      new URL(file, dir),
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
  }
  return dir.pathname;
}

/** Phase-2 audio invariants (CHAOS_TESTING.md I4, I5, I11, I13), via the test hooks. */
export async function checkAudioInvariants(ctx: MonkeyContext): Promise<void> {
  const { page } = ctx;
  const read = () =>
    page.evaluate(() => {
      const t = window.__banjoTest;
      if (!t) return null;
      return {
        audio: t.audio(),
        uiStopped:
          document.querySelector('[data-action="play"]')?.getAttribute("aria-label") !== "Stop",
        highlights: [...document.querySelectorAll(".measure-highlight")].map((h) =>
          Number(h.getAttribute("data-measure")),
        ),
        follow: t.player.follow.value.measure,
        // Paused or moved by measures: the place Play carries on from stays highlighted.
        paused: t.player.resumeAt.value !== null,
      };
    });
  let s = await read();
  if (!s) return;
  // I13: never more than one live audio context.
  if (s.audio.contexts > 1) throw new InvariantFailure("I13", `${s.audio.contexts} live contexts`);
  // I5: at most one measure highlighted, and it's the one the player is following.
  const distinct = [...new Set(s.highlights)];
  if (distinct.length > 1) throw new InvariantFailure("I5", `highlighted ${distinct.join(", ")}`);
  if (distinct.length === 1 && s.follow !== null && distinct[0] !== s.follow) {
    // The DOM can trail the player by a frame; recheck once.
    await page.waitForTimeout(50);
    s = (await read())!;
    const again = [...new Set(s.highlights)];
    if (again.length === 1 && s.follow !== null && again[0] !== s.follow) {
      throw new InvariantFailure("I5", `highlight ${again[0]} but playing ${s.follow}`);
    }
  }
  // I4 + I11: when the UI says stopped, sound stops within 500 ms and sources are released.
  if (s.uiStopped && s.audio.sources > 0) {
    await page.waitForTimeout(600);
    const after = (await read())!;
    if (after.uiStopped && after.audio.sources > 0) {
      throw new InvariantFailure("I4", `${after.audio.sources} sources still live after Stop`);
    }
    if (after.uiStopped && !after.paused && after.highlights.length > 0) {
      throw new InvariantFailure("I5", "a measure is highlighted while stopped");
    }
  }
}
