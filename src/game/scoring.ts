import type { FinalBandKey, SectionBandKey, SectionKey } from './constants'
import type { AnswerMap } from './types'

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

// --- whole-run scoring ------------------------------------------------------------------------

/** The mode shape scoring needs: the canonical question ids per section, in order. */
export interface ScoreSectionInput {
  key: SectionKey
  questionIds: string[]
}

export interface SectionScore {
  key: SectionKey
  mean: number
  band: SectionBandKey
  answered: number
  total: number
}

/** Everything the results screen needs — computed once, from persisted answers. */
export interface RunScore {
  mean: number
  band: FinalBandKey
  answered: number
  total: number
  sections: SectionScore[]
}

/**
 * Score a run against the mode's *current* sections.
 *
 * - Only question ids the mode still has count: an answer to a question a re-skin removed can
 *   never skew a score. Mean is over answers that exist (a partial run scores what it answered);
 *   a complete run — the only run the results screen accepts — always has all 15.
 * - Section means are over the *answered* scores; the final mean is over every answered score
 *   across all sections, never the mean of the section means (which would silently re-weight a
 *   mode with uneven section sizes).
 */
export function scoreRun(sections: ScoreSectionInput[], answers: AnswerMap): RunScore {
  const allScores: number[] = []
  const sectionScores: SectionScore[] = sections.map((section) => {
    const scores: number[] = []
    for (const questionId of section.questionIds) {
      const answer = answers[questionId]
      if (!answer) continue
      scores.push(answer.score)
      allScores.push(answer.score)
    }
    const sectionMean = mean(scores)
    return {
      key: section.key,
      mean: sectionMean,
      band: sectionBandOf(sectionMean),
      answered: scores.length,
      total: section.questionIds.length,
    }
  })

  const overallMean = mean(allScores)
  return {
    mean: overallMean,
    band: finalBandOf(overallMean),
    answered: allScores.length,
    total: sections.reduce((n, section) => n + section.questionIds.length, 0),
    sections: sectionScores,
  }
}
