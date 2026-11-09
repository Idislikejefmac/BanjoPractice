// P1 · IndexedDB storage (DEVELOPMENT.md §5, §8.1).
// - The database name includes the base path, so staging never touches production data.
// - Open has a timeout and retries (Safari sometimes hangs or throws UnknownError on first open).
// - A database newer than this build is never modified (StorageNewerVersionError → read-only).
// - Never await non-IndexedDB work inside a transaction: Safari auto-commits it.

import type { IDBPDatabase } from "idb";
import { openDB } from "idb";
import type { KeyValueStore, StoreName } from "../types.ts";
import { STORE_NAMES, StorageNewerVersionError, StorageUnavailableError } from "../types.ts";

export const DB_VERSION = 1;

export function dbNameForBase(base: string): string {
  return `banjo@${base}`;
}

export interface OpenOptions {
  timeoutMs?: number;
  retries?: number;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new StorageUnavailableError(`Opening storage took over ${ms} ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

async function openOnce(name: string, timeoutMs: number): Promise<IDBPDatabase> {
  try {
    return await withTimeout(
      openDB(name, DB_VERSION, {
        upgrade(db) {
          for (const store of STORE_NAMES) {
            if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
          }
        },
        blocked() {
          // An older tab of this app is open (e.g. Safari tab + Home Screen app): it will be
          // asked to close its connection via `blocking` below.
        },
      }),
      timeoutMs,
    );
  } catch (e) {
    if (e instanceof Error && e.name === "VersionError") {
      throw new StorageNewerVersionError("Saved data was written by a newer version of the app");
    }
    throw e;
  }
}

export async function openIndexedDbStore(
  base: string,
  opts: OpenOptions = {},
): Promise<KeyValueStore> {
  const name = dbNameForBase(base);
  const retries = opts.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 3 tries × 2 s: Safari sometimes fails the first open, but Dad shouldn't wait long.
      const db = await openOnce(name, opts.timeoutMs ?? 2000);
      return wrap(db);
    } catch (e) {
      if (e instanceof StorageNewerVersionError) throw e;
      lastError = e;
    }
  }
  throw new StorageUnavailableError(
    `Storage could not be opened: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function wrap(db: IDBPDatabase): KeyValueStore {
  return {
    async get<T>(store: StoreName, key: string) {
      return (await db.get(store, key)) as T | undefined;
    },
    async put<T>(store: StoreName, key: string, value: T) {
      await db.put(store, value, key);
    },
    async delete(store: StoreName, key: string) {
      await db.delete(store, key);
    },
    async keys(store: StoreName) {
      return (await db.getAllKeys(store)).map(String).sort();
    },
    async writeAll(ops) {
      const stores = [...new Set(ops.map((o) => o.store))];
      if (stores.length === 0) return;
      // One transaction over every store touched; only IndexedDB requests inside it.
      const tx = db.transaction(stores, "readwrite");
      await Promise.all([
        ...ops.map((o) =>
          o.op === "put"
            ? tx.objectStore(o.store).put(o.value, o.key)
            : tx.objectStore(o.store).delete(o.key),
        ),
        tx.done,
      ]);
    },
    async putMany<T>(store: StoreName, entries: readonly (readonly [string, T])[]) {
      // One transaction; only IndexedDB requests are awaited inside it.
      const tx = db.transaction(store, "readwrite");
      await Promise.all([...entries.map(([k, v]) => tx.store.put(v, k)), tx.done]);
    },
    close() {
      db.close();
    },
  };
}
