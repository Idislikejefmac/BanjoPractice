// C9 · Playback order map: the order measures are played in, with repeats and endings
// expanded, and the loop orders built on it (F8 section loops, F26 part loops).
//
// Endings: a repeated section is played as many times as its endings ask for (two when it
// has none, or "|:… [1 … :|[2 …"; three for "[1,2 … :|[3"; four for "[1-3 … :|[4"). An ending
// before the repeat sign runs from its first measure to the next ending or the repeat sign and
// is played only on the passes its label names. Endings after the repeat sign are played on
// the last pass, which then carries on. Nested repeats are not supported (songs and fiddle
// tunes don't use them).

import type { IndexedMeasure, SongIndex } from "../song/abcIndex.ts";

/**
 * The passes an ending label names: "1" → [1], "1,2" → [1, 2], "1-3" → [1, 2, 3]. Labels that
 * can't be read count as the first pass, the way a plain first ending works.
 */
export function endingPasses(label: string): number[] {
  const passes = new Set<number>();
  for (const part of label.split(/[,\s]+/)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) passes.add(n);
    } else if (/^\d+$/.test(part)) {
      passes.add(Number(part));
    }
  }
  return passes.size > 0 ? [...passes].sort((a, b) => a - b) : [1];
}

/** True for an ending played on the first pass, i.e. one that comes before the repeat sign. */
export function isFirstEnding(m: IndexedMeasure): boolean {
  return m.ending !== undefined && endingPasses(m.ending).includes(1);
}

/** Positions in index.measures, in the order they are played. */
export function playbackOrder(index: SongIndex): number[] {
  const ms = index.measures;

  // The passes each measure inside an ending before a repeat sign plays on.
  const onlyOn = new Map<number, number[]>();
  for (let i = 0; i < ms.length; i++) {
    const label = ms[i]!.ending;
    if (label === undefined) continue;
    // An ending that starts right after a repeat sign is a last-pass ending: always played.
    if (i > 0 && ms[i - 1]!.endRepeat) continue;
    const passes = endingPasses(label);
    for (let j = i; j < ms.length; j++) {
      if (j > i && ms[j]!.ending !== undefined) break;
      onlyOn.set(j, passes);
      if (ms[j]!.endRepeat) break;
    }
  }

  /** How many times the section ending at the repeat sign at `end` is played. */
  const passesFor = (from: number, end: number): number => {
    let most = 1;
    const look = (m: IndexedMeasure | undefined) => {
      if (m?.ending !== undefined) most = Math.max(most, ...endingPasses(m.ending));
    };
    for (let j = from; j <= end; j++) look(ms[j]);
    // The endings after the sign: consecutive measures that start an ending, or continue one.
    for (let j = end + 1; j < ms.length && !ms[j]!.startRepeat; j++) {
      if (ms[j]!.ending === undefined) break;
      look(ms[j]);
    }
    return Math.max(2, most);
  };

  const order: number[] = [];
  let sectionStart = 0;
  let pass = 1;
  let guard = 0;
  for (let i = 0; i < ms.length && guard < ms.length * 16; guard++) {
    const m = ms[i]!;
    if (m.startRepeat && pass === 1) sectionStart = i;
    const passes = onlyOn.get(i);
    if (passes && !passes.includes(pass)) {
      // Not this pass's ending. Skipping the measure with the repeat sign ends the section.
      if (m.endRepeat) {
        pass = 1;
        sectionStart = i + 1;
      }
      i++;
      continue;
    }
    order.push(i);
    if (m.endRepeat) {
      if (pass < passesFor(sectionStart, i)) {
        pass++;
        i = sectionStart;
        continue;
      }
      pass = 1;
      sectionStart = i + 1;
    } else if (pass > 1 && m.ending !== undefined && !onlyOn.has(i)) {
      // A last-pass ending ends the repeated section.
      pass = 1;
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
