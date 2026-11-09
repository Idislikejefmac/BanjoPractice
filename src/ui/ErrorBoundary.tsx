import type { ComponentChildren } from "preact";
import { Component } from "preact";
import type { Diagnostics } from "../platform/diagnostics.ts";

interface Props {
  diagnostics: Diagnostics;
  children: ComponentChildren;
}

interface State {
  failed: boolean;
}

/** Never a blank screen (CHAOS_TESTING.md I12): show a way back instead. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  override componentDidCatch(error: unknown): void {
    // Also to the console, so tests and the chaos monkey see it (I1).
    console.error("UI error boundary:", error);
    this.props.diagnostics.log("error", error instanceof Error ? error.message : String(error), {
      stack: error instanceof Error ? error.stack : undefined,
      context: "UI error boundary",
    });
    this.setState({ failed: true });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main class="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>Your songs are safe. Tap Reload to start the app again.</p>
        {/* No URL bar in a Home Screen app, so recovery must be a button. */}
        <button type="button" class="big-button" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    );
  }
}
