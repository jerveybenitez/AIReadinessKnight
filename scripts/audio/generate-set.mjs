#!/usr/bin/env node
/**
 * M13 — synthesise the shared sound set (QODER.md §3.7).
 *
 * The game has ONE static audio set for every mode (default / electric / default16 / future
 * modes), read through one resolver (src/game/audio/sounds.ts). No audio-generation service and
 * no encoder exists on this machine (ffmpeg / lame / oggenc / sox — all absent, checked in M13),
 * so the set is SYNTHESISED here in dependency-free Node and written as WAV: 22050 Hz, mono,
 * 16-bit PCM. That keeps every cue license-clean by construction and the whole set regenerable
 * from a seed. A 30 s 44.1 kHz stereo music loop would be ~5 MB; these loops are composed to
 * musically complete bar counts and rendered at 22050 Hz mono, which lands each music file in
 * the ~500–900 KB range (see the table printed at the end).
 *
 * Determinism: every noise source is drawn from a seeded PRNG (mulberry32) and every note is
 * hard-coded below — the same Node version reproduces byte-identical files.
 *
 * Usage: pnpm audio:generate
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const SR = 22050
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = path.join(ROOT, 'public', 'audio')
mkdirSync(OUT, { recursive: true })

const TWO_PI = Math.PI * 2

// --- deterministic PRNG (mulberry32) -----------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- buffer helpers ----------------------------------------------------------------------------

const track = (seconds) => new Float32Array(Math.max(1, Math.round(seconds * SR)))

/** Piecewise-linear envelope: attack to 1, sustain, release to 0 — all in seconds. */
function env(t, dur, attack, release) {
  const a = attack > 0 ? Math.min(t / attack, 1) : 1
  const r = release > 0 ? Math.min((dur - t) / release, 1) : 1
  return Math.max(0, Math.min(a, r))
}

/** Equal temperament, A4 = 440. */
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12)

/**
 * Add a pitched voice. wave: 'sine' | 'square' | 'triangle' | 'saw'. Square/triangle/saw are
 * Fourier-limited to the Nyquist frequency of the note's base pitch, so there is no aliasing.
 * f1 ≠ f0 gives a linear pitch slide (phaser-integral, phase-continuous).
 */
function addTone(buf, t0, dur, { f0, f1 = f0, wave = 'sine', gain = 0.2, attack = 0.01, release = 0.08 }) {
  const n0 = Math.round(t0 * SR)
  const n1 = Math.min(buf.length, Math.round((t0 + dur) * SR))
  if (n1 <= n0 || gain <= 0) return
  const K = Math.max(1, Math.min(96, Math.floor(SR / 2 / f0)))
  const harmonics = []
  if (wave === 'square') for (let k = 1; k <= K; k += 2) harmonics.push([k, 4 / (Math.PI * k)])
  else if (wave === 'saw') for (let k = 1; k <= K; k += 1) harmonics.push([k, (2 / Math.PI) * (1 / k)])
  else if (wave === 'triangle') for (let k = 1; k <= K; k += 2) harmonics.push([k, (8 / (Math.PI * Math.PI)) * (1 / (k * k)) * (((k - 1) / 2) % 2 === 0 ? 1 : -1)])
  let phase = 0
  for (let i = n0; i < n1; i += 1) {
    const t = (i - n0) / SR
    const f = f0 + ((f1 - f0) * t) / dur
    phase += (TWO_PI * f) / SR
    const e = env(t, dur, attack, release)
    if (e <= 0) continue
    let v
    if (wave === 'sine') v = Math.sin(phase)
    else {
      v = 0
      for (let h = 0; h < harmonics.length; h += 1) v += harmonics[h][1] * Math.sin(harmonics[h][0] * phase)
    }
    buf[i] += v * gain * e
  }
}

/**
 * Add filtered noise. mode: 'lp' | 'hp' | 'bp' (one-pole; bp = hp then lp). f0→f1 sweeps the
 * cutoff linearly over the duration. Deterministic via mulberry32(seed).
 */
