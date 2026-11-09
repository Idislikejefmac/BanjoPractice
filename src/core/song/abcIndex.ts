// C9 · ABC handling: the measure index (DEVELOPMENT.md §3 C9).
//
// abcjs parses the ABC; this adapter turns its output into plain data the rest of the core
// can use without abcjs: measures (written numbers, pickup = 0), their source text ranges,
// chords per slot, melody notes with MIDI pitches, and repeat/ending marks.
//
// abcjs's parseOnly needs no DOM, so this stays pure and runs in Node tests.

import abcjs from "abcjs";
import type { Key } from "../music/keys.ts";
import { parseKey } from "../music/keys.ts";

export interface Fraction {
  readonly num: number;
  readonly den: number;
}

export interface MelodyNote {
  /** Start, in whole notes from the start of the measure. */
  readonly offset: number;
  /** Length in whole notes (triplets already applied). */
  readonly duration: number;
  /** 0-based slot the note starts in (offset ÷ rollUnit, rounded down). */
  readonly slot: number;
  /** MIDI pitch of the top note, or null for a rest. */
  readonly midi: number | null;
  /** Continues a tie from the previous note: not a new attack. */
  readonly tiedFromPrevious: boolean;
}

export interface IndexedMeasure {
  /** Written measure number: 0 = pickup, then 1, 2, … */
  readonly index: number;
  /** Source text of the measure (from just after the previous bar line to the end of its own). */
  readonly startChar: number;
  readonly endChar: number;
  /** Where the closing bar line starts: the music is startChar..contentEnd. */
  readonly contentEnd: number;
  /** The closing bar line's look, ignoring repeat dots. */
  readonly barRight: "single" | "double" | "final";
  /** Length in whole notes. */
  readonly duration: number;
  /** Roll slots in this measure (normally 8; fewer for a pickup). */
  readonly slots: number;
  readonly chords: readonly { readonly atSlot: number; readonly chord: string }[];
  readonly melody: readonly MelodyNote[];
  /** Bar-line marks: a start repeat before it, an end repeat after it, an ending number. */
  readonly startRepeat: boolean;
  readonly endRepeat: boolean;
  readonly ending?: string;
}

export interface SongIndex {
  readonly title: string;
  readonly key: Key;
  readonly meter: Fraction;
  /** ABC L: default note length, as a fraction of a whole note. */
  readonly unitLength: number;
  /** One roll slot, as a fraction of a whole note: 1/8 for 4/4 and 2/2, 1/16 for 2/4. */
  readonly rollUnit: number;
  /** Tempo in beats per minute of the Q: beat, if given. */
  readonly tempoBpm: number | null;
  /** The Q: beat as a fraction of a whole note (1/4 if not given). */
  readonly tempoBeat: number;
  /** Where the music body starts in the source (everything before it is the header). */
  readonly bodyStart: number;
  readonly headerLines: readonly string[];
  readonly measures: readonly IndexedMeasure[];
  readonly errors: readonly string[];
}

// Minimal shapes of the abcjs parse output we read (abcjs's own typings are looser).
interface AbcPitch {
  pitch: number;
  accidental?: string;
  startTie?: unknown;
  endTie?: boolean;
}
interface AbcElement {
  el_type: string;
  startChar: number;
  endChar: number;
  duration?: number;
  rest?: { type: string };
  pitches?: AbcPitch[];
  chord?: { name: string; position?: string }[];
  type?: string;
  startEnding?: string;
  endEnding?: boolean;
  startTriplet?: number;
  tripletMultiplier?: number;
  endTriplet?: boolean;
  accidentals?: { acc: string; note: string }[];
}
interface AbcTune {
  lines: {
    staff?: { key?: { accidentals?: { acc: string; note: string }[] }; voices: AbcElement[][] }[];
  }[];
  metaText: { title?: string };
  getMeterFraction(): Fraction;
}

