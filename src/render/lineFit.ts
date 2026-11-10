// R3 · How much room each measure needs on the screen, for the line fitter in
// src/core/song/layoutAbc.ts (fitLines). Pure: numbers in, numbers out.

import type { LineFit } from "../core/song/layoutAbc.ts";

/** Padding left and right of the notation staff, in CSS px. */
export const NOTATION_PAD = 6;
/** A line may be drawn this much tighter than abcjs's natural spacing to fit one more measure. */
export const SQUEEZE = 0.92;
/** A song of one short line is stretched at most this many times its natural width. */
export const MAX_STRETCH = 2;
/** Least distance between tab slots, in tab units: a finger badge (17) and a little air. */
const MIN_SLOT = 19;
/** Tab-only view: comfortable slot distance and the room a bar line takes, in tab units. */
const TAB_SLOT = 24;
const TAB_BAR = 14;
/** Tab-only view: room kept for the TAB label and the right edge, in px. */
const TAB_EDGES = 40;
/** abcjs units kept free at the end of a line for the closing bar line. */
const LINE_END = 4;

/** How wide the song's measures are at abcjs's natural spacing, in abcjs units (px ÷ scale). */
export interface NaturalWidths {
  /** Each measure's width, bar line to bar line, by position in the song. */
  readonly widths: readonly number[];
  /** What comes before the first measure of a line: the clef and key signature. */
  readonly lead: number;
  /** The time signature on the first line. */
  readonly meterExtra: number;
  /** A repeat sign at the start of a line. */
  readonly repeatExtra: number;
}

export interface PageFit extends LineFit {
  /** Width of a line apart from its measures (px): padding, clef, key signature. */
  readonly fixed: number;
}

/**
 * Notation with the tab under it: measures as wide as abcjs draws them at natural spacing
 * (`natural`, × `notationScale` for px), and never so narrow that the tab's finger badges
 * (drawn at `tabScale`) would touch. `rigid` lists measures found too crowded to squeeze.
 */
export function notationPage(
  natural: NaturalWidths,
  measures: readonly { readonly slots: number }[],
  width: number,
  notationScale: number,
  tabScale: number,
  rigid: readonly number[] = [],
): PageFit {
  const fixed = 2 * NOTATION_PAD + (natural.lead + LINE_END) * notationScale;
  const floor = measures.map((m) => m.slots * MIN_SLOT * tabScale);
  const widths = natural.widths.map((w, i) => Math.max(w * notationScale, floor[i] ?? 0));
  return {
    widths,
    minWidths: widths.map((w, i) =>
      rigid.includes(i) ? w : Math.max(natural.widths[i]! * notationScale * SQUEEZE, floor[i] ?? 0),
    ),
    room: width - fixed,
    firstLineExtra: natural.meterExtra * notationScale,
    repeatExtra: natural.repeatExtra * notationScale,
    fixed,
  };
}

/** Tab-only view: every slot the same width (evenGeometry), so a measure needs its slots. */
export function tabPage(
  measures: readonly { readonly slots: number }[],
  width: number,
  tabScale: number,
): PageFit {
  return {
    widths: measures.map((m) => (m.slots * TAB_SLOT + TAB_BAR) * tabScale),
    room: width - TAB_EDGES,
    fixed: TAB_EDGES,
  };
}

/**
 * How wide to draw a line whose measures need `need` px: the whole column, so every line ends
 * at the same right edge. Only a song that is a single short line (a one-measure exercise on a
 * wide screen) stops short, so it isn't stretched out of shape.
 */
export function lineWidth(page: PageFit, need: number, width: number, onlyLine: boolean): number {
  return onlyLine ? Math.min(width, Math.ceil((page.fixed + need) * MAX_STRETCH)) : width;
}
