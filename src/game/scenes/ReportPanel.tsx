'use client'

import { useEffect, useRef } from 'react'

import { LoadingSpinner } from '../components/LoadingSpinner'
import type { ReportHorizon, ReportState } from '../report'
import type { ResolvedMode } from '../types'

/**
 * The readiness report view (§3.4, M7) — what the "Read the full report" button opens. It is
 * purely presentational: ResultsScene owns the fetch (which starts the moment results mount),
 * this panel renders whichever of loading / ready / error is true.
 *
 * The report text is model output: it is rendered as text nodes only, never as HTML (qwen-report
 * skill), and it already passed `validateReport` server-side before it got here.
 */

export type ReportPhase = 'loading' | 'ready' | 'error'

export interface ReportPanelProps {
  mode: ResolvedMode
  state: ReportState | null
  phase: ReportPhase
  onRetry: () => void
  onBack: () => void
}

const HORIZON_LABEL: Record<ReportHorizon, string> = {
  now: 'Now',
  '90-days': '90 days',
  '12-months': '12 months',
}

export function ReportPanel({ mode, state, phase, onRetry, onBack }: ReportPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="ark-report-card">
      <p className="ark-results-kicker">{mode.title}</p>
      <h2 id="ark-report-heading" tabIndex={-1} ref={headingRef}>
        Readiness report
      </h2>

      {state ? (
        <p className="ark-report-provenance">
          {state.status === 'ready'
            ? 'Written by QWEN from your answers.'
            : 'Written from your scores — the AI scribe was offline.'}
        </p>
      ) : null}

      {phase === 'loading' ? (
        <p className="ark-report-loading" role="status">
          <LoadingSpinner />
          The scribe is writing your report…
        </p>
      ) : null}

      {phase === 'error' ? (
        <div className="ark-report-error">
          <p role="alert">The scribe could not be reached.</p>
          <button type="button" className="ark-btn" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}

      {state ? (
        <div className="ark-report-scroll" tabIndex={0} role="region" aria-label="Report content">
          <p className="ark-report-headline">{state.report.headline}</p>
          <p className="ark-report-summary">{state.report.summary}</p>

          {state.report.strengths.length > 0 ? (
            <section className="ark-report-block">
              <h3>Strengths</h3>
              <ul>
                {state.report.strengths.map((item, index) => (
                  <li key={`strength-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {state.report.gaps.length > 0 ? (
            <section className="ark-report-block">
              <h3>Gaps — weakest first</h3>
              <ul>
                {state.report.gaps.map((item, index) => (
                  <li key={`gap-${index}`}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="ark-report-block">
            <h3>Next steps</h3>
            <ol className="ark-report-steps">
              {state.report.nextSteps.map((step, index) => (
                <li key={`step-${index}`}>
                  <span className="ark-report-horizon">{HORIZON_LABEL[step.horizon]}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}

      <button type="button" className="ark-btn" onClick={onBack}>
        ← Back to scores
      </button>
    </div>
  )
}
