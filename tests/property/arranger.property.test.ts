// C6 arranger: legal output for the built-ins and for random melodies (DEVELOPMENT.md §9 phase 3
// exit: "passes C4 hard rules for every measure … and for 10,000 random property-test melodies
// (or returns an explicit can't place)"). Locally 200 runs; the CI "arranger" job sets ARRANGER_RUNS=10000.
import { readdirSync, readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arrange, melodyTargets } from "../../src/core/banjo/arranger.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { checkConsistency } from "../../src/core/song/song.ts";

const RUNS = Number(process.env.ARRANGER_RUNS ?? 200);
const dir = new URL("../../songs/", import.meta.url);
const builtins = readdirSync(dir)
  .filter((f) => f.endsWith(".abc"))
  .map((f) => ({ id: f, abc: readFileSync(new URL(f, dir), "utf8") }));

const errors = (ms: Parameters<typeof validate>[0]) =>
  validate(ms).filter((v) => v.severity === "error");

describe("C6 arranger on the built-in melodies", () => {
  for (const { id, abc } of builtins) {
    it(`${id}: legal, matches the notation, and places most strong melody notes`, () => {
      const idx = indexAbc(abc);
      const t0 = performance.now();
      const { arrangement, problems } = arrange(idx);
      // Phase-3 budget is 300 ms on the iPad; a desktop should be far inside it.
      expect(performance.now() - t0).toBeLessThan(1500);
      expect(errors(arrangement.measures)).toEqual([]);
      expect(
        checkConsistency(idx, arrangement.measures).filter((p) => p.severity === "error"),
      ).toEqual([]);
      expect(problems).toEqual([]);
      let strong = 0;
      let placed = 0;
      idx.measures.forEach((m, i) => {
        for (const t of melodyTargets(m, idx.rollUnit).targets) {
          if (t.slot % 2 !== 0) continue;
          strong++;
          if (arrangement.measures[i]!.notes.some((n) => n.slot === t.slot && n.isMelody)) placed++;
        }
      });
      expect(placed / strong).toBeGreaterThan(0.75);
      expect(arrangement.measures.every((m) => m.source === "generated")).toBe(true);
    });
  }

  it("honors a roll override, and explains one that can't work", () => {
    const idx = indexAbc(builtins.find((b) => b.id.startsWith("cripple"))!.abc);
    const forced = arrange(idx, { overrides: new Map([[4, "alternating-thumb"]]) });
    const m4 = forced.arrangement.measures.find((m) => m.index === 4)!;
    expect(m4.rollName.startsWith("alternating-thumb")).toBe(true);
    expect(m4.source).toBe("override");
    expect(errors(forced.arrangement.measures)).toEqual([]);
    const impossible = arrange(idx, { overrides: new Map([[1, "no-such-roll"]]) });
    expect(impossible.problems.map((p) => p.measure)).toContain(1);
    expect(errors(impossible.arrangement.measures)).toEqual([]);
  });
});

const NOTES = [
  "G,",
  "A,",
  "B,",
  "C",
  "D",
  "E",
  "F",
  "^F",
  "G",
  "A",
  "B",
  "c",
  "d",
  "e",
  "f",
  "^f",
  "g",
  "a",
  "z",
];
const LENGTHS = ["", "2", "", "4", "/2"];
const CHORDS = ["G", "C", "D", "D7", "Em", "Am", "F", "A7"];

/** A random 4/4 measure: notes and lengths that add up to 8 eighths. */
const measureArb = fc
  .array(fc.tuple(fc.constantFrom(...NOTES), fc.constantFrom(...LENGTHS)), {
    minLength: 1,
    maxLength: 12,
  })
  .map((notes) => {
    let left = 8;
    const out: string[] = [];
    for (const [n, l] of notes) {
      const len = l === "" ? 1 : l === "/2" ? 0.5 : Number(l);
      if (len > left) break;
      out.push(n + l);
      left -= len;
    }
    if (left > 0) out.push(`z${left === 1 ? "" : left}`.replace("z0.5", "z/2"));
    // A trailing half-eighth needs pairing; keep measures whole by padding to an eighth grid.
    return out.join(" ");
  });

describe("C6 arranger regressions", () => {
  // fast-check seed -12563778: no candidate in measure 2 joined measure 1 legally, and the
  // fallback kept an illegal join (H1/H2). Melody-free backup candidates fix it.
  it("always finds a legal join, even for an awkward low melody", () => {
    const idx = indexAbc(
      `X:1
M:4/4
L:1/8
K:G
"G"G, G, G,4 G G,|"G"^f G,/2 G,/2 z6|"G"G, z7|]`,
    );
    const { arrangement } = arrange(idx);
    expect(errors(arrangement.measures)).toEqual([]);
  });
});

describe("C6 arranger on random melodies (property)", () => {
  it(`always returns a legal arrangement, or flags the measure it couldn't place (${RUNS} runs)`, () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.constantFrom(...CHORDS), measureArb), { minLength: 1, maxLength: 8 }),
        (measures) => {
          const body = measures.map(([c, m]) => `"${c}"${m}`).join("|") + "|]";
          const idx = indexAbc(`X:1\nM:4/4\nL:1/8\nK:G\n${body}`);
          if (idx.errors.length > 0) return; // e.g. a half-eighth left over: not a valid measure
          const { arrangement, problems } = arrange(idx);
          expect(arrangement.measures).toHaveLength(idx.measures.length);
          expect(errors(arrangement.measures)).toEqual([]);
          // Anything not placed is reported, never silent.
          for (const p of problems) expect(p.message.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: RUNS },
    );
  }, 600_000);
});
