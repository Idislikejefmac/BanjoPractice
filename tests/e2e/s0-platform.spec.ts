// Spike S0 (DEVELOPMENT.md §9): which platform features work in each Playwright engine?
// Results decide which chaos tiers can run on WebKit (CHAOS_TESTING.md §9).
// Run with: npm run spike:s0. Failures here are findings, not bugs.
import { expect, test } from "@playwright/test";

test.describe("@spike S0 platform capabilities", () => {
  test("Web Audio: context starts, time advances, output is measurable", async ({
    page,
    browserName,
  }) => {
    await page.goto("/");
    await page.locator("body").click(); // a user gesture, in case the engine needs one
    const result = await page.evaluate(async () => {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return { exists: false } as const;
      const ctx = new Ctx();
      await ctx.resume().catch(() => undefined);
      const osc = ctx.createOscillator();
      const analyser = ctx.createAnalyser();
      osc.connect(analyser);
      analyser.connect(ctx.destination);
      const t0 = ctx.currentTime;
      osc.start();
      await new Promise((r) => setTimeout(r, 400));
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      const rms = Math.sqrt(data.reduce((s, x) => s + x * x, 0) / data.length);
      const t1 = ctx.currentTime;
      osc.stop();
      await ctx.close();
      return {
        exists: true,
        state: ctx.state,
        advanced: t1 - t0,
        rms,
        sampleRate: ctx.sampleRate,
      } as const;
    });
    console.log(`[S0] ${browserName} Web Audio:`, JSON.stringify(result));
    expect(result.exists).toBe(true);
    if (result.exists) {
      expect(result.advanced).toBeGreaterThan(0.1);
      expect(result.rms).toBeGreaterThan(0);
    }
  });

  test("OfflineAudioContext renders", async ({ page, browserName }) => {
    await page.goto("/");
    const rms = await page.evaluate(async () => {
      const ctx = new OfflineAudioContext(1, 4410, 44100);
      const osc = ctx.createOscillator();
      osc.connect(ctx.destination);
      osc.start();
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      return Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length);
    });
    console.log(`[S0] ${browserName} OfflineAudioContext rms:`, rms);
    expect(rms).toBeGreaterThan(0);
  });

  test("Service worker registers and the app reloads offline", async ({
    page,
    context,
    browserName,
  }) => {
    await page.goto("/");
    const registered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
      ]);
      return reg !== null;
    });
    console.log(`[S0] ${browserName} service worker ready:`, registered);
    expect(registered).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Banjo Practice" })).toBeVisible();
    await context.setOffline(false);
  });

  test("IndexedDB opens", async ({ page, browserName }) => {
    await page.goto("/");
    const ok = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const req = indexedDB.open("s0-probe", 1);
          req.onsuccess = () => {
            req.result.close();
            resolve(true);
          };
          req.onerror = () => resolve(false);
        }),
    );
    console.log(`[S0] ${browserName} IndexedDB:`, ok);
    expect(ok).toBe(true);
  });
});
