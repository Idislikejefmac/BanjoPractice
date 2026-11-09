// C1 · Conventional spelling and transposition. C1 is the single source of truth for
// spelling: the app transposes ABC text itself and hands abcjs pre-transposed ABC.

import type { Key } from "./keys.ts";
import { keySignature } from "./keys.ts";
import type { Letter, NoteName } from "./notes.ts";
import { LETTERS, letterPitchClass, mod12, noteAt, pitchClass } from "./notes.ts";

/**
 * For each semitone offset above the tonic: [letter steps, semitones].
 * Diatonic degrees follow the tonic's major scale; chromatic notes are spelled the way
 * bluegrass and folk music normally write them: ♭2, ♭3, ♯4, ♭6, ♭7.
 * So in G: B♭ (not A♯), F (not E♯), C♯ (not D♭), E♭ (not D♯).
 */
const DEGREE_FOR_OFFSET: readonly (readonly [number, number])[] = [
  [0, 0], // 1
  [1, 1], // ♭2
  [1, 2], // 2
  [2, 3], // ♭3
  [2, 4], // 3
  [3, 5], // 4
  [3, 6], // ♯4
  [4, 7], // 5
  [5, 8], // ♭6
  [5, 9], // 6
  [6, 10], // ♭7
  [6, 11], // 7
];

/** Spells a pitch class conventionally in a key (any mode). */
export function spellInKey(pc: number, key: Key): NoteName {
  const offset = mod12(pc - pitchClass(key.tonic));
  const degree = DEGREE_FOR_OFFSET[offset] ?? [0, 0];
  return noteAt(key.tonic, degree[0], degree[1]);
}

/** Every single-accidental spelling of a pitch class (e.g. 10 → A♯, B♭). */
function spellingsOf(pc: number): NoteName[] {
  const out: NoteName[] = [];
  for (const letter of LETTERS as readonly Letter[]) {
    let acc = mod12(pc - letterPitchClass(letter));
    if (acc > 6) acc -= 12;
    if (Math.abs(acc) <= 1) out.push({ letter, accidental: acc });
  }
  return out;
}

/**
 * The key `semitones` away, with the tonic spelled to give the simplest key signature.
 * Ties (six sharps vs six flats) go to sharps.
 */
export function transposeKey(key: Key, semitones: number): Key {
  const pc = mod12(pitchClass(key.tonic) + semitones);
  let best: Key | null = null;
  let bestScore = Infinity;
  for (const tonic of spellingsOf(pc)) {
    const candidate: Key = { tonic, mode: key.mode };
    const fifths = keySignature(candidate);
    const score = Math.abs(fifths) * 2 + (fifths < 0 ? 1 : 0);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best ?? key;
}

/** Transposes a note name and spells it conventionally in the destination key. */
export function transposeNote(n: NoteName, semitones: number, toKey: Key): NoteName {
  return spellInKey(pitchClass(n) + semitones, toKey);
}

/** Semitones from one key's tonic up to another's, in 0..11. */
export function semitonesBetween(from: Key, to: Key): number {
  return mod12(pitchClass(to.tonic) - pitchClass(from.tonic));
}
