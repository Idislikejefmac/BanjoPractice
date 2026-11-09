// R2 · Tab layout (DEVELOPMENT.md §4 R2), pure: measures + slot positions in, drawing
// primitives out. TabSvg.tsx turns the primitives into SVG. Conventions from guide §10:
// top line = string 1, fret numbers on the lines, melody bold, a finger badge (T/I/M) under
// every picked note, slur arcs with labels, stems and beams from durationSlots.

import { rollById } from "../core/banjo/rolls.ts";
import type { CapoPlan } from "../core/banjo/tuning.ts";
import { actualFret, NO_CAPO } from "../core/banjo/tuning.ts";
import type { ArrangedMeasure, Finger, StringNo, TabNote, Technique } from "../core/banjo/types.ts";
import type { FretNumbering } from "../app/model.ts";

export interface MeasureGeometry {
  /** Written measure number. */
  readonly index: number;
  /** Left and right edges (bar lines) in px. */
  readonly left: number;
  readonly right: number;
  /** x of each slot's center. */
  readonly slotX: readonly number[];
  readonly startRepeat?: boolean;
  readonly endRepeat?: boolean;
  readonly ending?: string;
  readonly barRight?: "single" | "double" | "final";
}

export interface TabLayoutOptions {
  /** Size multiplier (F22). */
  readonly scale: number;
  readonly showRollNames: boolean;
  readonly showAccents: boolean;
  /** Show chord names above the tab (tab-only view, where there is no notation). */
  readonly showChords: boolean;
  readonly fretNumbering: FretNumbering;
  readonly plan?: CapoPlan;
  /** Show the measure number at the start of the line. */
  readonly showMeasureNumber: boolean;
  /** Where the staff lines start, if left of the first measure (room for the TAB label). */
  readonly lineStart?: number;
  /** Lyrics to print under the tab (tab-only view): one row per verse, at slots. */
  readonly lyrics?: readonly {
    readonly measure: number;
    readonly slot: number;
    readonly verse: number;
    readonly text: string;
  }[];
}

export interface TabText {
  readonly x: number;
  readonly y: number;
  readonly text: string;
}

export interface FretGlyph extends TabText {
  readonly melody: boolean;
  readonly measure: number;
  readonly slot: number;
  readonly string: StringNo;
}

export interface Badge {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly finger: Finger;
  readonly measure: number;
  readonly slot: number;
}

export interface Slur {
  /** SVG path for the arc. */
  readonly d: string;
  readonly label: TabText;
}

export interface Stem {
  readonly x: number;
  readonly y1: number;
  readonly y2: number;
}

export interface TabPrimitives {
  readonly width: number;
  readonly height: number;
  /** y of strings 1..5 (index 0 = string 1). */
  readonly stringY: readonly number[];
  readonly lineLeft: number;
  readonly lineRight: number;
  readonly bars: readonly { x: number; thick: boolean }[];
  readonly repeatDots: readonly { x: number; y: number; r: number }[];
  readonly frets: readonly FretGlyph[];
  readonly badges: readonly Badge[];
  readonly slurs: readonly Slur[];
  readonly stems: readonly Stem[];
  readonly beams: readonly { x1: number; x2: number; y: number; h: number }[];
  readonly rests: readonly TabText[];
  readonly accents: readonly TabText[];
  readonly rollLabels: readonly TabText[];
  readonly chordLabels: readonly TabText[];
  readonly endingLabels: readonly TabText[];
  readonly measureNumber: TabText | null;
  readonly lyricTexts: readonly TabText[];
  /** Each measure's box, for highlighting and taps. */
  readonly measureBoxes: readonly { index: number; x: number; width: number }[];
  readonly fontSize: number;
  readonly melodyFontSize: number;
}

const SLUR_LABEL: Readonly<Record<Technique, string>> = {
  pick: "",
  hammer: "h",
  pull: "p",
  "slide-up": "sl",
  "slide-down": "sl",
  choke: "ch",
};

