'use client'

import { useEffect } from 'react'

import { audioEngine } from '../audio/engine'
import { assetOr } from '../assets'
import { Knight, type KnightPose } from '../components/Knight'
import { Sprite } from '../components/Sprite'
import { sectionBand } from '../scoring'
import type { SectionBandKey } from '../constants'
import type { AnswerMap, ResolvedMode } from '../types'

/**
 * Section-end screen (§3.3): the band-driven animation. The section's mean lands in exactly one
 * band — the matching `sectionAnimation` entry supplies the CMS-editable copy (the creative spec
 * from ai_readiness_questions.json) and the animation asset slot. The knight holds the band pose:
 * celebrates a 3-4, catches their breath on 1-2.9, knocked on 0-0.9.
 *
 * The machine routes here only after question 5 is answered; Continue moves the run on. The frame
 * is decorative (aria-hidden) — the caption carries the meaning, and reduced motion simply has
 * nothing to collapse here.
 */

export interface SectionEndSceneProps {
  mode: ResolvedMode
  sectionIndex: number
  answers: AnswerMap
  onContinue: () => void
}

const BAND_POSE: Record<SectionBandKey, KnightPose> = {
  '3-4': 'celebrate',
  '1-2.9': 'idle',
  '0-0.9': 'fail',
}

export function SectionEndScene({ mode, sectionIndex, answers, onContinue }: SectionEndSceneProps) {
  const section = mode.sections[sectionIndex]
  const isLast = sectionIndex === mode.sections.length - 1

  // Hooks run before any early return: a missing section simply has no band and no sting.
  const band: SectionBandKey | null = section
    ? sectionBand(section.questions.map((question) => answers[question.id]?.score ?? 0))
    : null

  // One scene sting per band — the audio mirror of the band-driven animation frame. The
  // gameplay music bed keeps playing underneath (one loop for all three sections, M13).
  useEffect(() => {
    if (band) audioEngine.play(`sting-${band}`)
  }, [band])

  if (!section || !band) {
    return (
      <section className="ark-scene ark-section-end-scene" aria-labelledby="ark-section-end-heading">
        <h2 id="ark-section-end-heading" tabIndex={-1}>
          This section is missing from the mode.
        </h2>
      </section>
    )
  }

  const animation = section.sectionAnimation[band]

  return (
    <section className="ark-scene ark-section-end-scene" aria-labelledby="ark-section-end-heading">
      <div className="ark-section-end-card">
        <p className="ark-section-end-icon" aria-hidden="true">
          {section.icon || '◆'}
        </p>
        <h2 id="ark-section-end-heading" tabIndex={-1}>
          {section.name} — training complete
        </h2>
        <div className="ark-section-anim" aria-hidden="true">
          <Knight poses={section.assets.knight} pose={BAND_POSE[band]} className="ark-section-anim-knight" />
          <Sprite
            asset={assetOr(animation.asset, `Animation — ${band}`, 'effect')}
            className="ark-section-anim-slot"
          />
        </div>
        <p className="ark-section-end-copy">{animation.text}</p>
        <button
          type="button"
          className="ark-btn ark-btn--primary"
          onClick={() => {
            audioEngine.play('ui-select')
            onContinue()
          }}
        >
          {isLast ? 'See the final reckoning' : 'Next training ground'} →
        </button>
      </div>
    </section>
  )
}
