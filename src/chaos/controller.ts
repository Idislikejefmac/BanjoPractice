// Chaos controller (CHAOS_TESTING.md §3.1). Seeded and deterministic: with the same seed and
// the same sequence of operations, the same faults fire. Test builds only.

export type ServiceName = "storage" | "audio" | "samples" | "offline" | "wakeLock" | "input" | "mic" | "clock";

export interface FaultSpec {
  readonly service: ServiceName;
  /** Operation name, e.g. "put", or "*" for any. */
  readonly op: string;
  /** e.g. "QuotaExceededError", "UnknownError", "hang", "slow". */
  readonly kind: string;
  /** Fire on the nth matching call (1-based) only. */
  readonly nth?: number;
  /** Or fire with this probability on each matching call. */
  readonly probability?: number;
  /** For "slow": added latency in ms. */
  readonly delayMs?: number;
}

export interface FaultEvent {
  readonly seq: number;
  readonly service: ServiceName;
  readonly op: string;
  readonly kind: string;
}

export interface FaultHandle {
  readonly id: number;
}

/** mulberry32: small, fast, seedable PRNG. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ChaosController {
  private random: () => number = seededRandom(1);
  private armed = new Map<number, { spec: FaultSpec; calls: number }>();
  private nextId = 1;
  private seq = 0;
  private events: FaultEvent[] = [];

  seed(n: number): void {
    this.random = seededRandom(n);
    this.seq = 0;
    this.events = [];
  }

  arm(spec: FaultSpec): FaultHandle {
    const id = this.nextId++;
    this.armed.set(id, { spec, calls: 0 });
    return { id };
  }

  disarm(h: FaultHandle): void {
    this.armed.delete(h.id);
  }

  disarmAll(): void {
    this.armed.clear();
  }

  log(): readonly FaultEvent[] {
    return this.events;
  }

  /** Called by chaos wrappers before each operation. Returns the fault to inject, if any. */
  check(service: ServiceName, op: string): FaultSpec | null {
    this.seq++;
    for (const entry of this.armed.values()) {
      const { spec } = entry;
      if (spec.service !== service || (spec.op !== "*" && spec.op !== op)) continue;
      entry.calls++;
      const fire =
        spec.nth !== undefined ? entry.calls === spec.nth : this.random() < (spec.probability ?? 1);
      if (fire) {
        this.events.push({ seq: this.seq, service, op, kind: spec.kind });
        return spec;
      }
    }
    return null;
  }
}
