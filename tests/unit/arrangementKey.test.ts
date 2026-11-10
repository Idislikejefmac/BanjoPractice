// The generated banjo part must sound right in the song's key (C6, C8, F14): shapes and capo
// come from C8's table for the sounding key, never from the key the song happens to be printed
// in, and the open 5th string is only used where it fits the key and the chord.
//
// Regression: a song printed in B major (chords B, F♯, C♯m, E) and with no hand-written tab was
// arranged as "B shapes, no capo", so the thumb's open 5th string (g) sounded G natural against
// the key's G♯ in most measures.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrange, droneClashes } from "../../src/core/banjo/arranger.ts";
import { OPEN_G, pitchAt } from "../../src/core/banjo/tuning.ts";
import type { CapoPlan } from "../../src/core/banjo/tuning.ts";
import type { ArrangedMeasure } from "../../src/core/banjo/types.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { chordPitchClasses, parseChord } from "../../src/core/music/chords.ts";
import type { Chord } from "../../src/core/music/chords.ts";
import type { Key } from "../../src/core/music/keys.ts";
import { formatKey, parseKey, scalePitchClasses } from "../../src/core/music/keys.ts";
import { mod12 } from "../../src/core/music/notes.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import {
  arrangeForPlan,
  practiceArrangement,
  practicePlan,
  shapePlan,
} from "../../src/core/song/practiceArrangement.ts";
import { planFor } from "../../src/core/banjo/position.ts";
import { builtinSong, checkConsistency, loadSong } from "../../src/core/song/song.ts";

const header = (key: string) => `X:1\nT:Test tune\nM:4/4\nL:1/8\nQ:1/4=100\nK:${key}\n`;

// Made up for these tests (chord tones and scale steps): not songs.
const IN_B =
  header("B") +
  `"B"B2 d2 f2 d2|"F#"c2 A2 F2 A2|"C#m"c4 e2 c2|"E"B2 G2 e2 G2|\n` +
  `"C#m"G2 c2 e2 c2|"F#"A2 c2 f2 c2|"E"B4 G4|"B"B8|]\n`;
const IN_D = header("D") + `"D"d2 f2 a2 f2|"G"g2 d2 B2 d2|"A"e2 c2 A2 c2|"D"d8|]\n`;
const IN_E = header("E") + `"E"e2 g2 b2 g2|"A"a2 e2 c2 e2|"B7"f2 d2 B2 d2|"E"e8|]\n`;
const WITH_E7 =
  header("G") + `"G"B2 d2 B2 G2|"E7"B2 ^G2 B2 d2|"A7"A2 ^c2 e2 c2|"D7"d2 c2 A2 c2|"G"B8|]\n`;

const fixtureDir = new URL("../fixtures/songs/", import.meta.url);
const fixtures = readdirSync(fixtureDir)
  .filter((f) => f.endsWith(".abc"))
  .map((f) => {
    const id = f.replace(/\.abc$/, "");
    return {
      id,
      abc: readFileSync(new URL(f, fixtureDir), "utf8"),
      tab: readFileSync(new URL(`${id}.tab`, fixtureDir), "utf8"),
    };
  });

const untabbed = (abc: string, id = "test") => loadSong(builtinSong(id, abc));

interface Sounded {
  readonly measure: number;
  readonly slot: number;
  readonly string: number;
  readonly fret: number;
  readonly isMelody: boolean;
  /** Pitch class in the tab's own (shape) key: the tab's chords are named in that key too. */
  readonly pc: number;
  readonly chord: Chord | null;
}

/** Every tab note with its pitch class and the chord it is played over, in the shape key. */
function sounded(measures: readonly ArrangedMeasure[], plan: CapoPlan): Sounded[] {
  const out: Sounded[] = [];
  let carried: Chord | null = null;
  for (const m of measures) {
    const changes = m.chords
      .map((c) => ({ atSlot: c.atSlot, chord: parseChord(c.chord) }))
      .filter((c): c is { atSlot: number; chord: Chord } => c.chord !== null);
    for (const n of m.notes) {
      let chord = carried;
      for (const c of changes) if (c.atSlot <= n.slot) chord = c.chord;
      out.push({
        measure: m.index,
        slot: n.slot,
        string: n.string,
        fret: n.fret,
        isMelody: n.isMelody,
        pc: mod12(pitchAt(OPEN_G, n.string, n.fret, plan)),
        chord,
      });
    }
    for (const c of changes) carried = c.chord;
  }
  return out;
}

/**
 * Filler notes that don't fit: not a chord tone, and not the open 5th string where it is
 * welcome (in the key, and not a semitone from an out-of-key chord tone).
 */
function clashes(measures: readonly ArrangedMeasure[], plan: CapoPlan, shapeKey: Key): Sounded[] {
  const scale = scalePitchClasses(shapeKey);
  return sounded(measures, plan).filter((n) => {
    if (n.isMelody || !n.chord) return false;
    const chord = chordPitchClasses(n.chord);
    if (chord.has(n.pc)) return false;
    return !(n.string === 5 && n.fret === 0 && !droneClashes(n.pc, chord, scale));
  });
}

