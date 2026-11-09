// C1 · Transposing ABC text (DEVELOPMENT.md §3 C1: "C1 is the single source of truth for
// transposition"). The app transposes the ABC itself and hands abcjs the result, so the
// spelling Dad sees (B♭, not A♯) is the spelling C1 tested.
//
// Notes are re-spelled in the destination key; accidentals are written only where the new
// key signature (and earlier accidentals in the same measure) don't already give the pitch.
// Chord symbols in quotes are transposed with transposeChord; annotations ("^text") are not.

import abcjs from "abcjs";
import { formatChord, parseChord, transposeChord } from "../music/chords.ts";
import type { Key } from "../music/keys.ts";
import { keySignature, parseKey, toAbcKey } from "../music/keys.ts";
import type { Letter } from "../music/notes.ts";
import { letterPitchClass, mod12 } from "../music/notes.ts";
import { spellInKey } from "../music/spelling.ts";

const SHARP_ORDER: readonly Letter[] = ["F", "C", "G", "D", "A", "E", "B"];

/** Accidental the key signature gives each letter. */
function signatureAccidentals(key: Key): Record<Letter, number> {
  const out = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 } as Record<Letter, number>;
  const n = keySignature(key);
  if (n > 0) for (const l of SHARP_ORDER.slice(0, n)) out[l] = 1;
  if (n < 0) for (const l of [...SHARP_ORDER].reverse().slice(0, -n)) out[l] = -1;
  return out;
}

const ACC_TEXT: Readonly<Record<string, number>> = { "^": 1, "^^": 2, _: -1, __: -2, "=": 0 };
const ACC_OUT: Readonly<Record<number, string>> = {
  2: "^^",
  1: "^",
  0: "=",
  [-1]: "_",
  [-2]: "__",
};

/** "C" = C4 … "c" = C5; commas lower and apostrophes raise an octave. */
function octaveOf(letterText: string, marks: string): number {
  let octave = letterText === letterText.toUpperCase() ? 4 : 5;
  for (const m of marks) octave += m === "'" ? 1 : -1;
  return octave;
}

function writePitch(letter: Letter, octave: number): string {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5);
  return letter + ",".repeat(4 - octave);
}

const NOTE_TOKEN = /(\^\^|__|\^|_|=)?([A-Ga-g])([,']*)/g;

interface Span {
  readonly start: number;
  readonly end: number;
}

/** Ranges inside a note element that aren't pitches: chord symbols, decorations. */
function skipSpans(text: string): Span[] {
  const spans: Span[] = [];
  const re = /"[^"]*"|![^!]*!|\+[^+\s]*\+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) spans.push({ start: m.index, end: m.index + m[0].length });
  return spans;
}

function transposeChordText(quoted: string, semitones: number, toKey: Key): string {
  const inner = quoted.slice(1, -1);
  if (/^[\^_<>@]/.test(inner)) return quoted; // an annotation, not a chord
  const chord = parseChord(inner);
  if (!chord) return quoted;
  return `"${formatChord(transposeChord(chord, semitones, toKey), "ascii")}"`;
}

interface AbcEl {
  el_type: string;
  startChar: number;
  endChar: number;
}

export interface TransposeResult {
  readonly abc: string;
  readonly key: Key;
}

/**
 * Transposes ABC by `semitones` into `toKey` (the sounding key Dad picked). Returns the
 * text unchanged when semitones is 0.
 */
export function transposeAbc(abc: string, semitones: number, toKey: Key): TransposeResult {
  const fromKeyText = /^K:(.*)$/m.exec(abc)?.[1]?.trim() ?? "C";
  const fromKey = parseKey(fromKeyText) ?? parseKey("C")!;
  if (mod12(semitones) === 0 && semitones === 0) return { abc, key: fromKey };

  const fromSig = signatureAccidentals(fromKey);
  const toSig = signatureAccidentals(toKey);

  type Tune = { lines: { staff?: { voices: AbcEl[][] }[] }[] };
  const tune = (abcjs.parseOnly(abc) as unknown as Tune[])[0];
  const edits: { start: number; end: number; text: string }[] = [];

  for (const line of tune?.lines ?? []) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices) {
        let inAcc = new Map<string, number>();
        let outAcc = new Map<string, number>();
        for (const el of voice) {
          if (el.el_type === "bar") {
            inAcc = new Map();
            outAcc = new Map();
            continue;
          }
          if (el.el_type !== "note") continue;
          const text = abc.slice(el.startChar, el.endChar);
          const skips = skipSpans(text);
          for (const s of skips) {
            const piece = text.slice(s.start, s.end);
            if (piece.startsWith('"')) {
              const out = transposeChordText(piece, semitones, toKey);
              if (out !== piece) {
                edits.push({ start: el.startChar + s.start, end: el.startChar + s.end, text: out });
              }
            }
          }
          NOTE_TOKEN.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = NOTE_TOKEN.exec(text)) !== null) {
            const at = m.index;
            if (skips.some((s) => at >= s.start && at < s.end)) continue;
            const [token, accText, letterText, marks] = [m[0], m[1], m[2]!, m[3] ?? ""];
            const letter = letterText.toUpperCase() as Letter;
            const octave = octaveOf(letterText, marks);
            const pos = `${letter}${octave}`;
            if (accText !== undefined) inAcc.set(pos, ACC_TEXT[accText]!);
            const acc = inAcc.get(pos) ?? fromSig[letter];
            const midi = 12 * (octave + 1) + letterPitchClass(letter) + acc + semitones;

            const spelled = spellInKey(midi, toKey);
            const newOctave =
              Math.floor((midi - spelled.accidental - letterPitchClass(spelled.letter)) / 12) - 1;
            const newPos = `${spelled.letter}${newOctave}`;
            const implied = outAcc.get(newPos) ?? toSig[spelled.letter];
            let out = writePitch(spelled.letter, newOctave);
            if (implied !== spelled.accidental) {
              out = (ACC_OUT[spelled.accidental] ?? "") + out;
              outAcc.set(newPos, spelled.accidental);
            }
            if (out !== token)
              edits.push({
                start: el.startChar + at,
                end: el.startChar + at + token.length,
                text: out,
              });
          }
        }
      }
    }
  }

  // Apply edits from the end so earlier offsets stay valid; then the K: line.
  let result = abc;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
  }
  result = result.replace(/^K:.*$/m, `K:${toAbcKey(toKey)}`);
  return { abc: result, key: toKey };
}
