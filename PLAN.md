# Banjo Practice App — Plan

Updated Nov 8, 2026 · Jeff

## Overview

A banjo practice app for Dad's iPad, built as a web app (PWA) on Windows and installed from Safari with Add to Home Screen. No Mac, Apple developer account or App Store needed.

- **Player:** Dad, on a 5-string Deering banjo, three-finger (Scruggs) style in open G. Clawhammer is a possible later option.
- **Core idea:** pick a song, see it as notation with chords and banjo tab, hear it played back at any tempo and key, and practice along.
- **Hosting:** GitHub Pages over HTTPS, which Safari needs for microphone access and offline use.
- **Testing:** day to day in Chrome on the PC, with regular checks on Dad's iPad.

## Song library

A collapsible panel on the left lists every song; tapping one shows it in the main area.

- **Built-in songs:** traditional American tunes in the public domain (published before 1929, or folk songs with no known author), such as Cripple Creek, Soldier's Joy, Old Joe Clark, Cluck Old Hen, Shady Grove, Wildwood Flower and Will the Circle Be Unbroken.
- **Written fresh:** every chart is written for the app in ABC notation, never copied from websites, tab sites or songbooks.
- **Copyrighted standards** (most Bill Monroe and Flatt & Scruggs songs, for example) are left out of the built-in list. Dad can enter those himself in the song editor for his own practice.
- **List extras:** Favorites and Recently played at the top, then built-in songs, then his own songs.

## Song display

Each song shows as two lined-up staves, so the melody and the banjo part can be read together.

1. **Notation staff:** the melody in standard notation, with chord symbols above each measure (spelled conventionally, e.g. B♭ rather than A♯).
2. **Tab staff** underneath: five lines, one per string, with fret numbers aligned note for note with the measures above.
3. **Finger marks** under each tab note: T, I or M, always shown as letters and also color-coded. Colors use a color-blind-safe set (starting with something like orange, blue and purple), changeable in settings.
4. **Melody notes in bold** inside each roll, so the tune stands out from filler notes and drones.
5. **Left-hand techniques** marked in the tab: hammer-ons (h), pull-offs (p) and slides (/).

During playback:

