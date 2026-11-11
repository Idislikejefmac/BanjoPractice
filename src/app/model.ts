// Persisted app records (DEVELOPMENT.md §8.1) and their validators. Pure: no DOM or storage.
// The validators back invariant I7 (every stored record parses at the current schema) and
// make loading defensive: a corrupt record is replaced by defaults, never crashes the app.

import type { ChordOverrides } from "../core/banjo/exercises.ts";
import { validChordOverrides } from "../core/banjo/exercises.ts";
import { songProblems } from "../core/song/song.ts";
import { practiceSessionProblems } from "./practiceLog.ts";

export const MODEL_SCHEMA_VERSION = 1;

export type ViewMode = "both" | "tab";
export type MelodyInstrumentId = "violin" | "flute" | "mandolin";
export type MetronomeMode = "off" | "count-in" | "throughout";
export type PartId = "melody" | "chords" | "banjo";

export interface PartPrefs {
  readonly on: boolean;
  /** 0–1. */
  readonly volume: number;
}

/** Per-song practice state (DEVELOPMENT.md §2.2 PracticeContext, minus the transport). */
export interface VoicePrefs {
  readonly on: boolean;
  /** 0–1. */
  readonly volume: number;
  /** Octaves from the written pitch: -1 is a man's register, 0 as written. */
  readonly octave: -2 | -1 | 0;
}

export interface PracticePrefs {
  /** null = the song's own tempo (Q:). */
  readonly tempoBpm: number | null;
  /** Semitones up from the song's key, 0–11. Capo on the same shapes, or new shapes (F11). */
  readonly keyShift: number;
  /** F34: show the notation in the sounding key, or in the tab's shape key (as banjo books do). */
  readonly notationKey: "sounding" | "shape";
  readonly parts: Readonly<Record<PartId, PartPrefs>>;
  /** Roll ids the auto-arranged tab may use, or null for every roll (this song only). */
  readonly rolls: readonly string[] | null;
  /** The synthesized singing voice (this song only). */
  readonly voice: VoicePrefs;
  readonly metronome: MetronomeMode;
  /** Click (count-in and metronome) volume, 0–1. */
  readonly clickVolume: number;
  readonly countInBeats: 4 | 8;
  readonly clickPattern: "every-beat" | "two-and-four";
  readonly autoRepeat: boolean;
  /** F27: beats of silence between loop repeats. */
  readonly loopGapBeats: 0 | 1 | 2 | 4;
  /** F29 echo mode: phrase length in measures, or 0 for off. */
  readonly echoMeasures: 0 | 1 | 2 | 4;
  /** Section loop, as written measure numbers (F8). */
  readonly loop: { readonly from: number; readonly to: number } | null;
  readonly speedBuilder: {
    readonly enabled: boolean;
    readonly startBpm: number;
    readonly stepBpm: number;
    readonly targetBpm: number;
  };
}

export const TEMPO_MIN = 30;
export const TEMPO_MAX = 240;
export const DEFAULT_TEMPO = 100;

export const DEFAULT_PRACTICE: PracticePrefs = {
  tempoBpm: null,
  keyShift: 0,
  notationKey: "sounding",
  parts: {
    melody: { on: true, volume: 0.8 },
    chords: { on: true, volume: 0.8 },
    banjo: { on: true, volume: 1 },
  },
  rolls: null,
  voice: { on: false, volume: 0.8, octave: -1 },
  metronome: "count-in",
  clickVolume: 0.8,
  countInBeats: 4,
  clickPattern: "every-beat",
  autoRepeat: false,
  loopGapBeats: 0,
  echoMeasures: 0,
  loop: null,
  speedBuilder: { enabled: false, startBpm: 70, stepBpm: 4, targetBpm: 110 },
};
export type FretNumbering = "actual" | "capo-relative";

export interface Settings {
  readonly schemaVersion: number;
  /** Display size step, 0–3 (F22). */
  readonly size: number;
  readonly defaultView: ViewMode;
  readonly showRollNames: boolean;
  readonly showAccents: boolean;
  /** Finger badges in color; off = grey badges (letters always shown). */
  readonly colorBadges: boolean;
  readonly fretNumbering: FretNumbering;
  /** 5th-string spike frets (C2). Default none. */
  readonly spikes: readonly number[];
  /** Keep the screen awake while a song is open (F12). */
  readonly keepAwake: boolean;
  readonly melodyInstrument: MelodyInstrumentId;
  /** F31: a flashing beat light. */
  readonly visualMetronome: boolean;
  /** Song words under the notes (and under the tab in tab-only view). */
  readonly showLyrics: boolean;
  /**
   * What he last chose for the mix, kept across songs and exercises: which of melody, chords and
   * banjo are on, their volumes, the count-in/metronome mode and the click volume. They are
   * preferences, not per-song state, so opening another song never switches them back.
   */
  readonly parts: Readonly<Record<PartId, PartPrefs>>;
  readonly metronome: MetronomeMode;
  readonly clickVolume: number;
  /** Chords he chose for single measures of the roll exercises (measure position → chord). */
  readonly exerciseChords: ChordOverrides;
}