/** Friendly label for a roll name: "forward" → "Forward", "lick:pull-off" → "Lick: pull-off". */
export function rollLabel(name: string): string {
  return name
    .split("+")
    .map((part) => {
      if (part.startsWith("lick:")) return `lick: ${part.slice(5).replace(/-/g, " ")}`;
      if (part === "tag") return "tag";
      const roll = rollById(part === "alt-thumb" ? "alternating-thumb" : part);
      return roll ? roll.name : part.replace(/-/g, " ");
    })
    .join(" + ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Where a slot's notes are drawn: pinches share one x. */
function notesBySlot(m: ArrangedMeasure): Map<number, TabNote[]> {
  const out = new Map<number, TabNote[]>();
  for (const n of m.notes) {
    const list = out.get(n.slot) ?? [];
    list.push(n);
    out.set(n.slot, list);
  }
  return out;
}

export function layoutTabLine(
  measures: readonly ArrangedMeasure[],
  geometry: readonly MeasureGeometry[],
  width: number,
  opts: TabLayoutOptions,
): TabPrimitives {
  const u = opts.scale;
  const plan = opts.plan ?? NO_CAPO;
  const gap = 13 * u;
  const fontSize = 12.5 * u;
  const melodyFontSize = 15 * u;
  const topRows = (opts.showRollNames ? 15 * u : 0) + (opts.showChords ? 17 * u : 0) + 12 * u;
  const stringY = [0, 1, 2, 3, 4].map((i) => topRows + i * gap);
  const bottom = stringY[4]!;
  const badgeR = 8.5 * u;
  const badgeY = bottom + 15 * u;
  const badgeRow = 2 * badgeR + 3 * u;
  const stemLen = 14 * u;

  const lineLeft = opts.lineStart ?? geometry[0]?.left ?? 0;
  const lineRight = geometry[geometry.length - 1]?.right ?? width;

  const bars: { x: number; thick: boolean }[] = [{ x: lineLeft, thick: false }];
  const repeatDots: { x: number; y: number; r: number }[] = [];
  const frets: FretGlyph[] = [];
  const badges: Badge[] = [];
  const slurs: Slur[] = [];
  // Stem-area items are collected as x positions; their y is set once the badge rows are known.
  const stemXs: number[] = [];
  const beamXs: { x1: number; x2: number }[] = [];
  const restXs: number[] = [];
  const accents: TabText[] = [];
  const rollLabels: TabText[] = [];
  const chordLabels: TabText[] = [];
  const endingLabels: TabText[] = [];
  const measureBoxes: { index: number; x: number; width: number }[] = [];
  let maxBadgeRows = 1;

  // Last drawn note per string, for slur arcs that start in the previous measure.
  const lastOnString = new Map<StringNo, { x: number }>();
  const dotYs = [(stringY[1]! + stringY[2]!) / 2, (stringY[2]! + stringY[3]!) / 2];

  measures.forEach((m, mi) => {
    const g = geometry[mi];
    if (!g) return;
    measureBoxes.push({ index: m.index, x: g.left, width: g.right - g.left });
    const thick = g.barRight === "final";
    bars.push({ x: g.right, thick });
    if (thick || g.barRight === "double") bars.push({ x: g.right - 4 * u, thick: false });
    if (g.endRepeat) for (const y of dotYs) repeatDots.push({ x: g.right - 7 * u, y, r: 2 * u });
    if (g.startRepeat) {
      // At the start of a line the repeat sign goes after the TAB label, as in notation.
      const x = mi === 0 ? Math.max(g.left, lineLeft + 16 * u) : g.left;
      if (mi === 0) bars.push({ x, thick: true }, { x: x + 4 * u, thick: false });
      for (const y of dotYs) repeatDots.push({ x: x + 9 * u, y, r: 2 * u });
    }
    if (g.ending !== undefined) {
      endingLabels.push({ x: g.left + 4 * u, y: topRows - 3 * u, text: `${g.ending}.` });
    }

    if (opts.showRollNames && m.rollName) {
      rollLabels.push({ x: g.left + 5 * u, y: 11 * u, text: rollLabel(m.rollName) });
    }
    if (opts.showChords) {
      for (const c of m.chords) {
        const x = g.slotX[c.atSlot] ?? g.left;
        chordLabels.push({ x, y: (opts.showRollNames ? 15 * u : 0) + 13 * u, text: c.chord });
      }
    }

    const bySlot = notesBySlot(m);
    const slotStarts: { slot: number; x: number; dur: number }[] = [];
    for (let slot = 0; slot < m.slots; slot++) {
      const x = g.slotX[slot];
      if (x === undefined) continue;
      const notes = bySlot.get(slot);
      if (!notes || notes.length === 0) continue;
      const dur = Math.max(...notes.map((n) => n.durationSlots));
      slotStarts.push({ slot, x, dur });

      const picked = notes.filter((n) => n.technique === "pick" && n.finger !== null);
      // Badges: highest string first, stacked downwards for pinches.
      picked
        .slice()
        .sort((a, b) => a.string - b.string)
        .forEach((n, row) => {
          badges.push({
            x,
            y: badgeY + row * badgeRow,
            r: badgeR,
            finger: n.finger!,
            measure: m.index,
            slot,
          });
          maxBadgeRows = Math.max(maxBadgeRows, row + 1);
        });

      for (const n of notes) {
        const y = stringY[n.string - 1]!;
        const shown = opts.fretNumbering === "actual" ? actualFret(n.string, n.fret, plan) : n.fret;
        frets.push({
          x,
          y,
          text: String(shown),
          melody: n.isMelody,
          measure: m.index,
          slot,
          string: n.string,
        });
        if (n.technique !== "pick") {
          const from = lastOnString.get(n.string);
          const x1 = from ? from.x : x - 18 * u;
          const top = stringY[0]! - 6 * u;
          const yArc = Math.min(y - 7 * u, top + 4 * u);
          const mid = (x1 + x) / 2;
          slurs.push({
            d: `M ${x1 + 3 * u} ${yArc} Q ${mid} ${yArc - 9 * u} ${x - 3 * u} ${yArc}`,
            label: { x: mid, y: yArc - 7 * u, text: SLUR_LABEL[n.technique] },
          });
        }
        if (opts.showAccents && n.isAccent) {
          accents.push({ x, y: stringY[0]! - 9 * u, text: ">" });
        }
        lastOnString.set(n.string, { x });
      }
    }

    // Silent slots: a small rest in the stem area.
    const covered = new Set<number>();
    for (const n of m.notes) for (let s = n.slot; s < n.slot + n.durationSlots; s++) covered.add(s);
    for (let slot = 0; slot < m.slots; slot++) {
      const x = g.slotX[slot];
      if (!covered.has(slot) && x !== undefined) {
        restXs.push(x);
      }
    }

    // Stems for every note start; eighths (1 slot) beamed in groups of 4 slots.
    for (const s of slotStarts) stemXs.push(s.x);
    for (let group = 0; group < m.slots; group += 4) {
      const eighths = slotStarts.filter(
        (s) => s.slot >= group && s.slot < group + 4 && s.dur === 1,
      );
      // Beam runs of adjacent eighths.
      let run: typeof eighths = [];
      const flush = () => {
        if (run.length >= 2) {
          beamXs.push({ x1: run[0]!.x, x2: run[run.length - 1]!.x });
        } else if (run.length === 1) {
          // A lone eighth gets a short flag-like beam stub.
          const x = run[0]!.x;
          beamXs.push({ x1: x, x2: x + 6 * u });
        }
        run = [];
      };
      for (const e of eighths) {
        const prev = run[run.length - 1];
        if (prev && e.slot !== prev.slot + 1) flush();
        run.push(e);
      }
      flush();
    }
  });

  const stemTop = badgeY + badgeR + (maxBadgeRows - 1) * badgeRow + 4 * u;
  const stemBottom = stemTop + stemLen;
  const stems: Stem[] = stemXs.map((x) => ({ x, y1: stemTop, y2: stemBottom }));
  const beams = beamXs.map((b) => ({ ...b, y: stemBottom - 3 * u, h: 3 * u }));
  const rests: TabText[] = restXs.map((x) => ({ x, y: stemTop + stemLen * 0.7, text: "𝄾" }));
  // Lyrics, one row per verse, under the stems (tab-only view).
  const lyricTop = stemBottom + 14 * u;
  const lyricTexts: TabText[] = [];
  let verses = 0;
  for (const l of opts.lyrics ?? []) {
    const g = geometry.find((x) => x.index === l.measure);
    const x = g?.slotX[l.slot];
    if (x === undefined) continue;
    verses = Math.max(verses, l.verse + 1);
    lyricTexts.push({ x, y: lyricTop + l.verse * 15 * u, text: l.text });
  }
  const height = stemBottom + 8 * u + verses * 15 * u + (verses ? 6 * u : 0);

  const first = measures[0];
  return {
    width,
    height,
    stringY,
    lineLeft,
    lineRight,
    bars,
    repeatDots,
    frets,
    badges,
    slurs,
    stems,
    beams,
    rests,
    accents,
    rollLabels,
    chordLabels,
    endingLabels,
    measureNumber:
      opts.showMeasureNumber && first && first.index > 0
        ? { x: lineLeft + 2 * u, y: stringY[0]! - 4 * u, text: String(first.index) }
        : null,
    measureBoxes,
    fontSize,
    melodyFontSize,
    lyricTexts,
  };
}

/** Even slot positions for the tab-only view (no notation to align with). */
export function evenGeometry(
  measures: readonly {
    index: number;
    slots: number;
    startRepeat?: boolean;
    endRepeat?: boolean;
    ending?: string;
    barRight?: "single" | "double" | "final";
  }[],
  width: number,
  leftPad: number,
  slotsPerFullMeasure = 8,
): MeasureGeometry[] {
  // Pickups take their own width; full measures share the rest evenly.
  const totalSlots = measures.reduce((n, m) => n + Math.min(m.slots, slotsPerFullMeasure), 0);
  const usable = width - leftPad - 2;
  const slotW = usable / Math.max(totalSlots, 1);
  let x = leftPad;
  return measures.map((m) => {
    const left = x;
    const slotX = Array.from({ length: m.slots }, (_, i) => left + (i + 0.5) * slotW);
    x += m.slots * slotW;
    return {
      index: m.index,
      left,
      right: x,
      slotX,
      ...(m.startRepeat ? { startRepeat: true } : {}),
      ...(m.endRepeat ? { endRepeat: true } : {}),
      ...(m.ending !== undefined ? { ending: m.ending } : {}),
      ...(m.barRight ? { barRight: m.barRight } : {}),
    };
  });
}
