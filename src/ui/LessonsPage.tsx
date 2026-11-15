// F47 · Lessons: what Jens Kruger and Tony Trischka teach, in short plain words, with a link to
// each video. By instructor or by topic. Foundations show first; nuance and advice are a second
// layer he opens when he wants it. "Needs more information" lists the lessons where the captions
// carried only part of the teaching, so they can be filled in together. Pure display: nothing here
// is saved, and nothing needs the network except the link out to YouTube.

import { useEffect, useRef, useState } from "preact/hooks";
import type { AppStore } from "../app/store.ts";
import {
  bothCover,
  INSTRUCTORS,
  LESSONS,
  lessonById,
  lessonsFor,
  lessonsOnTopic,
  lessonUrl,
  needsMore,
  relatedLessons,
  TOPICS,
  topicsInUse,
} from "../core/learning/lessons.ts";
import type { Completeness, InstructorId, Lesson, TopicId } from "../core/learning/lessons.ts";

const COMPLETENESS: Readonly<Record<Completeness, { label: string; help: string }>> = {
  full: { label: "Complete", help: "The teaching is mostly spoken, so these notes cover it." },
  partial: {
    label: "Part is in the video",
    help: "The main idea is here; some notes or shapes are only played in the video.",
  },
  thin: {
    label: "Needs more information",
    help: "Little is spoken in this video: watch it, or find a written source.",
  },
};

const INSTRUCTOR_IDS = Object.keys(INSTRUCTORS) as InstructorId[];

function seriesLabel(l: Lesson): string {
  if (l.instructor === "jens-kruger") {
    if (l.order >= 110) return "Improvising masterclass";
    if (l.order >= 100) return "Method and masterclass";
    return `Beginner lesson ${l.order}`;
  }
  return `Video ${l.order}`;
}

