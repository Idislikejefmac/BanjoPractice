// C5 · Tab text format: hand-writing built-in songs and readable diffs.
//
//   # comment
//   m1  G          forward        | 3:0T* 2:0I 1:0M 5:0T> 2:0I 1:0M* 5:0T> 1:0M |
//   m2  C@1 G@5    alt-thumb      | 4:2T 2:1I* 5:0T 1:2M 3:0T 2:0I* 5:0T 1:0M |
//   m4  G          tag !end       | 3:0T 2:0I [5:0T,1:0M] - 3:0T . [5:0T,1:0M] - |
//
// Header: m<index>, chord tokens (chord or chord@slot, 1-based slots), a lowercase roll name,
// then optional flags: !end (phrase end), !generated, !override.
// Body: exactly one token per slot.
//   s:fF   string s, fret f, finger F (T/I/M)      trailing * = melody, > = accent
//   h p / \ ch prefix = slurred note (hammer, pull, slide up/down, choke): no finger
//   [a,b]  pinch (notes struck together)            -  hold the previous token
//   .      silent slot
// Default roll accents are applied at playback, not by the parser, so text round-trips exactly.
//
// The parser never throws: malformed input yields errors with line and column.

import { parseChord } from "../music/chords.ts";
import type {
  ArrangedMeasure,
  Finger,
  MeasureChord,
  MeasureSource,
  StringNo,
  TabNote,
  Technique,
} from "../banjo/types.ts";

