// Real implementations of the small platform services: P4 offline, P5 wake lock, P6 pedal
// input and P8 clock.

import { registerSW } from "virtual:pwa-register";
import type {
  Clock,
  InputService,
  OfflineService,
  PedalAction,
  ShareService,
  WakeLockService,
} from "../types.ts";

/** P8 */
export const browserClock: Clock = {
  now: () => performance.now(),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
};

/**
 * P4 · Registers the service worker. With registerType "prompt", a new version waits and
 * takes over on the next cold launch. We deliberately never call updateSW(): no banner,
 * no reload mid-practice (DEVELOPMENT.md P4).
 */
export function createOfflineService(): OfflineService {
  let offlineReady = false;
  let updateWaiting = false;
  let registration: ServiceWorkerRegistration | undefined;
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());

  if ("serviceWorker" in navigator) {
    registerSW({
      immediate: true,
      onOfflineReady() {
        offlineReady = true;
        changed();
      },
      onNeedRefresh() {
        updateWaiting = true;
        changed();
      },
      onRegisteredSW(_url, reg) {
        registration = reg;
        if (navigator.serviceWorker.controller) offlineReady = true;
        changed();
      },
    });
  }

  return {
    get offlineReady() {
      return offlineReady;
    },
    get updateWaiting() {
      return updateWaiting;
    },
    async checkForUpdate() {
      try {
        await registration?.update();
      } catch {
        // Offline or the server is unreachable: nothing to do.
      }
      return updateWaiting;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** P5 · Screen Wake Lock, re-acquired when the app becomes visible again. */
export function createWakeLockService(): WakeLockService {
  const supported = "wakeLock" in navigator;
  let wanted = false;
  let sentinel: WakeLockSentinel | null = null;

  const acquire = async () => {
    if (!supported || !wanted || sentinel || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
      sentinel.addEventListener("release", () => {
        sentinel = null;
      });
    } catch {
      sentinel = null; // Rejected (e.g. Low Power Mode): the UI shows a notice in phase 2.
    }
  };

  document.addEventListener("visibilitychange", () => void acquire());

  return {
    supported,
    get held() {
      return sentinel !== null;
    },
    async setWanted(next) {
      wanted = next;
      if (next) await acquire();
      else {
        await sentinel?.release();
        sentinel = null;
      }
    },
  };
}

const DEFAULT_PEDAL_KEYS: Readonly<Record<string, PedalAction>> = {
  PageDown: "play-stop",
  ArrowRight: "play-stop",
  ArrowDown: "play-stop",
  PageUp: "restart",
  ArrowLeft: "restart",
  ArrowUp: "restart",
};

/** P6 · Pedal keys, debounced and kept from scrolling the page. Text fields are ignored. */
export function createInputService(debounceMs = 250): InputService {
  const listeners = new Set<(a: PedalAction) => void>();
  let last = -Infinity;
  let sawHardwareKey = false;

  window.addEventListener("keydown", (e) => {
    const action = DEFAULT_PEDAL_KEYS[e.key];
    if (!action) return;
    sawHardwareKey = true;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    )
      return;
    e.preventDefault();
    const now = performance.now();
    if (e.repeat || now - last < debounceMs) return;
    last = now;
    listeners.forEach((l) => l(action));
  });

  return {
    get hardwareKeyboardLikely() {
      return sawHardwareKey;
    },
    onPedal(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Share sheet where available (iPad Safari), otherwise the clipboard. */
export function createShareService(): ShareService {
  return {
    async shareText(title, text) {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title, text });
          return "shared";
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
          // Fall through to the clipboard (e.g. NotAllowedError without a user gesture).
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        return "copied";
      } catch {
        return "failed";
      }
    },
  };
}