function addNoise(buf, t0, dur, { seed = 1, gain = 0.3, attack = 0.005, release = 0.08, mode = 'lp', f0 = 1000, f1 = f0 }) {
  const n0 = Math.round(t0 * SR)
  const n1 = Math.min(buf.length, Math.round((t0 + dur) * SR))
  if (n1 <= n0 || gain <= 0) return
  const rand = mulberry32(seed)
  let lpLo = 0
  let lpHi = 0
  const alpha = (f) => 1 - Math.exp((-TWO_PI * f) / SR)
  for (let i = n0; i < n1; i += 1) {
    const t = (i - n0) / SR
    const f = f0 + ((f1 - f0) * t) / dur
    const x = rand() * 2 - 1
    lpLo += alpha(f) * (x - lpLo)
    lpHi += alpha(f * 2.2) * (x - lpHi)
    const e = env(t, dur, attack, release)
    if (e <= 0) continue
    let v
    if (mode === 'lp') v = lpLo
    else if (mode === 'hp') v = x - lpLo
    else v = lpHi - lpLo // bp: difference of two low-passes reads as a band
    buf[i] += v * gain * e
  }
}

function addKick(buf, t0, { gain = 0.5, drop = 130, end = 42, dur = 0.13 }) {
  addTone(buf, t0, dur, { f0: drop, f1: end, wave: 'sine', gain, attack: 0.001, release: dur * 0.75 })
  addNoise(buf, t0, 0.02, { seed: 7, gain: gain * 0.25, mode: 'hp', f0: 2500, attack: 0.001, release: 0.015 })
}

function addHat(buf, t0, dur, gain) {
  addNoise(buf, t0, dur, { seed: 11, gain, mode: 'hp', f0: 8500, attack: 0.001, release: dur * 0.8 })
}

function addSnare(buf, t0, gain) {
  addNoise(buf, t0, 0.11, { seed: 13, gain, mode: 'bp', f0: 1700, attack: 0.001, release: 0.09 })
  addTone(buf, t0, 0.06, { f0: 185, wave: 'triangle', gain: gain * 0.7, attack: 0.001, release: 0.05 })
}

function peakOf(buf) {
  let peak = 0
  for (let i = 0; i < buf.length; i += 1) {
    const v = Math.abs(buf[i])
    if (v > peak) peak = v
  }
  return peak
}

function normalize(buf, target = 0.85) {
  const peak = peakOf(buf)
  if (peak < 1e-6) return buf
  const scale = target / peak
  for (let i = 0; i < buf.length; i += 1) buf[i] *= scale
  return buf
}

function writeWav(name, buf) {
  const dataSize = buf.length * 2
  const out = Buffer.alloc(44 + dataSize)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + dataSize, 4)
  out.write('WAVE', 8)
  out.write('fmt ', 12)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(1, 22) // mono
  out.writeUInt32LE(SR, 24)
  out.writeUInt32LE(SR * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < buf.length; i += 1) {
    const s = Math.max(-1, Math.min(1, buf[i]))
    out.writeInt16LE(Math.round(s * 32767), 44 + i * 2)
  }
  writeFileSync(path.join(OUT, name), out)
  return out.length
}

// --- music sequencer helpers -------------------------------------------------------------------

/** chords: array of root midi + mode; returns { bassRoot, triad } per bar. */
const CHORD = (rootMidi, third) => ({ root: rootMidi, triad: [rootMidi, rootMidi + third, rootMidi + third + 3] })

/** Play a melody: notes = [[startBeat, midi, durBeats], ...] */
function addMelody(buf, notes, bpm, { wave = 'triangle', gain = 0.2, attack = 0.015, releaseBeats = 0.6, detuneSemis = 0 }) {
  const beat = 60 / bpm
  for (const [b, midi, durBeats] of notes) {
    const f0 = hz(midi + detuneSemis)
    addTone(buf, b * beat, durBeats * beat, { f0, wave, gain, attack, release: Math.min(durBeats * beat * releaseBeats, durBeats * beat * 0.9) })
  }
}

function addBassLine(buf, pattern, bpm, { wave = 'square', gain = 0.15, attack = 0.01, release = 0.2 }) {
  const beat = 60 / bpm
  for (const [b, midi, durBeats] of pattern) {
    addTone(buf, b * beat, durBeats * beat, { f0: hz(midi), wave, gain, attack, release })
  }
}

// --- the music loops ---------------------------------------------------------------------------
// Every loop is composed to a whole number of bars and every voice is periodic over those bars,
// so the WAV loops seamlessly: the seam sits on a pattern boundary with no tail crossing it.