/** The practice keys that are kept as preferences (in Settings) instead of per song. */
export const SOUND_KEYS = ["parts", "metronome", "clickVolume"] as const;

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: MODEL_SCHEMA_VERSION,
  size: 1,
  defaultView: "both",
  showRollNames: true,
  showAccents: false,
  colorBadges: true,
  fretNumbering: "actual",
  spikes: [],
  keepAwake: true,
  melodyInstrument: "violin",
  visualMetronome: true,
  showLyrics: true,
  parts: DEFAULT_PRACTICE.parts,
  metronome: DEFAULT_PRACTICE.metronome,
  clickVolume: DEFAULT_PRACTICE.clickVolume,
  exerciseChords: {},
};

export const SIZE_STEPS = [0.85, 1, 1.25, 1.55] as const;

export interface SongPrefs {
  readonly schemaVersion: number;
  readonly songId: string;
  readonly favorite: boolean;
  /** ISO time the song was last opened, for "Recently played". */
  readonly lastOpenedAt?: string;
  /** View for this song, if Dad changed it from the default. */
  readonly view?: ViewMode;
  readonly practice?: PracticePrefs;
}

export interface Session {
  readonly schemaVersion: number;
  readonly songId: string | null;
  /** Measure (written number) at the top of the screen, for restoring the place. */
  readonly topMeasure: number;
  readonly songPanelOpen: boolean;
  readonly savedAt: string;
}

export const DEFAULT_SESSION: Session = {
  schemaVersion: MODEL_SCHEMA_VERSION,
  songId: null,
  topMeasure: 0,
  songPanelOpen: true,
  savedAt: new Date(0).toISOString(),
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isView = (v: unknown): v is ViewMode => v === "both" || v === "tab";

/** Problems with a settings record; empty when valid. */
export function settingsProblems(v: unknown): string[] {
  if (!isObj(v)) return ["not an object"];
  const p: string[] = [];
  if (v.schemaVersion !== MODEL_SCHEMA_VERSION) p.push("schemaVersion");
  if (!isInt(v.size) || v.size < 0 || v.size >= SIZE_STEPS.length) p.push("size");
  if (!isView(v.defaultView)) p.push("defaultView");
  for (const k of [
    "showRollNames",
    "showAccents",
    "colorBadges",
    "keepAwake",
    "visualMetronome",
    "showLyrics",
  ]) {
    if (!isBool(v[k])) p.push(k);
  }
  if (v.fretNumbering !== "actual" && v.fretNumbering !== "capo-relative") p.push("fretNumbering");
  if (!Array.isArray(v.spikes) || !v.spikes.every((s) => isInt(s) && s >= 6 && s <= 22)) {
    p.push("spikes");
  }
  if (!["violin", "flute", "mandolin"].includes(v.melodyInstrument as string)) {
    p.push("melodyInstrument");
  }
  p.push(...partsProblems(v.parts));
  if (!["off", "count-in", "throughout"].includes(v.metronome as string)) p.push("metronome");
  if (typeof v.clickVolume !== "number" || v.clickVolume < 0 || v.clickVolume > 1) {
    p.push("clickVolume");
  }
  if (!validChordOverrides(v.exerciseChords)) p.push("exerciseChords");
  return p;
}

function partsProblems(parts: unknown): string[] {
  if (!isObj(parts)) return ["parts"];
  const p: string[] = [];
  for (const id of ["melody", "chords", "banjo"]) {
    const part = parts[id];
    if (
      !isObj(part) ||
      !isBool(part.on) ||
      typeof part.volume !== "number" ||
      part.volume < 0 ||
      part.volume > 1
    ) {
      p.push(`parts.${id}`);
    }
  }
  return p;
}

const isBpm = (v: unknown) => typeof v === "number" && v >= TEMPO_MIN && v <= TEMPO_MAX;

export function practiceProblems(v: unknown): string[] {
  if (!isObj(v)) return ["not an object"];
  const p: string[] = [];
  if (v.tempoBpm !== null && !isBpm(v.tempoBpm)) p.push("tempoBpm");
  if (!isInt(v.keyShift) || v.keyShift < 0 || v.keyShift > 11) p.push("keyShift");
  if (v.notationKey !== "sounding" && v.notationKey !== "shape") p.push("notationKey");
  p.push(...partsProblems(v.parts));
  if (
    v.rolls !== null &&
    (!Array.isArray(v.rolls) ||
      v.rolls.length === 0 ||
      !v.rolls.every((r: unknown) => typeof r === "string"))
  ) {
    p.push("rolls");
  }
  const voice = v.voice;
  if (
    !isObj(voice) ||
    !isBool(voice.on) ||
    typeof voice.volume !== "number" ||
    voice.volume < 0 ||
    voice.volume > 1 ||
    ![-2, -1, 0].includes(voice.octave as number)
  ) {
    p.push("voice");
  }
  if (!["off", "count-in", "throughout"].includes(v.metronome as string)) p.push("metronome");
  if (v.countInBeats !== 4 && v.countInBeats !== 8) p.push("countInBeats");
  if (typeof v.clickVolume !== "number" || v.clickVolume < 0 || v.clickVolume > 1) {
    p.push("clickVolume");
  }
  if (v.clickPattern !== "every-beat" && v.clickPattern !== "two-and-four") p.push("clickPattern");
  if (!isBool(v.autoRepeat)) p.push("autoRepeat");
  if (![0, 1, 2, 4].includes(v.loopGapBeats as number)) p.push("loopGapBeats");
  if (![0, 1, 2, 4].includes(v.echoMeasures as number)) p.push("echoMeasures");
  if (v.loop !== null) {
    if (
      !isObj(v.loop) ||
      !isInt(v.loop.from) ||
      !isInt(v.loop.to) ||
      v.loop.from < 0 ||
      v.loop.to < 0
    ) {
      p.push("loop");
    }
  }
  const sb = v.speedBuilder;
  if (
    !isObj(sb) ||
    !isBool(sb.enabled) ||
    !isBpm(sb.startBpm) ||
    !isBpm(sb.targetBpm) ||
    typeof sb.stepBpm !== "number" ||
    sb.stepBpm < 1 ||
    sb.stepBpm > 30
  ) {
    p.push("speedBuilder");
  }
  return p;
}

/** Practice prefs from storage, falling back to defaults for anything invalid. */
export function readPractice(v: unknown): PracticePrefs {
  if (practiceProblems(v).length === 0) return v as unknown as PracticePrefs;
  if (!isObj(v)) return DEFAULT_PRACTICE;
  const merged: Obj = { ...DEFAULT_PRACTICE };
  for (const key of Object.keys(DEFAULT_PRACTICE)) {
    const candidate = { ...DEFAULT_PRACTICE, [key]: v[key] };
    if (practiceProblems(candidate).length === 0) merged[key] = v[key];
  }
  return merged as unknown as PracticePrefs;
}

export function songPrefsProblems(v: unknown): string[] {
  if (!isObj(v)) return ["not an object"];
  const p: string[] = [];
  if (v.schemaVersion !== MODEL_SCHEMA_VERSION) p.push("schemaVersion");
  if (typeof v.songId !== "string" || v.songId === "") p.push("songId");
  if (!isBool(v.favorite)) p.push("favorite");
  if (v.lastOpenedAt !== undefined && !isIso(v.lastOpenedAt)) p.push("lastOpenedAt");
  if (v.view !== undefined && !isView(v.view)) p.push("view");
  if (v.practice !== undefined) p.push(...practiceProblems(v.practice).map((x) => `practice.${x}`));
  return p;
}

export function sessionProblems(v: unknown): string[] {
  if (!isObj(v)) return ["not an object"];
  const p: string[] = [];
  if (v.schemaVersion !== MODEL_SCHEMA_VERSION) p.push("schemaVersion");
  if (v.songId !== null && (typeof v.songId !== "string" || v.songId === "")) p.push("songId");
  if (!isInt(v.topMeasure) || v.topMeasure < 0) p.push("topMeasure");
  if (!isBool(v.songPanelOpen)) p.push("songPanelOpen");
  if (!isIso(v.savedAt)) p.push("savedAt");
  return p;
}

/** Settings from storage, falling back to defaults field by field. */
export function readSettings(v: unknown): Settings {
  if (settingsProblems(v).length === 0) return v as unknown as Settings;
  if (!isObj(v)) return DEFAULT_SETTINGS;
  // Keep every valid field, replace the rest.
  const merged: Obj = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const candidate = { ...DEFAULT_SETTINGS, [key]: v[key] };
    if (settingsProblems(candidate).length === 0) merged[key] = v[key];
  }
  merged.schemaVersion = MODEL_SCHEMA_VERSION;
  return merged as unknown as Settings;
}

