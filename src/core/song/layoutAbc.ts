// R3 support (pure): split a song into display lines and build the ABC abcjs renders for each.
//
// Spike S2 result: abcjs spaces a measure by how many notes it holds, so a measure with one
// long note would be too narrow for 8 tab slots. Adding a hidden second voice of invisible
// rests, one per slot, makes abcjs space every measure for its slots, and the rests' x
// positions are exactly where the tab's slots go. Melody notes land on the same x as the rest
// at their slot (checked in tests/e2e/alignment.spec.ts).
//
// The app chooses the line breaks and renders one line at a time, so each line of notation
// can have its line of tab directly underneath.

import type { IndexedMeasure, SongIndex } from "./abcIndex.ts";

export interface DisplayLine {
  /** Positions in SongIndex.measures: from (inclusive) to (exclusive). */
  readonly from: number;
  readonly to: number;
}

/**
 * Line breaks: `perLine` full measures per line. A pickup rides along with the first line,
 * and a line also ends after a repeat sign or final bar so parts start on a new line when
 * that doesn't leave a line less than half full.
 */
export function lineBreaks(measures: readonly IndexedMeasure[], perLine: number): DisplayLine[] {
  const per = Math.max(1, Math.floor(perLine));
  const lines: DisplayLine[] = [];
  let from = 0;
  let count = 0;
  for (let i = 0; i < measures.length; i++) {
    const m = measures[i]!;
    if (m.index !== 0) count++;
    const sectionEnd = m.endRepeat || m.barRight !== "single";
    const isLast = i === measures.length - 1;
    if (isLast || count >= per || (sectionEnd && count >= Math.ceil(per / 2))) {
      lines.push({ from, to: i + 1 });
      from = i + 1;
      count = 0;
    }
  }
  return lines;
}

function cleanMusic(text: string): string {
  return text
    .replace(/%[^\n]*/g, "") // comments
    .replace(/\\\s*\n/g, " ") // line continuations
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function glyph(m: IndexedMeasure): string {
  return m.barRight === "final" ? "|]" : m.barRight === "double" ? "||" : "|";
}

/** Bar line between two measures on the same line, with repeat dots and ending number. */
function between(a: IndexedMeasure, b: IndexedMeasure): string {
  let bar: string;
  if (a.endRepeat && b.startRepeat) bar = ":|:";
  else if (a.endRepeat) bar = ":|";
  else if (b.startRepeat) bar = "|:";
  else bar = glyph(a);
  return b.ending !== undefined ? `${bar}[${b.ending} ` : `${bar} `;
}

/** ABC length suffix for `ratio` default note lengths: 1 → "", 2 → "2", ½ → "/", ¼ → "//". */
function lengthSuffix(ratio: number): string {
  if (Math.abs(ratio - 1) < 1e-9) return "";
  if (Number.isInteger(ratio)) return String(ratio);
  for (let den = 2; den <= 64; den *= 2) {
    const num = ratio * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      const n = Math.round(num);
      if (n === 1) return den === 2 ? "/" : den === 4 ? "//" : `/${den}`;
      return `${n}/${den}`;
    }
  }
  return "";
}

export interface LineAbcOptions {
  /** Show the time signature (first line only, as printed music does). */
  showMeter: boolean;
}

/** Hidden-voice rests: one invisible rest per slot. */
function slotRests(m: IndexedMeasure, index: SongIndex): string {
  const len = lengthSuffix(index.rollUnit / index.unitLength);
  return Array.from({ length: m.slots }, () => `x${len}`).join(" ");
}

/** The ABC for one display line: the melody voice plus the hidden slot voice. */
export function lineAbc(
  abc: string,
  index: SongIndex,
  line: DisplayLine,
  opts: LineAbcOptions,
): string {
  const ms = index.measures.slice(line.from, line.to);
  if (ms.length === 0) return "";
  const keyLine = index.headerLines.find((l) => l.startsWith("K:")) ?? "K:C";
  const meter = opts.showMeter ? `M:${index.meter.num}/${index.meter.den}` : "M:none";
  const unit = index.headerLines.find((l) => l.startsWith("L:")) ?? "L:1/8";

  const first = ms[0]!;
  let melody =
    (first.startRepeat ? "|:" : "") + (first.ending !== undefined ? `[${first.ending} ` : "");
  let slots = "";
  ms.forEach((m, i) => {
    melody += cleanMusic(abc.slice(m.startChar, m.contentEnd));
    slots += slotRests(m, index);
    const next = ms[i + 1];
    if (next) {
      melody += ` ${between(m, next)}`;
      slots += " | ";
    } else {
      melody += m.endRepeat ? " :|" : ` ${glyph(m)}`;
      slots += m.barRight === "final" ? " |]" : " |";
    }
  });

  return ["X:1", meter, unit, "%%score (1 2)", keyLine, "V:1", melody, "V:2", slots, ""].join("\n");
}
