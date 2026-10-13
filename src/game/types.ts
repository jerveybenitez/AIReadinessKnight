import type { FinalBandKey, SectionBandKey, SectionKey } from './constants'

/**
 * Wire types for the game. Plain JSON — this is what crosses the server→client boundary.
 * All nullable slots are unresolved slots; components must render them through `assetOr`
 * (src/game/assets.ts), which is the single place a missing asset becomes a placeholder.
 */

export interface ResolvedMode {
  slug: string
  title: string
  theme: {
    accentColor: string
    fontFamily: string
    bubbleSkin: string | null
    buttonSkin: string | null
  }
  titleScreen: {
    background: string | null
    logo: string | null
    copy: string
  }
  /** Ordered by canonical SECTION_KEYS order, never by CMS array position. */
  sections: ResolvedSection[]
  results: {
    background: string | null
    finalKnight: Record<FinalBandKey, string | null>
  }
  ai: {
    systemPrompt: string
    tone: string
    guidance: string
  }
}

export interface KnightPoses {
  idle: string | null
  attack: string | null
  celebrate: string | null
  fail: string | null
}

export interface TargetPoses {
  idle: string | null
  hover: string | null
  hit: string | null
}

export interface ResolvedSectionAssets {
  background: string | null
  knight: KnightPoses
  target: TargetPoses
  projectile: string | null
  hitEffect: string | null
}

export interface ResolvedSection {
  key: SectionKey
  name: string
  description: string
  icon: string
  assets: ResolvedSectionAssets
  sectionAnimation: Record<SectionBandKey, { text: string; asset: string | null }>
  questions: ResolvedQuestion[]
}

export interface ResolvedQuestion {
  id: string
  text: string
  /** Exactly 5 options; `options[i].score === i` is enforced by CMS validation. */
  options: { text: string; score: number }[]
}

export interface Answer {
  questionId: string
  sectionKey: SectionKey
  optionIndex: number
  score: number
}

/** One answer per question id — re-answering replaces, never appends. */
export type AnswerMap = Record<string, Answer>

/** What the resume endpoint returns — a narrow projection, never the raw submission. */
export interface RunSnapshot {
  runId: string
  modeSlug: string
  knightName: string
  answerCount: number
  complete: boolean
  answers: Answer[]
}

/** Shape of the `answer` endpoint response. */
export interface AnswerAck {
  runId: string
  answerCount: number
  complete: boolean
}