function composeTitle() {
  // A minor, 100 BPM, 8 bars (i–VI–III–VII × 2). Stately lute-and-flute chiptune.
  const bpm = 100
  const beat = 60 / bpm
  const bars = 8
  const buf = track(bars * 4 * beat)
  const chords = [CHORD(57, 3), CHORD(53, 4), CHORD(60, 4), CHORD(55, 4), CHORD(57, 3), CHORD(53, 4), CHORD(60, 4), CHORD(55, 4)]
  // Bass: half-note roots; last bar walks G→A to close the loop back to Am.
  addBassLine(buf, chords.flatMap((c, i) => (i === 7 ? [[28, c.root - 12, 2], [30, 57 - 12, 2]] : [[i * 4, c.root - 12, 2], [i * 4 + 2, c.root - 12, 2]])), bpm, { gain: 0.14 })
  // Lute pluck: quarter-note chord tones an octave above the bass root.
  addMelody(buf, chords.flatMap((c, i) => [0, 1, 2, 3].map((q) => [i * 4 + q, c.triad[q % 3] - 12, 0.9])), bpm, { wave: 'triangle', gain: 0.07, attack: 0.008, releaseBeats: 0.5 })
  // Flute lead.
  addMelody(buf, [
    [0, 69, 1], [1, 72, 1], [2, 76, 1.5], [3.5, 74, 0.5],
    [4, 72, 1], [5, 69, 1], [6, 65, 1.5], [7.5, 67, 0.5],
    [8, 67, 1], [9, 72, 1], [10, 76, 1], [11, 79, 1],
    [12, 77, 1.5], [13.5, 74, 0.5], [14, 71, 1], [15, 67, 1],
    [16, 69, 1], [17, 72, 1], [18, 76, 1.5], [19.5, 74, 0.5],
    [20, 72, 1], [21, 69, 1], [22, 65, 1.5], [23, 69, 0.5],
    [24, 67, 1], [25, 64, 1], [26, 60, 1], [27, 64, 1],
    [28, 74, 1], [29, 71, 1], [30, 69, 2],
  ], bpm, { wave: 'triangle', gain: 0.22, attack: 0.02, releaseBeats: 0.45 })
  // Sparkle doubling the lead an octave up, very quiet.
  addMelody(buf, [
    [0, 81, 1], [2, 88, 1.5], [8, 79, 1], [12, 89, 1.5],
    [16, 81, 1], [18, 88, 1.5], [24, 79, 1], [28, 83, 1], [30, 81, 2],
  ], bpm, { wave: 'sine', gain: 0.05, attack: 0.02, releaseBeats: 0.5 })
  return buf
}

function composeGameplay() {
  // E minor, 132 BPM, 8 bars (Em C G D × 2). Driving training-ground loop: drums, square bass,
  // square arpeggio lead. One loop for all three sections (QODER.md §3.7).
  const bpm = 132
  const beat = 60 / bpm
  const bars = 8
  const buf = track(bars * 4 * beat)
  const chords = [CHORD(52, 3), CHORD(60, 4), CHORD(55, 4), CHORD(50, 4), CHORD(52, 3), CHORD(60, 4), CHORD(55, 4), CHORD(50, 4)]
  // Drums.
  for (let b = 0; b < bars * 4; b += 1) addKick(buf, b * beat, { gain: 0.5 })
  for (let bar = 0; bar < bars; bar += 1) {
    addSnare(buf, (bar * 4 + 1) * beat, 0.26)
    addSnare(buf, (bar * 4 + 3) * beat, 0.26)
    for (let e = 0; e < 8; e += 1) {
      const open = e === 7
      addHat(buf, (bar * 4 + e * 0.5) * beat, open ? 0.12 : 0.035, open ? 0.07 : 0.1)
    }
  }
  // Bass: eighth-note roots with the last eighth of each bar on the fifth.
  addBassLine(buf, chords.flatMap((c, i) => {
    const root = c.root - 12
    const fifth = c.root - 5
    const notes = []
    for (let e = 0; e < 7; e += 1) notes.push([i * 4 + e * 0.5, root, 0.45])
    notes.push([i * 4 + 3.5, fifth, 0.45])
    return notes
  }), bpm, { wave: 'square', gain: 0.15, attack: 0.004, release: 0.05 })
  // Lead: eighth-note arpeggios climbing to the octave and back.
  const arp = (i, c) => {
    const [r, t3, t5] = c.triad
    const seq = [[0, r], [0.5, t3], [1, t5], [1.5, t3], [2, r + 12], [2.5, t5], [3, t3], [3.5, t5]]
    return seq.map(([b, m]) => [i * 4 + b, m, 0.42])
  }
  const lead = chords.flatMap((c, i) => arp(i, c))
  // Bar 8 leads home: last two eighths walk D → E so the seam resolves into bar 1.
  lead.push([30, 57, 0.42], [31, 52, 0.42])
  addMelody(buf, lead, bpm, { wave: 'square', gain: 0.12, attack: 0.004, releaseBeats: 0.35 })
  return buf
}

