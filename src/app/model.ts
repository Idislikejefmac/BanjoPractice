// Persisted app records (DEVELOPMENT.md §8.1) and their validators. Pure: no DOM or storage.
// The validators back invariant I7 (every stored record parses at the current schema) and
// make loading defensive: a corrupt record is replaced by defaults, never crashes the app.

export const MODEL_SCHEMA_VERSION = 1;

export type ViewMode = "both" | "tab";
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
}

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
  for (const k of ["showRollNames", "showAccents", "colorBadges", "keepAwake"]) {
    if (!isBool(v[k])) p.push(k);
  }
  if (v.fretNumbering !== "actual" && v.fretNumbering !== "capo-relative") p.push("fretNumbering");
  if (!Array.isArray(v.spikes) || !v.spikes.every((s) => isInt(s) && s >= 6 && s <= 22)) {
    p.push("spikes");
  }
  return p;
}

export function songPrefsProblems(v: unknown): string[] {
  if (!isObj(v)) return ["not an object"];
  const p: string[] = [];
  if (v.schemaVersion !== MODEL_SCHEMA_VERSION) p.push("schemaVersion");
  if (typeof v.songId !== "string" || v.songId === "") p.push("songId");
  if (!isBool(v.favorite)) p.push("favorite");
  if (v.lastOpenedAt !== undefined && !isIso(v.lastOpenedAt)) p.push("lastOpenedAt");
  if (v.view !== undefined && !isView(v.view)) p.push("view");
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

/**
 * Measures per display line: the most that fit at the minimum slot width, but only 1, 2 or 4
 * (or 8 on very wide screens) so 4-bar phrases stay together.
 */
export function measuresPerLine(width: number, sizeScale: number, slotsPerMeasure = 8): number {
  const slotMin = 24 * sizeScale;
  const measureWidth = slotsPerMeasure * slotMin + 14 * sizeScale;
  const fits = Math.floor((width - 40) / measureWidth);
  for (const n of [8, 4, 2]) if (fits >= n) return n;
  return 1;
}