- The current measure gets a light yellow background (not blue, which is the index finger's color).
- The page scrolls on its own to keep the current measure in view.

Display options: a size control for larger notes and text, and a tab-only view.

## Banjo rolls and arrangement

Every song is arranged in Scruggs three-finger style, with the melody placed inside the rolls, in open G tuning (gDGBD; strings 1 = high D to 5 = short g drone).

| Roll | Finger pattern (one measure, 8 notes) |
| --- | --- |
| Forward | T I M T I M T M |
| Backward (reverse) | M I T M I T M I |
| Forward-reverse | T I M T M I T M |
| Alternating thumb | T I T M T I T M |
| Pinch | Two or more fingers at once, often ending a phrase |

Rules the arranger follows:

- **No finger plays twice in a row** within a roll.
- **Hammer-ons, pull-offs and slides** add left-hand notes without a new pick, so they don't break the rule.
- **The melody note** falls on a picked note of the roll, and the 5th-string drone and other strings fill in around it.

**Roll exercises:** each roll on its own over simple progressions (G–C–D), with the same display, colors, tempo and playback controls, for warming up.

## Key and tempo

Dad can play any song in any key and at any speed, set from the toolbar.

- **Transposing:** the notation and chord symbols move to the actual key he picks. The banjo tab keeps the familiar G (or C/D) shapes, and the app tells him the capo setting, e.g. "Capo 2, 5th string to A".
- **Tempo:** a BPM setting with a slider and − / + buttons. Slowing down never changes pitch, because the app generates the notes rather than stretching a recording.
- **Speed builder:** start at a slow tempo and add a few BPM on each repeat, up to a target tempo he sets.

## Playback and controls

Any combination of parts can play back over MIDI, with the metronome on top.

| Part | Sound | Notes |
| --- | --- | --- |
| Chords | Acoustic guitar | Bluegrass "boom-chuck": bass note on beats 1 and 3, strum on 2 and 4 |
| Melody | His choice: mandolin, flute, fiddle, etc. | Mandolin isn't in the standard MIDI set, so it needs a bundled sample |
| Banjo | Banjo | Plays every roll note in the arrangement |
| Metronome | Click | Off, count-in only, or throughout; count-in of 4 or 8, with large on-screen numbers |

**Toolbar, always visible at the top:** Play, Stop, Auto-repeat, tempo, key and part toggles.

**Looping:** auto-repeat loops the whole song, or a section he picks (e.g. measures 5–8) for working on a tricky passage.

## Song editor

Dad can write out songs he knows, including copyrighted ones, for his own practice.

1. **Enter notes by name:** tap G, A, B… and pick a duration, measure by measure.
2. **Set the chord** for each measure, or split a measure into two halves with different chords (root note plus type: major, minor, 7 and so on).
3. **Rolls are generated automatically** from the key, chord and melody note. He can override the roll type on any measure or half-measure.
4. **Play it back** with the same controls as the library, to check it sounds right.
5. **Save:** his songs appear in the left-hand list next to the built-in ones.

**Backup:** an "Export my songs" file and a matching import, because Safari can clear a website's stored data. Adding the app to the Home Screen largely prevents that, but the export is cheap insurance.

## Fretboard and chord finder

A neck diagram that shows how to play any chord, anywhere on the neck, and what it should sound like.

- **Setup:** a 5-string banjo in open G (gDGBD), with other tunings such as double C and open D as later options.
- **Capo:** set the main capo fret, plus where the 5th string is capoed. Many Deerings have 5th-string spikes at frets 7, 9 and 10.
- **Find a chord:** pick any chord (e.g. Gm7). The app works out every playable shape, showing the open-position shape first if one exists, then shapes further up the neck. He steps through them, each showing which frets to press.
- **Hear it:** a play button for each shape uses the banjo sound, either strummed or picked one string at a time from low to high. The sound is calculated from the exact frets and capo shown.
- **Linked from songs:** tapping a chord symbol on the sheet music opens that chord here, with the current capo setting.

## Practice tools

- **Keep the screen awake** while a song is open, so the iPad doesn't dim or lock mid-tune.
- **Tuner** using the iPad's microphone, preset for open G.
- **Hands-free control** with a Bluetooth page-turner pedal: start, stop and restart without letting go of the banjo.
- **Practice log:** which songs he worked on, when, and the tempo he reached on each.
- **Record himself** and play it back, alone or with the backing parts.

## Technical approach and build order

A single web app with no server: songs stored as ABC text, sheet music and playback through the abcjs library, and everything saved on the iPad.

- **Notation and playback:** abcjs draws the notation and chord symbols and plays MIDI through soundfonts (guitar, banjo, flute, fiddle; a mandolin sample bundled separately).
- **Banjo tab and finger marks** are likely custom-drawn and aligned to abcjs's measures, since the colored T/I/M marks and bold melody notes go beyond its built-in options.
- **Storage:** the iPad's browser storage for his songs, settings and practice log, plus export/import files.
- **Offline:** a service worker caches the app and sounds, so it works without Wi-Fi once loaded.

Build order, each phase usable on the iPad before the next starts:

1. **Foundation:** app shell, song list and display, a handful of tunes in notation with chords, published to GitHub Pages and added to Dad's Home Screen.
2. **Playback:** part toggles and instruments, metronome and count-in, toolbar with Stop and Auto-repeat, section looping, tempo, speed builder, measure highlight, auto-scroll, transposition, screen kept awake.
3. **Banjo tab:** the roll arranger, tab staff, finger letters and colors, left-hand techniques, capo instructions, roll exercises. This is the hardest part, so start a small prototype of the arranger during phase 1.
4. **Fretboard and chord finder**, linked from the song chords.
5. **Song editor**, with export and import.
6. **Practice extras:** tuner, Bluetooth pedal, practice log, recording, favorites, display options.

Open questions:

- Which songs does Dad most want first? That sets the starting library.
- Does he read notation well, or mainly tab? That decides whether tab-only view should be the default.
