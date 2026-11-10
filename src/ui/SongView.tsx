// F3 notation view + F4 tab view, aligned line by line (R1–R3), with F22 display options and
// F35 scroll restore (the measure at the top of the screen is saved in the session).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Player } from "../app/player.ts";
import type { AppStore } from "../app/store.ts";
import { practiceArrangement } from "../core/song/practiceArrangement.ts";
import type { SongIndex } from "../core/song/abcIndex.ts";
import { indexAbc } from "../core/song/abcIndex.ts";
import { transposeAbc } from "../core/song/transposeAbc.ts";
import { SIZE_STEPS, measuresPerLine } from "../app/model.ts";
import type { ArrangedMeasure } from "../core/banjo/types.ts";
import { capoPlan } from "../core/banjo/tuning.ts";
import { formatKey } from "../core/music/keys.ts";
import type { IndexedMeasure } from "../core/song/abcIndex.ts";
import type { DisplayLine } from "../core/song/layoutAbc.ts";
import { lineAbc, lineBreaks, splitLines } from "../core/song/layoutAbc.ts";
import type { LoadedSong } from "../core/song/song.ts";
import { loadSong, songNotes } from "../core/song/song.ts";
import type { LineMeasureInfo } from "../render/notation.ts";
import { renderNotationLine } from "../render/notation.ts";
import type { MeasureGeometry, TabLayoutOptions } from "../render/tabLayout.ts";
import { evenGeometry, layoutTabLine } from "../render/tabLayout.ts";
import { TabSvg } from "../render/TabSvg.tsx";

/** Notation is drawn a little smaller than the tab: Dad reads mainly tab (F4). */
const NOTATION_SCALE = 0.9;
const NO_CUTS: readonly number[] = [];
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
  /** ABC and index for the notation: the song transposed to the sounding key (F11). */
  readonly notation: { readonly abc: string; readonly index: SongIndex };
  /** Written measure number playing now (F10). */
  readonly current: number | null;
  /** F16: a chord symbol in the notation was tapped. */
  readonly onChordTap: (chord: string) => void;
  /** F28: the step cursor's measure and slot. */
  readonly stepAt: { readonly measure: number; readonly slot: number } | null;
  /** F30: the note playing now (not while stepping). */
  readonly playAt: { readonly measure: number; readonly slot: number } | null;
  /** The notation came out wider than the screen: use fewer measures on each line. */
  readonly onTooWide: (from: number, to: number) => void;
  readonly line: DisplayLine;
  readonly lineNo: number;
  readonly width: number;
  readonly scale: number;
  readonly tabOnly: boolean;
  readonly arranged: readonly ArrangedMeasure[] | null;
  readonly tabOpts: Omit<TabLayoutOptions, "scale" | "showChords" | "showMeasureNumber"> & {
    readonly showLyrics: boolean;
  };
}

function SongLine({
  loaded,
  notation,
  current,
  stepAt,
  playAt,
  onTooWide,
  onChordTap,
  line,
  lineNo,
  width,
  scale,
  tabOnly,
  arranged,
  tabOpts,
}: LineProps) {
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
    const abc = lineAbc(notation.abc, notation.index, line, {
      showMeter: lineNo === 0,
      showLyrics: tabOpts.showLyrics,
    });
    let result = null;
    try {
      result = renderNotationLine(el, abc, width, NOTATION_SCALE * scale, infos, onChordTap);
    } catch {
      result = null;
    }
    // Words under crowded notes can make abcjs draw the staff wider than asked for.
    if (result && result.drawnWidth > width + 2) onTooWide(line.from, line.to);
    setGeometry(result?.geometry ?? evenGeometry(infos, width, 34 * scale));
    // `infos` is derived from `loaded` and `line`, which are the dependencies.
  }, [loaded, notation, line, lineNo, width, scale, tabOnly, tabOpts.showLyrics]);

  const tab =
    geometry && arranged
      ? layoutTabLine(arranged.slice(line.from, line.to), geometry, width, {
          ...tabOpts,
          scale: TAB_SCALE * scale,
          showChords: tabOnly,
          showMeasureNumber: true,
          ...(tabOnly && tabOpts.showLyrics ? { lyrics: lyricsFor(measures) } : {}),
          ...(tabOnly ? { lineStart: 0 } : {}),
        })
      : null;

  // The playing measure, highlighted across both staves (light yellow, never blue).
  const box = current !== null ? geometry?.find((g) => g.index === current) : undefined;

  return (
    <div
      class={box ? "song-line playing" : "song-line"}
      data-first-measure={measures[0]?.index ?? 0}
      data-last-measure={measures[measures.length - 1]?.index ?? 0}
    >
      {box && (
        <div
          class="measure-highlight"
          data-measure={box.index}
          style={{ left: `${box.left}px`, width: `${box.right - box.left}px` }}
        />
      )}
      {!tabOnly && <div class="notation" ref={notationRef} aria-label="Notation" />}
      {tab && (
        <TabSvg
          p={tab}
          highlight={current}
          stepAt={stepAt}
          playAt={playAt}
          label={`Tab, measures ${measures[0]?.index ?? 0} to ${measures[measures.length - 1]?.index ?? 0}`}
        />
      )}
    </div>
  );
}

