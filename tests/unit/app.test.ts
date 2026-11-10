import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SESSION,
  DEFAULT_SETTINGS,
  readSession,
  readSettings,
  recentSongIds,
  sessionProblems,
  settingsProblems,
  songPrefsProblems,
} from "../../src/app/model.ts";
import { AppStore } from "../../src/app/store.ts";
import type { Services } from "../../src/app/services.ts";
import { createDiagnostics } from "../../src/platform/diagnostics.ts";
import {
  createFakeAudio,
  createFakeClock,
  createFakeInput,
  createFakeMic,
  createFakeOffline,
  createFakeSamples,
  createFakeShare,
  createFakeWakeLock,
  createMemoryStore,
} from "../../src/platform/fakes.ts";
import type { KeyValueStore } from "../../src/platform/types.ts";
import { builtinSong } from "../../src/core/song/song.ts";

describe("persisted records (I7)", () => {
  it("accepts the defaults", () => {
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
    expect(sessionProblems(DEFAULT_SESSION)).toEqual([]);
  });

  it("repairs damaged settings field by field instead of dropping them all", () => {
    const s = readSettings({ ...DEFAULT_SETTINGS, size: 99, showRollNames: false, spikes: [3] });
    expect(s.size).toBe(DEFAULT_SETTINGS.size);
    expect(s.showRollNames).toBe(false);
    expect(s.spikes).toEqual([]);
    expect(settingsProblems(s)).toEqual([]);
    expect(readSettings("garbage")).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects a malformed session or song preference", () => {
    expect(readSession({ ...DEFAULT_SESSION, topMeasure: -1 })).toBeNull();
    expect(readSession(null)).toBeNull();
    expect(songPrefsProblems({ schemaVersion: 1, songId: "", favorite: true })).toContain("songId");
  });

  it("lists recently played songs newest first, at most 5", () => {
    const prefs = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({
      schemaVersion: 1,
      songId: id,
      favorite: false,
      lastOpenedAt: new Date(2026, 0, i + 1).toISOString(),
    }));
    expect(recentSongIds([...prefs, { schemaVersion: 1, songId: "x", favorite: true }])).toEqual([
      "f",
      "e",
      "d",
      "c",
      "b",
    ]);
  });
});

function fakeServices(storage: KeyValueStore): Services {
  return {
    storage,
    storageMode: "ok",
    offline: createFakeOffline(),
    wakeLock: createFakeWakeLock(),
    input: createFakeInput(),
    clock: createFakeClock(),
    share: createFakeShare(),
    audio: createFakeAudio(),
    samples: createFakeSamples(),
    mic: createFakeMic(),
    diagnostics: createDiagnostics("test", null),
  };
}

const SONGS = [
  builtinSong("a-song", "X:1\nT:A Song\nM:4/4\nL:1/8\nK:G\nG8|]"),
  builtinSong("b-song", "X:1\nT:B Song\nM:4/4\nL:1/8\nK:G\nG8|]"),
];

