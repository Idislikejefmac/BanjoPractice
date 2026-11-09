import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRACTICE, readPractice } from "../../src/app/model.ts";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import { arrange } from "../../src/core/banjo/arranger.ts";
import { validate } from "../../src/core/banjo/validator.ts";
import { builtinSong, loadSong } from "../../src/core/song/song.ts";
import { practiceArrangement } from "../../src/core/song/practiceArrangement.ts";

const dir = new URL("../fixtures/songs/", import.meta.url);
const songs = readdirSync(dir)
  .filter((f) => f.endsWith(".abc"))
  .map((f) => ({ id: f.replace(/\.abc$/, ""), abc: readFileSync(new URL(f, dir), "utf8") }));

/** Roll names in a measure's rollName, ignoring "+slur" and the fill endings. */
const rollsIn = (name: string) =>
  name.startsWith("lick:") || name === "tag" ? [] : name.replace("+slur", "").split("+");

describe("choosing which rolls the arranger may use", () => {
  for (const allowed of [["forward", "forward-reverse"], ["forward"]]) {
    for (const s of songs) {
      it(`${s.id}: only ${allowed.join(" and ")} (plus fills), and every join stays legal`, () => {
        const result = arrange(indexAbc(s.abc), { rolls: allowed });
        for (const m of result.arrangement.measures) {
          for (const roll of rollsIn(m.rollName)) expect(allowed).toContain(roll);
        }
        expect(validate(result.arrangement.measures).filter((v) => v.severity === "error")).toEqual(
          [],
        );
      });
    }
  }

  it("uses every roll when none are chosen, and ignores a list it doesn't recognise", () => {
    const idx = indexAbc(songs[0]!.abc);
    const all = arrange(idx).arrangement.measures.map((m) => m.rollName);
    expect(arrange(idx, { rolls: [] }).arrangement.measures.map((m) => m.rollName)).toEqual(all);
    expect(arrange(idx, { rolls: ["nope"] }).arrangement.measures.map((m) => m.rollName)).toEqual(
      all,
    );
  });

  it("still honours a roll set by hand for one measure", () => {
    const idx = indexAbc(songs[0]!.abc);
    const r = arrange(idx, {
      rolls: ["forward"],
      overrides: new Map([[idx.measures[1]!.index, "backward"]]),
    });
    expect(r.arrangement.measures[1]!.rollName.startsWith("backward")).toBe(true);
  });

  it("changes the practice tab to match the chosen rolls", () => {
    const abc = songs.find(
      (s) => s.id === "dark-hollow" || s.id === "will-the-circle-be-unbroken",
    )!;
    const loaded = loadSong(builtinSong("t-roll", abc.abc));
    const everything = practiceArrangement(loaded, 0, [], null).measures!;
    const forwardOnly = practiceArrangement(loaded, 0, [], ["forward"]).measures!;
    const names = (ms: typeof everything) => ms.map((m) => m.rollName).join();
    expect(names(forwardOnly)).not.toBe(names(everything));
    for (const m of forwardOnly)
      for (const roll of rollsIn(m.rollName)) expect(roll).toBe("forward");
  });
});

describe("the per-song roll setting", () => {
  it("defaults to every roll, and older saved settings without it still load", () => {
    expect(DEFAULT_PRACTICE.rolls).toBeNull();
    const older: Record<string, unknown> = { ...DEFAULT_PRACTICE, keyShift: 2 };
    delete older.rolls;
    const read = readPractice(older);
    expect(read.rolls).toBeNull();
    expect(read.keyShift).toBe(2);
  });

  it("keeps a valid list and drops an empty or invalid one", () => {
    expect(readPractice({ ...DEFAULT_PRACTICE, rolls: ["forward"] }).rolls).toEqual(["forward"]);
    expect(readPractice({ ...DEFAULT_PRACTICE, rolls: [] }).rolls).toBeNull();
    expect(readPractice({ ...DEFAULT_PRACTICE, rolls: [3] }).rolls).toBeNull();
  });
});
