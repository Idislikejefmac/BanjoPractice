// T3 · Storage fault scenarios (CHAOS_TESTING.md §6.1) and lifecycle faults (§6.5), scripted.
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { checkpoint, waitForSaves, watchErrors } from "./harness.ts";

const DB = "banjo@/";

async function start(page: Page, errors: string[]) {
  watchErrors(page, errors);
  await page.goto("/");
  await page.waitForSelector(".toolbar");
}

test("QuotaExceeded on save: visible failure, kept and retried, nothing lost (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.evaluate(() =>
    window.__banjoChaos!.arm({ service: "storage", op: "put", kind: "QuotaExceededError" }),
  );
  await page.click('[data-favorite="cripple-creek"]');
  await expect(page.locator(".notices")).toContainText("storage is full");
  // The star still shows: the change is kept in memory.
  await expect(page.locator('[data-favorite="cripple-creek"]').first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.evaluate(() => window.__banjoChaos!.disarmAll());
  await waitForSaves(page);
  await expect(page.locator(".notices")).toHaveCount(0);
  await checkpoint(page);
  expect(errors).toEqual([]);
});

test("IndexedDB unavailable at startup: built-in songs and a banner, no crash (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  });
  await start(page, errors);
  await expect(page.locator(".notices")).toContainText("Saving isn't available");
  await page.click('[data-song="cripple-creek"][data-section="builtin"]');
  await page.waitForSelector("svg.tab");
  expect(errors).toEqual([]);
});

test("IndexedDB open hangs: the app still shows something at once, then runs read-only (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.addInitScript(() => {
    const realOpen = indexedDB.open.bind(indexedDB);
    // Requests for the app's database never complete.
    indexedDB.open = ((name: string, version?: number) =>
      name.startsWith("banjo@")
        ? ({} as IDBOpenDBRequest)
        : realOpen(name, version)) as typeof indexedDB.open;
  });
  watchErrors(page, errors);
  await page.goto("/");
  // I12: never blank, even while storage is still trying to open.
  await expect(page.locator("#app")).not.toBeEmpty({ timeout: 1000 });
  await expect(page.locator(".notices")).toContainText("Saving isn't available", {
    timeout: 15_000,
  });
  await page.click('[data-song="old-joe-clark"][data-section="builtin"]');
  await page.waitForSelector("svg.tab");
  expect(errors).toEqual([]);
});

test("Database newer than this build: never modified, read-only with a message (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await page.goto("/");
  await page.waitForSelector(".toolbar");
  // Simulate a rollback: the database was upgraded by a newer app version.
  await page.evaluate(async (name) => {
    for (const db of await indexedDB.databases())
      if (db.name === name) indexedDB.deleteDatabase(name);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 99);
      req.onupgradeneeded = () => req.result.createObjectStore("future");
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => resolve();
    });
  }, DB);
  watchErrors(page, errors);
  await page.reload();
  await expect(page.locator(".notices")).toContainText("newer version");
  await page.click('[data-favorite="wildwood-flower"]');
  const version = await page.evaluate(async (name) => {
    const dbs = await indexedDB.databases();
    return dbs.find((d) => d.name === name)?.version;
  }, DB);
  expect(version).toBe(99);
  expect(errors).toEqual([]);
});

test("Corrupt records are ignored, the rest still loads (6.1)", async ({ page }) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.click('[data-favorite="old-joe-clark"]');
  await waitForSaves(page);
  await page.evaluate(async () => {
    const s = window.__banjoTest!.services.storage;
    await s.put("songPrefs", "broken", { favorite: "yes" });
    await s.put("settings", "settings", { size: "huge", showRollNames: false });
    await s.put("session", "session", "not a session");
  });
  await page.reload();
  await page.waitForSelector(".toolbar");
  await expect(page.locator('[data-song="old-joe-clark"][data-section="favorites"]')).toBeVisible();
  const settings = await page.evaluate(() => window.__banjoTest!.store.settings.value);
  expect(settings.showRollNames).toBe(false); // the valid field survives
  expect(settings.size).toBe(1);
  expect(errors).toEqual([]);
});

test("Slow storage (500 ms per op): the UI keeps up and every change lands (6.1)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  await page.evaluate(() =>
    window.__banjoChaos!.arm({ service: "storage", op: "*", kind: "slow", delayMs: 500 }),
  );
  const t0 = Date.now();
  for (let i = 0; i < 12; i++) {
    await page.click(`[data-favorite="${i % 2 ? "cripple-creek" : "old-joe-clark"}"]`);
  }
  await page.click('[data-action="bigger"]');
  expect(Date.now() - t0).toBeLessThan(5000);
  await page.evaluate(() => window.__banjoChaos!.disarmAll());
  await checkpoint(page);
  expect(errors).toEqual([]);
});

test("Staging and production keep separate databases (6.1)", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".toolbar");
  const names = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(names).toContain(DB);
  expect(names.some((n) => n?.includes("staging"))).toBe(false);
});

test("Reload mid-save leaves either the old or the new record, never a broken one (6.5)", async ({
  page,
}) => {
  const errors: string[] = [];
  await start(page, errors);
  for (let i = 0; i < 8; i++) {
    await page.click('[data-favorite="will-the-circle-be-unbroken"]');
    await page.click('[data-action="bigger"]').catch(() => {});
    await page.reload();
    await page.waitForSelector(".toolbar");
  }
  await checkpoint(page);
  expect(errors).toEqual([]);
});