describe("which open-5th-string notes clash", () => {
  const G = scalePitchClasses(parseKey("G")!);
  const B = scalePitchClasses(parseKey("B")!);
  const over = (chord: string) => chordPitchClasses(parseChord(chord)!);
  const g = 67;

  it("allows the drone over the chords of its own key (guide §4.2)", () => {
    for (const chord of ["G", "C", "D", "Em", "Am", "D7", "F", "A7"]) {
      expect(droneClashes(g, over(chord), G), chord).toBe(false);
    }
  });

  it("rejects a drone that is outside the key", () => {
    // Open g in B major: the key has G♯. Only a chord that contains G natural could excuse it.
    for (const chord of ["B", "F#", "C#m", "E"]) {
      expect(droneClashes(g, over(chord), B), chord).toBe(true);
    }
  });

  it("rejects the drone next to an out-of-key chord tone", () => {
    // E7 in the key of G has G♯, a semitone from the drone.
    expect(droneClashes(g, over("E7"), G)).toBe(true);
    expect(droneClashes(g, over("E"), G)).toBe(true);
  });
});

describe("a song with no hand-written tab is arranged in C8's shapes for its key", () => {
  it("B major: G shapes with a capo at 4, and no note outside the key", () => {
    const loaded = untabbed(IN_B);
    const tab = practiceArrangement(loaded, 0, []);
    expect(formatKey(tab.plan.shapeKey)).toBe("G major");
    expect(tab.plan.capo.capo).toBe(4);
    expect(tab.plan.instruction).toBe("Capo 4 · tune 5th string up to B");
    expect(tab.generated).toBe(true);
    expect(tab.arrangeResult!.problems).toEqual([]);
    // The tab is written in G shapes: its chords are the shapes Dad frets.
    expect(tab.measures!.slice(0, 4).map((m) => m.chords[0]!.chord)).toEqual(["G", "D", "Am", "C"]);

    // As played (with the capo): every note is in B major, and the open 5th string sounds b.
    const bMajor = scalePitchClasses(parseKey("B")!);
    const played = tab.measures!.flatMap((m) =>
      m.notes.map((n) => pitchAt(OPEN_G, n.string, n.fret, tab.plan.capo)),
    );
    expect(played.filter((midi) => !bMajor.has(mod12(midi)))).toEqual([]);
    const drones = tab.measures!.flatMap((m) => m.notes.filter((n) => n.string === 5));
    expect(drones.length).toBeGreaterThan(0);
    for (const n of drones) expect(pitchAt(OPEN_G, 5, n.fret, tab.plan.capo)).toBe(71);

    expect(clashes(tab.measures!, shapePlan(tab.plan), tab.index.key)).toEqual([]);
  });

  it("B major: the melody notes sound the printed melody (an octave down, C9)", () => {
    const loaded = untabbed(IN_B);
    const tab = practiceArrangement(loaded, 0, []);
    let melodyNotes = 0;
    tab.measures!.forEach((m, i) => {
      const printed = loaded.index.measures[i]!;
      for (const n of m.notes.filter((x) => x.isMelody)) {
        const at = n.slot * loaded.index.rollUnit + 1e-9;
        const note = printed.melody.find((x) => x.offset <= at && at < x.offset + x.duration);
        expect(pitchAt(OPEN_G, n.string, n.fret, tab.plan.capo)).toBe(note!.midi! - 12);
        melodyNotes++;
      }
    });
    expect(melodyNotes).toBeGreaterThan(20);
  });

  it("E major: D shapes with a capo at 2", () => {
    const tab = practiceArrangement(untabbed(IN_E), 0, []);
    expect(formatKey(tab.plan.shapeKey)).toBe("D major");
    expect(tab.plan.capo.capo).toBe(2);
    expect(clashes(tab.measures!, shapePlan(tab.plan), tab.index.key)).toEqual([]);
    expect(
      checkConsistency(tab.index, tab.measures!, OPEN_G, shapePlan(tab.plan)).filter(
        (p) => p.severity === "error",
      ),
    ).toEqual([]);
  });

  it("D position: the arranger knows the 5th string is tuned to a", () => {
    const tab = practiceArrangement(untabbed(IN_D), 0, []);
    expect(tab.plan.instruction).toBe("No capo · tune 5th string up to A");
    expect(tab.plan.capo.capo).toBe(0);
    // A melody note on the 5th string must sound the printed note with the string at a, not g.
    expect(
      checkConsistency(tab.index, tab.measures!, OPEN_G, tab.plan.capo).filter(
        (p) => p.severity === "error",
      ),
    ).toEqual([]);
    expect(clashes(tab.measures!, tab.plan.capo, tab.index.key)).toEqual([]);
  });

  it("keeps a song in G, C or D in its own key, as before", () => {
    for (const [key, shapes] of [
      ["G", "G major"],
      ["C", "C major"],
      ["D", "D major"],
      ["A", "G major"],
      ["F", "C major"],
    ] as const) {
      const loaded = untabbed(header(key) + `"${key}"z8|]\n`);
      expect(formatKey(practicePlan(loaded, 0, []).shapeKey), key).toBe(shapes);
    }
  });

  for (const f of fixtures) {
    it(`${f.id} without its tab: legal and free of clashes in all 12 keys`, () => {
      const loaded = untabbed(f.abc, `untabbed-${f.id}`);
      for (let shift = 0; shift < 12; shift++) {
        const tab = practiceArrangement(loaded, shift, []);
        const where = `${f.id} +${shift}`;
        expect(tab.plan.capo.capo, where).toBeLessThanOrEqual(5);
        expect(
          validate(tab.measures!, { plan: tab.plan.capo }).filter((v) => v.severity === "error"),
          where,
        ).toEqual([]);
        expect(
          checkConsistency(tab.index, tab.measures!, OPEN_G, shapePlan(tab.plan)).filter(
            (p) => p.severity === "error",
          ),
          where,
        ).toEqual([]);
        expect(clashes(tab.measures!, shapePlan(tab.plan), tab.index.key), where).toEqual([]);
      }
    });
  }
});

