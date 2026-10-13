import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import config from '@payload-config'

import { Stage } from '@/game/components/Stage'
import { loadResolvedMode } from '@/game/mode-loader'
import { loadRunSnapshot } from '@/game/run-server'
import { ResultsScene } from '@/game/scenes/Results'
import { scoreRun } from '@/game/scoring'
import type { AnswerMap } from '@/game/types'
import '@/game/game.css'

// The permalink must always reflect the run as it is right now — never a build-time snapshot.
export const dynamic = 'force-dynamic'

// One load per request even though the page and generateMetadata both ask for it.
const loadSnapshot = cache(async (runId: string) => {
  const payload = await getPayload({ config })
  return loadRunSnapshot(payload, runId)
})

interface ResultPageProps {
  params: Promise<{ runId: string }>
}

/**
 * The shareable permalink (§3.4, §6). The unguessable runId in the URL is the access token; the
 * page renders the same ResultsScene as the in-game ending, from the same narrow projection —
 * company name, industry and report internals are never part of what this route can see.
 */
export default async function ResultPage({ params }: ResultPageProps) {
  const { runId } = await params
  const snapshot = await loadSnapshot(runId)
  if (!snapshot) notFound()

  // An unfinished run has no result to show — send the visitor into the game to finish it.
  if (!snapshot.complete) redirect(`/${snapshot.modeSlug}?run=${snapshot.runId}`)

  const mode = await loadResolvedMode(snapshot.modeSlug)
  if (!mode) notFound()

  const answers: AnswerMap = {}
  for (const answer of snapshot.answers) answers[answer.questionId] = answer
  const score = scoreRun(
    mode.sections.map((section) => ({
      key: section.key,
      questionIds: section.questions.map((question) => question.id),
    })),
    answers,
  )

  const fontStack = mode.theme.fontFamily && mode.theme.fontFamily !== 'system' ? mode.theme.fontFamily : undefined

  return (
    <Stage accentColor={mode.theme.accentColor} fontFamily={fontStack}>
      <div className="ark-shell">
        <ResultsScene
          mode={mode}
          knightName={snapshot.knightName}
          runId={snapshot.runId}
          score={score}
          initialReport={snapshot.report}
        />
      </div>
    </Stage>
  )
}

export async function generateMetadata({ params }: ResultPageProps): Promise<Metadata> {
  const { runId } = await params
  const snapshot = await loadSnapshot(runId)
  if (!snapshot) return { title: 'Result not found — AI-Ready Knight' }

  return {
    title: `${snapshot.knightName}'s results — AI-Ready Knight`,
    description: 'A finished AI-readiness training run: overall score, section breakdown and the knight’s report.',
  }
}
