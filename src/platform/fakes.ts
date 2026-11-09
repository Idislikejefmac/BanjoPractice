// Fakes for unit tests and the chaos harness. Fakes model observed iPad behavior, not ideal
// behavior; extend them as spike S3 reports what the real iPad does.

import { MicDeniedError } from "./types.ts";
import type {
  AudioService,
  MicService,
  Clock,
  InputService,
  KeyValueStore,
  OfflineService,
  PedalAction,
  SampleLoader,
  ShareService,
  StoreName,
  WakeLockService,
} from "./types.ts";

/** P1 fake: an in-memory store with the same semantics as the IndexedDB one. */
export function createMemoryStore(): KeyValueStore & {
  dump(): Record<string, Record<string, unknown>>;
} {
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
    async writeAll(ops) {
      // Copy everything first so a bad value fails before anything changes.
      const prepared = ops.map((o) =>
        o.op === "put" ? { ...o, value: structuredClone(o.value) } : o,
      );
      for (const o of prepared) {
        if (o.op === "put") table(o.store).set(o.key, o.value);
        else table(o.store).delete(o.key);
      }
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
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
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
export function createFakeOffline(): OfflineService & {
  set(ready: boolean, waiting: boolean): void;
} {
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

/** Share fake: records what was shared. */
export function createFakeShare(
  result: "shared" | "copied" | "cancelled" | "failed" = "shared",
): ShareService & {
  shared: { title: string; text: string }[];
  files: { name: string; data: Blob }[];
} {
  const shared: { title: string; text: string }[] = [];
  const files: { name: string; data: Blob }[] = [];
  return {
    shared,
    files,
    async shareFile(name, data) {
      files.push({ name, data });
      return result === "copied" ? "downloaded" : result;
    },
    async shareText(title, text) {
      shared.push({ title, text });
      return result;
    },
  };
}

/**
 * P2 fake, modeled on observed iPad behavior (CHAOS_TESTING.md §3.1), not ideal behavior:
 * - before the first tap, unlock() only works from a "tap" (call tap() first);
 * - after interrupt() (a phone call), resume is refused until the next tap;
 * - routeChange() flips the sample rate, and the next unlock recreates the context.
 * There is no Web Audio here: graph() is null, so nothing actually sounds.
 */
export function createFakeAudio(): AudioService & {
  tap(): void;
  interrupt(): void;
  routeChange(): void;
  advance(seconds: number): void;
  readonly sampleRate: number;
  readonly created: number;
} {
  let state: AudioService["state"] = "suspended";
  let tapped = false;
  let time = 0;
  let live = 0;
  let created = 0;
  let rate = 48000;
  let staleRate = false;
  const stateListeners = new Set<(s: AudioService["state"]) => void>();
  const recreateListeners = new Set<() => void>();
  const set = (s: AudioService["state"]) => {
    state = s;
    stateListeners.forEach((l) => l(s));
  };
  return {
    get state() {
      return state;
    },
    get sampleRate() {
      return rate;
    },
    get created() {
      return created;
    },
    tap() {
      tapped = true;
    },
    interrupt() {
      tapped = false;
      set("interrupted");
    },
    routeChange() {
      staleRate = true;
      rate = rate === 48000 ? 44100 : 48000;
    },
    advance(seconds) {
      if (state === "running") time += seconds;
    },
    async unlock() {
      if (live === 0 || staleRate) {
        if (live > 0) {
          live--;
          recreateListeners.forEach((l) => l());
        }
        live++;
        created++;
        staleRate = false;
      }
      if (!tapped) throw new Error("Audio is still paused. Tap Play again.");
      tapped = false;
      set("running");
    },
    currentTime: () => time,
    latency: () => 0.02,
    graph: () => null,
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    onRecreate(listener) {
      recreateListeners.add(listener);
      return () => recreateListeners.delete(listener);
    },
    liveContexts: () => live,
    routeChanged() {
      staleRate = true;
    },
  };
}

/** P7 fake: permission granted or denied; the stream is empty. */
export function createFakeMic(granted = true): MicService & { opens: number } {
  let open = false;
  let opens = 0;
  return {
    get isOpen() {
      return open;
    },
    get opens() {
      return opens;
    },
    async open() {
      opens++;
      if (!granted) throw new MicDeniedError("denied");
      open = true;
      return {} as MediaStream;
    },
    close() {
      open = false;
    },
  };
}

/** P3 fake: every load fails (the engine then uses its synth fallback). */
export function createFakeSamples(): SampleLoader & { loads: string[] } {
  const loads: string[] = [];
  return {
    loads,
    async load(instrument, midi) {
      loads.push(`${instrument}/${midi}`);
      throw new Error("no samples in tests");
    },
    clear() {},
  };
}
