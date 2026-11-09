// F3 notation view + F4 tab view, aligned line by line (R1–R3), with F22 display options and
// F35 scroll restore (the measure at the top of the screen is saved in the session).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import { SIZE_STEPS, measuresPerLine } from "../app/model.ts";
import type { ArrangedMeasure } from "../core/banjo/types.ts";
import { capoPlan } from "../core/banjo/tuning.ts";
import { formatKey } from "../core/music/keys.ts";
import type { IndexedMeasure } from "../core/song/abcIndex.ts";
import type { DisplayLine } from "../core/song/layoutAbc.ts";
import { lineAbc, lineBreaks } from "../core/song/layoutAbc.ts";
import type { LoadedSong } from "../core/song/song.ts";
import { loadSong, songNotes } from "../core/song/song.ts";
import type { LineMeasureInfo } from "../render/notation.ts";
import { renderNotationLine } from "../render/notation.ts";
import type { MeasureGeometry, TabLayoutOptions } from "../render/tabLayout.ts";
import { evenGeometry, layoutTabLine } from "../render/tabLayout.ts";
import { TabSvg } from "../render/TabSvg.tsx";

/** Notation is drawn a little smaller than the tab: Dad reads mainly tab (F4). */
const NOTATION_SCALE = 0.9;
const TAB_SCALE = 1.1;

function info(m: IndexedMeasure): LineMeasureInfo {
  return {
    index: m.index,
    slots: m.slots,
    ...(m.startRepeat ? { startRepeat: true } : {}),
    ...(m.endRepeat ? { endRepeat: true } : {}),
    ...(m.ending !== undefined ? { ending: m.ending } : {}),
    barRight: m.barRight,
  };
}

function useWidth(ref: { current: HTMLElement | null }): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      // Debounced: re-laying out every line on each resize frame would block the main thread.
      t = setTimeout(() => setWidth(Math.floor(el.clientWidth)), 150);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [ref]);
  return width;
}

interface LineProps {
  readonly loaded: LoadedSong;
  readonly line: DisplayLine;
  readonly lineNo: number;
  readonly width: number;
  readonly scale: number;
  readonly tabOnly: boolean;
  readonly arranged: readonly ArrangedMeasure[] | null;
  readonly tabOpts: Omit<TabLayoutOptions, "scale" | "showChords" | "showMeasureNumber">;
}

function SongLine({ loaded, line, lineNo, width, scale, tabOnly, arranged, tabOpts }: LineProps) {
  const notationRef = useRef<HTMLDivElement>(null);
  const measures = loaded.index.measures.slice(line.from, line.to);
  const infos = measures.map(info);
  const [geometry, setGeometry] = useState<MeasureGeometry[] | null>(null);

  useLayoutEffect(() => {
    const el = notationRef.current;
    if (tabOnly || !el) {
      setGeometry(evenGeometry(infos, width, 34 * scale));
      return;
    }
    const abc = lineAbc(loaded.song.abc, loaded.index, line, { showMeter: lineNo === 0 });
    let result = null;
    try {
      result = renderNotationLine(el, abc, width, NOTATION_SCALE * scale, infos);
    } catch {
      result = null;
    }
    setGeometry(result?.geometry ?? evenGeometry(infos, width, 34 * scale));
    // `infos` is derived from `loaded` and `line`, which are the dependencies.
  }, [loaded, line, lineNo, width, scale, tabOnly]);

  const tab =
    geometry && arranged
      ? layoutTabLine(arranged.slice(line.from, line.to), geometry, width, {
          ...tabOpts,
          scale: TAB_SCALE * scale,
          showChords: tabOnly,
          showMeasureNumber: true,
          ...(tabOnly ? { lineStart: 0 } : {}),
        })
      : null;

  return (
    <div
      class="song-line"
      data-first-measure={measures[0]?.index ?? 0}
      data-last-measure={measures[measures.length - 1]?.index ?? 0}
    >
      {!tabOnly && <div class="notation" ref={notationRef} aria-label="Notation" />}
      {tab && (
        <TabSvg
          p={tab}
          label={`Tab, measures ${measures[0]?.index ?? 0} to ${measures[measures.length - 1]?.index ?? 0}`}
        />
      )}
    </div>
  );
}

