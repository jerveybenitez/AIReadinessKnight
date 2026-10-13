import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { GameShell } from '@/game/GameShell'
import { loadResolvedMode } from '@/game/mode-loader'

// The page reads live CMS data per request; modes must go live the moment an admin saves.
export const dynamic = 'force-dynamic'

// One load per request even though the page and generateMetadata both ask for it.
const loadMode = cache(loadResolvedMode)

interface ModePageProps {
  params: Promise<{ mode: string }>
}

export default async function ModePage({ params }: ModePageProps) {
  const { mode: slug } = await params
  const mode = await loadMode(slug)
  if (!mode) notFound()

  return <GameShell mode={mode} />
}

export async function generateMetadata({ params }: ModePageProps): Promise<Metadata> {
  const { mode: slug } = await params
  const mode = await loadMode(slug)
  if (!mode) return { title: 'Not found — AI-Ready Knight' }

  return {
    title: `${mode.title} — AI-Ready Knight`,
    description: mode.titleScreen.copy || `AI-readiness training in the ${mode.title} training grounds.`,
  }
}
