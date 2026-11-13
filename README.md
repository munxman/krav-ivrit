# Krav Ivrit

Krav Ivrit is a personal Hebrew study app for class vocabulary and everyday conversation. It uses Latin transliteration by default and pairs each term with English and Estonian. Hebrew script can be shown under the transliteration from Settings.

[Open Krav Ivrit](https://munxman.github.io/krav-ivrit/)

## Study and save progress

- Start a daily session to review due cards, learn up to five new items within your remaining daily budget, and finish with a timed commands drill. You can finish after two minutes. The session automatically ends at ten minutes.
- Answer one prompt at a time. On recall cards, say or type the transliteration, reveal the answer, and grade yourself from Again to Easy. The grade sets the next review date. Listening cards use a choice of meanings.
- The monthly check scores 20 Hebrew listening prompts. Pass with 16 correct answers or more. Without a Hebrew voice, the 20 prompts are available as text practice and are recorded as text practice.
- In Settings, adjust the daily new-item limit, turn packs and Hebrew script on or off, or change speech speed. Use **Export JSON** to keep a JSON copy of progress and settings. Use **Import JSON** to restore it on another device. Reset clears cards, streak and session history after confirmation.
- Open the app online and wait for **Ready for offline practice** to cache all eight packs. On iPhone, open it in Safari and choose **Share → Add to Home Screen** to install it. The app uses the browser's `he-IL` speech synthesis voice when available and shows a text fallback otherwise. Voice availability and whether speech works offline depend on the device and browser.

## Run locally

From the repository root, serve the files over HTTP and open the loopback address. No package installation or build is required.

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/). The service worker needs localhost or HTTPS.

## Deploy to GitHub Pages

Push the project to the separate `krav-ivrit` repository's `main` branch. In that repository, open **Settings → Pages**, select **Deploy from a branch**, choose **main** and **/(root)**, and save. The published directory is the repository root. Keep `.nojekyll` in that directory so Pages serves the static files directly. [GitHub Pages publishing source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Add or correct terms

Edit `data/terms.json`, a UTF-8 JSON array. Keep an existing `id` when correcting a term so its reviews stay attached. Use a unique ID for each new term. The pack names are `commands`, `numbers`, `body`, `strikes`, `weapons`, `dojo`, `courtesy`, and `everyday`.

```json
{
  "id": "toda",
  "pack": "courtesy",
  "translit": "toda",
  "hebrew": "תודה",
  "english": "Thank you",
  "estonian": "Aitäh",
  "notes": "A polite expression.",
  "example": { "translit": "Toda raba.", "english": "Thank you very much." }
}
```

Use `notes` for gender, register or usage. Add `"verify": true` when an entry needs a native speaker's review and update the list below. Keep command meanings distinct so answer choices are unambiguous. Validate the JSON with `python3 -m json.tool data/terms.json > /dev/null`. After editing cached files, advance the cache version in `sw.js` before deploying the update.

## Native speaker review

| Term ID | Review point |
| --- | --- |
| `kida` | Confirm how instructors cue a bow. |
| `shura` | Confirm whether instructors use this as a shortened line-up cue. |
| `egrof` | Confirm when instructors use “fist” as shorthand for “punch”. |
| `retzev` | Check whether local class usage has a narrower meaning than “sequence”. |
| `tefisa` | Confirm whether “grab” fits the intended class usage. |
| `bat-zug` | Confirm preferred wording for a female training partner. |
| `ben-zug` | Confirm preferred wording for a male training partner. |

## Source and data isolation

The engine adapts due-card and least-recent question selection from `src/basics-engine.js`, interleaving from `src/guided-session-model.js`, and Tallinn study-day counting from `src/study-chain.js`. [Study Pocket source at `f769ace`](https://github.com/munxman/study-pocket/tree/f769ace96a0599474d64104aef5bca1ce3a10815)

Krav Ivrit is a standalone static project. The app stores progress and settings in `krav-ivrit:progress:v1`, and its service worker and cache are scoped to its own deployment. There are no accounts or backend. See the [test checklist](TEST-CHECKLIST.md) for the repository and browser-storage checks.
