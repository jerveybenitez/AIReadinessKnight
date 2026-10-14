/**
 * The single audio resolver — every sound in the game is read through `soundFor` (QODER.md §3.7),
 * the audio mirror of `assetOr` (src/game/assets.ts). No component ever references an audio file
 * path directly; the cue map below is the one place a path exists. Audio is ONE shared static
 * set for every mode (default / electric / default16 / future modes) — the deliberate §3.7
 * exception to "every asset is a CMS upload" — but because lookup goes through this one
 * resolver, the set can be promoted to CMS later without touching any component.
 *
 * Cue inventory (QODER.md M13): three looping music beds (title/intake, gameplay × all sections,
 * results), per-section attack cues with a generic fallback, one impact, one section-end sting
 * per band, the results reveal, and hover/select/error UI cues.
 */

import type { SectionBandKey, SectionKey } from '../constants'

export type MusicCue = 'music-title' | 'music-gameplay' | 'music-results'

export type SoundCue =
  | MusicCue
  | 'attack'
  | 'impact'
  /** Section-end stings, keyed by band exactly like `sectionAnimation` (direct key access). */
  | `sting-${SectionBandKey}`
  | 'results-reveal'
  | 'ui-hover'
  | 'ui-select'
  | 'ui-error'

const SOUNDS: Record<string, string> = {
  'music-title': '/audio/music-title.wav',
  'music-gameplay': '/audio/music-gameplay.wav',
  'music-results': '/audio/music-results.wav',
  // Section attacks resolve per section; `attack` is the generic fallback the resolver drops to
  // when a section cue is missing (§3.7: fall back rather than play nothing).
  attack: '/audio/attack-generic.wav',
  'attack-archery': '/audio/attack-archery.wav',
  'attack-boxing': '/audio/attack-boxing.wav',
  'attack-swordsmanship': '/audio/attack-swordsmanship.wav',
  impact: '/audio/impact.wav',
  'sting-0-0.9': '/audio/sting-low.wav',
  'sting-1-2.9': '/audio/sting-mid.wav',
  'sting-3-4': '/audio/sting-high.wav',
  'results-reveal': '/audio/results-reveal.wav',
  'ui-hover': '/audio/ui-hover.wav',
  'ui-select': '/audio/ui-select.wav',
  'ui-error': '/audio/ui-error.wav',
}

export interface SoundForOptions {
  /** Section scope for section-aware cues (attack, impact). Missing scope → the generic cue. */
  section?: SectionKey
}

/**
 * Resolve a cue to its URL. Section-aware: `soundFor('attack', { section: 'archery' })` returns
 * the bow release, falling back to the generic attack when the section cue is absent — never
 * to silence while a generic exists. Returns null only when the cue itself is unknown, which
 * the engine treats as silence (the §3.7 degradation rule).
 */
export function soundFor(cue: SoundCue, options?: SoundForOptions): string | null {
  if (options?.section) {
    const scoped = SOUNDS[`${cue}-${options.section}`]
    if (scoped) return scoped
  }
  return SOUNDS[cue] ?? null
}

/** The cue map itself — frozen; tests and tooling read it, nothing writes it at runtime. */
export const SOUND_MAP: Readonly<Record<string, string>> = Object.freeze({ ...SOUNDS })