export function readSession(v: unknown): Session | null {
  return sessionProblems(v).length === 0 ? (v as unknown as Session) : null;
}

export function readSongPrefs(v: unknown): SongPrefs | null {
  return songPrefsProblems(v).length === 0 ? (v as unknown as SongPrefs) : null;
}

/** The validator for each persisted store (I7). Stores not listed hold no records yet. */
export const STORE_VALIDATORS: Readonly<Record<string, (v: unknown) => string[]>> = {
  songs: songProblems,
  practiceLog: practiceSessionProblems,
  drafts: (v) => (isObj(v) && isIso(v.savedAt) ? [] : ["draft"]),
  trash: (v) => (isObj(v) && isIso(v.deletedAt) && isObj(v.record) ? [] : ["trash"]),
  recordings: (v) =>
    isObj(v) &&
    typeof v.id === "string" &&
    typeof v.songId === "string" &&
    typeof v.blob === "object"
      ? []
      : ["recording"],
  meta: (v) => (isObj(v) ? [] : ["meta"]),
  settings: settingsProblems,
  songPrefs: songPrefsProblems,
  session: sessionProblems,
};

/** "Recently played": the last `n` songs opened, newest first. */
export function recentSongIds(prefs: readonly SongPrefs[], n = 5): string[] {
  return prefs
    .filter((p) => p.lastOpenedAt !== undefined)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))
    .slice(0, n)
    .map((p) => p.songId);
}
