// R2 · Draws one line of tab from the primitives in tabLayout.ts.
// Colors come from CSS variables, so the finger colors setting (F20) and the grey-badge
// option (F22) need no re-layout.

import type { TabPrimitives } from "./tabLayout.ts";

interface Props {
  readonly p: TabPrimitives;
  /** Written measure number to highlight (phase 2: the playing measure). */
  readonly highlight?: number | null;
  /** F28 step mode: the note(s) at this measure and slot are drawn larger. */
  readonly stepAt?: { readonly measure: number; readonly slot: number } | null;
  readonly label?: string;
}

export function TabSvg({ p, highlight = null, stepAt = null, label = "Banjo tab" }: Props) {
  const isStep = (measure: number, slot: number) =>
    stepAt !== null && stepAt.measure === measure && stepAt.slot === slot;
  const u = p.fontSize / 12.5;
  return (
    <svg
      class="tab"
      width={p.width}
      height={p.height}
      viewBox={`0 0 ${p.width} ${p.height}`}
      role="img"
      aria-label={label}
    >
      {p.measureBoxes.map((b) => (
        <rect
          key={`box${b.index}`}
          class={b.index === highlight ? "tab-measure current" : "tab-measure"}
          data-measure={b.index}
          x={b.x}
          y={0}
          width={b.width}
          height={p.height}
        />
      ))}

      {p.stringY.map((y, i) => (
        <line key={`s${i}`} class="tab-string" x1={p.lineLeft} x2={p.lineRight} y1={y} y2={y} />
      ))}
      <text class="tab-clef" x={p.lineLeft + 4 * u} y={(p.stringY[0]! + p.stringY[4]!) / 2}>
        TAB
      </text>
      {p.bars.map((b, i) => (
        <line
          key={`b${i}`}
          class={b.thick ? "tab-bar thick" : "tab-bar"}
          x1={b.x}
          x2={b.x}
          y1={p.stringY[0]}
          y2={p.stringY[4]}
        />
      ))}
      {p.repeatDots.map((d, i) => (
        <circle key={`r${i}`} class="tab-dot" cx={d.x} cy={d.y} r={d.r} />
      ))}

      {p.rollLabels.map((t, i) => (
        <text key={`rl${i}`} class="tab-roll" x={t.x} y={t.y}>
          {t.text}
        </text>
      ))}
      {p.chordLabels.map((t, i) => (
        <text key={`c${i}`} class="tab-chord" x={t.x} y={t.y}>
          {t.text}
        </text>
      ))}
      {p.endingLabels.map((t, i) => (
        <text key={`e${i}`} class="tab-ending" x={t.x} y={t.y}>
          {t.text}
        </text>
      ))}
      {p.measureNumber && (
        <text class="tab-measure-number" x={p.measureNumber.x} y={p.measureNumber.y}>
          {p.measureNumber.text}
        </text>
      )}

      {p.slurs.map((s, i) => (
        <g key={`sl${i}`}>
          <path class="tab-slur" d={s.d} />
          <text class="tab-slur-label" x={s.label.x} y={s.label.y}>
            {s.label.text}
          </text>
        </g>
      ))}
      {p.accents.map((t, i) => (
        <text key={`a${i}`} class="tab-accent" x={t.x} y={t.y}>
          {t.text}
        </text>
      ))}

      {p.frets.map((f) => (
        <text
          key={`f${f.measure}-${f.slot}-${f.string}`}
          class={`tab-fret${f.melody ? " melody" : ""}${isStep(f.measure, f.slot) ? " step-current" : ""}`}
          x={f.x}
          y={f.y}
          style={{
            fontSize: `${(f.melody ? p.melodyFontSize : p.fontSize) * (isStep(f.measure, f.slot) ? 1.5 : 1)}px`,
          }}
          data-measure={f.measure}
          data-slot={f.slot}
        >
          {f.text}
        </text>
      ))}

      {p.badges.map((b) => (
        <g key={`bd${b.measure}-${b.slot}-${b.y}`} class={`tab-badge finger-${b.finger}`}>
          <circle cx={b.x} cy={b.y} r={b.r * (isStep(b.measure, b.slot) ? 1.6 : 1)} />
          <text
            x={b.x}
            y={b.y}
            style={{ fontSize: `${b.r * 1.25 * (isStep(b.measure, b.slot) ? 1.6 : 1)}px` }}
          >
            {b.finger}
          </text>
        </g>
      ))}

      {p.stems.map((s, i) => (
        <line key={`st${i}`} class="tab-stem" x1={s.x} x2={s.x} y1={s.y1} y2={s.y2} />
      ))}
      {p.beams.map((b, i) => (
        <rect key={`bm${i}`} class="tab-beam" x={b.x1} y={b.y} width={b.x2 - b.x1} height={b.h} />
      ))}
      {p.lyricTexts.map((t, i) => (
        <text key={`ly${i}`} class="tab-lyric" x={t.x} y={t.y}>
          {t.text}
        </text>
      ))}
      {p.rests.map((r, i) => (
        <text key={`rs${i}`} class="tab-rest" x={r.x} y={r.y}>
          {r.text}
        </text>
      ))}
    </svg>
  );
}