function memoryLocal() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("app store", () => {
  it("saves favorites, settings and the session, and loads them back", async () => {
    const storage = createMemoryStore();
    const local = memoryLocal();
    const a = new AppStore(fakeServices(storage), SONGS, local);
    await a.load();
    a.toggleFavorite("b-song");
    a.openSong("a-song");
    a.updateSettings({ size: 3, showRollNames: false });
    a.setTopMeasure(5);
    a.flushSession();
    await settle();

    const b = new AppStore(fakeServices(storage), SONGS, memoryLocal());
    await b.load();
    expect(b.favorites.value.map((s) => s.id)).toEqual(["b-song"]);
    expect(b.currentSong.value?.id).toBe("a-song");
    expect(b.session.value.topMeasure).toBe(5);
    expect(b.settings.value.size).toBe(3);
    expect(b.recent.value.map((s) => s.id)).toEqual(["a-song"]);
  });

  it("restores the session from the localStorage mirror before the debounced write lands", async () => {
    const storage = createMemoryStore();
    const local = memoryLocal();
    const a = new AppStore(fakeServices(storage), SONGS, local);
    await a.load();
    a.openSong("b-song");
    a.setTopMeasure(3);
    // No flush: simulate iPadOS killing the page inside the 500 ms debounce.
    const b = new AppStore(fakeServices(storage), SONGS, local);
    await b.load();
    expect(b.session.value.songId).toBe("b-song");
    expect(b.session.value.topMeasure).toBe(3);
  });

  // Regression (chaos seed 7, I6): a session recovered from the mirror was shown but never
  // written to storage, so storage kept an older song until the next change.
  it("writes a session recovered from the mirror back to storage", async () => {
    const storage = createMemoryStore();
    const local = memoryLocal();
    const a = new AppStore(fakeServices(storage), SONGS, local);
    await a.load();
    const stored = async () =>
      (await storage.get("session", "session")) as { songId: string; topMeasure: number };
    a.openSong("a-song");
    a.flushSession();
    // Writes land a moment later: wait for it, or a late a-song write could land after b's.
    await vi.waitFor(async () => expect((await stored())?.songId).toBe("a-song"));
    a.openSong("b-song");
    a.setTopMeasure(4);
    // Killed inside the debounce: storage still has a-song, the mirror has b-song.
    const b = new AppStore(fakeServices(storage), SONGS, local);
    await b.load();
    expect(b.session.value.songId).toBe("b-song");
    await vi.waitFor(async () => expect((await stored()).songId).toBe("b-song"));
    expect((await stored()).topMeasure).toBe(4);
  });

  // Regression (found as a flaky test): with the same timestamp in storage and in the mirror
  // the older stored session won. The mirror is written on every change, so it wins a tie.
  it("prefers the localStorage mirror when its timestamp ties the stored session's", async () => {
    const storage = createMemoryStore();
    const local = memoryLocal();
    const at = "2026-11-10T00:00:00.000Z";
    const session = (songId: string) => ({ ...DEFAULT_SESSION, songId, savedAt: at });
    await storage.put("session", "session", session("a-song"));
    local.setItem("banjo.session", JSON.stringify(session("b-song")));
    const store = new AppStore(fakeServices(storage), SONGS, local);
    await store.load();
    expect(store.session.value.songId).toBe("b-song");
  });

  it("never fails a save silently: it shows a notice and retries (I6)", async () => {
    const storage = createMemoryStore();
    let failNext = 1;
    const flaky: KeyValueStore = {
      ...storage,
      async put(s, k, v) {
        if (failNext-- > 0) throw new DOMException("full", "QuotaExceededError");
        return storage.put(s, k, v);
      },
    };
    const a = new AppStore(fakeServices(flaky), SONGS, null);
    await a.load();
    a.toggleFavorite("a-song");
    await settle();
    expect(a.notices.value.map((n) => n.text).join()).toMatch(/storage is full/);
    expect(a.savesPending).toBe(true);
    await new Promise((r) => setTimeout(r, 3100));
    expect(a.savesPending).toBe(false);
    expect(a.notices.value).toEqual([]);
    expect(await storage.get("songPrefs", "a-song")).toMatchObject({ favorite: true });
  });

  // Regression: chaos seed 2 (WebKit). A slow save landed after a newer one and brought back
  // the old value after a reload.
  it("never lets a slow save overwrite a newer one (last write wins)", async () => {
    const storage = createMemoryStore();
    let call = 0;
    const slowFirst: KeyValueStore = {
      ...storage,
      async put(s, k, v) {
        if (call++ === 0) await new Promise((r) => setTimeout(r, 50));
        return storage.put(s, k, v);
      },
    };
    const a = new AppStore(fakeServices(slowFirst), SONGS, null);
    await a.load();
    a.toggleFavorite("a-song"); // favorite: slow to save
    a.toggleFavorite("a-song"); // not favorite: newer
    await new Promise((r) => setTimeout(r, 120));
    expect(a.savesPending).toBe(false);
    expect(a.prefs.value.get("a-song")?.favorite).toBe(false);
    expect(await storage.get("songPrefs", "a-song")).toMatchObject({ favorite: false });
  });

  // Regression: chaos seed 2 (Chromium). A star tapped just before a hard reload was lost.
  it("keeps a change made just before the app was killed mid-save", async () => {
    const storage = createMemoryStore();
    const local = memoryLocal();
    const hanging: KeyValueStore = { ...storage, put: () => new Promise(() => {}) };
    const a = new AppStore(fakeServices(hanging), SONGS, local);
    await a.load();
    a.toggleFavorite("b-song");
    a.updateSettings({ showAccents: true });
    // The page dies here. A fresh start with working storage must still have both.
    const b = new AppStore(fakeServices(storage), SONGS, local);
    await b.load();
    expect(b.favorites.value.map((s) => s.id)).toEqual(["b-song"]);
    expect(b.settings.value.showAccents).toBe(true);
    await settle();
    expect(await storage.get("songPrefs", "b-song")).toMatchObject({ favorite: true });
    expect(b.savesPending).toBe(false);
  });

  it("ignores a saved session for a song that no longer exists", async () => {
    const storage = createMemoryStore();
    await storage.put("session", "session", { ...DEFAULT_SESSION, songId: "gone" });
    const a = new AppStore(fakeServices(storage), SONGS, null);
    await a.load();
    expect(a.currentSong.value).toBeNull();
  });
});
