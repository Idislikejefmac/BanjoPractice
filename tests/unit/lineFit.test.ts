// R3: how many measures go on each display line, so every line fills the column.
import { describe, expect, it } from "vitest";
import { indexAbc } from "../../src/core/song/abcIndex.ts";
import type { LineFit } from "../../src/core/song/layoutAbc.ts";
import { fitLines, leadInAbc, lineAbc, lineNeed } from "../../src/core/song/layoutAbc.ts";
import { lineWidth, notationPage, tabPage } from "../../src/render/lineFit.ts";

interface M {
  index: number;
  startRepeat: boolean;
  endRepeat: boolean;
  barRight: "single" | "double" | "final";
  ending?: string;
}

/** `n` full measures, numbered from 1 (or from 0 with a pickup), the last with a final bar. */
function song(n: number, opts: { pickup?: boolean; marks?: Record<number, Partial<M>> } = {}): M[] {
  const first = opts.pickup ? 0 : 1;
  return Array.from({ length: n + (opts.pickup ? 1 : 0) }, (_, i) => ({
    index: first + i,
    startRepeat: false,
    endRepeat: false,
    barRight: first + i === n ? ("final" as const) : ("single" as const),
    ...opts.marks?.[first + i],
  }));
}

const even = (ms: readonly M[], w = 100): number[] => ms.map((m) => (m.index === 0 ? 30 : w));
const sizes = (lines: readonly { from: number; to: number }[]) => lines.map((l) => l.to - l.from);

describe("fitting measures to lines (R3)", () => {
  it("puts as many measures on a line as fit, and more when the page is wider", () => {
    const ms = song(16);
    const widths = even(ms);
    expect(sizes(fitLines(ms, { widths, room: 250 }))).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
    expect(sizes(fitLines(ms, { widths, room: 420 }))).toEqual([4, 4, 4, 4]);
    expect(sizes(fitLines(ms, { widths, room: 820 }))).toEqual([8, 8]);
    expect(sizes(fitLines(ms, { widths, room: 90 }))).toEqual(new Array(16).fill(1));
  });

  it("covers every measure once, in order, and never overfills a line", () => {
    const ms = song(23, {
      pickup: true,
      marks: { 8: { endRepeat: true }, 16: { barRight: "double" } },
    });
    const widths = ms.map((m, i) => (m.index === 0 ? 40 : 80 + ((i * 37) % 60)));
    for (const room of [150, 260, 333, 480, 700, 1200]) {
      const fit = { widths, room };
      const lines = fitLines(ms, fit);
      expect(lines[0]!.from).toBe(0);
      expect(lines[lines.length - 1]!.to).toBe(ms.length);
      lines.forEach((l, i) => {
        if (i > 0) expect(l.from).toBe(lines[i - 1]!.to);
        expect(l.to).toBeGreaterThan(l.from);
        // (One measure, or the pickup and one measure, is the least a line can hold.)
        const least = l.to - l.from === (ms[l.from]!.index === 0 ? 2 : 1);
        if (!least) expect(lineNeed(ms, fit, l)).toBeLessThanOrEqual(room);
      });
    }
  });

  it("shares measures out evenly instead of leaving a short last line", () => {
    const ms = song(9);
    // Four fit, so three lines are needed: 3 + 3 + 3, not 4 + 4 + 1.
    expect(sizes(fitLines(ms, { widths: even(ms), room: 410 }))).toEqual([3, 3, 3]);
    // Five fit: an eight-measure tune is 4 + 4, not 5 + 3.
    const eight = song(8);
    expect(sizes(fitLines(eight, { widths: even(eight), room: 540 }))).toEqual([4, 4]);
  });

  it("gives a crowded measure the room it needs", () => {
    const ms = song(8);
    const widths = [100, 100, 100, 100, 100, 260, 100, 100];
    const fit = { widths, room: 420 };
    const lines = fitLines(ms, fit);
    for (const l of lines) expect(lineNeed(ms, fit, l)).toBeLessThanOrEqual(420);
    // The wide measure 6 shares its line with fewer neighbours.
    const wide = lines.find((l) => l.from <= 5 && l.to > 5)!;
    expect(wide.to - wide.from).toBeLessThan(4);
  });

  it("keeps a pickup on the first line, even when that line is then too full", () => {
    const ms = song(8, { pickup: true });
    const lines = fitLines(ms, { widths: even(ms), room: 440 });
    expect(lines[0]).toEqual({ from: 0, to: 5 });
    expect(fitLines(ms, { widths: even(ms), room: 110 })[0]).toEqual({ from: 0, to: 2 });
    // A song that is only a pickup still gets its line.
    expect(fitLines(ms.slice(0, 1), { widths: [30], room: 400 })).toEqual([{ from: 0, to: 1 }]);
  });

  it("ends lines with the parts of the tune where that leaves no line half empty", () => {
    // A (6 measures) and B (6 measures); four fit on a line.
    const ms = song(12, { marks: { 6: { endRepeat: true }, 7: { startRepeat: true } } });
    expect(sizes(fitLines(ms, { widths: even(ms), room: 420 }))).toEqual([3, 3, 3, 3]);
    // A second ending is not a new part: it stays on the line with the first.
    const endings = song(8, {
      marks: {
        6: { ending: "1" },
        7: { ending: "1", endRepeat: true },
        8: { ending: "2", barRight: "final" },
      },
    });
    const last = fitLines(endings, { widths: even(endings), room: 420 }).at(-1)!;
    expect(last.to - last.from).toBeGreaterThan(1);
  });

  it("squeezes a line a little when that saves leaving lines much emptier", () => {
    const ms = song(8);
    const widths = even(ms);
    // Four measures need 400 and there is room for 385.
    expect(sizes(fitLines(ms, { widths, room: 385 })).sort()).toEqual([2, 3, 3]);
    const minWidths = widths.map((w) => w * 0.92);
    expect(sizes(fitLines(ms, { widths, minWidths, room: 385 }))).toEqual([4, 4]);
    // Not when the measures can't give that much...
    expect(sizes(fitLines(ms, { widths, minWidths, room: 360 })).sort()).toEqual([2, 3, 3]);
    // ...and lines that fill the page unsqueezed are left as they are.
    expect(sizes(fitLines(ms, { widths, minWidths, room: 410 }))).toEqual([4, 4]);
    expect(sizes(fitLines(ms, { widths, minWidths, room: 450 }))).toEqual([4, 4]);
  });

  it("counts the time signature on the first line and a repeat sign at a line's start", () => {
    const ms = song(8, { marks: { 5: { startRepeat: true } } });
    const fit: LineFit = { widths: even(ms), room: 410, firstLineExtra: 30, repeatExtra: 20 };
    expect(lineNeed(ms, fit, { from: 0, to: 4 })).toBe(430);
    expect(lineNeed(ms, fit, { from: 4, to: 8 })).toBe(420);
    expect(lineNeed(ms, fit, { from: 5, to: 8 })).toBe(300);
    // Four measures fit on a line, but not on the first one with its time signature.
    expect(sizes(fitLines(ms, { widths: even(ms), room: 410 }))).toEqual([4, 4]);
    expect(sizes(fitLines(ms, fit))[0]).toBeLessThan(4);
  });

  it("handles an empty song and a measure wider than the page", () => {
    expect(fitLines([], { widths: [], room: 400 })).toEqual([]);
    const ms = song(3);
    expect(sizes(fitLines(ms, { widths: [100, 900, 100], room: 400 }))).toEqual([1, 1, 1]);
  });
});

