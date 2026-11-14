// A song written with a chord only where it changes still names its chord in every measure
// of the notation, including at the start of a later line.
import { describe, expect, it } from "vitest";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { lineAbc } from "../../src/core/song/layoutAbc.ts";

const ABC = [
  "X:1",
  "T:Test",
  "M:4/4",
  "L:1/4",
  "K:G",
  '"G"GABc|defg|"C"gfed|"G"cBAG|"D7"dcBA|"G"G4|',
  "",
].join("\n");

const chordsIn = (text: string) => [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const melodyOf = (abc: string) =>
  abc.split("\n").find((l) => l.startsWith('"') || /^[A-Ga-g]/.test(l)) ?? "";

describe("chord on every measure", () => {
  const index = indexAbc(ABC);

  it("repeats the chord a measure carries on from the one before", () => {
    const line = lineAbc(
      ABC,
      index,
      { from: 0, to: 6 },
      { showMeter: true, chordEveryMeasure: true },
    );
    expect(chordsIn(melodyOf(line))).toEqual(["G", "G", "C", "G", "D7", "G"]);
  });

  it("is unchanged when the option is off", () => {
    const line = lineAbc(ABC, index, { from: 0, to: 6 }, { showMeter: true });
    expect(chordsIn(melodyOf(line))).toEqual(["G", "C", "G", "D7", "G"]);
  });

  it("a later line starts with the chord still in force from the line before", () => {
    const line = lineAbc(
      ABC,
      index,
      { from: 2, to: 4 },
      { showMeter: false, chordEveryMeasure: true },
    );
    expect(chordsIn(melodyOf(line))).toEqual(["C", "G"]);
    const second = lineAbc(
      ABC,
      index,
      { from: 1, to: 3 },
      { showMeter: false, chordEveryMeasure: true },
    );
    expect(chordsIn(melodyOf(second))).toEqual(["G", "C"]);
  });

  it("never doubles a chord that is already written at the start of the measure", () => {
    const line = lineAbc(
      ABC,
      index,
      { from: 0, to: 6 },
      { showMeter: true, chordEveryMeasure: true },
    );
    expect(melodyOf(line)).not.toMatch(/""|"G""G"/);
  });
});
