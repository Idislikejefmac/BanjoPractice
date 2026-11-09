// Exposes the chaos controller and test hooks on window. Only imported when the app is built
// with `--mode chaos`; scripts/check-prod-bundle.mjs fails the build if this leaks into
// production.

import type { Services } from "../app/services.ts";
import { ChaosController } from "./controller.ts";

declare global {
  interface Window {
    __banjoChaos?: ChaosController;
    __banjoTest?: {
      services: Services;
      version: string;
    };
  }
}

export function installChaos(services: Services, chaos: ChaosController): void {
  window.__banjoChaos = chaos;
  window.__banjoTest = { services, version: __APP_VERSION__ };
  const seed = Number(new URLSearchParams(location.search).get("chaosSeed") ?? "1");
  chaos.seed(Number.isFinite(seed) ? seed : 1);
  console.info(`CHAOS_SEED=${seed}`);
}