function composeResults() {
  // C major, 112 BPM, 8 bars (C G Am F × 2). Triumphant but loopable reckoning theme.
  const bpm = 112
  const beat = 60 / bpm
  const bars = 8
  const buf = track(bars * 4 * beat)
  const chords = [CHORD(60, 4), CHORD(55, 4), CHORD(57, 3), CHORD(53, 4), CHORD(60, 4), CHORD(55, 4), CHORD(57, 3), CHORD(53, 4)]
  for (let bar = 0; bar < bars; bar += 1) {
    addKick(buf, (bar * 4 + 0) * beat, { gain: 0.42 })
    addKick(buf, (bar * 4 + 2) * beat, { gain: 0.42 })
    for (let e = 0; e < 8; e += 1) addHat(buf, (bar * 4 + e * 0.5) * beat, 0.03, 0.055)
  }
  // Bass half notes; bar 8 walks F → G into the loop restart.
  addBassLine(buf, chords.flatMap((c, i) => (i === 7 ? [[28, c.root - 12, 2], [30, 55 - 12, 2]] : [[i * 4, c.root - 12, 2], [i * 4 + 2, c.root - 12, 2]])), bpm, { wave: 'triangle', gain: 0.19, attack: 0.01, releaseBeats: 0.5 })
  // Lead (square with a quiet triangle octave double).
  const notes = [
    [0, 67, 0.5], [0.5, 72, 0.5], [1, 76, 1], [2, 79, 1], [3, 76, 0.5], [3.5, 72, 0.5],
    [4, 74, 1], [5, 71, 1], [6, 67, 1], [7, 71, 0.5], [7.5, 74, 0.5],
    [8, 76, 1], [9, 72, 1], [10, 69, 1], [11, 72, 0.5], [11.5, 76, 0.5],
    [12, 65, 1], [13, 69, 1], [14, 72, 1.5], [15.5, 77, 0.5],
    [16, 67, 0.5], [16.5, 72, 0.5], [17, 76, 1], [18, 79, 1], [19, 76, 0.5], [19.5, 72, 0.5],
    [20, 74, 1], [21, 71, 1], [22, 67, 1], [23, 74, 0.5], [23.5, 71, 0.5],
    [24, 76, 1], [25, 72, 1], [26, 69, 1], [27, 76, 0.5], [27.5, 69, 0.5],
    [28, 67, 0.5], [28.5, 69, 0.5], [29, 71, 1], [30, 72, 2],
  ]
  addMelody(buf, notes, bpm, { wave: 'square', gain: 0.14, attack: 0.01, releaseBeats: 0.4 })
  addMelody(buf, notes, bpm, { wave: 'triangle', gain: 0.06, attack: 0.01, releaseBeats: 0.4, detuneSemis: 12 })
  return buf
}

// --- the one-shot cues -------------------------------------------------------------------------

function synthAttackArchery() {
  // Bow release: band-swept noise "thwip" + a fast low twang + a short string ping.
  const buf = track(0.35)
  addNoise(buf, 0, 0.18, { seed: 101, gain: 0.5, mode: 'bp', f0: 1800, f1: 6500, attack: 0.004, release: 0.12 })
  addTone(buf, 0, 0.1, { f0: 190, f1: 95, wave: 'sine', gain: 0.35, attack: 0.002, release: 0.08 })
  addTone(buf, 0.005, 0.06, { f0: 620, f1: 310, wave: 'triangle', gain: 0.12, attack: 0.002, release: 0.05 })
  return buf
}

function synthAttackBoxing() {
  // Punch: low thud (fast sine drop) + damp click.
  const buf = track(0.25)
  addTone(buf, 0, 0.16, { f0: 165, f1: 55, wave: 'sine', gain: 0.8, attack: 0.002, release: 0.1 })
  addNoise(buf, 0, 0.05, { seed: 103, gain: 0.35, mode: 'lp', f0: 1400, attack: 0.001, release: 0.04 })
  addNoise(buf, 0, 0.02, { seed: 104, gain: 0.2, mode: 'hp', f0: 3500, attack: 0.001, release: 0.015 })
  return buf
}

