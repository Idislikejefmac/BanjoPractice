// Built-in songs (F5), bundled from songs/*.abc and songs/*.tab at build time (DEVELOPMENT.md
// §8.1). IDs are the file names, so they stay stable.
//
// Only songs taken from a real source (Dad's sheet music, or a verified public-domain printing)
// go in songs/. Songs still waiting for one are listed in WANTED_SONGS and shown as such.

import type { Song } from "../core/song/song.ts";
import { builtinSong } from "../core/song/song.ts";

const abcFiles = import.meta.glob("../../songs/*.abc", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const tabFiles = import.meta.glob("../../songs/*.tab", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const idOf = (path: string) => path.replace(/^.*\//, "").replace(/\.(abc|tab)$/, "");

export function builtinSongs(): Song[] {
  const tabs = new Map(Object.entries(tabFiles).map(([p, text]) => [idOf(p), text]));
  return Object.entries(abcFiles)
    .map(([p, abc]) => builtinSong(idOf(p), abc, tabs.get(idOf(p))))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Songs Dad wants that don't have a reliable source yet (songs/STATUS.md). */
export const WANTED_SONGS: readonly { readonly title: string; readonly note: string }[] = [
  {
    title: "Cripple Creek",
    note: "Waiting for Dad's sheet music: no public-domain printing of the melody found yet.",
  },
  {
    title: "Old Joe Clark",
    note: "A 1912 printing exists but has unclear notes; waiting for Dad's sheet music to check it.",
  },
  {
    title: "Wildwood Flower",
    note: "Public-domain 1860 sheet music found (Library of Congress); to be transcribed and checked.",
  },
  {
    title: "Will the Circle Be Unbroken",
    note: "The 1907 hymn found in a 1908 hymnal (Hymnary.org); to be transcribed and checked.",
  },
];
