// C9 · Song model (DEVELOPMENT.md §3 C9, §8.1, §10).
//
// A song is ABC text plus an optional hand-written tab (C5 text format) and metadata.
// loadSong() indexes the ABC, parses the tab and checks that the two agree:
//   - same measures (written numbers) and the same number of slots in each,
//   - the same chords at the same slots,
//   - every tab note marked as melody sounds the notation's pitch at that slot.
// Banjo music is written an octave above where it sounds (like guitar), so a tab melody note
// matches the notation when it sounds exactly 12 semitones below the written note. A note an
// octave away from that is allowed but reported as a warning.

import type { Arrangement, ArrangedMeasure } from "../banjo/types.ts";
import { ARRANGEMENT_SCHEMA_VERSION } from "../banjo/types.ts";
import type { CapoPlan, Tuning } from "../banjo/tuning.ts";
import { NO_CAPO, OPEN_G, pitchAt } from "../banjo/tuning.ts";
import type { Violation } from "../banjo/validator.ts";
import { validate } from "../banjo/validator.ts";
import { parseChord } from "../music/chords.ts";
import { parseTab } from "../tab/tabText.ts";
import type { IndexedMeasure, SongIndex } from "./abcIndex.ts";
import { indexAbc } from "./abcIndex.ts";
import { isFirstEnding } from "../playback/order.ts";

export const SONG_SCHEMA_VERSION = 1;

/** Written pitch = sounding pitch + 12 (DEVELOPMENT.md C9). */
export const NOTATION_OCTAVE_OFFSET = 12;

export interface Song {
  readonly schemaVersion: number;
  /** Stable slug for built-ins ("cripple-creek"), a uuid for user songs. */
  readonly id: string;
  readonly title: string;
  readonly source: "builtin" | "user";
  readonly abc: string;
  /** Hand-written tab in the C5 text format, if any. */
  readonly tab?: string;
  readonly tags: readonly string[];
  /** e.g. "Traditional", "Hymn, 1907". */
  readonly credit?: string;
  /** Override for the slot length (C9 rollUnit), as a fraction of a whole note. */
  readonly rollUnit?: number;
  readonly updatedAt?: string;
  /** F17 roll overrides for user songs: written measure number → roll id. */
  readonly overrides?: Readonly<Record<string, string>>;
  /** F17: the editor's structured form of a user song, if it was entered in the editor. */
  readonly editor?: unknown;
}

/** Problems with a stored song record (I7); empty when valid. */
export function songProblems(v: unknown): string[] {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return ["not an object"];
  const s = v as Record<string, unknown>;
  const p: string[] = [];
  if (s.schemaVersion !== SONG_SCHEMA_VERSION) p.push("schemaVersion");
  if (typeof s.id !== "string" || s.id === "") p.push("id");
  if (typeof s.title !== "string") p.push("title");
  if (s.source !== "builtin" && s.source !== "user") p.push("source");
  if (typeof s.abc !== "string" || !/^K:/m.test(s.abc)) p.push("abc");
  if (s.tab !== undefined && typeof s.tab !== "string") p.push("tab");
  if (!Array.isArray(s.tags) || !s.tags.every((t) => typeof t === "string")) p.push("tags");
  if (s.overrides !== undefined) {
    const o = s.overrides;
    if (
      typeof o !== "object" ||
      o === null ||
      !Object.values(o).every((x) => typeof x === "string")
    ) {
      p.push("overrides");
    }
  }
  return p;
}

export interface SongProblem {
  readonly severity: "error" | "warning";
  /** Written measure number, or -1 for the whole song. */
  readonly measure: number;
  readonly message: string;
}

export interface LoadedSong {
  readonly song: Song;
  readonly index: SongIndex;
  /** null when the song has no tab, or the tab couldn't be read. */
  readonly arrangement: Arrangement | null;
  /** Arrangement doesn't match the notation (C9 consistency check): flag it as stale. */
  readonly stale: boolean;
  readonly problems: readonly SongProblem[];
  readonly violations: readonly Violation[];
}

function sameChord(a: string, b: string): boolean {
  const pa = parseChord(a);
  const pb = parseChord(b);
  if (!pa || !pb) return a === b;
  return (
    pa.root.letter === pb.root.letter &&
    pa.root.accidental === pb.root.accidental &&
    pa.quality.id === pb.quality.id &&
    (pa.bass?.letter ?? null) === (pb.bass?.letter ?? null) &&
    (pa.bass?.accidental ?? 0) === (pb.bass?.accidental ?? 0)
  );
}

/** The notation note sounding at a slot: the one that starts at or before it and covers it. */
function melodyAtSlot(m: IndexedMeasure, slot: number, rollUnit: number) {
  const t = slot * rollUnit + 1e-9;
  return m.melody.find((n) => n.offset <= t && t < n.offset + n.duration) ?? null;
}

