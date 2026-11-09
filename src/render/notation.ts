// R1 · Notation (DEVELOPMENT.md §4 R1): one display line of melody and chord symbols, drawn by
// abcjs from the layout ABC (src/core/song/layoutAbc.ts), and the measure and slot positions
// R3 needs to draw the tab directly underneath.

import abcjs from "abcjs";
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

const PAD = 6;
/** Half a notehead, in abcjs units: element x is the notehead's left edge, slots are centers. */
const HALF_NOTEHEAD = 4.9;

/**
 * Renders `abc` into `el` at `width` px (CSS) and `scale`, and returns where each measure and
 * slot landed, in the same px coordinates as the rendered SVG. Returns null if abcjs couldn't
 * lay the line out (the caller falls back to evenly spaced tab).
 */
export function renderNotationLine(
  el: HTMLElement,
  abc: string,
  width: number,
  scale: number,
  measures: readonly LineMeasureInfo[],
  onChordTap?: (chord: string) => void,
): NotationLayout | null {
  const staffwidth = Math.max(100, width / scale - 2 * PAD);
  const tunes = abcjs.renderAbc(el, abc, {
    staffwidth,
    scale,
    paddingleft: PAD,
    paddingright: PAD,
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
  const tune = tunes[0];
  const voices = tune?.lines.find((l) => l.staff)?.staff?.[0]?.voices;
  if (!svg || !voices || voices.length < 2) return null;

  // abcjs coordinates → CSS px: element x times the scale (measured in Chromium and WebKit;
  // guarded by tests/e2e/alignment.spec.ts).
  const rendered = svg.getBoundingClientRect();
  const k = scale;

  const melody = voices[0]!;
  const hidden = voices[1]!;
  const restX = hidden
    .filter((e) => e.el_type === "note" && e.rest?.type === "invisible" && e.abselem)
    .map((e) => (e.abselem!.x + HALF_NOTEHEAD) * k);

  // Bar lines that close a measure (skip a leading "|:" before any note on the line).
  const barX: number[] = [];
  let notesSince = 0;
  for (const e of melody) {
    if (e.el_type === "note") notesSince++;
    else if (e.el_type === "bar" && e.abselem) {
      if (notesSince > 0) barX.push(e.abselem.x * k);
      notesSince = 0;
    }
  }

  const total = measures.reduce((n, m) => n + m.slots, 0);
  if (restX.length !== total || barX.length < measures.length) return null;

  const geometry: MeasureGeometry[] = [];
  let r = 0;
  let left = PAD * k;
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

  return { width: rendered.width, height: rendered.height, geometry };
}