function synthAttackSword() {
  // Sword swish: rising band noise whoosh + a short metallic ring.
  const buf = track(0.32)
  addNoise(buf, 0, 0.22, { seed: 105, gain: 0.5, mode: 'bp', f0: 900, f1: 4800, attack: 0.03, release: 0.1 })
  addTone(buf, 0.02, 0.09, { f0: 2300, f1: 1150, wave: 'square', gain: 0.09, attack: 0.004, release: 0.05 })
  return buf
}

function synthAttackGeneric() {
  // Generic whoosh-thud — the fallback when a section attack cue is missing.
  const buf = track(0.22)
  addNoise(buf, 0, 0.12, { seed: 106, gain: 0.45, mode: 'bp', f0: 500, f1: 2500, attack: 0.01, release: 0.08 })
  addTone(buf, 0.02, 0.1, { f0: 150, f1: 70, wave: 'sine', gain: 0.5, attack: 0.002, release: 0.08 })
  return buf
}

function synthImpact() {
  // Hit: noise burst + low body thump + short ring.
  const buf = track(0.3)
  addNoise(buf, 0, 0.09, { seed: 107, gain: 0.6, mode: 'lp', f0: 1100, attack: 0.001, release: 0.07 })
  addTone(buf, 0, 0.2, { f0: 130, f1: 48, wave: 'sine', gain: 0.7, attack: 0.001, release: 0.12 })
  addTone(buf, 0.005, 0.18, { f0: 820, f1: 790, wave: 'sine', gain: 0.1, attack: 0.001, release: 0.15 })
  return buf
}

function synthStingLow() {
  // 0-0.9 band: a descending minor line, deflated.
  const buf = track(1.7)
  const line = [[0, 57, 0.3], [0.35, 53, 0.3], [0.7, 52, 0.3], [1.05, 48, 0.6]]
  for (const [t, m, d] of line) {
    addTone(buf, t, d, { f0: hz(m), wave: 'square', gain: 0.2, attack: 0.02, release: 0.25 })
    addTone(buf, t, d, { f0: hz(m - 12), wave: 'triangle', gain: 0.14, attack: 0.02, release: 0.25 })
  }
  return buf
}

function synthStingMid() {
  // 1-2.9 band: two level notes — neither celebration nor disaster, back to work.
  const buf = track(1.3)
  addTone(buf, 0, 0.4, { f0: hz(55), wave: 'triangle', gain: 0.24, attack: 0.02, release: 0.2 })
  addTone(buf, 0.42, 0.75, { f0: hz(60), wave: 'triangle', gain: 0.24, attack: 0.02, release: 0.35 })
  addTone(buf, 0.42, 0.75, { f0: hz(67), wave: 'sine', gain: 0.1, attack: 0.02, release: 0.35 })
  return buf
}

function synthStingHigh() {
  // 3-4 band: rising major arpeggio into a bright chord stab.
  const buf = track(1.2)
  const seq = [[0, 72, 0.12], [0.12, 76, 0.12], [0.24, 79, 0.12], [0.36, 84, 0.4]]
  for (const [t, m, d] of seq) {
    addTone(buf, t, d, { f0: hz(m), wave: 'square', gain: 0.18, attack: 0.004, release: 0.08 })
    addTone(buf, t, d, { f0: hz(m + 12), wave: 'sine', gain: 0.06, attack: 0.004, release: 0.08 })
  }
  for (const m of [72, 76, 79, 84]) addTone(buf, 0.78, 0.4, { f0: hz(m), wave: 'square', gain: 0.1, attack: 0.004, release: 0.3 })
  return buf
}

function synthResultsReveal() {
  // Fanfare: quick ascending run then a held triumphant chord with a bass root.
  const buf = track(1.5)
  const run = [[0, 72, 0.1], [0.1, 76, 0.1], [0.2, 79, 0.1], [0.3, 84, 0.45]]
  for (const [t, m, d] of run) addTone(buf, t, d, { f0: hz(m), wave: 'square', gain: 0.17, attack: 0.004, release: 0.1 })
  for (const m of [72, 76, 79, 84]) addTone(buf, 0.75, 0.65, { f0: hz(m), wave: 'square', gain: 0.09, attack: 0.01, release: 0.45 })
  addTone(buf, 0.75, 0.65, { f0: hz(48), wave: 'triangle', gain: 0.18, attack: 0.01, release: 0.4 })
  addNoise(buf, 0.75, 0.2, { seed: 109, gain: 0.06, mode: 'hp', f0: 7000, attack: 0.01, release: 0.15 })
  return buf
}

