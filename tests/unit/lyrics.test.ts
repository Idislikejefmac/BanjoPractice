import abcjs from "abcjs";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { lineAbc, lineBreaks, lyricLines } from "../../src/core/song/layoutAbc.ts";
import { evenGeometry, layoutTabLine } from "../../src/render/tabLayout.ts";
import { tab } from "../helpers/tab.ts";

const ABC = `X:1
M:4/4
L:1/8
K:G
P:A
"G"B2 B2 AG ED|"C"G2 GA B2 Bc|
w:Go-in' up Crip-ple Creek, go-in' in a run,_
w:I got a gal at the head of the creek, go up
P:B
"G"d8|]
w:fun
`;

describe("lyrics", () => {
  const idx = indexAbc(ABC);

  it("keeps each note's syllable for every verse", () => {
    expect(idx.verses).toBe(2);
    const m1 = idx.measures[0]!.melody;
    expect(m1.map((n) => n.lyrics?.[0])).toEqual(["Go-", "in'", "up", "Crip-", "ple", "Creek,"]);
    expect(m1[0]!.lyrics?.[1]).toBe("I");
  });

  it("writes the words under each display line, realigned at every bar", () => {
    const lines = lineBreaks(idx.measures, 2);
    const first = lineAbc(ABC, idx, lines[0]!, { showMeter: true, showLyrics: true });
    expect(first).toContain("w:Go-in' up Crip-ple Creek, | go-in' in a run, _");
    expect(first).toContain("w:I got a gal at the | head of the creek, go up");
    expect(lineAbc(ABC, idx, lines[0]!, { showMeter: true, showLyrics: false })).not.toContain(
      "w:",
    );
    // The rebuilt line still indexes to the same notes.
    const again = indexAbc(
      first
        .replace(/V:2[\s\S]*$/, "")
        .replace("%%score (1 2)\n", "")
        .replace("V:1\n", ""),
    );
    expect(again.measures[0]!.melody.map((n) => n.lyrics?.[0])).toEqual(
      idx.measures[0]!.melody.map((n) => n.lyrics?.[0]),
    );
  });

  // Regression: field lines between measures (w:, P:) leaked into the music text of the
  // per-line layout ABC, garbling the notation (found while adding lyrics).
  it("never copies field lines into the music text", () => {
    for (const [i, line] of lineBreaks(idx.measures, 2).entries()) {
      const music = lineAbc(ABC, idx, line, { showMeter: i === 0 }).split("\n")[6]!;
      expect(music).not.toMatch(/[A-Za-z]:/);
    }
  });

  // Regression (found with Head Over Heels, Roll in My Sweet Baby's Arms, The Long Black
  // Veil): a verse that has words only in an ending was read as verse 1, because abcjs stops
  // adding blanks once a w: line's words run out.
  it("keeps a later verse's words in that verse when only an ending has them", () => {
    const abc = [
      "X:1",
      "M:4/4",
      "L:1/8",
      "K:G",
      "G4 A4|[1 B4 c4:|[2 d4 e4|]",
      "w:one two|*",
      "w:*|three four",
    ];
    const two = indexAbc(abc.join("\n"));
    const sung = two.measures.map((m) => m.melody.map((n) => n.lyrics ?? null));
    expect(sung[0]).toEqual([
      ["one", ""],
      ["two", ""],
    ]);
    expect(sung[1]).toEqual([
      ["", "three"],
      ["", "four"],
    ]);
    expect(sung[2]).toEqual([null, null]);
  });

  // Sheet music puts no word under a note tied from the previous one, and our w: lines are
  // written that way. abcjs itself gives the tied-to note the next word (found when checking
  // HANDOFF.md's tie rule), so the index moves the words back onto the next new note.
  describe("tied notes take no syllable", () => {
    const TIED = "X:1\nM:4/4\nL:1/8\nK:G\nG4 G4-|G4 A4|\nw:a b|c\n";
    const words = (abc: string) =>
      indexAbc(abc).measures.map((m) =>
        m.melody.filter((n) => n.midi !== null).map((n) => n.lyrics?.[0] ?? ""),
      );

    it("puts the word after a tie on the next new note, not the tied one", () => {
      expect(words(TIED)).toEqual([
        ["a", "b"],
        ["", "c"],
      ]);
      expect(indexAbc(TIED).measures[1]!.melody[0]!.tiedFromPrevious).toBe(true);
    });

    it("carries words past the bar when the line has no | to resync", () => {
      const flow = "X:1\nM:4/4\nL:1/8\nK:G\nG4 G4-|G4 A4|B8|\nw:a b c d\n";
      expect(words(flow)).toEqual([["a", "b"], ["", "c"], ["d"]]);
    });

    it("leaves every verse in step, and the rebuilt display lines agree with abcjs", () => {
      const two = "X:1\nM:4/4\nL:1/8\nK:G\nG4 G4-|G4 A4|\nw:a b|c\nw:d e|f\n";
      const idx = indexAbc(two);
      expect(idx.measures[1]!.melody.map((n) => n.lyrics)).toEqual([undefined, ["c", "f"]]);
      const lines = lyricLines(idx.measures, idx.verses);
      expect(lines).toEqual(["w:a b | * c", "w:d e | * f"]);
      // abcjs, which draws the rebuilt lines, puts every word on the notes the index says.
      const rebuilt = ["X:1", "M:4/4", "L:1/8", "K:G", "G4 G4-|G4 A4|", ...lines].join("\n");
      const parsed = abcjs.parseOnly(rebuilt) as unknown as {
        lines: { staff?: { voices: { el_type: string; lyric?: { syllable: string }[] }[][] }[] }[];
      }[];
      const drawn = parsed[0]!.lines
        .flatMap((l) => l.staff?.[0]?.voices[0] ?? [])
        .filter((el) => el.el_type === "note")
        .map((el) => el.lyric?.map((l) => l.syllable) ?? []);
      expect(drawn).toEqual([
        ["a", "d"],
        ["b", "e"],
        ["", ""],
        ["c", "f"],
      ]);
    });
  });

  it("skips notes without a syllable and leaves silent verses out", () => {
    const only = indexAbc("X:1\nM:4/4\nL:1/8\nK:G\nG2 A2 B2 c2|\nw:la * la\n");
    expect(lyricLines(only.measures, only.verses)).toEqual(["w:la * la *"]);
    const none = indexAbc("X:1\nM:4/4\nL:1/8\nK:G\nG8|]");
    expect(none.verses).toBe(0);
    expect(lyricLines(none.measures, 1)).toEqual([]);
  });

  it("prints the words under the tab in the tab-only view", () => {
    const measures = tab("m1 G x | 3:0T* 2:0I 1:0M 5:0T 2:0I 1:0M 5:0T 1:0M |");
    const geometry = evenGeometry(measures, 600, 30);
    const p = layoutTabLine(measures, geometry, 600, {
      scale: 1,
      showRollNames: false,
      showAccents: false,
      showChords: true,
      fretNumbering: "actual",
      showMeasureNumber: false,
      lyrics: [
        { measure: 1, slot: 0, verse: 0, text: "Go-" },
        { measure: 1, slot: 4, verse: 1, text: "I" },
      ],
    });
    expect(p.lyricTexts.map((t) => t.text)).toEqual(["Go-", "I"]);
    expect(p.lyricTexts[0]!.x).toBeCloseTo(geometry[0]!.slotX[0]!);
    expect(p.lyricTexts[1]!.y).toBeGreaterThan(p.lyricTexts[0]!.y);
    expect(p.lyricTexts[0]!.y).toBeGreaterThan(p.stringY[4]!);
  });

  it("the built-in songs with words have them on every sung note of their chorus", () => {
    const circle = indexAbc(
      readFileSync(
        new URL("../fixtures/songs/will-the-circle-be-unbroken.abc", import.meta.url),
        "utf8",
      ),
    );
    const sung = circle.measures.flatMap((m) => m.melody.filter((n) => n.midi !== null));
    expect(sung.every((n) => (n.lyrics?.[0] ?? "") !== "")).toBe(true);
  });
});
