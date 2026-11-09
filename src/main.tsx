import { render } from "preact";
import { App } from "./ui/App.tsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.tsx";
import { builtinSongs } from "./app/builtins.ts";
import { allRollExercises } from "./core/banjo/exercises.ts";
import { createServices } from "./app/services.ts";
import { Player } from "./app/player.ts";
import { AppStore } from "./app/store.ts";
import type { KeyValueStore } from "./platform/types.ts";
import type { Song } from "./core/song/song.ts";
import { installGlobalErrorHandlers } from "./platform/diagnostics.ts";
import "./ui/app.css";

async function start(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;

  // Test builds only (`vite build --mode chaos`). In production builds this branch is
  // removed at compile time, and scripts/check-prod-bundle.mjs verifies it.
  let wrap: ((s: KeyValueStore) => KeyValueStore) | undefined;
  let testSongs: Song[] = [];
  let finishChaos:
    | ((
        services: Awaited<ReturnType<typeof createServices>>,
        store: AppStore,
        player: Player,
      ) => void)
    | undefined;
  if (import.meta.env.MODE === "chaos") {
    const [{ ChaosController }, { wrapStorage }, { installChaos }, { fixtureSongs }] =
      await Promise.all([
        import("./chaos/controller.ts"),
        import("./chaos/storageChaos.ts"),
        import("./chaos/install.ts"),
        import("./chaos/fixtures.ts"),
      ]);
    testSongs = fixtureSongs();
    const chaos = new ChaosController();
    wrap = (s) => wrapStorage(s, chaos);
    finishChaos = (services, store, player) => installChaos(services, chaos, store, player);
  }

  const services = await createServices(wrap);
  installGlobalErrorHandlers(services.diagnostics);

  let local: Storage | null = null;
  try {
    local = window.localStorage;
  } catch {
    local = null;
  }
  const store = new AppStore(
    services,
    [...builtinSongs(), ...testSongs, ...allRollExercises()],
    local,
  );
  await store.load();
  const player = new Player(services, store);
  // iOS doesn't fire beforeunload; pagehide is the last chance to save (DEVELOPMENT.md §5.2).
  window.addEventListener("pagehide", () => {
    store.flushSession();
    player.stop();
  });
  finishChaos?.(services, store, player);

  root.textContent = ""; // the "Loading…" placeholder from index.html
  render(
    <ErrorBoundary diagnostics={services.diagnostics}>
      <App services={services} store={store} player={player} />
    </ErrorBoundary>,
    root,
  );
}

void start();
