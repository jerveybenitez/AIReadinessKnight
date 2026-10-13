import type { Payload } from 'payload'

import questionsJson from '../../ai_readiness_questions.json'
import { SECTION_BAND_KEYS, type SectionKey } from '../game/constants'

export const DEFAULT_SYSTEM_PROMPT = [
  'You are a pragmatic AI-adoption advisor writing a short readiness report for a company leadership team.',
  'You are given the company name, industry, per-section and overall mean scores (0-4), and the exact answer they chose for every question.',
  'Be concrete and specific to the industry. Do not invent facts beyond the scores and answers given. Avoid buzzwords.',
  'Prioritise the weakest sections first when recommending next steps.',
].join(' ')

export const DEFAULT_TITLE_COPY =
  'Complete the training. Face the truth. The Knight of AI readiness is forged by what you build next.'

export type SeedResult = 'created' | 'exists'

/**
 * Idempotent seed for the `default` mode — the fallback source for every other mode.
 *
 * - Safe to re-run: if a mode with slug `default` exists, nothing is touched (admin edits win).
 * - Question ids are generated once here (`<sectionKey>-q<n>`) and never regenerated — stored answers key on them.
 * - Asset slots are intentionally left empty; the game renders dev placeholders until real art is
 *   uploaded, and other modes inherit whatever `default` ends up with.
 */
export async function seedDefaultMode(payload: Payload): Promise<SeedResult> {
  const existing = await payload.find({
    collection: 'modes',
    where: { slug: { equals: 'default' } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs.length > 0) {
    return 'exists'
  }

  await payload.create({
    collection: 'modes',
    data: {
      title: 'Default',
      slug: 'default',
      theme: {
        accentColor: '#d4af37',
        fontFamily: 'system',
      },
      titleScreen: {
        copy: DEFAULT_TITLE_COPY,
      },
      sections: questionsJson.questions.map((section) => ({
        key: section.game_training as SectionKey,
        name: section.name,
        description: section.description,
        icon: section.icon,
        sectionAnimation: SECTION_BAND_KEYS.map((band) => ({
          band,
          text: section.section_animation[band],
        })),
        questions: section.questions.map((question, index) => ({
          id: `${section.game_training}-q${index + 1}`,
          text: question.text,
          options: question.options.map((option) => ({
            text: option.text,
            score: option.score,
          })),
        })),
      })),
      ai: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        tone: 'Direct, encouraging, practical',
        guidance: '',
      },
    },
    overrideAccess: true,
  })

  return 'created'
}
