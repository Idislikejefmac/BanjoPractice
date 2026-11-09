// Diagnostics (DEVELOPMENT.md §5.3): an in-memory ring buffer mirrored to localStorage, so it
// survives an IndexedDB failure, which is the thing most likely to need diagnosing remotely.

export interface DiagnosticEntry {
  readonly time: string;
  readonly version: string;
  readonly level: "error" | "warning" | "info";
  readonly message: string;
  readonly stack?: string;
  readonly context?: string;
}

const LIMIT = 200;
const KEY = "banjo.diagnostics";

export interface Diagnostics {
  log(
    level: DiagnosticEntry["level"],
    message: string,
    extra?: { stack?: string; context?: string },
  ): void;
  entries(): readonly DiagnosticEntry[];
  clear(): void;
  /** Plain text for the share sheet. */
  report(): string;
}

export function createDiagnostics(
  version: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
): Diagnostics {
  let buffer: DiagnosticEntry[] = [];
  try {
    const saved = storage?.getItem(KEY);
    if (saved) buffer = (JSON.parse(saved) as DiagnosticEntry[]).slice(-LIMIT);
  } catch {
    buffer = [];
  }

  const persist = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(buffer));
    } catch {
      // Storage full or blocked: keep the in-memory copy.
    }
  };

  return {
    log(level, message, extra) {
      buffer.push({ time: new Date().toISOString(), version, level, message, ...extra });
      if (buffer.length > LIMIT) buffer = buffer.slice(-LIMIT);
      persist();
    },
    entries: () => buffer,
    clear() {
      buffer = [];
      try {
        storage?.removeItem(KEY);
      } catch {
        // ignore
      }
    },
    report() {
      const lines = buffer.map(
        (e) =>
          `${e.time} [${e.level}] v${e.version} ${e.message}${e.context ? ` (${e.context})` : ""}${e.stack ? `\n${e.stack}` : ""}`,
      );
      return [`Banjo Practice diagnostics, ${buffer.length} entries`, ...lines].join("\n");
    },
  };
}

/** Records uncaught errors and unhandled rejections. */
export function installGlobalErrorHandlers(diag: Diagnostics): void {
  window.addEventListener("error", (e) => {
    diag.log("error", e.message || "Uncaught error", {
      stack: e.error instanceof Error ? e.error.stack : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: unknown = e.reason;
    diag.log("error", r instanceof Error ? r.message : `Unhandled rejection: ${String(r)}`, {
      stack: r instanceof Error ? r.stack : undefined,
    });
  });
}
