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

describe("one chord height on every line", () => {
  const index = indexAbc(ABC);

  it("gives every line a hidden third voice holding the song's highest note, raised a stem", () => {
    const a = lineAbc(ABC, index, { from: 0, to: 3 }, { showMeter: true });
    const b = lineAbc(ABC, index, { from: 3, to: 6 }, { showMeter: false });
    for (const line of [a, b]) {
      expect(line).toContain("%%score (1 2 3)");
      expect(line).toContain("V:3");
    }
    // The same note on both lines (the song's, not the line's), so both reserve the same room.
    const noteOf = (l: string) => l.split("V:3\n")[1]!.trim().split(" ")[0];
    expect(noteOf(a)).toBe(noteOf(b));
    // A note name with an optional length, such as f'/ (a stem's height above the melody's top).
    expect(noteOf(a)).toMatch(/^[a-gA-G][',]*\/?\d*$/);
  });

  it("asks abcjs for the chord size it will really be drawn at", () => {
    const line = lineAbc(ABC, index, { from: 0, to: 6 }, { showMeter: true, chordSize: 24 });
    expect(line).toContain("%%gchordfont Arial 24 bold");
  });
});

describe("section labels written in quotes", () => {
  it("splits words that are not chords from the music, and keeps the chords", async () => {
    const { splitLabels } = await import("../../src/core/song/layoutAbc.ts");
    expect(splitLabels('"Chorus""G"GABc')).toEqual({ music: '"G"GABc', labels: ["Chorus"] });
    expect(splitLabels('"^Verse 2""D7"dcBA')).toEqual({ music: '"D7"dcBA', labels: ["Verse 2"] });
    expect(splitLabels('"@-8,12 Tag" abc')).toEqual({ music: "abc", labels: ["Tag"] });
    expect(splitLabels('"Am7"abc "D/F#"def')).toEqual({
      music: '"Am7"abc "D/F#"def',
      labels: [],
    });
    // Nothing in a label can break the ABC field it is set in.
    expect(splitLabels('"^a]b|c"x').labels).toEqual(["a b c"]);
  });

  it("sets a label as a part label, and does not carry it as a chord or repeat the chord twice", () => {
    const abc = [
      "X:1",
      "T:Test",
      "M:4/4",
      "L:1/4",
      "K:G",
      '"G"GABc|"D"defg|"Verse""G"gfed|cBAG|"C"dcBA|',
      "",
    ].join("\n");
    const index = indexAbc(abc);
    const line = lineAbc(
      abc,
      index,
      { from: 2, to: 5 },
      { showMeter: false, chordEveryMeasure: true },
    );
    const melody = line.split("\n")[line.split("\n").indexOf("V:1") + 1]!;
    expect(melody).toContain("[P:Verse]");
    expect(melody).not.toMatch(/"Verse"|"D""G"|"Verse\nG"/);
    expect(chordsIn(melody)).toEqual(["G", "G", "C"]); // the label is not a chord; no carried D
  });
});