export function checkConsistency(
  index: SongIndex,
  measures: readonly ArrangedMeasure[],
  tuning: Tuning = OPEN_G,
  plan: CapoPlan = NO_CAPO,
): SongProblem[] {
  const out: SongProblem[] = [];
  const abcNums = index.measures.map((m) => m.index).join(",");
  const tabNums = measures.map((m) => m.index).join(",");
  if (abcNums !== tabNums) {
    out.push({
      severity: "error",
      measure: -1,
      message: `The tab's measures (${tabNums}) don't match the notation's (${abcNums})`,
    });
  }
  const byIndex = new Map(index.measures.map((m) => [m.index, m]));
  for (const tm of measures) {
    const am = byIndex.get(tm.index);
    if (!am) continue;
    if (am.slots !== tm.slots) {
      out.push({
        severity: "error",
        measure: tm.index,
        message: `Measure ${tm.index} has ${tm.slots} tab notes but ${am.slots} in the notation`,
      });
      continue;
    }
    const ac = am.chords.map((c) => `${c.atSlot}:${c.chord}`);
    const tc = tm.chords.map((c) => `${c.atSlot}:${c.chord}`);
    const chordsMatch =
      ac.length === tc.length &&
      am.chords.every(
        (c, i) => c.atSlot === tm.chords[i]?.atSlot && sameChord(c.chord, tm.chords[i]!.chord),
      );
    if (!chordsMatch) {
      out.push({
        severity: "error",
        measure: tm.index,
        message: `Measure ${tm.index} chords differ: notation ${ac.join(" ") || "none"}, tab ${tc.join(" ") || "none"} (slots are 0-based here)`,
      });
    }
    for (const n of tm.notes) {
      if (!n.isMelody) continue;
      const written = melodyAtSlot(am, n.slot, index.rollUnit);
      if (!written || written.midi === null) {
        out.push({
          severity: "error",
          measure: tm.index,
          message: `Measure ${tm.index}, note ${n.slot + 1}: marked as melody, but the notation has a rest there`,
        });
        continue;
      }
      const sounding = pitchAt(tuning, n.string, n.fret, plan);
      const diff = written.midi - NOTATION_OCTAVE_OFFSET - sounding;
      if (diff % 12 !== 0) {
        out.push({
          severity: "error",
          measure: tm.index,
          message: `Measure ${tm.index}, note ${n.slot + 1}: string ${n.string} fret ${n.fret} doesn't sound the melody note`,
        });
      } else if (diff !== 0) {
        out.push({
          severity: "warning",
          measure: tm.index,
          message: `Measure ${tm.index}, note ${n.slot + 1}: melody played an octave ${diff > 0 ? "lower" : "higher"} than written`,
        });
      }
    }
  }
  return out;
}

export function loadSong(
  song: Song,
  tuning: Tuning = OPEN_G,
  plan: CapoPlan = NO_CAPO,
): LoadedSong {
  const index = indexAbc(song.abc, song.rollUnit !== undefined ? { rollUnit: song.rollUnit } : {});
  const problems: SongProblem[] = index.errors.map((message) => ({
    severity: "error" as const,
    measure: -1,
    message,
  }));
  if (song.tab === undefined) {
    return { song, index, arrangement: null, stale: false, problems, violations: [] };
  }
  const parsed = parseTab(song.tab);
  if (!parsed.ok) {
    for (const e of parsed.errors) {
      problems.push({
        severity: "error",
        measure: -1,
        message: `Tab line ${e.line}, column ${e.column}: ${e.message}`,
      });
    }
    return { song, index, arrangement: null, stale: true, problems, violations: [] };
  }
  const consistency = checkConsistency(index, parsed.measures, tuning, plan);
  problems.push(...consistency);
  const arrangement: Arrangement = {
    schemaVersion: ARRANGEMENT_SCHEMA_VERSION,
    shapeKey: index.key,
    measures: parsed.measures,
  };
  const violations = validate(parsed.measures, { tuning, plan, extraEdges: repeatEdges(index) });
  return {
    song,
    index,
    arrangement,
    stale: consistency.some((p) => p.severity === "error"),
    problems,
    violations,
  };
}

/**
 * Repeat back-edges and ending jumps, as positions in the measures array, for C4's warning
 * checks: the end of a repeated section back to its start, and the measure before a first
 * ending on to the second ending.
 */
export function repeatEdges(index: SongIndex): { from: number; to: number }[] {
  const edges: { from: number; to: number }[] = [];
  const ms = index.measures;
  let sectionStart = 0;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i]!;
    if (m.startRepeat) sectionStart = i;
    if (m.endRepeat) {
      edges.push({ from: i, to: sectionStart });
      // Second ending: the measure before the first ending jumps to it.
      const next = ms[i + 1];
      if (next?.ending !== undefined && !isFirstEnding(next)) {
        const first = ms.findIndex((x, j) => j >= sectionStart && isFirstEnding(x));
        if (first > 0) edges.push({ from: first - 1, to: i + 1 });
      }
    }
  }
  return edges;
}

/** A header field from ABC text (first occurrence), e.g. field(abc, "T") → title. */
function abcField(abc: string, field: string): string | undefined {
  const m = new RegExp(`^${field}:(.*)$`, "m").exec(abc);
  return m ? m[1]!.trim() : undefined;
}

/**
 * A built-in song from its files (songs/<id>.abc and optional songs/<id>.tab).
 * Title from T:, credit from C:, tags from R:, notes from N: lines.
 */
export function builtinSong(id: string, abc: string, tab?: string): Song {
  const rhythm = abcField(abc, "R");
  const credit = abcField(abc, "C");
  return {
    schemaVersion: SONG_SCHEMA_VERSION,
    id,
    title: abcField(abc, "T") ?? id,
    source: "builtin",
    abc,
    ...(tab !== undefined ? { tab } : {}),
    tags: rhythm ? [rhythm] : [],
    ...(credit !== undefined ? { credit } : {}),
  };
}

/** N: lines from the ABC header, e.g. a note that a melody is a draft. */
export function songNotes(abc: string): string[] {
  return [...abc.matchAll(/^N:(.*)$/gm)].map((m) => m[1]!.trim());
}
