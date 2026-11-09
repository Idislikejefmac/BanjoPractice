import { readdirSync, readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseKey } from "../../src/core/music/keys.ts";
import { transposeKey } from "../../src/core/music/spelling.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { transposeAbc } from "../../src/core/song/transposeAbc.ts";

const k = (s: string) => parseKey(s)!;
const dir = new URL("../../songs/", import.meta.url);
const songs = readdirSync(dir)
  .filter((f) => f.endsWith(".abc"))
  .map((f) => readFileSync(new URL(f, dir), "utf8"));

const midis = (abc: string) => indexAbc(abc).measures.flatMap((m) => m.melody.map((n) => n.midi));
const chords = (abc: string) => indexAbc(abc).measures.flatMap((m) => m.chords.map((c) => c.chord));

describe("C1 ABC transposition", () => {
  it("moves every pitch by the interval and re-spells the key and chords", () => {
    const abc = 'X:1\nM:4/4\nL:1/8\nK:G\n"G"d2 dB "D7"AG ^FE|"C"c8|]';
    const t = transposeAbc(abc, 2, k("A"));
    expect(t.abc).toMatch(/^K:A$/m);
    expect(midis(t.abc)).toEqual(midis(abc).map((m) => m! + 2));
    expect(chords(t.abc)).toEqual(["A", "E7", "D"]);
  });

  it("spells flat keys with flats (B♭, not A♯)", () => {
    const t = transposeAbc('X:1\nM:4/4\nL:1/8\nK:G\n"G"GABc d2 "D"D2|]', 3, k("Bb"));
    expect(t.abc).toMatch(/^K:Bb$/m);
    expect(t.abc).toContain('"Bb"');
    expect(t.abc).not.toMatch(/\^/); // no sharps written: the key signature covers B♭ and E♭
  });

  it("writes a natural or accidental only where the new key signature needs one", () => {
    // In G, F natural needs "=F"; up a tone in A that is G natural, which needs "=G". The next measure's F♯ becomes G♯, which A major's key signature already gives.
    const t = transposeAbc("X:1\nM:4/4\nL:1/8\nK:G\n=F2 F2 E4|F8|]", 2, k("A"));
    expect(t.abc.split("\n").pop()).toBe("=G2 G2 F4|G8|]");
  });

  it("transposes the built-in songs to every capo key and back without changing a pitch", () => {
    for (const abc of songs) {
      const from = indexAbc(abc).key;
      for (let semis = 1; semis <= 7; semis++) {
        const up = transposeAbc(abc, semis, transposeKey(from, semis));
        expect(midis(up.abc)).toEqual(midis(abc).map((m) => (m === null ? null : m + semis)));
        expect(indexAbc(up.abc).measures.map((m) => m.chords.length)).toEqual(
          indexAbc(abc).measures.map((m) => m.chords.length),
        );
        const back = transposeAbc(up.abc, -semis, from);
        expect(midis(back.abc)).toEqual(midis(abc));
        expect(chords(back.abc)).toEqual(chords(abc));
      }
    }
  });

  it("round-trips random melodies (property)", () => {
    const note = fc.constantFrom(
      "C",
      "D",
      "E",
      "F",
      "G",
      "A",
      "B",
      "c",
      "d",
      "e",
      "^F",
      "_B",
      "=c",
      "g",
    );
    fc.assert(
      fc.property(
        fc.array(note, { minLength: 8, maxLength: 8 }),
        fc.integer({ min: -6, max: 6 }),
        (notes, semis) => {
          const abc = `X:1\nM:4/4\nL:1/8\nK:D\n${notes.join("")}|]`;
          const to = transposeKey(k("D"), semis);
          const t = transposeAbc(abc, semis, to);
          expect(midis(t.abc)).toEqual(midis(abc).map((m) => m! + semis));
        },
      ),
    );
  });
});
