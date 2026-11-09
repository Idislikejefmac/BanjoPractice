// Wires the platform services together at startup. Every other part of the app receives these
// interfaces, never the browser APIs directly (DEVELOPMENT.md §2 principle 2).

import type { Diagnostics } from "../platform/diagnostics.ts";
import { createDiagnostics } from "../platform/diagnostics.ts";
import { createMemoryStore } from "../platform/fakes.ts";
import {
  browserClock,
  createInputService,
  createOfflineService,
  createWakeLockService,
} from "../platform/real/browser.ts";
import { openIndexedDbStore } from "../platform/real/storage.ts";
import type {
  Clock,
  InputService,
  KeyValueStore,
  OfflineService,
  WakeLockService,
} from "../platform/types.ts";
import { StorageNewerVersionError } from "../platform/types.ts";

export type StorageMode = "ok" | "read-only-newer" | "unavailable";

export interface Services {
  readonly storage: KeyValueStore;
  readonly storageMode: StorageMode;
  readonly offline: OfflineService;
  readonly wakeLock: WakeLockService;
  readonly input: InputService;
  readonly clock: Clock;
  readonly diagnostics: Diagnostics;
}

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export async function createServices(
  wrapStorage?: (s: KeyValueStore) => KeyValueStore,
): Promise<Services> {
  const diagnostics = createDiagnostics(__APP_VERSION__, safeLocalStorage());

  let storage: KeyValueStore;
  let storageMode: StorageMode = "ok";
  try {
    storage = await openIndexedDbStore(import.meta.env.BASE_URL);
  } catch (e) {
    // Keep running with built-in songs; nothing the user saves this session is kept,
    // and the UI says so (CHAOS_TESTING.md §6.1).
    storageMode = e instanceof StorageNewerVersionError ? "read-only-newer" : "unavailable";
    diagnostics.log("error", `Storage: ${e instanceof Error ? e.message : String(e)}`);
    storage = createMemoryStore();
  }
  if (wrapStorage) storage = wrapStorage(storage);

  return {
    storage,
    storageMode,
    offline: createOfflineService(),
    wakeLock: createWakeLockService(),
    input: createInputService(),
    clock: browserClock,
    diagnostics,
  };
}
