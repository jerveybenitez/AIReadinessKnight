# ADR 0005 — Audio: synthesised WAV set, gesture-gated engine, persisted mute

Status: accepted (2026-10-14)

## Options

1. **Source CC0 / public-domain audio files** — download a music loop and effects from an open
   library, commit them to `public/audio/`.
2. **Synthesise the set in a checked-in script** — `scripts/audio/generate-set.mjs` writes WAV
   with dependency-free Node, deterministic from a seed.
3. **MIDI files + a JS synthesiser** — tiny asset size, but browsers have no built-in MIDI synth,
   so this means shipping a soundfont player (heavy dependency, unpredictable output).

## Choice

Option 2, delivered as WAV (22050 Hz, mono, 16-bit PCM) through a single resolver and a single
gesture-gated engine (see `docs/audio.md` for the full cue table).

## Why

- **License cleanliness is structural, not procedural.** Every byte is produced by code in this
  repo; there is nothing to attribute, audit, or accidentally contaminate. Sourced files would
  carry per-file provenance duties forever (QODER.md M13 makes this explicit).
- **Reproducibility.** The script is deterministic (seeded PRNG, hard-coded note tables) and
  self-checking: it fails its own sanity checks (silence, peak, duration) rather than emitting a
  bad file quietly. A future "different mood" is a recipe edit plus `pnpm audio:generate`.
- **No encoder exists on this machine.** QODER.md M13 mandates checking before generating:
  ffmpeg, lame, oggenc and sox are all absent, and Python 3.14 (present) has no stdlib audio
  encoder. WAV is the only format this environment can actually produce — and at 44.1 kHz stereo
  a 30 s loop is ~5 MB, which §3.7's no-blocking rule rejects in spirit. Composing every loop to
  a whole number of bars and rendering at 22050 Hz mono lands the music files at 626–847 KB and
  every one-shot under ~75 KB (2521 KB for all 15 cues) — small enough for lazy fetching, with
  loop seams guaranteed to sit on pattern boundaries.
- **One resolver keeps the CMS door open.** §3.7 makes the static set a conscious exception to
  "every asset is a CMS upload"; `soundFor()` (mirroring `assetFor`) means promoting audio into
  the `modes` collection later is one file's change, not a sweep.
- **Delivery rules live in one engine.** Gesture-gated unlock (autoplay policy), persisted mute
  (`ark:muted`), automation-default-muted (the e2e suite must stay silent), per-URL failure
  caching (degrade to silence, never break the scene machine), and music-via-`HTMLAudioElement` /
  effects-via-`AudioBufferSourceNode` are all implemented once in `src/game/audio/engine.ts` and
  nowhere else.

## What it costs

- WAV is uncompressed: ~2.5 MB of audio where a compressed format would be ~10× smaller. At this
  set size that is a fine trade for "no encoder dependency"; if an encoder ever lands on the
  machine, re-encoding the *files* needs no recipe changes (the loops are already seam-safe), and
  this ADR should be revisited then.
- The chiptune palette is a deliberate aesthetic ceiling — the set sounds like a synthesised
  score because it is one. That is the style the brief asks for (and it matches `default16`
  exactly), but "orchestral" would mean re-sourcing, not re-parameterising.
- Synthesis recipes are code, so a composer cannot edit them without reading JavaScript.

## Rejected

- **Option 1 (sourced CC0)** — faster to polished, but per-file provenance/license tracking is a
  permanent liability, and nothing guarantees the files share a sonic palette the way one
  synthesiser does.
- **Option 3 (MIDI)** — explicitly ruled out by §3.7: no built-in browser synth, heavy JS
  dependency, unpredictable output. A chiptune *style* is welcome; a MIDI *file format* is not.
- **Compressed formats (mp3/ogg)** on this machine — impossible without an encoder (see Why).
