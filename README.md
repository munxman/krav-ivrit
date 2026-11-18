# Krav Ivrit

Krav Ivrit is a personal Hebrew study app for class vocabulary and everyday conversation. It uses Latin transliteration by default and pairs each term with English and Estonian. Each term also has an approximate pronunciation written with Estonian spelling, such as `ka-DI-ma`. Hebrew script can be shown under the transliteration from Settings.

[Open Krav Ivrit](https://munxman.github.io/krav-ivrit/)

## Study and save progress

- Start a daily session to review due cards, learn up to five new items within your remaining daily budget, and finish with a timed commands drill. Two minutes is enough for a short start. You can end a session or use Today, History and Settings at any time. Leaving practice saves completed answers. The session automatically ends at ten minutes.
- Answer one prompt at a time. On recall cards, say or type the transliteration, reveal the answer, and grade yourself from Again to Easy. The grade sets the next review date. Listening cards show the written Hebrew, Latin transliteration and pronunciation hint alongside the audio, followed by a choice of meanings. This also applies to commands drills and monthly checks.
- The monthly check scores 20 commands with audio and written Hebrew. Pass with 16 correct answers or more. If playback fails, the prompts become text practice and are recorded as text practice.
- In Settings, adjust the daily new-item limit, turn packs and Hebrew script on or off, or change speech speed. Use **Export JSON** to keep a JSON copy of progress and settings. Use **Import JSON** to restore it on another device. Reset clears cards, streak and session history after confirmation.
- Open the app online and wait for **Ready for offline practice** to cache all eight packs and the included Hebrew recordings. The 152 MP3 files total about 1 MB. On iPhone, open it in Safari and choose **Share → Add to Home Screen** to install it.

## Pronunciation and iPhone audio

Pronunciation hints appear in the study packs and after revealing a card's answer. They also appear in text practice when audio is unavailable. The hints use Estonian vowels and consonants, with hyphens between syllables and CAPITALS marking the stressed syllable of each word. Read `j` like English y, `š` like English sh, and `ts` like the end of cats. Hebrew kh/ch is approximated by a throaty `h`, like the ch in Bach. These spellings approximate Hebrew sounds.

**Built-in recordings** is the default Hebrew audio setting. Tap **Settings → Test Hebrew audio** to play the included shalom clip. The same recordings play in the study packs, listening cards and commands drills, with the selected playback speed. They use the browser's media player and download with the offline pack. If audio is silent, check the media volume and output, including connected headphones, then try the [standalone shalom file](audio/shalom.mp3). [Audio source, license and reproduction details](audio/README.md)

**Phone voice** remains available as an optional audio source. For this setting on iPhone, open **Settings → Accessibility → Read & Speak → Voices → Hebrew** and select or download a voice. Older iOS versions use **Spoken Content**. In Krav Ivrit, choose Phone voice and tap Test Hebrew audio. Select **I heard Hebrew** after a correct sample, or **No sound or wrong language** to continue with written practice. The app remembers confirmation in this browser and resets it on backup import. The phone-voice route also supports voices listed as `he-IL` or `he`. [Apple's voice settings guide](https://support.apple.com/en-ie/guide/iphone/iph96b214f0/ios)

Playback failures provide a Play Hebrew retry. Once a monthly check has revealed written prompts, it stays recorded as text practice for that session.

To receive the current update, open the [Krav Ivrit updater](update.html?v=5) online. It downloads the current app and recordings, checks that the new offline pack is active, then opens the app. Browser-saved progress uses the same Krav Ivrit storage key across updates.

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
  "pronunciation": { "et": "to-DA" },
  "hebrew": "תודה",
  "english": "Thank you",
  "estonian": "Aitäh",
  "notes": "A polite expression.",
  "example": { "translit": "Toda raba.", "english": "Thank you very much." }
}
```

Use `pronunciation.et` for the stress-marked Estonian pronunciation and `notes` for gender, register or usage. Add `"verify": true` when an entry needs a native speaker's review and update the list below. Keep command meanings distinct so answer choices are unambiguous. Validate the JSON with `python3 -m json.tool data/terms.json > /dev/null`. After editing cached files, advance the cache version in `sw.js` before deploying the update.

For built-in audio, add or regenerate `audio/<id>.mp3` and the matching entry in `audio/manifest.json` using the [audio reproduction instructions](audio/README.md). Keep filenames aligned with the term IDs. The service worker downloads the complete audio manifest and its clips before announcing offline readiness.

## Native speaker review

| Term ID | Review point |
| --- | --- |
| `kida` | Confirm how instructors cue a bow. |
| `shura` | Confirm whether instructors use this as a shortened line-up cue. |
| `egrof` | Confirm when instructors use “fist” as shorthand for “punch”. |
| `retzev` | Check the class meaning of “sequence”. Standard Hebrew retsef ends in f; the common Krav transliteration is retained. |
| `tefisa` | Confirm whether “grab” fits the intended class usage. |
| `bat-zug` | Confirm preferred wording for a female training partner. |
| `ben-zug` | Confirm preferred wording for a male training partner. |

## Source and data isolation

The engine adapts due-card and least-recent question selection from `src/basics-engine.js`, interleaving from `src/guided-session-model.js`, and Tallinn study-day counting from `src/study-chain.js`. [Study Pocket source at `f769ace`](https://github.com/munxman/study-pocket/tree/f769ace96a0599474d64104aef5bca1ce3a10815)

Krav Ivrit is a standalone static project. The app stores progress and settings in `krav-ivrit:progress:v1`, and its service worker and cache are scoped to its own deployment. There are no accounts or backend. See the [test checklist](TEST-CHECKLIST.md) for the repository and browser-storage checks.
