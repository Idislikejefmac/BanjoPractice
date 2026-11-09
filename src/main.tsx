import { render } from "preact";
import { App } from "./ui/App.tsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";
import { builtinSongs } from "./app/builtins.ts";
import { createServices } from "./app/services.ts";
import { AppStore } from "./app/store.ts";
import type { KeyValueStore } from "./platform/types.ts";
import { installGlobalErrorHandlers } from "./platform/diagnostics.ts";
import "./ui/app.css";

async function start(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;

  // Test builds only (`vite build --mode chaos`). In production builds this branch is
  // removed at compile time, and scripts/check-prod-bundle.mjs verifies it.
  let wrap: ((s: KeyValueStore) => KeyValueStore) | undefined;
  let finishChaos:
    ((services: Awaited<ReturnType<typeof createServices>>, store: AppStore) => void) | undefined;
  if (import.meta.env.MODE === "chaos") {
    const [{ ChaosController }, { wrapStorage }, { installChaos }] = await Promise.all([
      import("./chaos/controller.ts"),
      import("./chaos/storageChaos.ts"),
      import("./chaos/install.ts"),
    ]);
    const chaos = new ChaosController();
    wrap = (s) => wrapStorage(s, chaos);
    finishChaos = (services, store) => installChaos(services, chaos, store);
  }

  const services = await createServices(wrap);
  installGlobalErrorHandlers(services.diagnostics);

  let local: Storage | null = null;
  try {
    local = window.localStorage;
  } catch {
    local = null;
  }
  const store = new AppStore(services, builtinSongs(), local);
  await store.load();
  // iOS doesn't fire beforeunload; pagehide is the last chance to save (DEVELOPMENT.md §5.2).
  window.addEventListener("pagehide", () => store.flushSession());
  finishChaos?.(services, store);

  render(
    <ErrorBoundary diagnostics={services.diagnostics}>
      <App services={services} store={store} />
    </ErrorBoundary>,
    root,
  );
}

void start();
