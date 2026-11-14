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

  it("D7 plays the flat seventh where D plays the root, in every roll", () => {
    for (const roll of ["forward", "backward", "alternating-thumb"]) {
      const plain = tabLines(rollExercise(roll)!.tab!)[4]!;
      const seven = tabLines(rollExercise(roll, { "4": "D7" })!.tab!)[4]!;
      expect(plain, roll).toContain("2:3I"); // D on the 2nd string, 3rd fret
      expect(seven, roll).toContain("2:1I"); // C on the 2nd string, 1st fret
      expect(seven, roll).not.toContain("2:3I");
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

describe("the roll lesson song (F36)", () => {
  it("is two measures of one chord, the roll on both, at a slow tempo", async () => {
    const { rollLesson, LESSON_START_BPM } = await import("../../src/core/banjo/exercises.ts");
    const { indexAbc } = await import("../../src/core/song/abcIndex.ts");
    for (const chord of ["G", "C", "D7", "Em", "B7"]) {
      const song = rollLesson("forward", chord)!;
      const idx = indexAbc(song.abc);
      expect(idx.measures).toHaveLength(2);
      expect(idx.tempoBpm).toBe(LESSON_START_BPM);
      expect(song.id).toBe("lesson:forward");
      expect(song.tags).toEqual(["lesson"]);
      expect(song.tab).toBeTruthy();
      for (const m of idx.measures) expect(m.chords[0]?.chord).toBe(chord);
    }
  });

  it("falls back to G for a chord that isn't on offer, and knows no unknown roll", async () => {
    const { rollLesson } = await import("../../src/core/banjo/exercises.ts");
    expect(rollLesson("forward", "C#m9")?.abc).toContain('"G"');
    expect(rollLesson("no-such-roll")).toBeNull();
  });

  it("maps both song ids to the roll", async () => {
    const { rollIdOfSong } = await import("../../src/core/banjo/exercises.ts");
    expect(rollIdOfSong("exercise:forward")).toBe("forward");
    expect(rollIdOfSong("lesson:forward")).toBe("forward");
    expect(rollIdOfSong("cripple-creek")).toBeNull();
    expect(rollIdOfSong(null)).toBeNull();
  });
});

describe("saved chord patterns (F46)", () => {
  const songs = ["forward", "backward"].map((r) => rollExercise(r)!);

  it("are part of the settings, and a damaged list is repaired field by field", () => {
    const good = { id: "a", name: "D7 version", chords: { "5": "D7" } };
    const read = (v: unknown) => readSettings({ ...DEFAULT_SETTINGS, chordPatterns: v });
    expect(read([good]).chordPatterns).toEqual([good]);
    expect(read([good, good]).chordPatterns).toEqual([]); // a repeated id
    expect(read("x").chordPatterns).toEqual([]);
    expect(read([{ ...good, chords: { "5": "H#" } }]).chordPatterns).toEqual([]);
    // Settings saved before patterns existed have none, and everything else is kept.
    const { chordPatterns: _p, activeChordPattern: _a, ...old } = DEFAULT_SETTINGS;
    void _p;
    void _a;
    const upgraded = readSettings({ ...old, size: 3 });
    expect(upgraded.chordPatterns).toEqual([]);
    expect(upgraded.activeChordPattern).toBeNull();
    expect(upgraded.size).toBe(3);
  });

  it("save, load, update, rename and delete; each is saved and survives a restart", async () => {
    const storage = createMemoryStore();
    const a = new AppStore(fakeServices(storage), songs, null);
    await a.load();
    a.updateSettings({ exerciseChords: { "3": "Em", "5": "D7" } });
    expect(a.saveChordPattern("D7 version")).toBeNull();
    const [saved] = a.settings.value.chordPatterns;
    expect(saved).toMatchObject({ name: "D7 version", chords: { "3": "Em", "5": "D7" } });
    expect(a.settings.value.activeChordPattern).toBe(saved!.id);

    // A second pattern; the first is untouched by working on the second.
    a.updateSettings({ exerciseChords: { "4": "G7" } });
    expect(a.saveChordPattern("d7 VERSION")).toMatch(/already a pattern/); // refused, nothing changes
    expect(a.saveChordPattern("Plain G7")).toBeNull();
    expect(a.settings.value.chordPatterns).toHaveLength(2);

    a.loadChordPattern(saved!.id);
    expect(a.settings.value.exerciseChords).toEqual({ "3": "Em", "5": "D7" });
    a.updateSettings({ exerciseChords: { "3": "Am" } });
    a.updateChordPattern();
    expect(a.settings.value.chordPatterns[0]!.chords).toEqual({ "3": "Am" });
    expect(a.renameChordPattern(saved!.id, "Minor start")).toBeNull();
    expect(a.renameChordPattern(saved!.id, "plain g7")).toMatch(/already a pattern/);
    await settle();

    const b = new AppStore(fakeServices(storage), songs, null);
    await b.load();
    expect(b.settings.value.chordPatterns.map((p) => p.name)).toEqual(["Minor start", "Plain G7"]);
    expect(b.settings.value.activeChordPattern).toBe(saved!.id);
    expect(b.settings.value.exerciseChords).toEqual({ "3": "Am" });

    // Standard chords, then delete: the chords stay, the pattern and its "in use" mark go.
    b.loadChordPattern(null);
    expect(b.settings.value.exerciseChords).toEqual({});
    expect(b.settings.value.activeChordPattern).toBeNull();
    b.loadChordPattern(saved!.id);
    b.deleteChordPattern(saved!.id);
    expect(b.settings.value.chordPatterns.map((p) => p.name)).toEqual(["Plain G7"]);
    expect(b.settings.value.activeChordPattern).toBeNull();
    expect(b.settings.value.exerciseChords).toEqual({ "3": "Am" });
    b.loadChordPattern("no-such-pattern"); // does nothing
    expect(b.settings.value.exerciseChords).toEqual({ "3": "Am" });
  });

  it("the open exercise follows a loaded pattern", async () => {
    const a = new AppStore(fakeServices(createMemoryStore()), songs, null);
    await a.load();
    a.openSong("exercise:forward");
    a.updateSettings({ exerciseChords: { "5": "D7" } });
    a.saveChordPattern("D7 version");
    a.loadChordPattern(null);
    expect(chordsOf(a.currentSong.value!.abc)).toEqual(chordsOf(rollExercise("forward")!.abc));
    a.loadChordPattern(a.settings.value.chordPatterns[0]!.id);
    expect(chordsOf(a.currentSong.value!.abc)).toEqual(
      chordsOf(rollExercise("forward", { "5": "D7" })!.abc),
    );
  });
});
