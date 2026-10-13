'use client'

import type { ResolvedMode } from '../types'

/**
 * Section-end screen — stub for M3. M5 adds the band-driven animation (text + asset from the
 * mode's `section_animation`, chosen by the section's mean band from src/game/scoring.ts, M6).
 * The machine already routes here after question 5; the button continues the run.
 */

export interface SectionEndSceneProps {
  mode: ResolvedMode
  sectionIndex: number
  onContinue: () => void
}

export function SectionEndScene({ mode, sectionIndex, onContinue }: SectionEndSceneProps) {
  const section = mode.sections[sectionIndex]
  const isLast = sectionIndex === mode.sections.length - 1

  return (
    <section className="ark-scene ark-section-end-scene" aria-labelledby="ark-section-end-heading">
      <div className="ark-section-end-card">
        <p className="ark-section-end-icon" aria-hidden="true">
          {section?.icon || '◆'}
        </p>
        <h2 id="ark-section-end-heading" tabIndex={-1}>
          {section?.name ?? 'Section'} — training complete
        </h2>
        <p className="ark-section-end-copy">
          The {section?.name.toLowerCase() ?? 'section'} drills are done. Your knight catches their breath.
        </p>
        <button type="button" className="ark-btn ark-btn--primary" onClick={onContinue} autoFocus>
          {isLast ? 'See the final reckoning' : 'Next training ground'} →
        </button>
      </div>
    </section>
  )
}
