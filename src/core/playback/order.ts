// C9 · Playback order map: the order measures are played in, with repeats and endings
// expanded, and the loop orders built on it (F8 section loops, F26 part loops).
//
// Endings: a first ending runs from its first measure through the measure with the end
// repeat; it is skipped the second time through. A second (or later) ending is the measure
// after the repeat sign. Nested repeats are not supported (fiddle tunes don't use them).

import type { SongIndex } from "../song/abcIndex.ts";

/** Positions in index.measures, in the order they are played. */
export function playbackOrder(index: SongIndex): number[] {
  const ms = index.measures;
  const order: number[] = [];
  const firstEnding = new Set<number>();
  // Measures inside a first ending (to skip on the repeat).
  for (let i = 0; i < ms.length; i++) {
    if (ms[i]!.ending === "1") {
      for (let j = i; j < ms.length; j++) {
        firstEnding.add(j);
        if (ms[j]!.endRepeat) break;
      }
    }
  }

  let sectionStart = 0;
  let secondPass = false;
  let guard = 0;
  for (let i = 0; i < ms.length && guard < ms.length * 4; guard++) {
    const m = ms[i]!;
    if (m.startRepeat && !secondPass) sectionStart = i;
    if (secondPass && firstEnding.has(i)) {
      i++;
      continue;
    }
    order.push(i);
    if (m.endRepeat) {
      if (!secondPass) {
        secondPass = true;
        i = sectionStart;
        continue;
      }
      secondPass = false;
      sectionStart = i + 1;
    } else if (secondPass && m.ending !== undefined && m.ending !== "1") {
      // A second ending ends the repeated section.
      secondPass = false;
      sectionStart = i + 1;
    }
    i++;
  }
  return order;
}

export type LoopSpec =
  | { readonly kind: "song" }
  | { readonly kind: "section"; readonly from: number; readonly to: number };

/**
 * The positions one pass of a loop plays. A section loop plays the written measures from…to
 * in order and ignores repeat signs inside (DEVELOPMENT.md F8); `from`/`to` are written
 * measure numbers and may be given either way round.
 */
export function loopOrder(index: SongIndex, loop: LoopSpec): number[] {
  if (loop.kind === "song") return playbackOrder(index);
  const lo = Math.min(loop.from, loop.to);
  const hi = Math.max(loop.from, loop.to);
  const out: number[] = [];
  index.measures.forEach((m, i) => {
    if (m.index >= lo && m.index <= hi) out.push(i);
  });
  return out.length > 0 ? out : playbackOrder(index);
}
