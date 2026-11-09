// P1–P8 · Platform service interfaces (DEVELOPMENT.md §5). Every service has a real
// implementation, a fake (unit tests) and, in test builds, a chaos wrapper.
// Phase 0 implements P1, P4, P5, P6 and P8; P2, P3 and P7 get real implementations in
// phases 2 and 6, and their fakes must model observed iPad behavior (spike S3).

/** IndexedDB object stores (DEVELOPMENT.md §8.1). */
export type StoreName =
  | "songs"
  | "songPrefs"
  | "session"
  | "drafts"
  | "settings"
  | "practiceLog"
  | "recordings"
  | "trash"
  | "diagnostics"
  | "meta";

export const STORE_NAMES: readonly StoreName[] = [
  "songs",
  "songPrefs",
  "session",
  "drafts",
  "settings",
  "practiceLog",
  "recordings",
  "trash",
  "diagnostics",
  "meta",
];

/** P1 · Storage. All writes are single-record transactions unless a batch is used. */
export interface KeyValueStore {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  keys(store: StoreName): Promise<string[]>;
  /** All-or-nothing: validate and prepare everything before calling (no awaits inside). */
  putMany<T>(store: StoreName, entries: readonly (readonly [string, T])[]): Promise<void>;
  close(): void;
}

/** The database was written by a newer app version: run read-only, never modify it. */
export class StorageNewerVersionError extends Error {
  override name = "StorageNewerVersionError";
}

/** The database could not be opened (blocked, unavailable, timed out). */
export class StorageUnavailableError extends Error {
  override name = "StorageUnavailableError";
}

/** P2 · Audio context. One live context at a time; recreated on sample-rate changes. */
export interface AudioService {
  readonly state: "suspended" | "running" | "interrupted" | "closed";
  /** Call from a user gesture. Resolves when audio can play. */
  unlock(): Promise<void>;
  currentTime(): number;
  onStateChange(listener: (state: AudioService["state"]) => void): () => void;
}

/** P3 · Sample loader. Buffers may be dropped by the OS and reloaded transparently. */
export interface SampleLoader {
  load(instrument: string, midi: number): Promise<AudioBuffer>;
  isCached(instrument: string): Promise<boolean>;
}

/** P4 · Offline and updates. New versions apply on the next cold launch, no banner. */
export interface OfflineService {
  readonly offlineReady: boolean;
  readonly updateWaiting: boolean;
  checkForUpdate(): Promise<boolean>;
  onChange(listener: () => void): () => void;
}

/** P5 · Screen wake lock. */
export interface WakeLockService {
  readonly supported: boolean;
  readonly held: boolean;
  /** Keep the screen on while `wanted` is true; re-acquires after the app returns. */
  setWanted(wanted: boolean): Promise<void>;
}

/** P6 · Input from a Bluetooth page-turner pedal (it acts as a keyboard). */
export type PedalAction = "next" | "previous" | "play-stop" | "restart";
export interface InputService {
  onPedal(listener: (action: PedalAction) => void): () => void;
  /** True when a hardware keyboard (e.g. a paired pedal) seems to be present. */
  readonly hardwareKeyboardLikely: boolean;
}

/** P7 · Microphone, processing off (echo cancellation etc. mangle a banjo's attack). */
export interface MicService {
  open(): Promise<MediaStream>;
  close(): void;
}

/** P8 · Clock for UI timing (audio timing uses AudioService.currentTime). */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): number;
  clearTimeout(id: number): void;
}

/** Share sheet (iPad) or clipboard fallback, for "Share diagnostics" and later exports. */
export interface ShareService {
  /** "shared" via the share sheet, "copied" to the clipboard, "cancelled", or "failed". */
  shareText(title: string, text: string): Promise<"shared" | "copied" | "cancelled" | "failed">;
}
