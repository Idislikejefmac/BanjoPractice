// R1 · Notation (DEVELOPMENT.md §4 R1): one display line of melody and chord symbols, drawn by
// abcjs from the layout ABC (src/core/song/layoutAbc.ts), and the measure and slot positions
// R3 needs to draw the tab directly underneath.

import abcjs from "abcjs";
import type { NaturalWidths } from "./lineFit.ts";
import { NOTATION_PAD } from "./lineFit.ts";
import type { MeasureGeometry } from "./tabLayout.ts";

export interface LineMeasureInfo {
  readonly index: number;
  readonly slots: number;
  readonly startRepeat?: boolean;
  readonly endRepeat?: boolean;
  readonly ending?: string;
  readonly barRight?: "single" | "double" | "final";
}

export interface NotationLayout {
  readonly width: number;
  /** How far right the staff and words are actually drawn (px); more than `width` = crowded. */
  readonly drawnWidth: number;
  readonly height: number;
  readonly geometry: MeasureGeometry[];
}

interface AbsElem {
  x: number;
  w: number;
}
interface VoiceElem {
  el_type: string;
  rest?: { type: string };
  abselem?: AbsElem;
}
interface RenderedTune {
  lines: { staff?: { voices: VoiceElem[][] }[] }[];
}

const PAD = NOTATION_PAD;
/**
 * Air abcjs keeps between things it would otherwise set edge to edge, in abcjs units: without
 * it, long words under short notes are drawn touching.
 */
const MIN_PADDING = 4;
/** Half a notehead, in abcjs units: element x is the notehead's left edge, slots are centers. */
const HALF_NOTEHEAD = 4.9;

/** Where a rendered line's slots and closing bar lines are, in abcjs units (before scaling). */
function readLine(tunes: RenderedTune[]): { restX: number[]; barX: number[] } | null {
  const voices = tunes[0]?.lines.find((l) => l.staff)?.staff?.[0]?.voices;
  if (!voices || voices.length < 2) return null;
  const restX = voices[1]!
    .filter((e) => e.el_type === "note" && e.rest?.type === "invisible" && e.abselem)
    .map((e) => e.abselem!.x);
  // Bar lines that close a measure (skip a leading "|:" before any note on the line).
  const barX: number[] = [];
  let notesSince = 0;
  for (const e of voices[0]!) {
    if (e.el_type === "note") notesSince++;
    else if (e.el_type === "bar" && e.abselem) {
      if (notesSince > 0) barX.push(e.abselem.x);
      notesSince = 0;
    }
  }
  return { restX, barX };
}

/**
 * Renders `abc` into `el` so that the staff spans `width` px (CSS) at `scale`, and returns
 * where each measure and slot landed, in the same px coordinates as the rendered SVG. Returns
 * null if abcjs couldn't lay the line out (the caller falls back to evenly spaced tab).
 */
