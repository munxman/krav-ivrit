# Krav Ivrit test checklist

## Local checks

- [x] Checked the vocabulary schema, unique IDs, eight pack IDs, and README coverage of every native-speaker review flag for 152 entries.
- [x] Exercised the engine with a fixed clock. Due reviews came first, new items counted toward the five-item Tallinn-day budget, disabled packs stayed out of the queue, and question types rotated by previous use. Checked grading intervals, distinct multiple-choice answers, streak, and today's minutes.
- [x] At a 390 px mobile viewport, verified the main action is at least 44 px high and the page has no horizontal overflow. Hebrew script began hidden and appeared when enabled. Without a Hebrew voice, listening prompts displayed Latin transliteration.
- [x] Practiced question-before-explanation, typed recall, self-grading, ending at two minutes, and a commands drill that started at minute eight and automatically ended at minute ten with a score.
- [x] Completed 20 unique monthly text prompts and checked that their text-practice label survived reload. With a simulated `he-IL` voice, verified 0.75× playback, increasing drill speed, a hidden written prompt during the listening check, and a pass at 16 of 20.
- [x] In a fresh Chrome session, saved settings and a practice card, reloaded, exported JSON, canceled and confirmed reset, rejected a Study Pocket backup, and restored the Krav Ivrit export exactly.
- [x] Validated the web app manifest and precached all 11 app and pack assets. Reloaded at `/krav-ivrit/` with the network disabled, loaded all eight packs, and started a practice session.
- [x] With `/krav-ivrit/` and `/study-pocket/` on the same loopback origin, watched all localStorage method calls during the browser practice and backup tests. Krav Ivrit only used `krav-ivrit:progress:v1`. Synthetic Study Pocket settings, progress, cache contents, IndexedDB, and the sibling service worker survived unchanged. A sibling fetch used the network online and failed offline, confirming that Krav Ivrit did not intercept it.

Chrome exposed no native Hebrew voice in the test environment. Actual Hebrew audio output and testing on a physical iPhone remain unverified.

## Study Pocket stays separate

The original repository was inspected through read-only Git and GitHub Pages queries. The original public page was fetched as an HTTP resource. This does not open the learner's Study Pocket browser data.

| Original deployment evidence | Value at baseline and read-only recheck |
| --- | --- |
| `HEAD` and `refs/heads/main` | `f769ace96a0599474d64104aef5bca1ce3a10815` |
| `main:docs` tree | `c6f56a06e9f6d79f46af6451eb6ae19bf91f1d20` |
| GitHub Pages source and status | `main` → `/docs`, built |
| Public `index.html` SHA-256 | `c9db41b5bedbc0e8c0f00ee12d2085b8084814e7f5b814c159d07cb9418ce30e` |

The public page checksum matches `docs/index.html` from the pinned original commit. Rechecked the public refs, Pages source and status, and the live page checksum against the baseline. The local isolation tests use seeded fixtures in a fresh profile. The learner's real Study Pocket browser storage was never opened or inspected.
