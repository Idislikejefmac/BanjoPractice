import { describe, expect, it } from "vitest";
import { rollById, rollMeasure, ROLLS } from "../../src/core/banjo/rolls.ts";
import { NO_CAPO, OPEN_G } from "../../src/core/banjo/tuning.ts";
import { classifyMeasure, classifyNote } from "../../src/core/learning/classify.ts";
import {
  accentFingers,
  listenCue,
  rollHalves,
  rollsPlayingString,
} from "../../src/core/learning/cues.ts";
import {
  AGAIN_TO_RETREAT,
  GOT_IT_TO_ADVANCE,
  hiddenSlots,
  INITIAL_FADE,
  parseFadeState,
  rate,
} from "../../src/core/learning/fade.ts";
import type { FadeState, Rating } from "../../src/core/learning/fade.ts";
import {
  answer,
  BOX_INTERVALS_MS,
  dueItems,
  MAX_QUESTIONS,
  MIN_GAP_MS,
  newItem,
} from "../../src/core/learning/schedule.ts";

const ctx = { tuning: OPEN_G, plan: NO_CAPO };

describe("fade ladder (F37)", () => {
  it("advances after three 'got it' in a row, and resets the run", () => {
    let s: FadeState = INITIAL_FADE;
    for (let i = 0; i < GOT_IT_TO_ADVANCE - 1; i++) s = rate(s, "got-it");
    expect(s.level).toBe(1);
    s = rate(s, "got-it");
    expect(s).toEqual({ level: 2, gotItRun: 0, againRun: 0 });
  });

  it("an 'again' in the middle breaks the run", () => {
    let s: FadeState = INITIAL_FADE;
    s = rate(rate(s, "got-it"), "got-it");
    s = rate(s, "again");
    s = rate(rate(s, "got-it"), "got-it");
    expect(s.level).toBe(1);
  });

  it("steps back after two 'again' in a row, but never below 1 or above 4", () => {
    let s: FadeState = { level: 3, gotItRun: 0, againRun: 0 };
    for (let i = 0; i < AGAIN_TO_RETREAT; i++) s = rate(s, "again");
    expect(s.level).toBe(2);
    for (let i = 0; i < 10; i++) s = rate(s, "again");
    expect(s.level).toBe(1);
    for (let i = 0; i < 40; i++) s = rate(s, "got-it");
    expect(s.level).toBe(4);
  });

  it("stays inside its bounds for any sequence of ratings", () => {
    let seed = 12345;
    let s: FadeState = INITIAL_FADE;
    for (let i = 0; i < 2000; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const r: Rating = seed % 3 === 0 ? "again" : "got-it";
      s = rate(s, r);
      expect([1, 2, 3, 4]).toContain(s.level);
      expect(s.gotItRun).toBeLessThan(GOT_IT_TO_ADVANCE + 1);
      expect(s.againRun).toBeLessThan(AGAIN_TO_RETREAT + 1);
    }
  });

  it("hides more help at each level", () => {
    expect(hiddenSlots(1, "finger")).toEqual([]);
    expect(hiddenSlots(2, "finger")).toEqual([4, 5, 6, 7]);
    expect(hiddenSlots(2, "string")).toEqual([4, 5, 6, 7]);
    expect(hiddenSlots(3, "finger")).toEqual([]);
    expect(hiddenSlots(3, "string")).toHaveLength(8);
    expect(hiddenSlots(4, "finger")).toHaveLength(8);
  });

  it("reads back damaged stored state as the starting state", () => {
    expect(parseFadeState(null)).toEqual(INITIAL_FADE);
    expect(parseFadeState("x")).toEqual(INITIAL_FADE);
    expect(parseFadeState({ level: 9 })).toEqual(INITIAL_FADE);
    expect(parseFadeState({ level: 3, gotItRun: -4, againRun: 1.5 })).toEqual({
      level: 3,
      gotItRun: 0,
      againRun: 0,
    });
    expect(parseFadeState({ level: 2, gotItRun: 2, againRun: 1 })).toEqual({
      level: 2,
      gotItRun: 2,
      againRun: 1,
    });
  });
});

