// C1 · Note names and pitch classes.

export type Letter = "C" | "D" | "E" | "F" | "G" | "A" | "B";

/** A spelled note name without octave, e.g. B♭ = { letter: "B", accidental: -1 }. */
export interface NoteName {
  readonly letter: Letter;
  /** -2 = double flat … +2 = double sharp. */
  readonly accidental: number;
}

export type AccidentalStyle = "unicode" | "ascii";

export const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];

const LETTER_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function mod12(n: number): number {
  return mod(n, 12);
}

export function letterPitchClass(letter: Letter): number {
  return LETTER_PC[letter];
}

export function pitchClass(n: NoteName): number {
  return mod12(LETTER_PC[n.letter] + n.accidental);
}

export function noteName(letter: Letter, accidental = 0): NoteName {
  return { letter, accidental };
}

/**
 * The note `letterSteps` letters above `base` whose pitch class is `semitones` above it.
 * noteAt(G, 2, 3) = B♭ (a minor third up from G, spelled on the letter B).
 */
export function noteAt(base: NoteName, letterSteps: number, semitones: number): NoteName {
  const letter = LETTERS[mod(LETTERS.indexOf(base.letter) + letterSteps, 7)] as Letter;
  const target = mod12(pitchClass(base) + semitones);
  let accidental = mod12(target - LETTER_PC[letter]);
  if (accidental > 6) accidental -= 12;
  return { letter, accidental };
}

const NOTE_RE = /^([A-Ga-g])(##|bb|#|b|♯♯|♭♭|♯|♭|𝄪|𝄫)?$/u;

function accidentalValue(s: string): number {
  switch (s) {
    case "#":
    case "♯":
      return 1;
    case "##":
    case "♯♯":
    case "𝄪":
      return 2;
    case "b":
    case "♭":
      return -1;
    case "bb":
    case "♭♭":
    case "𝄫":
      return -2;
    default:
      return 0;
  }
}

/** Parses "G", "Bb", "B♭", "F#", "F♯", "Ebb". Returns null for anything else. */
export function parseNoteName(text: string): NoteName | null {
  const m = NOTE_RE.exec(text.trim());
  if (!m || m[1] === undefined) return null;
  return { letter: m[1].toUpperCase() as Letter, accidental: accidentalValue(m[2] ?? "") };
}

export function formatAccidental(accidental: number, style: AccidentalStyle = "unicode"): string {
  const sharp = style === "unicode" ? "♯" : "#";
  const flat = style === "unicode" ? "♭" : "b";
  if (accidental > 0) return sharp.repeat(accidental);
  if (accidental < 0) return flat.repeat(-accidental);
  return "";
}

export function formatNoteName(n: NoteName, style: AccidentalStyle = "unicode"): string {
  return n.letter + formatAccidental(n.accidental, style);
}

export function sameNoteName(a: NoteName, b: NoteName): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}

/** Scientific-pitch octave of a MIDI number: 67 (G4) → 4, 60 (C4) → 4. */
export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}
