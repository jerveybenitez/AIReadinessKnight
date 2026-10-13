import type { FinalBandKey, SectionBandKey } from './constants'

/**
 * Scoring — the single, pure home of every score decision (QODER.md §4, settled).
 *
 * Everything is a mean score per question on a 0–4 scale. Never a total. There are two different
 * band sets with different boundaries; they are deliberately NOT unified:
 *
 *   section bands (drive the section-end animation §3.3):  >=3 → '3-4' · >=1 → '1-2.9' · else '0-0.9'
 *   final bands   (drive the ending knight pose §3.4):     >=2.9 → high_average · >=1.7 → average · else low_average
 *
 * The mean is never rounded before banding — rounding 2.85 up to 2.9 would silently promote a
 * band. Banding therefore lives in `*BandOf(mean)` functions that take the exact mean, with
 * `*Band(scores)` wrappers computing the raw mean from answer scores.
 */

/** Raw mean of answer scores. Empty input is 0 (the machine guarantees five answers before banding). */
export function mean(scores: number[]): number {
  if (scores.length === 0) return 0
  let total = 0
  for (const score of scores) total += score
  return total / scores.length
}

/** Section band for an exact mean. `>= 3` promotes to '3-4'; a mean of 2.95 stays in '1-2.9'. */
export function sectionBandOf(meanScore: number): SectionBandKey {
  if (meanScore >= 3) return '3-4'
  if (meanScore >= 1) return '1-2.9'
  return '0-0.9'
}

export function sectionBand(scores: number[]): SectionBandKey {
  return sectionBandOf(mean(scores))
}

/** Final band for an exact mean. `>= 2.9` is high_average; a mean of 2.85 stays average. */
export function finalBandOf(meanScore: number): FinalBandKey {
  if (meanScore >= 2.9) return 'high_average'
  if (meanScore >= 1.7) return 'average'
  return 'low_average'
}

export function finalBand(scores: number[]): FinalBandKey {
  return finalBandOf(mean(scores))
}