export function renderNotationLine(
  el: HTMLElement,
  abc: string,
  width: number,
  scale: number,
  measures: readonly LineMeasureInfo[],
  onChordTap?: (chord: string) => void,
  /** Set edge to edge, with no air between words: for a measure too wide for the screen. */
  tight = false,
): NotationLayout | null {
  // abcjs takes the staff width and the padding in screen px and divides them by the scale
  // itself. (Dividing here as well made every full line 1/scale too wide: issue found Nov 2026.)
  const staffwidth = Math.max(100, width - 2 * PAD);
  const tunes = abcjs.renderAbc(el, abc, {
    staffwidth,
    scale,
    paddingleft: PAD,
    paddingright: PAD,
    minPadding: tight ? 0 : MIN_PADDING,
    paddingtop: 0,
    paddingbottom: 0,
    add_classes: true,
    clickListener: onChordTap
      ? (abcElem: { chord?: { name: string }[] }) => {
          const chord = abcElem.chord?.[0]?.name;
          if (chord) onChordTap(chord);
        }
      : undefined,
  } as Parameters<typeof abcjs.renderAbc>[2]) as unknown as RenderedTune[];

  const svg = el.querySelector("svg");
  const read = readLine(tunes);
  if (!svg || !read) return null;

  // abcjs coordinates → CSS px: element x times the scale (measured in Chromium and WebKit;
  // guarded by tests/e2e/alignment.spec.ts).
  const rendered = svg.getBoundingClientRect();
  const k = scale;
  // abcjs gives the wrapper a fixed width of its own; it should be the column's width.
  el.style.width = "100%";
  el.style.maxWidth = "100%";
  let drawnRight = rendered.left;
  for (const node of svg.querySelectorAll("path, rect, line, circle, text")) {
    const r = node.getBoundingClientRect();
    if (r.width > 0 && r.right > drawnRight) drawnRight = r.right;
  }

  const restX = read.restX.map((x) => (x + HALF_NOTEHEAD) * k);
  const barX = read.barX.map((x) => x * k);
  const total = measures.reduce((n, m) => n + m.slots, 0);
  if (restX.length !== total || barX.length < measures.length) return null;

  const geometry: MeasureGeometry[] = [];
  let r = 0;
  let left = PAD;
  measures.forEach((m, i) => {
    const slotX = restX.slice(r, r + m.slots);
    r += m.slots;
    const right = barX[i]!;
    geometry.push({
      index: m.index,
      left,
      right,
      slotX,
      ...(m.startRepeat ? { startRepeat: true } : {}),
      ...(m.endRepeat ? { endRepeat: true } : {}),
      ...(m.ending !== undefined ? { ending: m.ending } : {}),
      ...(m.barRight ? { barRight: m.barRight } : {}),
    });
    left = right;
  });

  return {
    width: rendered.width,
    drawnWidth: drawnRight - rendered.left,
    height: rendered.height,
    geometry,
  };
}

/** The ABC measureNotation needs, built by layoutAbc.ts (lineAbc and leadInAbc). */
export interface MeasureAbc {
  /** The whole song as one line, with no time signature. */
  readonly song: string;
  /** Two empty measures: plain, with the time signature, and after a repeat sign. */
  readonly lead: string;
  readonly leadMeter: string;
  readonly leadRepeat: string;
}

/**
 * Measures every measure of a song at abcjs's natural spacing (the spacing it uses when a line
 * has room to spare; words under the notes widen it), by drawing the whole song as one long
 * line in a hidden element. The widths don't depend on where a measure sits on a line, so one
 * drawing serves every screen width and size; the caller scales them. Returns null if abcjs
 * can't lay the song out.
 */
export function measureNotation(
  abc: MeasureAbc,
  measures: readonly LineMeasureInfo[],
): NaturalWidths | null {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden";
  document.body.appendChild(host);
  try {
    const read = (text: string) =>
      readLine(
        abcjs.renderAbc(host, text, {
          // Far wider than the music: abcjs then leaves the line at its natural spacing.
          staffwidth: 2000 * (measures.length + 2),
          scale: 1,
          paddingleft: PAD,
          paddingright: PAD,
          minPadding: MIN_PADDING,
        }) as unknown as RenderedTune[],
      );
    // A line's lead-in: where its first bar line falls, less the width of that measure.
    const leadIn = (text: string) => {
      const bars = read(text)?.barX;
      return bars && bars.length >= 2 ? bars[0]! - (bars[1]! - bars[0]!) - PAD : null;
    };
    const lead = leadIn(abc.lead);
    const meter = leadIn(abc.leadMeter);
    const repeat = leadIn(abc.leadRepeat);
    const bars = read(abc.song)?.barX;
    if (lead === null || meter === null || repeat === null) return null;
    if (bars?.length !== measures.length || bars.some((x) => !Number.isFinite(x))) return null;
    const repeatExtra = Math.max(0, repeat - lead);
    // The first measure's bar line is measured from the page's edge: take the lead-in off.
    const first = bars[0]! - PAD - lead - (measures[0]?.startRepeat ? repeatExtra : 0);
    const widths = bars.map((x, i) => (i === 0 ? Math.max(1, first) : x - bars[i - 1]!));
    return { widths, lead, meterExtra: Math.max(0, meter - lead), repeatExtra };
  } catch {
    return null;
  } finally {
    host.remove();
  }
}
