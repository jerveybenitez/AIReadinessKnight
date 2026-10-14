/**
 * The audio engine — the runtime half of QODER.md §3.7. Every cue a scene wants to play goes
 * through `soundFor` (sounds.ts) and this singleton; components never touch a file path and
 * never touch `AudioContext` themselves.
 *
 * Contract implemented here:
 * - **Gesture-gated unlock.** Nothing plays before the first real interaction: `unlock()` must
 *   run inside a user-gesture handler (the title screen's Begin button, the global one-time
 *   gesture listener armed by Stage, or the mute control). Before that, the engine is inert and
 *   music requests are held as "desired" until the unlock arrives.
 * - **Mute is mandatory and persisted.** `ark:muted` in localStorage survives reloads and runs.
 *   Under browser automation (navigator.webdriver — the e2e suite) the default is muted so the
 *   tests stay silent unless a test deliberately opts in.
 * - **Degrade to silence.** A missing file, a failed fetch, a decode error or no output device
 *   resolves to quiet — never to a thrown error, never to blocked gameplay. Failures are cached
 *   so a broken cue is retried at most once per session.
 * - **No audio on the first paint's critical path.** The AudioContext is created at unlock, the
 *   music element at first real playback, and effect files are fetched lazily on first use.
 * - **Reduced motion is not a mute signal.** Music and UI cues play under reduced motion; only
 *   the attack/impact pair is skipped, and that decision lives in the question scene alongside
 *   the visual beat it belongs to — not here.
 */

import type { SectionKey } from '../constants'
import { soundFor, type MusicCue, type SoundCue } from './sounds'

const MUTE_STORAGE_KEY = 'ark:muted'
const MUSIC_VOLUME = 0.42
const HOVER_THROTTLE_MS = 70

/** Initial state: the persisted choice wins; under automation the suite gets silence by default. */
function initialMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const stored = window.localStorage.getItem(MUTE_STORAGE_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    // storage unavailable (private mode) — sound still works, persistence is best-effort
  }
  return typeof navigator !== 'undefined' && Boolean(navigator.webdriver)
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicEl: HTMLAudioElement | null = null
  private currentMusicUrl: string | null = null
  private desiredMusic: MusicCue | null = null
  private unlocked = false
  private gestureArmed = false
  private muted: boolean
  /** Decoded (or permanently failed) effect buffers, keyed by URL. */
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private lastPlayedAt = new Map<string, number>()
  private listeners = new Set<() => void>()

  constructor() {
    this.muted = initialMuted()
  }

  isMuted(): boolean {
    return this.muted
  }

  /** useSyncExternalStore contract for the mute toggle (see MuteControl). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0')
    } catch {
      /* persistence is best-effort */
    }
    if (this.master) this.master.gain.value = muted ? 0 : 1
    if (this.musicEl) {
      this.musicEl.volume = muted ? 0 : MUSIC_VOLUME
      if (muted) this.musicEl.pause()
    }
    if (!muted) this.ensureMusicPlaying()
    for (const listener of this.listeners) listener()
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted)
    return this.muted
  }

  /** Idempotent. Call from inside a user-gesture handler only. */
  unlock(): void {
    if (this.unlocked || typeof window === 'undefined') return
    this.unlocked = true
    try {
      const AC =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AC) {
        this.ctx = new AC()
        this.master = this.ctx.createGain()
        this.master.gain.value = this.muted ? 0 : 1
        this.master.connect(this.ctx.destination)
        void this.ctx.resume().catch(() => {})
      }
    } catch {
      // No output device / blocked — everything below degrades to silence.
      this.ctx = null
      this.master = null
    }
    this.ensureMusicPlaying()
  }

  /**
   * Stage calls this once: the first real interaction anywhere (pointer or key) unlocks audio.
   * Covers routes with no Begin button (the results permalink) and stray gestures alike.
   */
  armGestureUnlock(): () => void {
    if (this.gestureArmed || typeof window === 'undefined') return () => {}
    this.gestureArmed = true
    const onGesture = () => {
      this.unlock()
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
    window.addEventListener('pointerdown', onGesture)
    window.addEventListener('keydown', onGesture)
    return () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }

  /**
   * Request the looping music bed for the current scene. Holds the request until unlock when
   * called pre-gesture; a no-op when the same bed is already playing. Muting pauses the stream
   * entirely so the muted path (the e2e default) produces no audio traffic at all.
   */
  setMusic(cue: MusicCue): void {
    this.desiredMusic = cue
    this.ensureMusicPlaying()
  }

  private ensureMusicPlaying(): void {
    if (!this.unlocked || this.muted || !this.desiredMusic) return
    const url = soundFor(this.desiredMusic)
    if (!url || url === this.currentMusicUrl) return
    try {
      if (!this.musicEl) {
        this.musicEl = new Audio()
        this.musicEl.loop = true
        this.musicEl.preload = 'auto'
      }
      this.currentMusicUrl = url
      this.musicEl.src = url
      this.musicEl.volume = MUSIC_VOLUME
      void this.musicEl.play().catch(() => {
        /* suspended tab, no device — silence is correct */
      })
    } catch {
      /* no device — silence is correct */
    }
  }

  /**
   * Fire a one-shot cue. A no-op until unlocked, while muted, or when the cue is unknown —
   * and every failure inside (fetch, decode, scheduling) resolves to silence by construction.
   */
  play(cue: SoundCue, options?: { section?: SectionKey }): void {
    if (!this.unlocked || this.muted || !this.ctx || !this.master) return
    const url = soundFor(cue, options)
    if (!url) return
    const now = performance.now()
    if (now - (this.lastPlayedAt.get(url) ?? 0) < HOVER_THROTTLE_MS) return
    this.lastPlayedAt.set(url, now)
    void this.bufferFor(url).then((buffer) => {
      if (!buffer || !this.ctx || !this.master) return
      try {
        const source = this.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(this.master)
        source.start()
      } catch {
        /* scheduling failure — silence is correct */
      }
    })
  }

  /** Fetch + decode once; cache both the buffer and a permanent failure. */
  private bufferFor(url: string): Promise<AudioBuffer | null> {
    let pending = this.buffers.get(url)
    if (!pending) {
      const ctx = this.ctx
      pending = fetch(url)
        .then((res) => {
          if (!res.ok || !ctx) throw new Error(`audio fetch failed: ${res.status}`)
          return res.arrayBuffer()
        })
        .then((bytes) => ctx!.decodeAudioData(bytes))
        .catch(() => null)
      this.buffers.set(url, pending)
    }
    return pending
  }
}

export const audioEngine = new AudioEngine()