function synthUiHover() {
  const buf = track(0.06)
  addTone(buf, 0, 0.055, { f0: 920, f1: 1180, wave: 'sine', gain: 0.22, attack: 0.004, release: 0.04 })
  return buf
}

function synthUiSelect() {
  const buf = track(0.14)
  addTone(buf, 0, 0.06, { f0: hz(76), wave: 'square', gain: 0.26, attack: 0.002, release: 0.03 })
  addTone(buf, 0.055, 0.075, { f0: hz(81), wave: 'square', gain: 0.26, attack: 0.002, release: 0.05 })
  return buf
}

function synthUiError() {
  // Dull detuned double-square buzz.
  const buf = track(0.28)
  addTone(buf, 0, 0.26, { f0: 110, wave: 'square', gain: 0.26, attack: 0.005, release: 0.06 })
  addTone(buf, 0, 0.26, { f0: 116.5, wave: 'square', gain: 0.26, attack: 0.005, release: 0.06 })
  addNoise(buf, 0, 0.26, { seed: 113, gain: 0.08, mode: 'lp', f0: 900, attack: 0.005, release: 0.06 })
  return buf
}

// --- build the set -----------------------------------------------------------------------------

const SET = [
  // file, synthesiser, expected duration (s) — used for the printed table and the sanity checks.
  ['music-title.wav', composeTitle, 19.2],
  ['music-gameplay.wav', composeGameplay, 14.545],
  ['music-results.wav', composeResults, 17.143],
  ['attack-archery.wav', synthAttackArchery, 0.35],
  ['attack-boxing.wav', synthAttackBoxing, 0.25],
  ['attack-swordsmanship.wav', synthAttackSword, 0.32],
  ['attack-generic.wav', synthAttackGeneric, 0.22],
  ['impact.wav', synthImpact, 0.3],
  ['sting-low.wav', synthStingLow, 1.7],
  ['sting-mid.wav', synthStingMid, 1.3],
  ['sting-high.wav', synthStingHigh, 1.2],
  ['results-reveal.wav', synthResultsReveal, 1.5],
  ['ui-hover.wav', synthUiHover, 0.06],
  ['ui-select.wav', synthUiSelect, 0.14],
  ['ui-error.wav', synthUiError, 0.28],
]

let failures = 0
const rows = []
for (const [name, synth, expectedSeconds] of SET) {
  const buf = synth()
  const prePeak = peakOf(buf)
  normalize(buf, 0.85)
  const postPeak = peakOf(buf)
  const seconds = buf.length / SR
  const kb = writeWav(name, buf) / 1024
  const problems = []
  if (prePeak < 0.05) problems.push('near-silent before normalise')
  if (Math.abs(postPeak - 0.85) > 0.02) problems.push(`peak ${postPeak.toFixed(3)} after normalise`)
  if (Math.abs(seconds - expectedSeconds) > Math.max(0.05, expectedSeconds * 0.02)) {
    problems.push(`duration ${seconds.toFixed(3)}s ≠ ${expectedSeconds}s`)
  }
  if (problems.length > 0) failures += 1
  rows.push([name, seconds.toFixed(2), kb.toFixed(0), problems.length === 0 ? 'ok' : problems.join('; ')])
}

const width = rows.reduce((w, r) => Math.max(w, r[0].length), 4)
console.log(`\nAI-Ready Knight — shared sound set → ${OUT}`)
console.log(`sample rate ${SR} Hz · mono · 16-bit PCM\n`)
console.log(`${'file'.padEnd(width)}  seconds    KB   check`)
for (const [name, seconds, kb, check] of rows) {
  console.log(`${name.padEnd(width)}  ${String(seconds).padStart(7)}  ${String(kb).padStart(5)}   ${check}`)
}
const totalKb = rows.reduce((sum, r) => sum + Number(r[2]), 0)
console.log(`\n${rows.length} files · ${totalKb.toFixed(0)} KB total · loop seams sit on bar boundaries by construction`)

if (failures > 0) {
  console.error(`\n${failures} file(s) failed their sanity checks — see the table above.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
