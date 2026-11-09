import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexAbc, defaultRollUnit } from "../../src/core/song/abcIndex.ts";
import type { Song } from "../../src/core/song/song.ts";
import { checkConsistency, loadSong, repeatEdges } from "../../src/core/song/song.ts";
import { parseTab } from "../../src/core/tab/tabText.ts";

const HEADER = "X:1\nT:Test\nM:4/4\nL:1/8\nK:G\n";

function song(abc: string, tab?: string): Song {
  return {
    schemaVersion: 1,
    id: "t",
    title: "Test",
    source: "builtin",
    abc,
    tags: [],
    ...(tab !== undefined ? { tab } : {}),
  };
}

describe("C9 ABC measure index", () => {
  it("numbers measures from 1, or from 0 when there is a pickup", () => {
    expect(indexAbc(`${HEADER}"G"G8|"D"A8|]`).measures.map((m) => m.index)).toEqual([1, 2]);
    const withPickup = indexAbc(`${HEADER}D2|"G"G8|G6|]`);
    expect(withPickup.measures.map((m) => [m.index, m.slots])).toEqual([
      [0, 2],
      [1, 8],
      [2, 6],
    ]);
  });

  it("puts chords at the slot where they start", () => {
    const idx = indexAbc(`${HEADER}"C"G2 GA "G"B2 Bc|`);
    expect(idx.measures[0]!.chords).toEqual([
      { atSlot: 0, chord: "C" },
      { atSlot: 4, chord: "G" },
    ]);
  });

  it("works out MIDI pitches with the key signature and accidentals in the measure", () => {
    // K:D has F♯ and C♯. "=c" is C natural for the rest of the measure only.
    const idx = indexAbc(`X:1\nM:4/4\nL:1/8\nK:D\nF c =c c F2 G2|c8|]`);
    expect(idx.measures[0]!.melody.map((n) => n.midi)).toEqual([66, 73, 72, 72, 66, 67]);
    expect(idx.measures[1]!.melody.map((n) => n.midi)).toEqual([73]);
  });

  it("applies modes from K: (G Mixolydian has F natural)", () => {
    const idx = indexAbc(`X:1\nM:4/4\nL:1/8\nK:GMix\nf8|]`);
    expect(idx.measures[0]!.melody[0]!.midi).toBe(77);
    expect(idx.key.mode).toBe("mixolydian");
  });

  it("scales triplets so the measure still adds up", () => {
    const idx = indexAbc(`${HEADER}(3BcB A2 G4|`);
    const m = idx.measures[0]!;
    expect(m.slots).toBe(8);
    expect(m.melody.map((n) => n.slot)).toEqual([0, 0, 1, 2, 4]);
    expect(idx.errors).toEqual([]);
  });

  it("marks ties so a tied note isn't a new attack", () => {
    const idx = indexAbc(`${HEADER}G4 B4-|B8|]`);
    expect(idx.measures[1]!.melody[0]!.tiedFromPrevious).toBe(true);
    expect(idx.measures[0]!.melody[1]!.tiedFromPrevious).toBe(false);
  });

  it("records repeats and endings", () => {
    const idx = indexAbc(`${HEADER}|:G8|A8|[1B8:|[2c8|]`);
    const ms = idx.measures;
    expect(ms.map((m) => m.index)).toEqual([1, 2, 3, 4]);
    expect(ms[0]!.startRepeat).toBe(true);
    expect(ms[2]!.ending).toBe("1");
    expect(ms[2]!.endRepeat).toBe(true);
    expect(ms[3]!.ending).toBe("2");
    expect(repeatEdges(idx)).toEqual([
      { from: 2, to: 0 },
      { from: 1, to: 3 },
    ]);
  });

  it("uses 8 slots per measure in 2/4 with sixteenths", () => {
    expect(defaultRollUnit({ num: 2, den: 4 })).toBe(1 / 16);
    const idx = indexAbc(`X:1\nM:2/4\nL:1/16\nK:G\nGABc dcBA|G8|]`);
    expect(idx.measures.map((m) => m.slots)).toEqual([8, 8]);
  });

  it("reads tempo, meter and title from the header", () => {
    const idx = indexAbc(`X:1\nT:Name\nM:2/2\nL:1/8\nQ:1/4=120\nK:C\nC8|]`);
    expect(idx.title).toBe("Name");
    expect(idx.meter).toEqual({ num: 2, den: 2 });
    expect(idx.tempoBpm).toBe(120);
  });

  it("reports a measure that isn't a whole number of slots", () => {
    expect(indexAbc(`${HEADER}G7/2 A/2|`).errors).toEqual([]);
    // 1/2 + 4 + 2 + 1 = 7½ eighths: not a whole number of slots.
    expect(indexAbc(`${HEADER}G/2 A4 B2 c|`).errors.length).toBeGreaterThan(0);
  });
});

