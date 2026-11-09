// Fakes for unit tests and the chaos harness. Fakes model observed iPad behavior, not ideal
// behavior; extend them as spike S3 reports what the real iPad does.

import type {
  Clock,
  InputService,
  KeyValueStore,
  OfflineService,
  PedalAction,
  StoreName,
  WakeLockService,
} from "./types.ts";

/** P1 fake: an in-memory store with the same semantics as the IndexedDB one. */
export function createMemoryStore(): KeyValueStore & { dump(): Record<string, Record<string, unknown>> } {
  const data = new Map<StoreName, Map<string, unknown>>();
  const table = (s: StoreName) => {
    let t = data.get(s);
    if (!t) {
      t = new Map();
      data.set(s, t);
    }
    return t;
  };
  // structuredClone mirrors IndexedDB: callers never share objects with the store.
  return {
    async get<T>(store: StoreName, key: string) {
      const v = table(store).get(key);
      return v === undefined ? undefined : (structuredClone(v) as T);
    },
    async put<T>(store: StoreName, key: string, value: T) {
      table(store).set(key, structuredClone(value));
    },
    async delete(store: StoreName, key: string) {
      table(store).delete(key);
    },
    async keys(store: StoreName) {
      return [...table(store).keys()].sort();
    },
    async putMany<T>(store: StoreName, entries: readonly (readonly [string, T])[]) {
      const copies = entries.map(([k, v]) => [k, structuredClone(v)] as const);
      for (const [k, v] of copies) table(store).set(k, v);
    },
    close() {},
    dump() {
      const out: Record<string, Record<string, unknown>> = {};
      for (const [s, t] of data) out[s] = Object.fromEntries(t);
      return out;
    },
  };
}

/** P8 fake: time only moves when the test calls advance(). */
export function createFakeClock(start = 0): Clock & { advance(ms: number): void } {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    setTimeout(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms), fn });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

/** P5 fake. */
export function createFakeWakeLock(supported = true): WakeLockService & { release(): void } {
  let held = false;
  return {
    supported,
    get held() {
      return held;
    },
    async setWanted(wanted) {
      held = supported && wanted;
    },
    /** Simulates the system releasing the lock (e.g. the app was backgrounded). */
    release() {
      held = false;
    },
  };
}

/** P6 fake: tests call press() to simulate a pedal. */
export function createFakeInput(): InputService & { press(action: PedalAction): void } {
  const listeners = new Set<(a: PedalAction) => void>();
  return {
    hardwareKeyboardLikely: false,
    onPedal(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    press(action) {
      for (const l of listeners) l(action);
    },
  };
}

/** P4 fake. */
export function createFakeOffline(): OfflineService & { set(ready: boolean, waiting: boolean): void } {
  let offlineReady = false;
  let updateWaiting = false;
  const listeners = new Set<() => void>();
  return {
    get offlineReady() {
      return offlineReady;
    },
    get updateWaiting() {
      return updateWaiting;
    },
    async checkForUpdate() {
      return updateWaiting;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(ready, waiting) {
      offlineReady = ready;
      updateWaiting = waiting;
      for (const l of listeners) l();
    },
  };
}
