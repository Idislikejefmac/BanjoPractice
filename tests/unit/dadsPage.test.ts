// Dad's own page, "3 Finger Scruggs style" (photo 20261115_121459.jpg, read 2026-11-15): the
// finger letters he wrote under each roll, compared with the roll library. Six of the eight match;
// one is a contradiction still to investigate, and the waltz rolls (3/4) showed that the arranger
// built full waltz bars from the wrong end of each roll.
import { describe, expect, it } from "vitest";
import { arrange } from "../../src/core/banjo/arranger.ts";
import { rollById, rollSlice, ROLLS } from "../../src/core/banjo/rolls.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";

const fingersOf = (id: string) => rollById(id)!.fingers.join(" ");

describe("Dad's 4/4 rolls against the library", () => {
  it("alternating thumb: T I T M T I T M, exactly the library's", () => {
    expect(fingersOf("alternating-thumb")).toBe("T I T M T I T M");
  });

  it("forward roll: I M T I M T I M, the library's pattern starting two notes earlier", () => {
    // Deering writes it this way, "index, middle, thumb, repeated"; the library starts on the
    // thumb (the first two notes moved to the end), which is the same endless pattern.
    const dad = "I M T I M T I M".split(" ");
    const lib = rollById("forward")!.fingers;
    const rotated = [...lib.slice(6), ...lib.slice(0, 6)];
    expect(rotated.join(" ")).toBe(dad.join(" "));
    // Not the thumb-ending form most tab books print.
    expect(fingersOf("forward-thumb-ending")).not.toBe(dad.join(" "));
  });

  it("OPEN QUESTION: his 4/4 'Forward/Reverse' T M T I M I T M is not the library's (or Deering's, Tony's, Jens's)", () => {
    const dad = "T M T I M I T M".split(" ");
    const lib = rollById("forward-reverse")!.fingers; // T I M T M I T M, stated by all three
    const differs = dad.map((f, i) => (f === lib[i] ? null : i + 1)).filter((x) => x !== null);
    expect(differs).toEqual([2, 3, 4]); // only these positions differ
    // His second half, M I T M, is the library's second half; only his first half, T M T I, differs
    // (the library has T I M T).
    expect(dad.slice(4)).toEqual(lib.slice(4));
    // It is not the thumb-start variant either (T M T I M T I M).
    expect(fingersOf("forward-thumb-start")).not.toBe(dad.join(" "));
  });
});

describe("Dad's waltz (3/4) rolls are the first six notes of the library's rolls", () => {
  const dads: [string, string][] = [
    ["forward", "T I M T I M"],
    ["backward", "M I T M I T"],
    ["forward-reverse", "T I M T M I"],
    ["forward-thumb-start", "T M T I M T"],
  ];
  for (const [id, six] of dads) {
    it(`${id}: ${six}`, () => {
      expect(rollSlice(rollById(id)!.fingers, 6).join(" ")).toBe(six);
    });
  }

  it("a pickup bar still takes the end of the roll, so it leads into the downbeat", () => {
    const f = rollById("forward")!.fingers;
    expect(rollSlice(f, 2)).toEqual(f.slice(6));
    expect(rollSlice(f, 3)).toEqual(f.slice(5));
    expect(rollSlice(f, 8)).toEqual([...f]);
  });

  it("the arranger builds each full waltz bar from the front of its roll", () => {
    const abc = [
      "X:1",
      "T:Waltz test",
      "M:3/4",
      "L:1/8",
      "K:G",
      '"G"GAB dBG|"C"cBc AGE|"D"DEF GAB|"G"G6|"G"GAB dBG|"C"cBc AGE|"D"DEF GAB|"G"G6|]',
      "",
    ].join("\n");
    const r = arrange(indexAbc(abc), {});
    expect(r.problems).toEqual([]);
    let checked = 0;
    for (const m of r.arrangement.measures) {
      const id = m.rollName?.replace(/\+slur$/, "") ?? "";
      const roll = ROLLS.find((x) => x.id === id);
      if (!roll || m.slots !== 6) continue; // halves, licks and fills are built differently
      const fingers = Array.from({ length: 6 }, (_, s) => {
        const here = m.notes.filter((n) => n.slot === s && n.finger);
        return here.length === 1 ? here[0]!.finger : null;
      });
      if (fingers.includes(null)) continue; // a pinch or a hold: not a plain roll bar
      expect(fingers.join(" "), `${m.index} ${id}`).toBe(rollSlice(roll.fingers, 6).join(" "));
      checked++;
    }
    expect(checked).toBeGreaterThan(2);
  });
});