describe("the room measures need on the screen", () => {
  const natural = { widths: [60, 250, 300, 250], lead: 50, meterExtra: 20, repeatExtra: 16 };
  const measures = [{ slots: 2 }, { slots: 8 }, { slots: 8 }, { slots: 8 }];

  it("scales abcjs's widths to px and leaves out the clef, key and padding", () => {
    const page = notationPage(natural, measures, 1000, 0.9, 1.1);
    expect(page.widths).toEqual([54, 225, 270, 225]);
    expect(page.fixed).toBeCloseTo(12 + 54 * 0.9);
    expect(page.room).toBeCloseTo(1000 - page.fixed);
    expect(page.firstLineExtra).toBeCloseTo(18);
    expect(page.repeatExtra).toBeCloseTo(14.4);
  });

  it("lets measures squeeze a little, but not ones found too crowded", () => {
    const page = notationPage(natural, measures, 1000, 0.9, 1.1, [2]);
    expect(page.minWidths![1]).toBeCloseTo(225 * 0.92);
    expect(page.minWidths![2]).toBe(270);
  });

  it("never makes a measure narrower than its tab slots need", () => {
    // Sixteenth-note slots: abcjs would set eight of them in 150 units.
    const page = notationPage({ ...natural, widths: [150] }, [{ slots: 8 }], 1000, 0.9, 1.1);
    expect(page.widths[0]).toBeCloseTo(8 * 19 * 1.1);
    expect(page.minWidths![0]).toBeCloseTo(8 * 19 * 1.1);
  });

  it("gives tab-only lines room by their slots, growing with the size setting", () => {
    const small = tabPage(measures, 1000, 1.1);
    expect(small.widths[1]).toBeCloseTo((8 * 24 + 14) * 1.1);
    expect(small.widths[0]).toBeLessThan(small.widths[1]!);
    expect(tabPage(measures, 1000, 1.7).widths[1]).toBeGreaterThan(small.widths[1]!);
    expect(small.room).toBe(960);
  });

  it("draws every line the column's full width, but not a song of one short line", () => {
    const page = notationPage(natural, measures, 1000, 0.9, 1.1);
    expect(lineWidth(page, 300, 1000, false)).toBe(1000);
    expect(lineWidth(page, 900, 1000, true)).toBe(1000);
    expect(lineWidth(page, 200, 1000, true)).toBeLessThan(600);
  });
});

describe("layout ABC for filling and measuring lines", () => {
  const abc = "X:1\nM:3/4\nL:1/8\nK:D\n|:A2 B2 c2|d6:|\n";
  const idx = indexAbc(abc);

  it("asks abcjs to spread a line over the whole staff only when told to", () => {
    const line = { from: 0, to: 2 };
    expect(lineAbc(abc, idx, line, { showMeter: true, fill: true })).toContain("%%stretchlast 1\n");
    expect(lineAbc(abc, idx, line, { showMeter: true })).not.toContain("stretchlast");
  });

  it("builds two empty measures in the song's key and meter for measuring a line's start", () => {
    const plain = leadInAbc(idx, { showMeter: false, startRepeat: false });
    expect(plain).toContain("M:none\n");
    expect(plain).toContain("K:D\n");
    expect(plain).toContain("V:1\nx x x x x x | x x x x x x |\nV:2\nx x x x x x | x x x x x x |\n");
    expect(leadInAbc(idx, { showMeter: true, startRepeat: true })).toContain("M:3/4\n");
    expect(leadInAbc(idx, { showMeter: true, startRepeat: true })).toContain("V:1\n|:x x");
  });
});
