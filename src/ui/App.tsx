// Phase 0 placeholder: proves the app installs from Safari, opens offline, and runs the banjo
// core. It shows the roll library, each roll checked live by the rule validator.

import { useEffect, useState } from "preact/hooks";
import type { Services } from "../app/services.ts";
import { ROLLS, rollMeasure } from "../core/banjo/rolls.ts";
import type { Finger } from "../core/banjo/types.ts";
import { validate } from "../core/banjo/validator.ts";

const FINGER_LABEL: Readonly<Record<Finger, string>> = { T: "Thumb", I: "Index", M: "Middle" };

function useOfflineStatus(services: Services) {
  const read = () => ({
    ready: services.offline.offlineReady,
    waiting: services.offline.updateWaiting,
  });
  const [status, setStatus] = useState(read);
  useEffect(() => services.offline.onChange(() => setStatus(read())), [services]);
  return status;
}

function FingerBadge({ finger }: { finger: Finger }) {
  return (
    <span
      class={`badge badge-${finger}`}
      title={FINGER_LABEL[finger]}
      aria-label={FINGER_LABEL[finger]}
    >
      {finger}
    </span>
  );
}

function RollCard({ roll }: { roll: (typeof ROLLS)[number] }) {
  // Two copies, so the join into the next measure is checked too.
  const problems = validate([rollMeasure(roll, { index: 1 }), rollMeasure(roll, { index: 2 })]);
  return (
    <li class="roll">
      <div class="roll-head">
        <h3>{roll.name}</h3>
        <span class={problems.length === 0 ? "check ok" : "check bad"}>
          {problems.length === 0 ? "✓ follows the rules" : `${problems.length} problem(s)`}
        </span>
      </div>
      <div class="roll-grid" role="table" aria-label={`${roll.name} roll`}>
        <div class="row" role="row">
          {roll.fingers.map((f, i) => (
            <span role="cell" key={i} class={roll.accents.includes(i) ? "accent" : ""}>
              <FingerBadge finger={f} />
            </span>
          ))}
        </div>
        <div class="row strings" role="row">
          {roll.exampleStrings.map((s, i) => (
            <span role="cell" key={i}>
              {s}
            </span>
          ))}
        </div>
      </div>
      <p class="use">{roll.use}</p>
    </li>
  );
}

export function App({ services }: { services: Services }) {
  const offline = useOfflineStatus(services);
  return (
    <div class="shell">
      <header class="toolbar">
        <h1>Banjo Practice</h1>
        <span class="version">
          v{__APP_VERSION__} · {__BUILD_SHA__}
          {__BUILD_CHANNEL__ !== "production" ? ` · ${__BUILD_CHANNEL__}` : ""}
        </span>
      </header>

      <main class="content">
        {services.storageMode !== "ok" && (
          <p class="notice" role="status">
            {services.storageMode === "read-only-newer"
              ? "Your saved songs were made by a newer version of the app. Please update the app."
              : "Saving isn't available right now, so changes won't be kept."}
          </p>
        )}

        <section class="intro">
          <h2>Coming soon</h2>
          <p>
            This is the first build. Songs, tab and playback arrive in the next phases. For now,
            here are the eight Scruggs rolls the app is built on, each checked by its rule checker.
          </p>
          <p class="status">
            {offline.ready ? "✓ Works without Wi-Fi" : "Getting ready to work without Wi-Fi…"}
            {offline.waiting ? " · A new version will load next time you open the app." : ""}
          </p>
        </section>

        <section>
          <h2>Rolls</h2>
          <p class="legend">
            <FingerBadge finger="T" /> Thumb <FingerBadge finger="I" /> Index{" "}
            <FingerBadge finger="M" /> Middle
            <span class="legend-note">Underlined = accented note. Numbers = strings.</span>
          </p>
          <ul class="rolls">
            {ROLLS.map((r) => (
              <RollCard key={r.id} roll={r} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