describe("spaced review (F40)", () => {
  const T0 = 1_700_000_000_000;

  it("a correct answer moves up a box and waits longer", () => {
    const a = answer(newItem("q"), true, T0);
    expect(a.box).toBe(1);
    expect(a.dueAt).toBe(T0 + (BOX_INTERVALS_MS[1] as number));
  });

  it("a miss returns to box 0, due after a gap, never straight away", () => {
    const missed = answer({ ...newItem("q"), box: 4 }, false, T0);
    expect(missed.box).toBe(0);
    expect(dueItems([missed], T0)).toEqual([]);
    expect(dueItems([missed], T0 + MIN_GAP_MS - 1)).toEqual([]);
    expect(dueItems([missed], T0 + MIN_GAP_MS)).toHaveLength(1);
  });

  it("never-seen items come after overdue ones, and the limit holds", () => {
    const seen = answer(newItem("seen"), false, T0);
    const items = [newItem("a"), newItem("b"), seen];
    const due = dueItems(items, T0 + 2 * MIN_GAP_MS);
    expect(due[0]?.id).toBe("seen");
    const many = Array.from({ length: 20 }, (_, i) => newItem(`n${i}`));
    expect(dueItems(many, T0)).toHaveLength(MAX_QUESTIONS);
    expect(dueItems(many, T0, 0)).toEqual([]);
  });

  it("survives the clock going backwards or far forwards", () => {
    const a = answer(newItem("q"), true, T0);
    // Clock went back a year: the answer is "in the future", so it is due again.
    expect(dueItems([a], T0 - 365 * 24 * 3_600_000)).toHaveLength(1);
    // Clock went forward a year: overdue, so due.
    expect(dueItems([a], T0 + 365 * 24 * 3_600_000)).toHaveLength(1);
    // Normal time just after answering: not due.
    expect(dueItems([a], T0 + 60_000)).toEqual([]);
  });
});

describe("cues and roll queries (F41, F44)", () => {
  it("derives the cue from the roll, so it is true for every roll", () => {
    expect(listenCue(rollById("forward")!)).toBe("Listen for the thumb on every strong beat.");
    expect(listenCue(rollById("backward")!)).toBe(
      "Listen for the strong beats: middle finger, thumb, index finger, middle finger.",
    );
  });

  it("names each accent's finger, never claiming a finger that isn't there", () => {
    for (const roll of ROLLS) {
      const cue = listenCue(roll);
      const names = new Set(
        accentFingers(roll).map((f) => ({ T: "thumb", I: "index finger", M: "middle finger" })[f]),
      );
      for (const n of names) expect(cue).toContain(n);
      if (names.size > 1) expect(cue).toContain("strong beats:");
    }
  });

  it("splits every roll into two four-slot halves that rejoin", () => {
    for (const roll of ROLLS) {
      const [a, b] = rollHalves(roll);
      expect(a).toHaveLength(4);
      expect(b).toHaveLength(4);
      expect([...a, ...b]).toEqual([...roll.fingers]);
    }
  });

  it("finds rolls for a string and slot, including every roll's own example", () => {
    for (const roll of ROLLS) {
      roll.exampleStrings.forEach((string, slot) => {
        expect(rollsPlayingString(string, slot).map((r) => r.id)).toContain(roll.id);
      });
    }
    // The middle finger never plays the 5th string.
    expect(rollsPlayingString(5, 0).every((r) => r.fingers[0] === "T")).toBe(true);
  });
});

describe("why this note? (F39)", () => {
  it("labels a forward roll over G: drone, chord tones", () => {
    const m = rollMeasure(rollById("forward")!);
    const roles = classifyMeasure(m, ctx).map((x) => x.role);
    // Strings 3,2,1,5,2,1,5,1 open over G: G, B, D are all G-chord tones; 5th string is the drone.
    expect(roles).toEqual([
      "chord-tone",
      "chord-tone",
      "chord-tone",
      "drone",
      "chord-tone",
      "chord-tone",
      "drone",
      "chord-tone",
    ]);
  });

  it("calls an open note outside the chord 'passing' and respects chord changes", () => {
    const m = rollMeasure(rollById("forward")!, { chord: "C" });
    // 2nd string open is B: not in C.
    expect(classifyNote(m, m.notes[1]!, ctx)).toBe("passing");
    const changed = {
      ...m,
      chords: [
        { atSlot: 0, chord: "C" },
        { atSlot: 4, chord: "G" },
      ],
    };
    expect(classifyNote(changed, changed.notes[1]!, ctx)).toBe("passing");
    expect(classifyNote(changed, changed.notes[4]!, ctx)).toBe("chord-tone");
  });

  it("melody and slurs come before chord membership; an unreadable chord is 'passing'", () => {
    const m = rollMeasure(rollById("forward")!);
    const melody = { ...m.notes[1]!, isMelody: true };
    expect(classifyNote(m, melody, ctx)).toBe("melody");
    const hammer = { ...m.notes[0]!, technique: "hammer" as const, finger: null, fret: 2 };
    expect(classifyNote(m, hammer, ctx)).toBe("slur");
    const noChord = { ...m, chords: [{ atSlot: 0, chord: "???" }] };
    expect(classifyNote(noChord, noChord.notes[0]!, ctx)).toBe("passing");
    expect(classifyNote({ ...m, chords: [] }, m.notes[0]!, ctx)).toBe("passing");
  });
});