export function LessonsPage({ store }: { store: AppStore }) {
  const request = store.lessonsOpen.value;
  const [mode, setMode] = useState<"instructor" | "topic">("instructor");
  const [onlyMore, setOnlyMore] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(request?.lessonId ? [request.lessonId] : []),
  );
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set()); // folded instructor/topic groups
  const [more, setMore] = useState<ReadonlySet<string>>(new Set()); // lessons whose nuance is open
  const focusId = useRef<string | null>(request?.lessonId ?? null);

  const flip = (set: ReadonlySet<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };
  const visible = (l: Lesson) => !onlyMore || needsMore(l);
  const total = LESSONS.length;
  const moreCount = LESSONS.filter(needsMore).length;

  // Bring a lesson he was sent to (from a roll, or "Also on this topic") into view.
  useEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    document
      .querySelector<HTMLElement>(`[data-lesson="${id}"]`)
      ?.scrollIntoView?.({ block: "start" });
  });

  const goTo = (id: string) => {
    const l = lessonById(id);
    if (!l) return;
    focusId.current = id;
    setMode("instructor");
    setShut((s) => {
      const next = new Set(s);
      next.delete(`i:${l.instructor}`);
      return next;
    });
    setOpen((o) => new Set(o).add(id));
  };

  const LessonRow = ({ lesson }: { lesson: Lesson }) => {
    const isOpen = open.has(lesson.id);
    const c = COMPLETENESS[lesson.completeness];
    return (
      <li class="lesson-item" data-lesson={lesson.id}>
        <button
          type="button"
          class={isOpen ? "lesson-head-button on" : "lesson-head-button"}
          data-action="lesson-toggle"
          aria-expanded={isOpen}
          onClick={() => setOpen((o) => flip(o, lesson.id))}
        >
          <span class="lesson-arrow" aria-hidden="true">
            {isOpen ? "▾" : "▸"}
          </span>
          <span class="lesson-title-block">
            <span class="lesson-item-title">{lesson.title}</span>
            <span class="lesson-item-meta">
              {INSTRUCTORS[lesson.instructor].name} · {seriesLabel(lesson)}
            </span>
          </span>
          <span class={`lesson-badge lesson-badge-${lesson.completeness}`} title={c.help}>
            {c.label}
          </span>
        </button>
        {isOpen && (
          <div class="lesson-body">
            <h4>The basics</h4>
            <ol class="lesson-points">
              {lesson.foundations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
            {lesson.nuance.length > 0 && (
              <>
                <button
                  type="button"
                  class="plain-button lesson-more-button"
                  data-action="lesson-nuance"
                  aria-expanded={more.has(lesson.id)}
                  onClick={() => setMore((m) => flip(m, lesson.id))}
                >
                  {more.has(lesson.id) ? "Hide" : "More"}: nuance and advice ({lesson.nuance.length}
                  )
                </button>
                {more.has(lesson.id) && (
                  <ul class="lesson-points lesson-nuance">
                    {lesson.nuance.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <p class="lesson-watch">
              <strong>Only in the video:</strong> {lesson.watch}
            </p>
            <p class="lesson-state">
              {c.label}. {c.help}
            </p>
            <p>
              <a
                class="big-button lesson-link"
                href={lessonUrl(lesson)}
                target="_blank"
                rel="noopener noreferrer"
                data-action="lesson-watch"
              >
                Watch on YouTube (needs internet)
              </a>
            </p>
            <RelatedLessons lesson={lesson} onGo={goTo} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div class="settings-page lessons-page" role="dialog" aria-modal="true" aria-label="Lessons">
      <header class="settings-head">
        <h2>Lessons</h2>
        <button
          class="big-button"
          data-action="lessons-done"
          onClick={() => (store.lessonsOpen.value = null)}
        >
          Done
        </button>
      </header>
      <p class="hint">
        What Jens Kruger and Tony Trischka teach, in short plain words, with a link to each video.
        The basics come first; nuance and advice are one tap further.
      </p>

      <div class="lessons-controls">
        <div class="view-switch" role="group" aria-label="Group lessons by">
          {(
            [
              ["instructor", "By instructor"],
              ["topic", "By topic"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              class={mode === m ? "view-segment on" : "view-segment"}
              data-action={`lessons-by-${m}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          class={onlyMore ? "plain-button on" : "plain-button"}
          data-action="lessons-needs-more"
          aria-pressed={onlyMore}
          onClick={() => setOnlyMore(!onlyMore)}
        >
          Needs more information ({moreCount} of {total})
        </button>
      </div>

      {mode === "instructor" &&
        INSTRUCTOR_IDS.map((id) => {
          const list = lessonsFor(id).filter(visible);
          const folded = shut.has(`i:${id}`);
          return (
            <section class="lessons-group" key={id} aria-label={INSTRUCTORS[id].name}>
              <h3>
                <button
                  type="button"
                  class="section-toggle"
                  data-action={`lessons-group-${id}`}
                  aria-expanded={!folded}
                  onClick={() => setShut((s) => flip(s, `i:${id}`))}
                >
                  <span class="section-arrow" aria-hidden="true">
                    {folded ? "▸" : "▾"}
                  </span>
                  {INSTRUCTORS[id].name}
                  <span class="section-count"> ({list.length})</span>
                </button>
              </h3>
              {!folded && (
                <>
                  <p class="lessons-blurb">{INSTRUCTORS[id].blurb}</p>
                  <ul class="lesson-list">
                    {list.map((l) => (
                      <LessonRow key={l.id} lesson={l} />
                    ))}
                  </ul>
                  {list.length === 0 && (
                    <p class="lessons-empty">Nothing here needs more information.</p>
                  )}
                </>
              )}
            </section>
          );
        })}

      {mode === "topic" &&
        topicsInUse().map(({ group, topics }) => (
          <section class="lessons-group" key={group} aria-label={group}>
            <h3 class="topic-group-title">{group}</h3>
            {topics.map((t: TopicId) => {
              const list = lessonsOnTopic(t).filter(visible);
              if (list.length === 0) return null;
              const folded = !shut.has(`t:${t}`) && false;
              void folded;
              const isShut = shut.has(`t:${t}`);
              return (
                <div class="topic-block" key={t} data-topic={t}>
                  <button
                    type="button"
                    class="section-toggle"
                    data-action="topic-toggle"
                    aria-expanded={!isShut}
                    onClick={() => setShut((s) => flip(s, `t:${t}`))}
                  >
                    <span class="section-arrow" aria-hidden="true">
                      {isShut ? "▸" : "▾"}
                    </span>
                    {TOPICS[t].name}
                    <span class="section-count"> ({list.length})</span>
                    {bothCover(t) && <span class="topic-both"> both instructors</span>}
                  </button>
                  {!isShut && (
                    <ul class="lesson-list">
                      {list.map((l) => (
                        <LessonRow key={l.id} lesson={l} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        ))}
    </div>
  );
}

function RelatedLessons({ lesson, onGo }: { lesson: Lesson; onGo: (id: string) => void }) {
  const list = relatedLessons(lesson);
  if (list.length === 0) return null;
  return (
    <div class="lesson-related">
      <h4>Also on this topic</h4>
      <ul>
        {list.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              class="plain-button"
              data-action="lesson-related"
              data-related={o.id}
              onClick={() => onGo(o.id)}
            >
              {INSTRUCTORS[o.instructor].name}: {o.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
