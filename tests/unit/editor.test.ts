import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arrange } from "../../src/core/banjo/arranger.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { parseKey } from "../../src/core/music/keys.ts";
import type { Letter } from "../../src/core/music/notes.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import type { EditorNote, EditorSong, Eighths } from "../../src/core/song/editorModel.ts";
import { emptySong, fits, overridesOf, toAbc } from "../../src/core/song/editorModel.ts";

const G = parseKey("G")!;
const note = (
  letter: Letter | null,
  eighths: Eighths,
  octave = 4,
  accidental: EditorNote["accidental"] = "key",
): EditorNote => ({
  letter,
  accidental,
  octave,
  eighths,
});

describe("F17 editor model", () => {
  it("writes ABC that reads back as the same notes and chords", () => {
    const song: EditorSong = {
      ...emptySong(G),
      title: "My Tune",
      measures: [
        {
          notes: [note("G", 2), note("A", 2), note("B", 2), note("D", 2, 5)],
          chords: [
            { atSlot: 0, chord: "G" },
            { atSlot: 4, chord: "D" },
          ],
        },
        { notes: [note("C", 4, 5), note(null, 4)], chords: [{ atSlot: 0, chord: "C" }] },
      ],
    };
    const abc = toAbc(song);
    const idx = indexAbc(abc);
    expect(idx.errors).toEqual([]);
    expect(idx.title).toBe("My Tune");
    expect(idx.measures.map((m) => m.slots)).toEqual([8, 8]);
    expect(idx.measures[0]!.melody.map((n) => n.midi)).toEqual([67, 69, 71, 74]);
    expect(idx.measures[0]!.chords).toEqual([
      { atSlot: 0, chord: "G" },
      { atSlot: 4, chord: "D" },
    ]);
    expect(idx.measures[1]!.melody.map((n) => n.midi)).toEqual([72, null]);
  });

  it("pads a part-filled measure with rests and keeps the chord", () => {
    const idx = indexAbc(
      toAbc({
        ...emptySong(G),
        measures: [{ notes: [note("G", 1)], chords: [{ atSlot: 0, chord: "G" }] }],
      }),
    );
    expect(idx.measures[0]!.slots).toBe(8);
    expect(idx.measures[0]!.chords).toEqual([{ atSlot: 0, chord: "G" }]);
  });

  it("writes accidentals only where the key doesn't already give them", () => {
    // In G, F is already sharp; F natural needs "=" once per measure.
    const abc = toAbc({
      ...emptySong(G),
      measures: [
        {
          notes: [note("F", 2, 4, 1), note("F", 2, 4, 0), note("F", 2, 4, 0), note("B", 2, 4, -1)],
          chords: [],
        },
      ],
    });
    expect(abc).toContain("F2=F2F2_B2");
  });

  it("won't let a measure overfill", () => {
    const s = emptySong(G);
    const m = { notes: [note("G", 4), note("A", 2)], chords: [] };
    expect(fits(s, m, 2)).toBe(true);
    expect(fits(s, m, 3)).toBe(false);
    expect(fits({ ...s, meter: "3/4" }, { notes: [note("G", 4)], chords: [] }, 4)).toBe(false);
  });

  it("collects roll overrides by measure number", () => {
    const s = {
      ...emptySong(G),
      measures: [
        { notes: [], chords: [] },
        { notes: [], chords: [], roll: "forward" },
      ],
    };
    expect([...overridesOf(s)]).toEqual([[2, "forward"]]);
  });

  it("any song entered in the editor indexes cleanly and arranges legally (property)", () => {
    const letters: Letter[] = ["C", "D", "E", "F", "G", "A", "B"];
    const noteArb = fc.record({
      letter: fc.constantFrom<Letter | null>(...letters, null),
      accidental: fc.constantFrom<EditorNote["accidental"]>("key", -1, 0, 1),
      octave: fc.constantFrom(4, 5),
      eighths: fc.constantFrom<Eighths>(1, 2, 2, 3, 4),
    });
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(fc.array(noteArb, { maxLength: 8 }), fc.constantFrom("G", "C", "D7", "Em")),
          {
            minLength: 1,
            maxLength: 4,
          },
        ),
        (raw) => {
          const s = emptySong(G);
          const measures = raw.map(([notes, chord]) => {
            const kept: EditorNote[] = [];
            for (const n of notes)
              if (fits(s, { notes: kept, chords: [] }, n.eighths)) kept.push(n);
            return { notes: kept, chords: [{ atSlot: 0, chord }] };
          });
          const idx = indexAbc(toAbc({ ...s, measures }));
          expect(idx.errors).toEqual([]);
          expect(idx.measures).toHaveLength(measures.length);
          const r = arrange(idx);
          expect(validate(r.arrangement.measures).filter((v) => v.severity === "error")).toEqual(
            [],
          );
        },
      ),
      { numRuns: 60 },
    );
  });
});