describe("the arranger keeps the thumb off a clashing open 5th string", () => {
  it("plays another string under an E7 in the key of G", () => {
    const idx = indexAbc(WITH_E7);
    const { arrangement, problems } = arrange(idx);
    expect(problems).toEqual([]);
    const e7 = arrangement.measures.find((m) => m.chords[0]?.chord === "E7")!;
    expect(e7.notes.filter((n) => n.string === 5)).toEqual([]);
    // The drone stays where it belongs: over G and D7.
    const g = arrangement.measures[0]!;
    expect(g.notes.some((n) => n.string === 5 && n.fret === 0)).toBe(true);
    expect(
      clashes(arrangement.measures, { capo: 0, fifth: { semitones: 0, by: "none" } }, idx.key),
    ).toEqual([]);
  });

  it("does so in a song arranged straight in B major too", () => {
    // arrange() itself (as the editor preview once called it), with no capo plan to help.
    const idx = indexAbc(IN_B);
    const { arrangement } = arrange(idx);
    expect(arrangement.measures.flatMap((m) => m.notes.filter((n) => n.string === 5))).toEqual([]);
    expect(validate(arrangement.measures).filter((v) => v.severity === "error")).toEqual([]);
  });
});

describe("the arranger's search respects the left hand's reach (H5)", () => {
  it("leaves out a melody note it can't reach instead of giving up on the measure", () => {
    // A repeated c over a C chord: the second c is only at 3rd string fret 5, out of reach of
    // the chord's 1st-fret note. Every candidate used to fail C4 and the measure lost its melody.
    const idx = indexAbc(header("G") + `"G"B2 d2 B2 G2|"C"c2 c c3 c2|"G"B8|]\n`);
    const { arrangement, problems } = arrange(idx);
    expect(problems).toEqual([]);
    expect(arrangement.measures[1]!.notes.filter((n) => n.isMelody).length).toBeGreaterThan(1);
    expect(validate(arrangement.measures).filter((v) => v.severity === "error")).toEqual([]);
  });
});

describe("hand-written tabs are left as they are", () => {
  for (const f of fixtures) {
    it(`${f.id}: its own tab at the printed key and with a capo`, () => {
      const loaded = loadSong(builtinSong(f.id, f.abc, f.tab));
      expect(loaded.stale).toBe(false);
      const own = practiceArrangement(loaded, 0, []);
      expect(own.generated).toBe(false);
      expect(own.measures).toBe(loaded.arrangement!.measures);
      expect(own.plan.keepsTab).toBe(true);
      expect(own.plan.capo.capo).toBe(0);
      const capoed = practiceArrangement(loaded, 2, []);
      expect(capoed.generated).toBe(false);
      expect(capoed.measures).toBe(loaded.arrangement!.measures);
      expect(capoed.plan.capo.capo).toBe(2);
    });
  }

  it("Cripple Creek in A keeps its capo instruction", () => {
    const f = fixtures.find((x) => x.id === "cripple-creek")!;
    const loaded = loadSong(builtinSong(f.id, f.abc, f.tab));
    expect(practicePlan(loaded, 2, []).instruction).toBe("Capo 2 · tune 5th string up to A");
    expect(practicePlan(loaded, 2, [7, 9, 10]).instruction).toBe(
      "Capo 2 · 5th string to A (spike at 7)",
    );
  });
});

describe("arrangeForPlan", () => {
  it("returns the song itself when it is already in the shape key", () => {
    const abc = fixtures.find((x) => x.id === "cripple-creek")!.abc;
    const idx = indexAbc(abc);
    const r = arrangeForPlan(abc, idx, planFor(idx.key));
    expect(r.abc).toBe(abc);
    expect(r.index).toBe(idx);
  });

  it("moves the melody into the shape key otherwise", () => {
    const idx = indexAbc(IN_B);
    const r = arrangeForPlan(IN_B, idx, planFor(idx.key));
    expect(formatKey(r.index.key)).toBe("G major");
    expect(r.result.arrangement.measures.length).toBe(idx.measures.length);
  });
});