const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = "CDEFGAB";
const ACC: Readonly<Record<string, number>> = {
  sharp: 1,
  flat: -1,
  natural: 0,
  dblsharp: 2,
  dblflat: -2,
};

/** Default slot length for a meter (DEVELOPMENT.md C9 `rollUnit`). */
export function defaultRollUnit(meter: Fraction): number {
  return meter.num === 2 && meter.den === 4 ? 1 / 16 : 1 / 8;
}

function headerField(header: readonly string[], field: string): string | null {
  const line = header.find((l) => l.startsWith(`${field}:`));
  return line ? line.slice(field.length + 1).trim() : null;
}

function parseFraction(text: string | null): Fraction | null {
  const m = /^(\d+)\/(\d+)$/.exec(text ?? "");
  return m ? { num: Number(m[1]), den: Number(m[2]) } : null;
}

function parseTempoBeat(text: string | null): number {
  const m = /(\d+)\/(\d+)\s*=/.exec(text ?? "");
  return m ? Number(m[1]) / Number(m[2]) : 1 / 4;
}

function parseTempo(text: string | null): number | null {
  // "1/4=120", "120", "\"Moderato\" 1/4=96"
  const m = /(?:\d+\/\d+\s*=\s*)?(\d+)\s*$/.exec(text ?? "");
  return m ? Number(m[1]) : null;
}

/** Length of the header: every line up to and including K:. */
function splitHeader(abc: string): { header: string[]; bodyStart: number } {
  const header: string[] = [];
  let pos = 0;
  while (pos < abc.length) {
    const nl = abc.indexOf("\n", pos);
    const end = nl === -1 ? abc.length : nl + 1;
    const line = abc.slice(pos, end).replace(/\r?\n$/, "");
    header.push(line);
    pos = end;
    if (/^K:/.test(line)) break;
  }
  return { header, bodyStart: pos };
}

const EPS = 1e-9;

