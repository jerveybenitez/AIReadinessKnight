'use client'

import type { ResolvedMode } from '../types'

/**
 * Results screen — stub for M3. The real screen (scores, bands, final knight pose, QWEN report,
 * shareable permalink) is M6/M7. This version exists so a completed run has a visible end, and it
 * states the contract the real screen must honour: the permalink is the access token.
 */

export interface ResultsSceneProps {
  mode: ResolvedMode
  knightName: string
  runId: string
}

export function ResultsScene({ mode, knightName, runId }: ResultsSceneProps) {
  return (
    <section className="ark-scene ark-results-scene" aria-labelledby="ark-results-heading">
      <div className="ark-results-card">
        <p className="ark-results-kicker">{mode.title}</p>
        <h2 id="ark-results-heading" tabIndex={-1}>
          The training is complete, {knightName}
        </h2>
        <p className="ark-results-copy">
          Scores, your knight&rsquo;s final pose and the written report arrive in the coming milestones. For now, your
          run is safely stored.
        </p>
        <p className="ark-results-permalink">
          Permalink: <code>#/results?run={runId}</code> <em>(not yet live — M6)</em>
        </p>
      </div>
    </section>
  )
}
