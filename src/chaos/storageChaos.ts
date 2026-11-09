// Chaos wrapper for P1 storage (CHAOS_TESTING.md §6.1).

import type { KeyValueStore, StoreName } from "../platform/types.ts";
import type { ChaosController, FaultSpec } from "./controller.ts";

function domError(name: string, message: string): Error {
  // DOMException where available (browsers, Node 17+), so app code sees the real error shape.
  try {
    return new DOMException(message, name);
  } catch {
    const e = new Error(message);
    e.name = name;
    return e;
  }
}

async function inject(fault: FaultSpec | null): Promise<void> {
  if (!fault) return;
  switch (fault.kind) {
    case "slow":
      await new Promise((r) => setTimeout(r, fault.delayMs ?? 500));
      return;
    case "hang":
      await new Promise(() => {}); // never settles
      return;
    default:
      throw domError(fault.kind, `Injected ${fault.kind}`);
  }
}

export function wrapStorage(store: KeyValueStore, chaos: ChaosController): KeyValueStore {
  const op = (name: string) => inject(chaos.check("storage", name));
  return {
    async get<T>(s: StoreName, key: string) {
      await op("get");
      return store.get<T>(s, key);
    },
    async put<T>(s: StoreName, key: string, value: T) {
      await op("put");
      return store.put(s, key, value);
    },
    async delete(s: StoreName, key: string) {
      await op("delete");
      return store.delete(s, key);
    },
    async keys(s: StoreName) {
      await op("keys");
      return store.keys(s);
    },
    async writeAll(ops) {
      await op("writeAll");
      return store.writeAll(ops);
    },
    async putMany<T>(s: StoreName, entries: readonly (readonly [string, T])[]) {
      await op("putMany");
      return store.putMany(s, entries);
    },
    close() {
      store.close();
    },
  };
}
