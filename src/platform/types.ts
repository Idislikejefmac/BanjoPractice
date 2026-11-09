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
  /**
   * All-or-nothing across stores (F18 import): every put and delete lands, or none does.
   * Validate and prepare everything first: nothing else may be awaited inside.
   */
  writeAll(
    ops: readonly (
      | {
          readonly op: "put";
          readonly store: StoreName;
          readonly key: string;
          readonly value: unknown;
        }
      | { readonly op: "delete"; readonly store: StoreName; readonly key: string }
    )[],
  ): Promise<void>;
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

/** This browser has no Web Audio at all (unlock() rejects with this). */
export class AudioUnavailableError extends Error {
  override name = "AudioUnavailableError";
}

/** P2 · Audio context. One live context at a time; recreated on sample-rate changes. */
export interface AudioService {
  readonly state: "suspended" | "running" | "interrupted" | "closed";
  /** Call from a user gesture. Resolves when audio can play; rejects if it can't yet. */
  unlock(): Promise<void>;
  currentTime(): number;
  /** Output latency in seconds, for lining the highlight up with what Dad hears (P8). */
  latency(): number;
  /** The live context and the master input (through the limiter), or null before unlock. */
  graph(): { readonly context: BaseAudioContext; readonly master: AudioNode } | null;
  onStateChange(listener: (state: AudioService["state"]) => void): () => void;
  /** The context was replaced (e.g. after a sample-rate change): decoded buffers are stale. */
  onRecreate(listener: () => void): () => void;
  /** Contexts created and not yet closed (I13: never more than one). */
  liveContexts(): number;
  /** The audio route changed (mic opened, headphones): recreate before the next play. */
  routeChanged(): void;
}

/** P3 · Sample loader. Buffers may be dropped by the OS and reloaded transparently. */
export interface SampleLoader {
  /** Decoded sample for an instrument and MIDI note; rejects if missing or undecodable. */
  load(instrument: string, midi: number): Promise<AudioBuffer>;
  /** Forget decoded buffers (after the context is recreated). */
  clear(): void;
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
  /** Rejects with MicDeniedError when permission is refused. */
  open(): Promise<MediaStream>;
  close(): void;
  readonly isOpen: boolean;
}

/** Microphone permission was refused (or is blocked in iPad Settings). */
export class MicDeniedError extends Error {
  override name = "MicDeniedError";
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
  /** A file via the share sheet (Save to Files, AirDrop, Mail), or a download on a PC. */
  shareFile(name: string, data: Blob): Promise<"shared" | "downloaded" | "cancelled" | "failed">;
}
