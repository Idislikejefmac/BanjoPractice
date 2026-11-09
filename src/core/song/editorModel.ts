// F17 · Song editor model (pure). Dad enters notes by name and length, measure by measure, and
// a chord per measure or half-measure. The model turns into ABC text, which is what's saved
// (DEVELOPMENT.md C9: a song is its ABC plus metadata), and the tab is arranged from it by C6.

import type { Key } from "../music/keys.ts";
import { keySignature, toAbcKey } from "../music/keys.ts";
import type { Letter } from "../music/notes.ts";

/** Note lengths in eighths (the editor's unit): 1 = eighth, 2 = quarter, 3 = dotted quarter… */
export type Eighths = 1 | 2 | 3 | 4 | 6 | 8;
export const LENGTHS: readonly { eighths: Eighths; label: string }[] = [
  { eighths: 1, label: "Eighth" },
  { eighths: 2, label: "Quarter" },
  { eighths: 3, label: "Dotted quarter" },
  { eighths: 4, label: "Half" },
  { eighths: 6, label: "Dotted half" },
  { eighths: 8, label: "Whole" },
];

export interface EditorNote {
  /** null = a rest. */
  readonly letter: Letter | null;
  /** −1 flat, 0 natural (as the key gives it), +1 sharp. "key" = whatever the key signature says. */
  readonly accidental: -1 | 0 | 1 | "key";
  /** 4 = the octave from middle C up (written pitch). */
  readonly octave: number;
  readonly eighths: Eighths;
}

export interface EditorMeasure {
  readonly notes: readonly EditorNote[];
  /** Chord symbols at slots (0 = start, 4 = second half in 4/4). */
  readonly chords: readonly { readonly atSlot: number; readonly chord: string }[];
  /** Roll override for this measure (F14/F17), e.g. "forward". */
  readonly roll?: string;
}

export interface EditorSong {
  readonly title: string;
  readonly key: Key;
  readonly meter: "4/4" | "2/4" | "3/4" | "2/2";
  readonly tempoBpm: number;
  readonly measures: readonly EditorMeasure[];
}

/** Eighths in a full measure. */
export function measureEighths(meter: EditorSong["meter"]): number {
  return meter === "3/4" ? 6 : meter === "2/4" ? 4 : 8;
}

export function usedEighths(m: EditorMeasure): number {
  return m.notes.reduce((n, x) => n + x.eighths, 0);
}

/** Whether a note fits in what's left of the measure (Dad can't overfill one). */
export function fits(song: EditorSong, m: EditorMeasure, eighths: number): boolean {
  return usedEighths(m) + eighths <= measureEighths(song.meter);
}

const SHARP_ORDER: readonly Letter[] = ["F", "C", "G", "D", "A", "E", "B"];

function keyAccidental(key: Key, letter: Letter): number {
  const n = keySignature(key);
  if (n > 0) return SHARP_ORDER.slice(0, n).includes(letter) ? 1 : 0;
  if (n < 0) return [...SHARP_ORDER].reverse().slice(0, -n).includes(letter) ? -1 : 0;
  return 0;
}

function abcNote(n: EditorNote, key: Key, measureAcc: Map<string, number>): string {
  const len = n.eighths === 1 ? "" : String(n.eighths);
  if (n.letter === null) return `z${len}`;
  const pos = `${n.letter}${n.octave}`;
  let prefix = "";
  if (n.accidental !== "key") {
    const implied = measureAcc.get(pos) ?? keyAccidental(key, n.letter);
    if (implied !== n.accidental) {
      prefix = n.accidental === 1 ? "^" : n.accidental === -1 ? "_" : "=";
      measureAcc.set(pos, n.accidental);
    }
  }
  const letter =
    n.octave >= 5
      ? n.letter.toLowerCase() + "'".repeat(n.octave - 5)
      : n.letter + ",".repeat(4 - n.octave);
  return prefix + letter + len;
}

/** The song as ABC text. Empty or part-filled measures are padded with rests. */
export function toAbc(song: EditorSong): string {
  const full = measureEighths(song.meter);
  const body = song.measures
    .map((m) => {
      const acc = new Map<string, number>();
      let at = 0;
      let out = "";
      const pending = [...m.chords].sort((a, b) => a.atSlot - b.atSlot);
      for (const n of m.notes) {
        // A chord that starts inside this note is written before it.
        while (pending.length && pending[0]!.atSlot <= at + n.eighths - 1) {
          out += `"${pending.shift()!.chord}"`;
        }
        out += abcNote(n, song.key, acc);
        at += n.eighths;
      }
      // Pad with rests (and any chords still to come).
      while (at < full) {
        const next = pending[0];
        if (next && next.atSlot <= at) out += `"${pending.shift()!.chord}"`;
        const nextChord = pending[0]?.atSlot ?? full;
        const len = Math.max(1, Math.min(full, nextChord) - at);
        out += `z${len === 1 ? "" : len}`;
        at += len;
      }
      return out;
    })
    .join("|");
  return [
    "X:1",
    `T:${song.title.replace(/\n/g, " ") || "Untitled"}`,
    "C:Entered by hand",
    `M:${song.meter}`,
    "L:1/8",
    `Q:1/4=${song.tempoBpm}`,
    `K:${toAbcKey(song.key)}`,
    `${body}|]`,
    "",
  ].join("\n");
}

export function emptySong(key: Key, meter: EditorSong["meter"] = "4/4"): EditorSong {
  return {
    title: "",
    key,
    meter,
    tempoBpm: 90,
    measures: [{ notes: [], chords: [] }],
  };
}

/** Roll overrides (F17), by written measure number (1-based, no pickups in the editor). */
export function overridesOf(song: EditorSong): Map<number, string> {
  const out = new Map<number, string>();
  song.measures.forEach((m, i) => {
    if (m.roll) out.set(i + 1, m.roll);
  });
  return out;
}