export function SongView({ store, player }: { store: AppStore; player: Player }) {
  const song = store.currentSong.value;
  const settings = store.settings.value;
  const view = store.view.value;
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useWidth(containerRef);
  const scale = SIZE_STEPS[settings.size] ?? 1;
  const tabOnly = view === "tab";

  const loaded = useMemo(() => (song ? loadSong(song) : null), [song]);
  // Words under crowded notes can make abcjs draw a line wider than the screen. A line that
  // does reports its measures here and is cut in two; every other line is left as it was. The
  // cuts are remembered with the song, width and size they were found for, so a different one
  // starts afresh (no reset effect: it would run after the first render and undo them).
  const fitKey = `${song?.id}|${width}|${scale}|${view}|${settings.showLyrics}`;
  const [fit, setFit] = useState<{ key: string; cuts: readonly number[] }>({
    key: fitKey,
    cuts: [],
  });
  const cuts = fit.key === fitKey ? fit.cuts : NO_CUTS;
  const tooWide = useCallback(
    (from: number, to: number) =>
      setFit((s) => {
        const have = s.key === fitKey ? s.cuts : NO_CUTS;
        const mid = from + Math.ceil((to - from) / 2);
        if (to - from < 2 || have.includes(mid)) return s;
        return { key: fitKey, cuts: [...have, mid] };
      }),
    [fitKey],
  );
  const lines = useMemo(() => {
    if (!loaded || width <= 0) return [];
    const per = measuresPerLine(width, TAB_SCALE * scale);
    return splitLines(lineBreaks(loaded.index.measures, per), cuts);
  }, [loaded, width, scale, cuts]);

  const keyShift = store.practice.value.keyShift;
  const rolls = store.practice.value.rolls;
  const shapeNotation = store.practice.value.notationKey === "shape";
  // The tab for this key: the hand-written one with a capo, or C6's in new shapes (F11, F14).
  const practiceTab = useMemo(
    () => (loaded ? practiceArrangement(loaded, keyShift, settings.spikes, rolls) : null),
    [loaded, keyShift, settings.spikes, rolls],
  );
  const position = practiceTab?.plan ?? null;
  const arranged = practiceTab?.measures ?? null;
  // Notation in the sounding key (C1 transposes the ABC text; abcjs only draws it), or in
  // the tab's shape key (F34).
  const notation = useMemo(() => {
    if (!loaded || !practiceTab) return null;
    if (shapeNotation) return { abc: practiceTab.abc, index: practiceTab.index };
    if (keyShift === 0) return { abc: loaded.song.abc, index: loaded.index };
    const t = transposeAbc(loaded.song.abc, keyShift, practiceTab.plan.soundingKey);
    return { abc: t.abc, index: indexAbc(t.abc) };
  }, [loaded, practiceTab, keyShift, shapeNotation]);
  const tabOpts = {
    showRollNames: settings.showRollNames,
    showAccents: settings.showAccents,
    fretNumbering: settings.fretNumbering,
    plan: position?.capo ?? capoPlan(0, settings.spikes),
    showLyrics: settings.showLyrics,
  };
  const follow = player.follow.value;
  const current = follow.measure;
  const openChord = useMemo(() => (chord: string) => (store.chordFinder.value = chord), [store]);
  const stepAt =
    player.step.value && follow.measure !== null && follow.slot !== null
      ? { measure: follow.measure, slot: follow.slot }
      : null;
  const playAt =
    !player.step.value &&
    player.state.value !== "stopped" &&
    follow.countIn === null &&
    !follow.yourTurn &&
    follow.measure !== null &&
    follow.slot !== null
      ? { measure: follow.measure, slot: follow.slot }
      : null;

  // F10 follow: keep the playing line in the upper third. A manual scroll pauses it for 4 s.
  const pausedUntil = useRef(0);
  const programmatic = useRef(false);
  useEffect(() => {
    if (current === null || Date.now() < pausedUntil.current) return;
    const el = [...document.querySelectorAll<HTMLElement>(".song-line")].find(
      (l) => Number(l.dataset.firstMeasure) <= current && Number(l.dataset.lastMeasure) >= current,
    );
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = toolbarHeight();
    const band = top + (window.innerHeight - top) / 3;
    if (r.top < top || r.top > band) {
      programmatic.current = true;
      window.scrollTo({ top: window.scrollY + r.top - top - 8, behavior: "smooth" });
      setTimeout(() => (programmatic.current = false), 600);
    }
  }, [current]);
  useEffect(() => {
    const onUser = () => {
      if (!programmatic.current && player.state.peek() !== "stopped") {
        pausedUntil.current = Date.now() + 4000;
      }
    };
    window.addEventListener("wheel", onUser, { passive: true });
    window.addEventListener("touchmove", onUser, { passive: true });
    return () => {
      window.removeEventListener("wheel", onUser);
      window.removeEventListener("touchmove", onUser);
    };
  }, [player]);

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
    <article class={follow.yourTurn ? "song your-turn" : "song"} aria-label={song.title}>
      {follow.yourTurn && (
        <p class="your-turn-label" role="status">
          Your turn
        </p>
      )}
      <header class="song-head">
        <h2>{song.title}</h2>
        <p class="song-meta">
          <span>Key of {formatKey(position?.soundingKey ?? index.key)}</span>
          {keyShift > 0 && shapeNotation && practiceTab && (
            <span data-testid="notation-key">
              Notes shown in {formatKey(practiceTab.index.key)}, as the tab
            </span>
          )}
          <span>
            {index.meter.num}/{index.meter.den}
          </span>
          <PrintButton
            title={song.title}
            subtitle={`Key of ${formatKey(position?.soundingKey ?? index.key)} · ${position?.instruction ?? "No capo"}`}
            onShare={(name, blob) => player.share(name, blob)}
          />
          <span class="capo-instruction" data-testid="capo-instruction">
            {position?.instruction ?? "No capo"}
          </span>
          {song.credit && <span>{song.credit}</span>}
        </p>
        {notes.map((n) => (
          <p class="song-note" key={n}>
            {n}
          </p>
        ))}
        {practiceTab?.generated && (
          <p class="song-note" data-testid="generated-note">
            {loaded.arrangement && !loaded.stale
              ? "This key uses an auto-generated arrangement."
              : "This tab was arranged by the app."}
          </p>
        )}
        {loaded.stale && (
          <p class="song-note warn" role="status">
            The hand-written tab doesn't match the notation, so the app arranged one instead.
          </p>
        )}
        {(practiceTab?.arrangeResult?.problems ?? []).map((p) => (
          <p class="song-note warn" role="status" key={p.measure}>
            Measure {p.measure}: {p.message}.
          </p>
        ))}
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
              notation={notation!}
              current={current}
              stepAt={stepAt}
              playAt={playAt}
              onTooWide={tooWide}
              onChordTap={openChord}
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

/** F32: make a PDF of the tab (and notation) and share it. */
function PrintButton({
  title,
  subtitle,
  onShare,
}: {
  title: string;
  subtitle: string;
  onShare: (name: string, blob: Blob) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paper, setPaper] = useState<"letter" | "a4">("letter");
  const [withNotation, setWithNotation] = useState(true);
  if (!open) {
    return (
      <button class="link-button" data-action="print" onClick={() => setOpen(true)}>
        Print or save as PDF
      </button>
    );
  }
  return (
    <span class="print-options">
      <select
        name="paper"
        value={paper}
        onChange={(e) => setPaper((e.target as HTMLSelectElement).value as "letter" | "a4")}
      >
        <option value="letter">Letter</option>
        <option value="a4">A4</option>
      </select>
      <label>
        <input
          type="checkbox"
          checked={withNotation}
          onChange={(e) => setWithNotation((e.target as HTMLInputElement).checked)}
        />{" "}
        Notes too
      </label>
      <button
        class="plain-button"
        data-action="make-pdf"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void import("../render/printTab.ts")
            .then(({ printTab }) =>
              printTab([...document.querySelectorAll<HTMLElement>(".song-line")], {
                title,
                subtitle,
                paper,
                withNotation,
              }),
            )
            .then((blob) => onShare(`${title}.pdf`, blob))
            .finally(() => {
              setBusy(false);
              setOpen(false);
            });
        }}
      >
        {busy ? "Making the PDF…" : "Make PDF"}
      </button>
    </span>
  );
}

/** Lyric syllables at their slots, for printing under the tab. */
function lyricsFor(measures: readonly IndexedMeasure[]) {
  const out: { measure: number; slot: number; verse: number; text: string }[] = [];
  for (const m of measures) {
    for (const n of m.melody) {
      n.lyrics?.forEach((text, verse) => {
        const clean = text.replace(/_$/, "");
        if (clean) out.push({ measure: m.index, slot: n.slot, verse, text: clean });
      });
    }
  }
  return out;
}

function toolbarHeight(): number {
  return document.querySelector(".toolbar")?.getBoundingClientRect().height ?? 0;
}
