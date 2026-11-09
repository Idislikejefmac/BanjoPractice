# Built-in songs: status and sources

A song goes in this folder only when its melody and words come from a real source: Dad's
sheet music, or a verified public-domain printing. Never from memory, and never copied from tab
sites, modern songbooks or recordings (DEVELOPMENT.md §10). The banjo tab is then written
fresh for this app and checked by Jeff and Dad.

**Default: songs live on Dad's iPad only.** This app is for Dad's personal use, not a product.
Photos of his sheet music go in `sheet-music/` (git-ignored, never committed). Transcriptions go
in `sheet-music/songs/<id>.abc` (and an optional `.tab`), and `node scripts/make-song-pack.ts`
turns them into a backup file to load on the iPad with Settings → Restore from a backup. Only
songs that are clearly public domain *and* worth sharing might ever go in this public folder.

`sheet-music/` is itself a clone of a separate **private** repository (`BanjoPractice-Songs`), so
Dad's transcriptions and the photos they came from sync between machines without ever entering
this public one. On a new machine: `git clone <private repo URL> sheet-music` inside this folder.

The drafts written from memory early on now live in `tests/fixtures/songs/` and are used only by
the tests. They must not be shipped (the production-bundle check fails if they are).

| Song | Status | Source found |
| --- | --- | --- |
| Cripple Creek | **Waiting for Dad's sheet music** | Words only: E. C. Perrow, "Songs and Rhymes from the South", *Journal of American Folk-Lore* 28 (1915) pp. 180–181 ([archive.org](https://archive.org/details/journalofamefolk28ameruoft)). No public-domain melody reached yet; candidates: Cecil Sharp's 1917 field manuscripts CJS2/10/3879 and CJS2/10/3930 at the Vaughan Williams Memorial Library (open in a browser; the archive blocks automated access). |
| Old Joe Clark | **Waiting for Dad's sheet music** (to check the 1912 printing) | Perrow, *JAFL* 25 (1912) p. 152 ([archive.org](https://archive.org/details/journalofamefolk25ameruoft), leaf 0160): tune and words, but the printing has an unclear accidental (bar 2), irregular barlines, and verse words not set under the notes. |
| Wildwood Flower | **Source found; to transcribe and check** | "I'll Twine 'Mid the Ringlets", Maud Irving / J. P. Webster, 1860; Oliver Ditson reissue 1888, Library of Congress ([item](https://www.loc.gov/item/2025700939/), [PDF](https://tile.loc.gov/storage-services/public/music/muscopyright-113808/muscopyright-113808.pdf), voice part pp. 3–4). |
| Will the Circle Be Unbroken | **Source found; to transcribe and check** | Habershon / Gabriel, 1907: *Alexander's Gospel Songs* (1908) No. 55 p. 56 ([Hymnary.org page scan](https://hymnary.org/hymn/AGS1908/page/56)). Not the 1935 Carter Family song. |
