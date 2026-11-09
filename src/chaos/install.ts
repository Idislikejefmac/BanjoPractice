// Exposes the chaos controller and test hooks on window. Only imported when the app is built
// with `--mode chaos`; scripts/check-prod-bundle.mjs fails the build if this leaks into
// production.

import type { Services } from "../app/services.ts";
import type { Player } from "../app/player.ts";
import type { AppStore } from "../app/store.ts";
import type { StoreName } from "../platform/types.ts";
import { STORE_NAMES } from "../platform/types.ts";
import type { ChaosController } from "./controller.ts";

declare global {
  interface Window {
    __banjoChaos?: ChaosController;
    __banjoTest?: {
      services: Services;
      store: AppStore;
      player: Player;
      /** Audio resource counts (I11, I13) and late slots (phase-2 exit). */
      audio(): {
        contexts: number;
        sources: number;
        previews: number;
        buffers: number;
        lateSlots: number;
        state: string;
      };
      version: string;
      /** Every record in P1, by store (I6, I7). */
      dumpStorage(): Promise<Record<string, Record<string, unknown>>>;
      /** True while a save is in flight or waiting to retry. */
      savesPending(): boolean;
    };
  }
}

export function installChaos(
  services: Services,
  chaos: ChaosController,
  store: AppStore,
  player: Player,
): void {
  window.__banjoChaos = chaos;
  window.__banjoTest = {
    services,
    store,
    player,
    audio: () => ({
      contexts: services.audio.liveContexts(),
      ...player.engine.counts(),
      lateSlots: player.scheduler.lateSlots,
      state: player.state.value,
    }),
    version: __APP_VERSION__,
    async dumpStorage() {
      const out: Record<string, Record<string, unknown>> = {};
      for (const name of STORE_NAMES as readonly StoreName[]) {
        const table: Record<string, unknown> = {};
        for (const key of await services.storage.keys(name)) {
          table[key] = await services.storage.get(name, key);
        }
        out[name] = table;
      }
      return out;
    },
    savesPending: () => store.savesPending,
  };
  const seed = Number(new URLSearchParams(location.search).get("chaosSeed") ?? "1");
  chaos.seed(Number.isFinite(seed) ? seed : 1);
  console.info(`CHAOS_SEED=${seed}`);
}
