import type { ArrangedMeasure } from "../../src/core/banjo/types.ts";
import { parseTab } from "../../src/core/tab/tabText.ts";

/** Parses tab text that is expected to be valid; throws with the parser's errors otherwise. */
export function tab(text: string): ArrangedMeasure[] {
  const result = parseTab(text);
  if (!result.ok) {
    const details = result.errors.map((e) => `  line ${e.line}, col ${e.column}: ${e.message}`).join("\n");
    throw new Error(`Test tab failed to parse:\n${details}`);
  }
  return result.measures;
}

/** The four fixture measures from DEVELOPMENT.md §3 C5, read as one piece. */
export const SPEC_FIXTURE = `
m1  G          forward          | 3:0T* 2:0I 1:0M 5:0T> 2:0I 1:0M* 5:0T> 1:0M |
m2  C@1 G@5    alt-thumb        | 4:2T 2:1I* 5:0T 1:2M 3:0T 2:0I* 5:0T 1:0M |
m3  G          lick:slide-3     | 3:2T /3:3 2:0I* 1:0M 5:0T 2:0I 1:0M - |
m4  G          tag              | 3:0T 2:0I [5:0T,1:0M] - 3:0T . [5:0T,1:0M] - |
`;