export function indexAbc(abc: string, opts: { rollUnit?: number } = {}): SongIndex {
  const errors: string[] = [];
  const { header, bodyStart } = splitHeader(abc);
  const key = parseKey(headerField(header, "K") ?? "G") ?? parseKey("G")!;
  const meter = parseFraction(headerField(header, "M")) ?? { num: 4, den: 4 };
  const unitParsed = parseFraction(headerField(header, "L"));
  const unitLength = unitParsed ? unitParsed.num / unitParsed.den : 1 / 8;
  const rollUnit = opts.rollUnit ?? defaultRollUnit(meter);
  const barLength = meter.num / meter.den;

  let tune: AbcTune | undefined;
  try {
    tune = (abcjs.parseOnly(abc) as unknown as AbcTune[])[0];
  } catch (e) {
    errors.push(`ABC could not be read: ${e instanceof Error ? e.message : String(e)}`);
  }

  const measures: IndexedMeasure[] = [];
  if (!tune) {
    return {
      title: headerField(header, "T") ?? "",
      key,
      meter,
      unitLength,
      rollUnit,
      tempoBpm: parseTempo(headerField(header, "Q")),
      tempoBeat: parseTempoBeat(headerField(header, "Q")),
      bodyStart,
      headerLines: header,
      measures,
      errors,
    };
  }

  // Key signature accidentals per letter, updated by inline key changes.
  let keyAcc: Record<string, number> = {};
  const setKeyAcc = (list: { acc: string; note: string }[] | undefined) => {
    keyAcc = {};
    for (const a of list ?? []) keyAcc[a.note.toUpperCase()] = ACC[a.acc] ?? 0;
  };
  setKeyAcc(tune.lines.find((l) => l.staff)?.staff?.[0]?.key?.accidentals);

  // Running state for the measure being built.
  let start = bodyStart;
  let pos = 0;
  let chords: { atSlot: number; chord: string }[] = [];
  let melody: MelodyNote[] = [];
  let measureAcc: Record<number, number> = {}; // diatonic step → accidental, this measure only
  let tripletMult = 1;
  let pendingStartRepeat = false;
  let pendingEnding: string | undefined;
  let nextIndex: number | null = null;
  let tieOpen = false;

  const slotOf = (offset: number) => Math.floor(offset / rollUnit + EPS);

  const close = (endChar: number, bar: AbcElement | null) => {
    const duration = pos;
    if (duration < EPS && chords.length === 0) {
      // A bar line with nothing before it (e.g. "|:" at the start, or "| [1"): carry its marks.
      if (bar?.type === "bar_left_repeat" || bar?.type === "bar_dbl_repeat")
        pendingStartRepeat = true;
      if (bar?.startEnding) pendingEnding = bar.startEnding;
      start = endChar;
      return;
    }
    if (nextIndex === null) nextIndex = duration < barLength - EPS ? 0 : 1;
    const slots = Math.round(duration / rollUnit);
    if (Math.abs(slots * rollUnit - duration) > EPS) {
      errors.push(`Measure ${nextIndex} is not a whole number of roll notes long`);
    }
    const type = bar?.type ?? "";
    measures.push({
      index: nextIndex,
      startChar: start,
      endChar,
      contentEnd: bar ? bar.startChar : endChar,
      barRight:
        type === "bar_thin_thick" ? "final" : type === "bar_thin_thin" ? "double" : "single",
      duration,
      slots,
      chords,
      melody,
      startRepeat: pendingStartRepeat,
      endRepeat: bar?.type === "bar_right_repeat" || bar?.type === "bar_dbl_repeat",
      ...(pendingEnding !== undefined ? { ending: pendingEnding } : {}),
    });
    nextIndex++;
    pendingStartRepeat = bar?.type === "bar_left_repeat" || bar?.type === "bar_dbl_repeat";
    pendingEnding = bar?.startEnding;
    start = endChar;
    pos = 0;
    chords = [];
    melody = [];
    measureAcc = {};
  };

  for (const line of tune.lines) {
    const voice = line.staff?.[0]?.voices[0];
    if (!voice) continue;
    for (const el of voice) {
      if (el.el_type === "key") {
        setKeyAcc(el.accidentals);
        continue;
      }
      if (el.el_type === "bar") {
        close(el.endChar, el);
        continue;
      }
      if (el.el_type !== "note") continue;

      if (el.startTriplet) tripletMult = el.tripletMultiplier ?? 1;
      const duration = (el.duration ?? 0) * tripletMult;
      if (el.endTriplet) tripletMult = 1;

      for (const c of el.chord ?? []) {
        if (c.position === undefined || c.position === "default") {
          chords.push({ atSlot: slotOf(pos), chord: c.name });
        }
      }

      let midi: number | null = null;
      const isRest = el.rest !== undefined;
      const top = el.pitches?.[el.pitches.length - 1];
      if (!isRest && top) {
        const step = top.pitch; // 0 = middle C (C4)
        const letter = LETTERS[((step % 7) + 7) % 7]!;
        const octave = Math.floor(step / 7);
        if (top.accidental !== undefined && top.accidental in ACC) {
          measureAcc[step] = ACC[top.accidental]!;
        }
        const acc = measureAcc[step] ?? keyAcc[letter] ?? 0;
        midi = 60 + octave * 12 + LETTER_PC[letter]! + acc;
      }
      const tied = !isRest && tieOpen;
      tieOpen = !isRest && Boolean(top?.startTie);
      if (duration > EPS) {
        melody.push({ offset: pos, duration, slot: slotOf(pos), midi, tiedFromPrevious: tied });
      }
      pos += duration;
    }
  }
  // Music that doesn't end with a bar line still forms a last measure.
  if (pos > EPS) close(abc.length, null);

  return {
    title: tune.metaText.title ?? headerField(header, "T") ?? "",
    key,
    meter,
    unitLength,
    rollUnit,
    tempoBpm: parseTempo(headerField(header, "Q")),
    tempoBeat: parseTempoBeat(headerField(header, "Q")),
    bodyStart,
    headerLines: header,
    measures,
    errors,
  };
}
