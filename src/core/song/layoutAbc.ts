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

/** What the line fitter knows about the page. All widths are in one unit (px, say). */
export interface LineFit {
  /** The width each measure takes at comfortable spacing, by position in SongIndex.measures. */
  readonly widths: readonly number[];
  /** The least width each measure can be squeezed to; without it, measures are not squeezed. */
  readonly minWidths?: readonly number[];
  /** Room for measures on a line (the column, less the clef and key signature). */
  readonly room: number;
  /** Extra width the first line needs (its time signature). */
  readonly firstLineExtra?: number;
  /** Extra width a line that starts with a repeat sign needs. */
  readonly repeatExtra?: number;
}

type FitMeasure = Pick<
  IndexedMeasure,
  "index" | "startRepeat" | "endRepeat" | "barRight" | "ending"
>;

/** Phrases are four measures long in nearly all of this music. */
const PHRASE = 4;
/**
 * Cost of a line that runs on past the end of a part: about that of four lines each left a
 * third empty, so a part starts on a new line unless that leaves lines emptier than that.
 */
const CROSS_PART = 0.4;
/**
 * Cost of a line break in the middle of a phrase: small, so it only decides between layouts
 * that are otherwise much alike (it adds up over a song, and must never be worth a line with a
 * single measure on it).
 */
const OFF_PHRASE = 0.01;
/** A squeezed line costs this many times what an equally stretched one does. */
const TIGHT = 3;

function lineExtra(measures: readonly FitMeasure[], fit: LineFit, from: number): number {
  return (
    (from === 0 ? (fit.firstLineExtra ?? 0) : 0) +
    (measures[from]?.startRepeat ? (fit.repeatExtra ?? 0) : 0)
  );
}

/** The width a line takes at comfortable spacing; the page stretches it out to `fit.room`. */
export function lineNeed(measures: readonly FitMeasure[], fit: LineFit, line: DisplayLine): number {
  let need = lineExtra(measures, fit, line.from);
  for (let i = line.from; i < line.to; i++) need += fit.widths[i] ?? 0;
  return need;
}

/**
 * Line breaks that fill the page: as many measures on each line as fit, shared out so that
 * every line is about equally full (each is then stretched to the full width, and a short last
 * line would be stretched thin). A line may be squeezed a little, down to its measures'
 * `minWidths`, when that saves leaving it much emptier. A pickup rides along with the first
 * line. Where it costs little, lines end with a part (a repeat sign or double bar) and
 * otherwise after a whole number of four-measure phrases.
 *
 * A measure too wide for a line by itself still gets a line (the caller deals with it).
 */
export function fitLines(measures: readonly FitMeasure[], fit: LineFit): DisplayLine[] {
  const n = measures.length;
  if (n === 0) return [];
  const room = Math.max(fit.room, 1);
  // A part ends at a repeat sign or a double bar, but not between a first and second ending.
  const partEnd = (i: number) => {
    const m = measures[i]!;
    return (m.endRepeat && measures[i + 1]?.ending === undefined) || m.barRight !== "single";
  };

  // onPhrase[j]: a line can end before measure j without splitting a phrase.
  const onPhrase: boolean[] = [];
  let count = 0;
  measures.forEach((m, i) => {
    onPhrase[i] = count % PHRASE === 0;
    if (m.index !== 0) count++;
    if (partEnd(i)) count = 0;
  });

  // best[j]: the least cost of laying out measures 0..j-1 in whole lines; prev[j]: where the
  // last of those lines starts.
  const best = new Array<number>(n + 1).fill(Infinity);
  const prev = new Array<number>(n + 1).fill(0);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    const pickup = measures[i]!.index === 0;
    let need = lineExtra(measures, fit, i);
    let least = need;
    let crossings = 0;
    for (let j = i + 1; j <= n; j++) {
      const w = fit.widths[j - 1] ?? 0;
      need += w;
      least += Math.min(w, fit.minWidths?.[j - 1] ?? w);
      // One measure (or a pickup and one measure) is always allowed: it can't be split.
      const smallest = j === i + 1 || (pickup && j === i + 2);
      if (least > room && !smallest) break;
      // A pickup never sits on a line by itself, unless it is the whole song.
      if (!(pickup && j === i + 1 && j < n)) {
        const slack = (room - need) / room;
        const cost =
          best[i]! +
          (slack >= 0 ? slack : TIGHT * slack) ** 2 +
          crossings * CROSS_PART +
          (j < n && !onPhrase[j] ? OFF_PHRASE : 0);
        if (cost < best[j]!) {
          best[j] = cost;
          prev[j] = i;
        }
      }
      if (partEnd(j - 1)) crossings++;
    }
  }

  const lines: DisplayLine[] = [];
  for (let to = n; to > 0; to = prev[to]!) lines.unshift({ from: prev[to]!, to });
  return lines;
}

