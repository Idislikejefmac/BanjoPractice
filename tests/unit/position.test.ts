import { describe, expect, it } from "vitest";
import {
  keysKeepingTab,
  planFor,
  plansFor,
  PRACTICAL_CAPO,
} from "../../src/core/banjo/position.ts";
import { OPEN_G, pitchAt } from "../../src/core/banjo/tuning.ts";
import type { Key, Mode } from "../../src/core/music/keys.ts";
import { formatKey, MODES, parseKey } from "../../src/core/music/keys.ts";
import { mod12, pitchClass } from "../../src/core/music/notes.ts";
import { transposeKey } from "../../src/core/music/spelling.ts";

const k = (s: string) => parseKey(s)!;
const G = k("G");

describe("C8 position planner: the spec's table (DEVELOPMENT.md C8)", () => {
  const cases: [string, string, number, string][] = [
    ["G", "G", 0, "No capo"],
    ["A", "G", 2, "Capo 2 · tune 5th string up to A"],
    ["Bb", "G", 3, "Capo 3 · tune 5th string up to B♭"],
    ["B", "G", 4, "Capo 4 · tune 5th string up to B"],
    ["C", "C", 0, "No capo"],
    ["D", "D", 0, "No capo · tune 5th string up to A"],
    ["E", "D", 2, "Capo 2 · tune 5th string up to B"],
    ["F", "C", 5, "Capo 5 · tune 5th string up to C"],
    ["Eb", "D", 1, "Capo 1 · tune 5th string up to B♭"],
    ["AMix", "GMix", 2, "Capo 2 · tune 5th string up to A"],
    ["ADor", "ADor", 0, "No capo"],
    ["BDor", "ADor", 2, "Capo 2 · tune 5th string up to A"],
    ["Em", "Em", 0, "No capo"],
    ["Am", "Am", 0, "No capo"],
  ];
  for (const [sounding, shape, capo, text] of cases) {
    it(`${sounding} → ${shape} shapes, capo ${capo}`, () => {
      const plan = planFor(k(sounding));
      expect(formatKey(plan.shapeKey)).toBe(formatKey(k(shape)));
      expect(plan.capo.capo).toBe(capo);
      expect(plan.instruction).toBe(text);
    });
  }

  it("uses Dad's spikes when he has them", () => {
    expect(planFor(k("A"), { spikes: [7, 9, 10] }).instruction).toBe(
      "Capo 2 · 5th string to A (spike at 7)",
    );
    expect(planFor(k("E"), { spikes: [7, 9, 10] }).instruction).toBe(
      "Capo 2 · 5th string to B (spike at 9)",
    );
  });
});

describe("C8 for every key (12 tonics × 4 modes)", () => {
  const tonics = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  for (const mode of MODES as readonly Mode[]) {
    for (const t of tonics) {
      const sounding: Key = { tonic: parseKey(t)!.tonic, mode };
      it(`${t} ${mode}: capo within the limit, sounds right, says what to do`, () => {
        const plan = planFor(sounding);
        expect(plan.capo.capo).toBeLessThanOrEqual(PRACTICAL_CAPO);
        expect(plan.instruction.length).toBeGreaterThan(0);
        expect(
          mod12(pitchClass(plan.shapeKey.tonic) + plan.capo.capo) -
            mod12(pitchClass(sounding.tonic)),
        ).toBe(0);
        for (const p of plansFor(sounding)) expect(p.capo.capo).toBeLessThanOrEqual(7);
      });
    }
  }
});

describe("C8 with an arrangement", () => {
  it("keeps the tab with a capo of 0–5 on the arrangement's shapes", () => {
    const plan = planFor(k("A"), { arrangementShape: G });
    expect(plan.keepsTab).toBe(true);
    expect(plan.capo.capo).toBe(2);
    // The tab's open 3rd string now sounds a (capo 2).
    expect(pitchAt(OPEN_G, 3, 0, plan.capo)).toBe(57);
    expect(pitchAt(OPEN_G, 5, 0, plan.capo)).toBe(69);
  });

  it("needs a re-arranged tab past capo 5, and offers capo 6–7 as an alternative", () => {
    const plan = planFor(k("D"), { arrangementShape: G });
    expect(plan.keepsTab).toBe(false);
    expect(formatKey(plan.shapeKey)).toBe("D major");
    const alternatives = plansFor(k("D"), { arrangementShape: G });
    expect(alternatives.some((p) => p.keepsTab && p.capo.capo === 7)).toBe(true);
  });

  it("lists the keys a G tab can be played in with a capo", () => {
    const keys = keysKeepingTab(G).map((x) => formatKey(x.key, "ascii"));
    expect(keys).toEqual([
      "G major",
      "Ab major",
      "A major",
      "Bb major",
      "B major",
      "C major",
      "Db major",
      "D major",
    ]);
    expect(
      keysKeepingTab(G).every((x, i) => formatKey(transposeKey(G, i)) === formatKey(x.key)),
    ).toBe(true);
  });
});
