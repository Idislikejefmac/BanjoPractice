// C9 parts (F26): the A part, B part… of a tune, for one-tap part loops.
// From P: labels in the body if the song has them, otherwise from the repeat structure:
// each repeated section (|: … :|) is a part, and so is each unrepeated stretch between them.
// A pickup belongs to the first part.

import type { SongIndex } from "../song/abcIndex.ts";
import { isFirstEnding } from "./order.ts";

export interface SongPart {
  readonly label: string;
  /** Written measure numbers, inclusive. */
  readonly from: number;
  readonly to: number;
}

const LETTERS = "ABCDEFGH";

/** P: labels in the music body, with the position of the first measure each one starts. */
function bodyPartLabels(abc: string, index: SongIndex): { label: string; at: number }[] {
  const out: { label: string; at: number }[] = [];
  const re = /(?:^P:\s*([A-Za-z0-9]+)\s*$|\[P:\s*([A-Za-z0-9]+)\])/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(abc)) !== null) {
    if (m.index < index.bodyStart) continue;
    const label = (m[1] ?? m[2])!;
    // A measure's range starts right after the previous bar, so a label belongs to the first
    // measure that ends after it.
    const at = index.measures.findIndex((ms) => ms.endChar > m!.index);
    if (at >= 0) out.push({ label, at });
  }
  return out;
}

export function songParts(abc: string, index: SongIndex): SongPart[] {
  const ms = index.measures;
  if (ms.length === 0) return [];

  const labels = bodyPartLabels(abc, index);
  if (labels.length >= 2) {
    return labels.map((l, i) => {
      const end = (labels[i + 1]?.at ?? ms.length) - 1;
      const from = i === 0 ? ms[0]!.index : ms[l.at]!.index;
      return { label: l.label, from, to: ms[end]!.index };
    });
  }

  // From the repeat structure.
  const sections: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i]!;
    if (m.startRepeat && i > start) {
      sections.push({ start, end: i - 1 });
      start = i;
    }
    const next = ms[i + 1];
    const nextIsSecondEnding = next?.ending !== undefined && !isFirstEnding(next);
    if ((m.endRepeat && !nextIsSecondEnding) || (m.ending !== undefined && !isFirstEnding(m))) {
      sections.push({ start, end: i });
      start = i + 1;
    }
  }
  if (start < ms.length) sections.push({ start, end: ms.length - 1 });
  // A lone pickup measure joins the first part.
  if (sections.length > 1 && sections[0]!.end === 0 && ms[0]!.index === 0) {
    sections.shift();
    sections[0]!.start = 0;
  }
  if (sections.length < 2) return [];
  return sections.map((s, i) => ({
    label: LETTERS[i] ?? String(i + 1),
    from: ms[s.start]!.index,
    to: ms[s.end]!.index,
  }));
}