export function SongView({ store }: { store: AppStore }) {
  const song = store.currentSong.value;
  const settings = store.settings.value;
  const view = store.view.value;
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useWidth(containerRef);
  const scale = SIZE_STEPS[settings.size] ?? 1;
  const tabOnly = view === "tab";

  const loaded = useMemo(() => (song ? loadSong(song) : null), [song]);
  const lines = useMemo(() => {
    if (!loaded || width <= 0) return [];
    const per = measuresPerLine(width, TAB_SCALE * scale);
    return lineBreaks(loaded.index.measures, per);
  }, [loaded, width, scale]);

  const arranged = loaded?.arrangement && !loaded.stale ? loaded.arrangement.measures : null;
  const plan = capoPlan(0, settings.spikes);
  const tabOpts = {
    showRollNames: settings.showRollNames,
    showAccents: settings.showAccents,
    fretNumbering: settings.fretNumbering,
    plan,
  };

  // Scroll: restore the saved place once per song, then keep the session up to date.
  const restored = useRef<string | null>(null);
  const restoring = useRef(false);
  const openNonce = store.openNonce.value;
  const lastNonce = useRef(openNonce);
  useLayoutEffect(() => {
    if (!song || lines.length === 0) return;
    if (openNonce !== lastNonce.current) {
      lastNonce.current = openNonce;
      restored.current = song.id;
      window.scrollTo(0, 0);
      return;
    }
    if (restored.current === song.id) return;
    restored.current = song.id;
    const target = store.session.peek().topMeasure;
    if (target <= 0) return;
    // The tab lines finish drawing over the next frames, and until then the page may be too
    // short to scroll that far. Keep trying until the line is at the top (or ~1 s passes),
    // and don't record scroll positions meanwhile.
    restoring.current = true;
    let tries = 0;
    let frame = 0;
    const attempt = () => {
      const el = [...document.querySelectorAll<HTMLElement>(".song-line")].find(
        (l) => Number(l.dataset.lastMeasure) >= target,
      );
      if (el) {
        const offset = el.getBoundingClientRect().top - toolbarHeight();
        if (Math.abs(offset) > 2) window.scrollTo(0, window.scrollY + offset);
        if (Math.abs(el.getBoundingClientRect().top - toolbarHeight()) <= 2 && tries > 3) {
          restoring.current = false;
          return;
        }
      }
      if (++tries > 60) {
        restoring.current = false;
        return;
      }
      frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => {
      cancelAnimationFrame(frame);
      restoring.current = false;
    };
  }, [song, lines, openNonce, store]);

  useEffect(() => {
    if (!song) return;
    let frame = 0;
    const onScroll = () => {
      if (restoring.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = toolbarHeight() + 4;
        const el = [...document.querySelectorAll<HTMLElement>(".song-line")].find(
          (l) => l.getBoundingClientRect().bottom > top,
        );
        store.setTopMeasure(window.scrollY < 4 ? 0 : Number(el?.dataset.firstMeasure ?? 0));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [song, store]);

  if (!song || !loaded) return null;
  const notes = songNotes(song.abc);
  const index = loaded.index;
  const brokenRules = loaded.violations.filter((v) => v.severity === "error");

  return (
    <article class="song" aria-label={song.title}>
      <header class="song-head">
        <h2>{song.title}</h2>
        <p class="song-meta">
          <span>Key of {formatKey(index.key)}</span>
          <span>
            {index.meter.num}/{index.meter.den}
          </span>
          <span class="capo-instruction">No capo</span>
          {song.credit && <span>{song.credit}</span>}
        </p>
        {notes.map((n) => (
          <p class="song-note" key={n}>
            {n}
          </p>
        ))}
        {loaded.arrangement === null && !loaded.stale && (
          <p class="song-note">This song has no banjo tab yet.</p>
        )}
        {loaded.stale && (
          <p class="song-note warn" role="status">
            The tab for this song doesn't match the notation, so only the notation is shown.
          </p>
        )}
        {brokenRules.length > 0 && (
          <p class="song-note warn" role="status">
            {brokenRules.length} place(s) in this tab can't be played as written (measure{" "}
            {[...new Set(brokenRules.map((v) => v.measure))].join(", ")}).
          </p>
        )}
      </header>
      <div class="song-lines" ref={containerRef}>
        {width > 0 &&
          lines.map((line, i) => (
            <SongLine
              key={`${line.from}-${line.to}-${width}-${scale}-${view}`}
              loaded={loaded}
              line={line}
              lineNo={i}
              width={width}
              scale={scale}
              tabOnly={tabOnly}
              arranged={arranged}
              tabOpts={tabOpts}
            />
          ))}
      </div>
    </article>
  );
}

function toolbarHeight(): number {
  return document.querySelector(".toolbar")?.getBoundingClientRect().height ?? 0;
}
