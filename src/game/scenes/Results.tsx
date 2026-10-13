'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { assetOr } from '../assets'
import { Sprite } from '../components/Sprite'
import { clearRunId } from '../run-client'
import type { FinalBandKey } from '../constants'
import type { RunScore } from '../scoring'
import type { ResolvedMode } from '../types'

/**
 * Results (§3.4) — the end of the run, reachable two ways that must never diverge: in-game when
 * the machine completes, and via the shareable permalink /result/<runId> in a fresh browser.
 * Both surfaces render this component with the same props; the permalink route computes the
 * score with the same `scoreRun` used here, from the same narrow RunSnapshot.
 *
 * The permalink is the access token (§6) — it is permanent, not single-use, and shows only what a
 * recipient should see: the knight, the scores and (from M7) the report.
 */

export interface ResultsSceneProps {
  mode: ResolvedMode
  knightName: string
  runId: string
  score: RunScore
}

const FINAL_BAND_LABEL: Record<FinalBandKey, string> = {
  high_average: 'High average',
  average: 'Average',
  low_average: 'Low average',
}

// The absolute permalink needs the browser origin. Read it via useSyncExternalStore so the
// server render ('') hydrates cleanly and the full URL appears immediately after — no
// effect-time state, no hydration mismatch.
const subscribeToNothing = () => () => {}
const readOrigin = () => window.location.origin
const readServerOrigin = () => ''

export function ResultsScene({ mode, knightName, runId, score }: ResultsSceneProps) {
  const origin = useSyncExternalStore(subscribeToNothing, readOrigin, readServerOrigin)
  const permalink = `${origin}/result/${runId}`

  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyTimer = useRef<number | null>(null)
  const permalinkRef = useRef<HTMLElement>(null)
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    },
    [],
  )

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(permalink)
      setCopyState('copied')
    } catch {
      // Clipboard blocked (e.g. unfocused document) — hand the URL over selected instead.
      setCopyState('failed')
      const node = permalinkRef.current
      const selection = window.getSelection()
      if (node && selection) {
        selection.removeAllRanges()
        const range = document.createRange()
        range.selectNodeContents(node)
        selection.addRange(range)
      }
    }
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 2400)
  }, [permalink])

  const copyLabel = copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy link'

  return (
    <section className="ark-scene ark-results-scene" aria-labelledby="ark-results-heading">
      <div className="ark-results-card">
        <p className="ark-results-kicker">{mode.title}</p>
        <h2 id="ark-results-heading" tabIndex={-1} ref={headingRef}>
          The training is complete, {knightName}
        </h2>

        <Sprite
          asset={assetOr(
            mode.results.finalKnight[score.band],
            `Final knight — ${FINAL_BAND_LABEL[score.band]}`,
            'knight',
          )}
          className="ark-results-final-knight"
          alt={`Your knight at the end of training: ${FINAL_BAND_LABEL[score.band].toLowerCase()}.`}
        />

        <p className="ark-results-overall">
          Overall score: <strong>{score.mean.toFixed(1)} / 4</strong> · {FINAL_BAND_LABEL[score.band]}
        </p>

        <ul className="ark-results-breakdown" aria-label="Section breakdown">
          {score.sections.map((section) => {
            const resolved = mode.sections.find((candidate) => candidate.key === section.key)
            return (
              <li key={section.key} className="ark-results-row">
                <span className="ark-results-row-icon" aria-hidden="true">
                  {resolved?.icon || '◆'}
                </span>
                <span className="ark-results-row-name">{resolved?.name ?? section.key}</span>
                <span className="ark-results-row-mean">{section.mean.toFixed(1)} / 4</span>
                <span className="ark-results-row-band">{section.band}</span>
              </li>
            )
          })}
        </ul>

        <p className="ark-results-report">
          Your QWEN-written debrief — strengths and next steps — arrives with the next milestone.
        </p>

        <div className="ark-results-permalink-row">
          <code className="ark-results-permalink-text" ref={permalinkRef}>
            {permalink}
          </code>
          <button type="button" className="ark-btn ark-btn--compact" onClick={handleCopy}>
            {copyLabel}
          </button>
        </div>

        <div className="ark-results-actions">
          <a
            href={`/${mode.slug}`}
            className="ark-btn ark-btn--primary"
            onClick={() => clearRunId(mode.slug)}
          >
            Train again
          </a>
        </div>
      </div>
    </section>
  )
}