describe("C9 notation/tab consistency", () => {
  const abc = `${HEADER}"G"d2 dB "D"AG ED|`;
  const good = "m1 G D@5 x | 1:0M* 2:0I 1:0M* 2:0I* 3:2T* p3:0* 4:2T* 4:0I* |";

  it("accepts a tab whose melody notes sound the written notes an octave down", () => {
    const parsed = parseTab(good);
    expect(parsed.ok).toBe(true);
    expect(checkConsistency(indexAbc(abc), parsed.measures)).toEqual([]);
  });

  it("flags a wrong melody note, wrong chords and the wrong measure count", () => {
    const wrongNote = parseTab(good.replace("1:0M* 2:0I 1:0M*", "1:2M* 2:0I 1:0M*")).measures;
    expect(checkConsistency(indexAbc(abc), wrongNote).map((p) => p.message)).toEqual([
      "Measure 1, note 1: string 1 fret 2 doesn't sound the melody note",
    ]);
    const wrongChord = parseTab(good.replace("G D@5", "G D@4")).measures;
    expect(checkConsistency(indexAbc(abc), wrongChord)[0]!.message).toMatch(/chords differ/);
    const extra = parseTab(`${good}\nm2 G x | 3:0T 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |`).measures;
    expect(checkConsistency(indexAbc(abc), extra)[0]!.message).toMatch(/don't match/);
  });

  it("warns, rather than fails, when the melody is an octave away", () => {
    // Written E4 sounds E3 (4th string, fret 2); the 1st string, fret 2 is E4.
    const tab = parseTab("m1 G D@5 x | 1:0M* 2:0I 1:0M* 2:0I* 3:2T* p3:0* 2:0I 1:2M* |");
    const problems = checkConsistency(indexAbc(abc), tab.measures);
    expect(problems.map((p) => p.severity)).toEqual(["error"]); // slot 8 is D, not E
    const octave = parseTab("m1 G D@5 x | 1:0M* 2:0I 1:0M* 2:0I* 3:2T* p3:0* 2:0I 2:3M* |");
    expect(checkConsistency(indexAbc(abc), octave.measures).map((p) => p.severity)).toEqual([
      "warning",
    ]);
  });

  it("marks the arrangement stale when the tab can't be read or doesn't match", () => {
    expect(loadSong(song(abc, "m1 G x | 9:0T |")).stale).toBe(true);
    expect(loadSong(song(abc, good)).stale).toBe(false);
    expect(loadSong(song(abc)).arrangement).toBeNull();
  });
});

describe("built-in songs (F5)", () => {
  const dir = new URL("../../songs/", import.meta.url);
  const ids = readdirSync(dir)
    .filter((f) => f.endsWith(".abc"))
    .map((f) => f.replace(/\.abc$/, ""));

  it("has the four phase-1 songs", () => {
    expect(ids.sort()).toEqual([
      "cripple-creek",
      "old-joe-clark",
      "wildwood-flower",
      "will-the-circle-be-unbroken",
    ]);
  });

  for (const id of ids) {
    it(`${id}: notation and tab agree, and the tab passes every hard rule (C4)`, () => {
      const abc = readFileSync(new URL(`${id}.abc`, dir), "utf8");
      const tabUrl = new URL(`${id}.tab`, dir);
      expect(existsSync(tabUrl)).toBe(true);
      const loaded = loadSong(song(abc, readFileSync(tabUrl, "utf8")));
      expect(loaded.problems.filter((p) => p.severity === "error")).toEqual([]);
      expect(loaded.violations.filter((v) => v.severity === "error")).toEqual([]);
      expect(loaded.stale).toBe(false);
      expect(loaded.index.measures.length).toBeGreaterThanOrEqual(8);
    });
  }
});
