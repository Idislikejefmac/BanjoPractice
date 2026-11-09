// T1 property tests (CHAOS_TESTING.md §5.1, §5.2).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rollMeasure, ROLLS } from "../../src/core/banjo/rolls.ts";
import type { ArrangedMeasure, Finger, StringNo, TabNote } from "../../src/core/banjo/types.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { MODES } from "../../src/core/music/keys.ts";
import type { Key } from "../../src/core/music/keys.ts";
import { LETTERS, pitchClass } from "../../src/core/music/notes.ts";
import type { Letter } from "../../src/core/music/notes.ts";
import { spellInKey, transposeKey, transposeNote } from "../../src/core/music/spelling.ts";
import { parseTab, serializeTab } from "../../src/core/tab/tabText.ts";

const RUNS = { numRuns: 500 };

const keyArb: fc.Arbitrary<Key> = fc
  .record({
    letter: fc.constantFrom(...(LETTERS as Letter[])),
    accidental: fc.integer({ min: -1, max: 1 }),
    mode: fc.constantFrom(...MODES),
  })
  .map(({ letter, accidental, mode }) => ({ tonic: { letter, accidental }, mode }));

describe("C1 transposition", () => {
  it("transposing a canonically spelled note up then down is the identity", () => {
    fc.assert(
      fc.property(
        keyArb,
        fc.integer({ min: 0, max: 11 }),
        fc.integer({ min: -11, max: 11 }),
        (key, pc, n) => {
          const original = spellInKey(pc, key);
          const there = transposeKey(key, n);
          const back = transposeNote(transposeNote(original, n, there), -n, key);
          expect(back).toEqual(original);
        },
      ),
      RUNS,
    );
  });

  it("transposed keys keep their mode and land on the right pitch", () => {
    fc.assert(
      fc.property(keyArb, fc.integer({ min: -11, max: 11 }), (key, n) => {
        const t = transposeKey(key, n);
        expect(t.mode).toBe(key.mode);
        expect(pitchClass(t.tonic)).toBe((((pitchClass(key.tonic) + n) % 12) + 12) % 12);
      }),
      RUNS,
    );
  });
});

// A measure built from a random roll with random legal frets on its example strings.
const legalMeasureArb: fc.Arbitrary<ArrangedMeasure> = fc
  .record({
    roll: fc.constantFrom(...ROLLS),
    index: fc.integer({ min: 1, max: 64 }),
    melody: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
    base: fc.integer({ min: 0, max: 9 }),
  })
  .map(({ roll, index, melody, base }) => {
    const m = rollMeasure(roll, { index });
    m.notes = m.notes.map((n, i) => ({
      ...n,
      // Strings 1–4 fretted within one 4-fret window; the 5th string stays open.
      fret: n.string === 5 ? 0 : base === 0 ? 0 : base + (i % 3),
      isMelody: melody[i] ?? false,
    }));
    return m;
  });

describe("C5 tab text", () => {
  it("parse(serialize(m)) round-trips any legal measure list", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(legalMeasureArb, { minLength: 1, maxLength: 8, selector: (m) => m.index }),
        (ms) => {
          const parsed = parseTab(serializeTab(ms));
          expect(parsed.ok).toBe(true);
          expect(parsed.measures).toEqual(ms);
        },
      ),
      RUNS,
    );
  });

  it("never throws on mutated input", () => {
    const valid =
      "m1 G forward | 3:0T* 2:0I 1:0M 5:0T> 2:0I 1:0M* 5:0T> 1:0M |\nm2 G tag | 3:0T 2:0I [5:0T,1:0M] - 3:0T . [5:0T,1:0M] - |";
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ at: fc.nat(valid.length), ch: fc.string({ maxLength: 3 }), del: fc.nat(3) }),
          { maxLength: 6 },
        ),
        (edits) => {
          let text = valid;
          for (const e of edits) text = text.slice(0, e.at) + e.ch + text.slice(e.at + e.del);
          expect(() => parseTab(text)).not.toThrow();
        },
      ),
      RUNS,
    );
  });
});

describe("C4 validator", () => {
  it("accepts every roll-built measure with in-window frets", () => {
    fc.assert(
      fc.property(legalMeasureArb, (m) => {
        expect(validate([m]).filter((v) => v.rule !== "H5")).toEqual([]);
      }),
      RUNS,
    );
  });

  it("reports H1 whenever a finger is duplicated into the next slot", () => {
    fc.assert(
      fc.property(legalMeasureArb, fc.integer({ min: 0, max: 6 }), (m, i) => {
        const a = m.notes[i] as TabNote;
        const b = m.notes[i + 1] as TabNote;
        const broken: ArrangedMeasure = {
          ...m,
          notes: m.notes.map((n, j) => (j === i + 1 ? { ...b, finger: a.finger as Finger } : n)),
        };
        expect(validate([broken]).some((v) => v.rule === "H1")).toBe(true);
      }),
      RUNS,
    );
  });

  it("reports H2 whenever a string is repeated into the next slot", () => {
    fc.assert(
      fc.property(legalMeasureArb, fc.integer({ min: 0, max: 6 }), (m, i) => {
        const a = m.notes[i] as TabNote;
        const broken: ArrangedMeasure = {
          ...m,
          notes: m.notes.map((n, j) =>
            j === i + 1 ? { ...n, string: a.string as StringNo, fret: a.fret } : n,
          ),
        };
        expect(validate([broken]).some((v) => v.rule === "H2")).toBe(true);
      }),
      RUNS,
    );
  });

  it("never throws, whatever it is given", () => {
    fc.assert(
      fc.property(fc.anything(), (junk) => {
        expect(() => validate([junk as ArrangedMeasure])).not.toThrow();
      }),
      RUNS,
    );
  });
});
