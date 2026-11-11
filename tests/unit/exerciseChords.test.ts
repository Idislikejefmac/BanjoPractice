// F45 · A chord chosen for a single measure of a roll exercise changes that measure and its roll.
import { describe, expect, it } from "vitest";
import {
  EXERCISE_CHORD_CHOICES,
  EXERCISE_MEASURES,
  exerciseChordAt,
  rollExercise,
  validChordOverrides,
} from "../../src/core/banjo/exercises.ts";
import { loadSong } from "../../src/core/song/song.ts";
import { DEFAULT_SETTINGS, readSettings, settingsProblems } from "../../src/app/model.ts";
import { AppStore } from "../../src/app/store.ts";
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
import type { Services } from "../../src/app/services.ts";
import type { KeyValueStore } from "../../src/platform/types.ts";

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
const settle = () => new Promise((r) => setTimeout(r, 0));

const chordsOf = (abc: string) => [...abc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const tabLines = (tab: string) => tab.split("\n").filter((l) => /^m\d+ /.test(l));

describe("rollExercise with a chord chosen for single measures", () => {
  it("changes only those measures, and arranges each one for its new chord", () => {
    const plain = rollExercise("forward")!;
    const song = rollExercise("forward", { "3": "Am", "8": "F" })!;
    const before = chordsOf(plain.abc);
    const after = chordsOf(song.abc);
    expect(before).toHaveLength(EXERCISE_MEASURES);
    const changed = after.map((c, i) => (c === before[i] ? "" : `${i}:${c}`)).filter(Boolean);
    expect(changed).toEqual(["3:Am", "8:F"]);
    const was = tabLines(plain.tab!);
    const now = tabLines(song.tab!);
    expect(now[3]!.split(" ")[1]).toBe("Am");
    expect(now[8]!.split(" ")[1]).toBe("F");
    // The roll is arranged again for the new chord: those measures' frets differ, others don't.
    expect(now[3]).not.toBe(was[3]);
    expect(now[4]).toBe(was[4]);
    const loaded = loadSong(song);
    expect(loaded.stale).toBe(false);
    expect(loaded.violations).toEqual([]);
  });

  it("every chord offered works in every measure of every roll (tab matches notation)", () => {
    for (const roll of ["forward", "backward", "alternating-thumb"]) {
      for (const { chord } of EXERCISE_CHORD_CHOICES) {
        const all = Object.fromEntries(
          Array.from({ length: EXERCISE_MEASURES - 2 }, (_, i) => [String(i + 2), chord]),
        );
        const loaded = loadSong(rollExercise(roll, all)!);
        expect(loaded.stale, `${roll} ${chord}`).toBe(false);
        expect(loaded.violations, `${roll} ${chord}`).toEqual([]);
      }
    }
  });

  it("leaves the open-strings measures alone and ignores choices that aren't on offer", () => {
    expect(validChordOverrides({ "0": "C" })).toBe(false);
    expect(validChordOverrides({ "3": "Cm" })).toBe(false);
    expect(validChordOverrides({ "99": "C" })).toBe(false);
    expect(validChordOverrides({ "3": "C", x: "G" })).toBe(false);
    expect(validChordOverrides({})).toBe(true);
    expect(rollExercise("forward", { "0": "C" })!.abc).toBe(rollExercise("forward")!.abc);
    expect(exerciseChordAt({}, 3)).toBe("C");
    expect(exerciseChordAt({}, 4)).toBe("D");
    expect(exerciseChordAt({ "3": "Em" }, 3)).toBe("Em");
  });
});

describe("saved exercise chords", () => {
  it("are part of the settings and repaired when damaged", () => {
    expect(settingsProblems(DEFAULT_SETTINGS)).toEqual([]);
    const read = (v: unknown) => readSettings({ ...DEFAULT_SETTINGS, exerciseChords: v });
    expect(read({ "3": "X" }).exerciseChords).toEqual({});
    expect(read(["G"]).exerciseChords).toEqual({});
    expect(read({ "3": "Am" }).exerciseChords).toEqual({ "3": "Am" });
  });

  it("change the open exercise, follow him to the next roll, and survive a restart", async () => {
    const storage = createMemoryStore();
    const songs = ["forward", "backward"].map((r) => rollExercise(r)!);
    const a = new AppStore(fakeServices(storage), songs, null);
    await a.load();
    a.openSong("exercise:forward");
    a.updateSettings({ exerciseChords: { "3": "Em", "5": "F" } });
    const expected = chordsOf(rollExercise("forward", { "3": "Em", "5": "F" })!.abc);
    expect(chordsOf(a.currentSong.value!.abc)).toEqual(expected);
    a.openSong("exercise:backward");
    expect(chordsOf(a.currentSong.value!.abc)).toEqual(expected);
    await settle();
    const b = new AppStore(fakeServices(storage), songs, null);
    await b.load();
    b.openSong("exercise:forward");
    expect(chordsOf(b.currentSong.value!.abc)).toEqual(expected);
  });
});
