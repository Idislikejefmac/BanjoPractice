// P2 audio context and P3 sample loader (DEVELOPMENT.md §5).
//
// iPad specifics:
// - One AudioContext, created and resumed from a user gesture (Safari needs a tap).
// - navigator.audioSession.type = "playback" where supported, so the silent switch doesn't
//   mute the app (spike S3 checks this on the iPad).
// - A master limiter (DynamicsCompressor) so stacked parts never clip (I14).
// - After an audio route change (Bluetooth, headphones, a call) Safari can keep running at the
//   old sample rate and play off-pitch. We can't read the hardware rate directly, so after a
//   device change the context is closed and recreated before the next play.
// - Never more than one live context (I13): the old one is asked to close first (not waited for:
//   an interrupted context may never answer).
// - Back from another app, an interrupted or silent context is replaced, not trusted, and a
//   request to resume that is not answered within a moment is retried on a fresh context.

import type { AudioService, MicService, SampleLoader } from "../types.ts";
import { AudioUnavailableError, MicDeniedError } from "../types.ts";

type State = AudioService["state"];

interface AudioSessionNavigator {
  audioSession?: { type: string };
}

/** How long to wait for a context to resume before trying a fresh one. */
const RESUME_WAIT_MS = 600;

/** True if the context is running within `ms` after asking it to resume. Never waits longer. */
async function resumedWithin(c: AudioContext, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const answered = c.resume().then(
    () => true,
    () => false,
  );
  const gaveUp = new Promise<boolean>((r) => {
    timer = setTimeout(() => r(false), ms);
  });
  const ok = await Promise.race([answered, gaveUp]);
  clearTimeout(timer);
  return ok && (c.state as string) === "running";
}

export function createAudioService(): AudioService {
  let ctx: AudioContext | null = null;
  let master: DynamicsCompressorNode | null = null;
  let live = 0;
  let needsRecreate = false;
  const stateListeners = new Set<(s: State) => void>();
  const recreateListeners = new Set<() => void>();

  const state = (): State => {
    if (!ctx) return "suspended";
    const s = ctx.state as string;
    return s === "running" || s === "interrupted" || s === "closed" ? s : "suspended";
  };
  const emit = () => stateListeners.forEach((l) => l(state()));

  try {
    navigator.mediaDevices?.addEventListener?.("devicechange", () => {
      needsRecreate = true;
    });
  } catch {
    // No media devices API: nothing to watch.
  }
  // Back in the app after another one had the sound (Mail, Files, a call): iOS may have left the
  // context half-alive, so the next Play starts a fresh one instead of trusting it.
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && ctx && ctx.state !== "running") {
        needsRecreate = true;
      }
    });
  } catch {
    // No document (a worker or a test): nothing to watch.
  }

  /**
   * A new context. It is created in the same task as the tap that asked for it (no waiting on the
   * old one), because iOS lets a context start only from a tap, and closing an interrupted
   * context can wait for ever.
   */
  async function create(): Promise<AudioContext> {
    if (ctx) {
      const old = ctx;
      ctx = null;
      master = null;
      old.close().catch(() => undefined); // not awaited: it may never answer
      live--;
      recreateListeners.forEach((l) => l());
    }
    try {
      (navigator as unknown as AudioSessionNavigator).audioSession!.type = "playback";
    } catch {
      // Not supported (only newer Safari has audioSession).
    }
    if (typeof AudioContext === "undefined") {
      throw new AudioUnavailableError("This browser can't play sound (no Web Audio)");
    }
    const c = new AudioContext({ latencyHint: "interactive" });
    live++;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(c.destination);
    c.addEventListener("statechange", emit);
    ctx = c;
    master = limiter;
    needsRecreate = false;
    return c;
  }

  return {
    get state() {
      return state();
    },
    async unlock() {
      if (!ctx || ctx.state === "closed" || needsRecreate) await create();
      let c = ctx!;
      // iOS can leave an interrupted context for good (the app was in the background): replace it
      // at once. Otherwise ask it to resume, but only wait a moment before replacing it.
      if ((c.state as string) === "interrupted") c = await create();
      if (c.state !== "running" && !(await resumedWithin(c, RESUME_WAIT_MS))) c = await create();
      if (c.state !== "running" && !(await resumedWithin(c, RESUME_WAIT_MS))) {
        throw new Error("Audio is still paused. Tap Play again.");
      }
      emit();
    },
    currentTime: () => ctx?.currentTime ?? 0,
    latency() {
      if (!ctx) return 0;
      const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency;
      return out && out > 0 && out < 1 ? out : ctx.baseLatency || 0;
    },
    graph: () => (ctx && master ? { context: ctx, master } : null),
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
      needsRecreate = true;
    },
  };
}

/** P7 microphone with Safari's voice processing off. Opening it can change the sample rate. */
export function createMicService(audio: AudioService): MicService {
  let stream: MediaStream | null = null;
  return {
    get isOpen() {
      return stream !== null;
    },
    async open() {
      if (stream) return stream;
      if (!navigator.mediaDevices?.getUserMedia) throw new MicDeniedError("No microphone here");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          throw new MicDeniedError("Microphone permission was refused");
        }
        throw e;
      }
      audio.routeChanged();
      stream.getTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          stream = null;
        }),
      );
      return stream;
    },
    close() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      audio.routeChanged();
    },
  };
}

/** Samples from public/samples/<instrument>/<midi>.mp3, decoded on the live context. */
export function createSampleLoader(audio: AudioService, base: string): SampleLoader {
  const cache = new Map<string, Promise<AudioBuffer>>();
  audio.onRecreate(() => cache.clear());
  return {
    load(instrument, midi) {
      const key = `${instrument}/${midi}`;
      let p = cache.get(key);
      if (!p) {
        p = (async () => {
          const graph = audio.graph();
          if (!graph) throw new Error("Audio isn't started yet");
          const res = await fetch(`${base}samples/${instrument}/${midi}.mp3`);
          if (!res.ok) throw new Error(`Sample ${key}: HTTP ${res.status}`);
          return graph.context.decodeAudioData(await res.arrayBuffer());
        })();
        // A failed load can be retried next time (e.g. after coming back online).
        p.catch(() => cache.delete(key));
        cache.set(key, p);
      }
      return p;
    },
    clear: () => cache.clear(),
  };
}
