# Hebrew audio

These 152 clips use the synthetic Hebrew **Noa** voice by **thewh1teagle**, generated locally from the vocabulary in `data/terms.json`. The clips are distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Suggested attribution when reusing the clips

> Hebrew audio generated with Piper Hebrew — Noa by thewh1teagle, licensed CC BY 4.0. Generated for Krav Ivrit, with reviewed pronunciation inputs, silence trimming, loudness normalization and MP3 encoding. https://huggingface.co/thewh1teagle/piper-he-noa

The [voice model card](https://huggingface.co/thewh1teagle/piper-he-noa/blob/23f8e06909e9a1e562a50f99df63e3785451379a/README.md) declares CC BY 4.0 and describes its training sources. It uses Chatterbox-generated Hebrew speech and public-domain LJSpeech. The model was created on 26 October 2026 and this revision was last modified on 27 October 2026.

- Model revision `23f8e06909e9a1e562a50f99df63e3785451379a`.
- Model file `he_IL-noa-medium.onnx`, 77,056,101 bytes. SHA-256 `83b18c0b8fad6ac00fcea5c5bdf3c1fdbec182f9eadad9f97bc423ab4e22be7d`.
- Generator [Piper](https://github.com/OHF-Voice/piper1-gpl), version 1.8.0. Speaker 0, Noa. Source rate 22,050 Hz.
- Candidate phonemes [ReNikud](https://github.com/thewh1teagle/renikud), by Maxim Melichov, Yakov Kolani and Morris Alper, CC BY 4.0. Package `renikud-onnx==0.1.1`, model revision `a59c632c8cbac0f8c63f298cad77ef3a3a2547c9`.
- Each candidate was reviewed against its intended term. Thirty-nine ambiguous readings were corrected, including masculine/feminine numbers and words whose unpointed Hebrew has several readings. The resulting IPA is stored in `manifest.json`, so regeneration uses the reviewed inputs.
- Output MP3, mono, 44,100 Hz, 64 kbit/s. Quiet edges were trimmed with approximately 80 ms margins and two-pass FFmpeg normalization targeted −18 LUFS and −2 dBTP.

`retzev.mp3` pronounces the Hebrew רֶצֶף with its final **f**. The stable filename retains the original item ID.

The manifest includes the source Hebrew, reviewed phonemes, model provenance, duration, byte size, SHA-256 and decoded signal measurements for every clip. All 152 MP3s were decoded and checked for non-silent audio, finite samples, plausible duration and unclipped peaks. Their combined size is 1,043,857 bytes. Native-speaker listening review is still appropriate for the vocabulary entries marked `verify`.

An independent local Whisper `large-v3-turbo` transcription of the actual clips for `kadima`, `yamin`, `eight-f`, `eight-m` and `ani-rofe` produced “קדימה, ימין, שמונה, שמונה, אני רופא.” without an expected-text prompt. The two forms of eight have the same unpointed spelling, so that transcription checks intelligibility while their reviewed IPA records the distinct vowels.

## Reproduce

Install Python 3.12, FFmpeg with `libmp3lame`, and a temporary environment with `piper-tts==1.8.0`. Run the following Python from the repository root. It downloads the pinned voice and regenerates clips into a temporary directory, using the manifest's reviewed phonemes. Neural sampling can produce small waveform differences between runs.

```python
import hashlib
import json
import subprocess
import tempfile
import urllib.request
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

manifest = json.loads(Path("audio/manifest.json").read_text())
meta = manifest["voice"]
scratch = Path(tempfile.mkdtemp(prefix="krav-audio-"))
base = meta["model"] + "/resolve/" + meta["revision"] + "/"
for name in ("he_IL-noa-medium.onnx", "he_IL-noa-medium.onnx.json"):
    urllib.request.urlretrieve(base + name, scratch / name)
assert hashlib.sha256((scratch / "he_IL-noa-medium.onnx").read_bytes()).hexdigest() == meta["modelSha256"]
voice = PiperVoice.load(scratch / "he_IL-noa-medium.onnx")
settings = meta["synthesis"]
config = SynthesisConfig(
    speaker_id=meta["speakerId"], length_scale=settings["lengthScale"],
    noise_scale=settings["noiseScale"], noise_w_scale=settings["noiseWScale"],
    normalize_audio=False,
)
for item_id, clip in manifest["clips"].items():
    samples = voice.phoneme_ids_to_audio(
        voice.phonemes_to_ids(list(clip["phonemes"])), config,
    )
    threshold = max(10 ** (-50 / 20), float(np.max(np.abs(samples))) * 0.006)
    audible = np.flatnonzero(np.abs(samples) >= threshold)
    assert len(audible), item_id
    margin = round(voice.config.sample_rate * 0.08)
    samples = samples[max(0, audible[0] - margin):min(len(samples), audible[-1] + margin + 1)]
    wav = scratch / (item_id + ".wav")
    with wave.open(str(wav), "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(voice.config.sample_rate)
        stream.writeframes((np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes())
    first = subprocess.run([
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(wav),
        "-af", "loudnorm=I=-18:TP=-2:LRA=7:print_format=json", "-f", "null", "-",
    ], capture_output=True, text=True, check=True)
    measured, _ = json.JSONDecoder().raw_decode(first.stderr[first.stderr.rfind("{"):])
    normalization = (
        "loudnorm=I=-18:TP=-2:LRA=7:measured_I={input_i}:measured_TP={input_tp}:"
        "measured_LRA={input_lra}:measured_thresh={input_thresh}:"
        "offset={target_offset}:linear=true"
    ).format(**measured)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
        "-af", normalization, "-ac", "1", "-ar", "44100", "-codec:a", "libmp3lame",
        "-b:a", "64k", "-map_metadata", "-1", str(scratch / clip["file"]),
    ], check=True)
print(scratch)
```