/**
 * Splits display lines at the given measure positions (a line that came out too wide is cut
 * in two); positions at or outside a line's ends are ignored.
 */
export function splitLines(lines: readonly DisplayLine[], cuts: readonly number[]): DisplayLine[] {
  return lines.flatMap((line) => {
    const inside = [...new Set(cuts)]
      .filter((c) => c > line.from && c < line.to)
      .sort((a, b) => a - b);
    const points = [line.from, ...inside, line.to];
    return points.slice(1).map((to, i) => ({ from: points[i]!, to }));
  });
}

function cleanMusic(text: string): string {
  return (
    text
      // Field lines between measures (w: lyrics, P: part labels, W:, N:…) are not music.
      .replace(/^[ \t]*[A-Za-z]:[^\n]*$/gm, "")
      .replace(/%[^\n]*/g, "") // comments
      .replace(/\\\s*\n/g, " ") // line continuations
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
  /** Write the lyrics (w: lines) under this line's notes. */
  showLyrics?: boolean;
  /**
   * Spread the line over the whole staff width. Without this abcjs leaves a line that is less
   * than two-thirds full at its natural spacing, because it draws each of ours as a tune's
   * last line.
   */
  fill?: boolean;
}

/**
 * The w: lines for some measures: one per verse, a syllable (or "*" for none) per sung note,
 * and "|" at each bar so a miscounted measure can't shift the words of the next one. A note
 * tied from the previous one gets "*" (or "_" inside a held word): abcjs hands a word to every
 * note, tied or not, and the index has already moved the words off the tied-to notes.
 */
export function lyricLines(measures: readonly IndexedMeasure[], verses: number): string[] {
  const out: string[] = [];
  for (let v = 0; v < verses; v++) {
    const bars = measures.map((m) => {
      let holding = false;
      return m.melody
        .filter((n) => n.midi !== null)
        .map((n) => {
          const syl = n.lyrics?.[v] ?? "";
          if (syl === "") return holding ? "_" : "*";
          holding = syl.endsWith("_");
          return (holding ? syl.slice(0, -1) : syl).replace(/ /g, "~");
        })
        .join(" ")
        .replace(/- /g, "-");
    });
    if (bars.every((b) => b.split(" ").every((t) => t === "*" || t === ""))) continue;
    out.push(`w:${bars.join(" | ")}`);
  }
  return out;
}

/** Hidden-voice rests: one invisible rest per slot. */
function slotRests(m: IndexedMeasure, index: SongIndex): string {
  const len = lengthSuffix(index.rollUnit / index.unitLength);
  return Array.from({ length: m.slots }, () => `x${len}`).join(" ");
}

function header(index: SongIndex, opts: LineAbcOptions): string[] {
  return [
    "X:1",
    opts.showMeter ? `M:${index.meter.num}/${index.meter.den}` : "M:none",
    index.headerLines.find((l) => l.startsWith("L:")) ?? "L:1/8",
    ...(opts.fill ? ["%%stretchlast 1"] : []),
    "%%score (1 2)",
    index.headerLines.find((l) => l.startsWith("K:")) ?? "K:C",
  ];
}

/**
 * Two empty measures in the song's key, for measuring how much of a line the clef, key
 * signature, time signature and an opening repeat sign take up (see measureNotation).
 */
export function leadInAbc(
  index: SongIndex,
  opts: { showMeter: boolean; startRepeat: boolean },
): string {
  const full = index.measures.find((m) => m.index !== 0) ?? index.measures[0];
  if (!full) return "";
  const rests = slotRests(full, index);
  const bars = `${rests} | ${rests} |`;
  const first = (opts.startRepeat ? "|:" : "") + bars;
  return [...header(index, opts), "V:1", first, "V:2", bars, ""].join("\n");
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

  const words = opts.showLyrics ? lyricLines(ms, index.verses) : [];
  return [...header(index, opts), "V:1", melody, ...words, "V:2", slots, ""].join("\n");
}