export interface TabParseError {
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export type TabParseResult =
  | { readonly ok: true; readonly measures: ArrangedMeasure[] }
  | { readonly ok: false; readonly errors: TabParseError[]; readonly measures: ArrangedMeasure[] };

interface Token {
  readonly text: string;
  /** 1-based column. */
  readonly col: number;
}

const SLUR_PREFIX: Readonly<Record<string, Technique>> = {
  h: "hammer",
  p: "pull",
  "/": "slide-up",
  "\\": "slide-down",
  ch: "choke",
};
const TECHNIQUE_PREFIX: Readonly<Record<Technique, string>> = {
  pick: "",
  hammer: "h",
  pull: "p",
  "slide-up": "/",
  "slide-down": "\\",
  choke: "ch",
};

const NOTE_RE = /^(ch|h|p|\/|\\)?([1-5]):(\d{1,2})([TIM])?([*>]{0,2})$/;
const MEASURE_RE = /^m(\d{1,4})$/;
const ROLL_RE = /^[a-z][a-z0-9:+/_-]*$/;
const FLAGS: readonly string[] = ["!end", "!generated", "!override"];

function tokenize(text: string, offset: number): Token[] {
  const out: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push({ text: m[0], col: offset + m.index + 1 });
  return out;
}

export function parseTab(text: string): TabParseResult {
  const errors: TabParseError[] = [];
  const measures: ArrangedMeasure[] = [];
  const seen = new Set<number>();

  let lines: string[];
  try {
    lines = String(text).split(/\r?\n/);
  } catch {
    return {
      ok: false,
      errors: [{ line: 1, column: 1, message: "Tab text is not a string" }],
      measures,
    };
  }

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const err = (column: number, message: string) => errors.push({ line: lineNo, column, message });
    try {
      const measure = parseLine(raw, err);
      if (!measure) return;
      if (seen.has(measure.index)) {
        err(1, `Measure m${measure.index} appears more than once`);
        return;
      }
      seen.add(measure.index);
      measures.push(measure);
    } catch (e) {
      err(1, `Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return errors.length === 0 ? { ok: true, measures } : { ok: false, errors, measures };
}

function parseLine(
  raw: string,
  err: (column: number, message: string) => void,
): ArrangedMeasure | null {
  const open = raw.indexOf("|");
  if (open < 0) {
    err(1, "Expected '|' before the notes");
    return null;
  }
  const close = raw.lastIndexOf("|");
  if (close === open) {
    err(raw.length + 1, "Expected a closing '|' after the notes");
    return null;
  }
  if (raw.slice(close + 1).trim() !== "") {
    err(close + 2, "Unexpected text after the closing '|'");
    return null;
  }

  const header = tokenize(raw.slice(0, open), 0);
  const body = tokenize(raw.slice(open + 1, close), open + 1);

  const first = header[0];
  const indexMatch = first ? MEASURE_RE.exec(first.text) : null;
  if (!first || !indexMatch || indexMatch[1] === undefined) {
    err(first?.col ?? 1, "A measure line starts with its number, e.g. m1");
    return null;
  }
  const index = Number(indexMatch[1]);

  const chordTokens: Token[] = [];
  let rollName: string | null = null;
  let phraseEnd = false;
  let source: MeasureSource = "hand";
  let ok = true;
  for (const tok of header.slice(1)) {
    if (rollName === null && /^[A-G]/.test(tok.text)) {
      chordTokens.push(tok);
    } else if (rollName === null) {
      if (!ROLL_RE.test(tok.text)) {
        err(tok.col, `Expected a chord or a lowercase roll name, found "${tok.text}"`);
        ok = false;
      }
      rollName = tok.text;
    } else if (FLAGS.includes(tok.text)) {
      if (tok.text === "!end") phraseEnd = true;
      else source = tok.text === "!generated" ? "generated" : "override";
    } else {
      err(tok.col, `Unknown flag "${tok.text}" (expected !end, !generated or !override)`);
      ok = false;
    }
  }
  if (rollName === null) {
    err(open + 1, "Missing roll name before '|', e.g. forward");
    return null;
  }
  if (body.length === 0) {
    err(open + 2, "A measure needs at least one note");
    return null;
  }

  const notes: TabNote[] = [];
  let lastGroup: TabNote[] | null = null;
  let pinchGroup = 0;
  body.forEach((tok, slot) => {
    if (tok.text === "-") {
      if (!lastGroup) {
        err(
          tok.col,
          slot === 0 ? "A hold (-) can't start a measure" : "A hold (-) must follow a note",
        );
        ok = false;
        return;
      }
      for (const n of lastGroup) n.durationSlots += 1;
      return;
    }
    if (tok.text === ".") {
      lastGroup = null;
      return;
    }
    if (tok.text.startsWith("[")) {
      if (!tok.text.endsWith("]")) {
        err(tok.col, "A pinch is written [a,b] with no spaces inside");
        ok = false;
        lastGroup = null;
        return;
      }
      const parts = tok.text.slice(1, -1).split(",");
      if (parts.length < 2) {
        err(tok.col, "A pinch needs at least two notes");
        ok = false;
        lastGroup = null;
        return;
      }
      const group: TabNote[] = [];
      let col = tok.col + 1;
      for (const part of parts) {
        const n = parseNote(part, slot, col, err);
        if (n) {
          if (n.technique !== "pick") {
            err(col, "Notes in a pinch are picked, not slurred");
            ok = false;
          } else {
            n.pinchGroup = pinchGroup;
            group.push(n);
          }
        } else {
          ok = false;
        }
        col += part.length + 1;
      }
      pinchGroup += 1;
      notes.push(...group);
      lastGroup = group;
      return;
    }
    const n = parseNote(tok.text, slot, tok.col, err);
    if (!n) {
      ok = false;
      lastGroup = null;
      return;
    }
    notes.push(n);
    lastGroup = [n];
  });

  const slots = body.length;
  const chords: MeasureChord[] = [];
  for (const tok of chordTokens) {
    const [name, at, ...rest] = tok.text.split("@");
    if (name === undefined || rest.length > 0 || !parseChord(name)) {
      err(tok.col, `Unknown chord "${tok.text}"`);
      ok = false;
      continue;
    }
    const atSlot = at === undefined ? 0 : Number(at) - 1;
    if (!Number.isInteger(atSlot) || atSlot < 0 || atSlot >= slots) {
      err(tok.col, `Chord position @${at} is outside this ${slots}-note measure`);
      ok = false;
      continue;
    }
    chords.push({ atSlot, chord: name });
  }

  if (!ok) return null;
  const measure: ArrangedMeasure = { index, slots, chords, rollName, source, notes };
  if (phraseEnd) measure.phraseEnd = true;
  return measure;
}

function parseNote(
  text: string,
  slot: number,
  col: number,
  err: (column: number, message: string) => void,
): TabNote | null {
  const m = NOTE_RE.exec(text);
  if (!m) {
    err(col, `Can't read note "${text}" (expected string:fret plus finger, e.g. 3:0T)`);
    return null;
  }
  const technique: Technique = m[1] ? (SLUR_PREFIX[m[1]] ?? "pick") : "pick";
  const string = Number(m[2]) as StringNo;
  const fret = Number(m[3]);
  const finger = (m[4] ?? null) as Finger | null;
  const marks = m[5] ?? "";
  if (marks.length === 2 && marks[0] === marks[1]) {
    err(col, `Mark "${marks[0]}" is repeated`);
    return null;
  }
  if (technique === "pick" && finger === null) {
    err(col, `Picked note "${text}" needs a finger: T, I or M`);
    return null;
  }
  if (technique !== "pick" && finger !== null) {
    err(col, `Slurred note "${text}" isn't picked, so it takes no finger`);
    return null;
  }
  return {
    slot,
    durationSlots: 1,
    string,
    fret,
    finger,
    technique,
    isMelody: marks.includes("*"),
    isAccent: marks.includes(">"),
  };
}

function formatNote(n: TabNote): string {
  return (
    TECHNIQUE_PREFIX[n.technique] +
    `${n.string}:${n.fret}` +
    (n.finger ?? "") +
    (n.isMelody ? "*" : "") +
    (n.isAccent ? ">" : "")
  );
}

/** Canonical text for measures. parseTab(serializeTab(ms)) deep-equals ms for parser output. */
export function serializeTab(measures: readonly ArrangedMeasure[]): string {
  return measures.map(serializeMeasure).join("\n") + "\n";
}

export function serializeMeasure(m: ArrangedMeasure): string {
  const chords = m.chords.map((c) => (c.atSlot === 0 ? c.chord : `${c.chord}@${c.atSlot + 1}`));
  const flags = [m.phraseEnd ? "!end" : "", m.source === "hand" ? "" : `!${m.source}`].filter(
    Boolean,
  );
  const header = [`m${m.index}`, ...chords, m.rollName, ...flags].join(" ");

  const tokens: string[] = [];
  for (let slot = 0; slot < m.slots; slot++) {
    const starting = m.notes.filter((n) => n.slot === slot);
    if (starting.length === 0) {
      const held = m.notes.some((n) => n.slot < slot && n.slot + n.durationSlots > slot);
      tokens.push(held ? "-" : ".");
    } else if (starting.length === 1 && starting[0]?.pinchGroup === undefined) {
      tokens.push(formatNote(starting[0]));
    } else {
      tokens.push(`[${starting.map(formatNote).join(",")}]`);
    }
  }
  return `${header} | ${tokens.join(" ")} |`;
}
