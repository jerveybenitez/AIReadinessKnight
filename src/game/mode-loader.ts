import { getPayload } from 'payload'

import config from '@payload-config'

import { SECTION_BAND_KEYS, SECTION_KEYS, type SectionBandKey, type SectionKey } from './constants'
import type { ResolvedMode, ResolvedQuestion, ResolvedSection } from './types'
import type { Media, Mode } from '@/payload-types'

/**
 * Loads a mode and resolves every empty slot against the `default` mode — once, server-side.
 * The returned object has no inheritance left in it: downstream code never branches on a missing
 * slot (game-modes-cms skill). Unknown slug returns null; the route turns that into a 404.
 */

type Section = NonNullable<Mode['sections']>[number]

const mediaUrl = (value: (number | null) | Media | undefined): string | null => {
  if (value && typeof value === 'object' && typeof value.url === 'string') return value.url
  return null
}

const pick = <T>(primary: T | null | undefined, fallback: T | null | undefined, dflt: T): T =>
  primary ?? fallback ?? dflt

const sectionByKey = (mode: Mode, key: SectionKey): Section | undefined =>
  (mode.sections ?? []).find((section) => section.key === key)

const resolveQuestions = (primary: Section | undefined, fallback: Section | undefined): ResolvedQuestion[] => {
  const source = primary?.questions && primary.questions.length > 0 ? primary.questions : fallback?.questions
  return (source ?? []).map((question, index) => {
    const fb = fallback?.questions?.[index]
    return {
      id: question.id || fb?.id || `q${index + 1}`,
      text: question.text || fb?.text || '',
      options: (question.options ?? []).map((option, oi) => ({
        text: option.text || fb?.options?.[oi]?.text || '',
        score: typeof option.score === 'number' ? option.score : (fb?.options?.[oi]?.score ?? oi),
      })),
    }
  })
}

const resolveSection = (primary: Section | undefined, fallback: Section): ResolvedSection => {
  const key = primary?.key ?? fallback.key
  const primaryAnimations = new Map(
    (primary?.sectionAnimation ?? []).filter(Boolean).map((entry) => [entry.band, entry]),
  )
  const fallbackAnimations = new Map(
    (fallback.sectionAnimation ?? []).filter(Boolean).map((entry) => [entry.band, entry]),
  )

  const sectionAnimation = Object.fromEntries(
    SECTION_BAND_KEYS.map((band) => {
      const p = primaryAnimations.get(band)
      const f = fallbackAnimations.get(band)
      return [band, { text: p?.text || f?.text || '', asset: mediaUrl(p?.asset) ?? mediaUrl(f?.asset) }]
    }),
  ) as Record<SectionBandKey, { text: string; asset: string | null }>

  return {
    key,
    name: pick(primary?.name, fallback.name, key),
    description: pick(primary?.description, fallback.description, ''),
    icon: pick(primary?.icon, fallback.icon, ''),
    assets: {
      background: mediaUrl(primary?.assets?.background) ?? mediaUrl(fallback.assets?.background),
      knight: {
        idle: mediaUrl(primary?.assets?.knight?.idle) ?? mediaUrl(fallback.assets?.knight?.idle),
        attack: mediaUrl(primary?.assets?.knight?.attack) ?? mediaUrl(fallback.assets?.knight?.attack),
        celebrate: mediaUrl(primary?.assets?.knight?.celebrate) ?? mediaUrl(fallback.assets?.knight?.celebrate),
        fail: mediaUrl(primary?.assets?.knight?.fail) ?? mediaUrl(fallback.assets?.knight?.fail),
      },
      target: {
        idle: mediaUrl(primary?.assets?.target?.idle) ?? mediaUrl(fallback.assets?.target?.idle),
        hover: mediaUrl(primary?.assets?.target?.hover) ?? mediaUrl(fallback.assets?.target?.hover),
        hit: mediaUrl(primary?.assets?.target?.hit) ?? mediaUrl(fallback.assets?.target?.hit),
      },
      projectile: mediaUrl(primary?.assets?.projectile) ?? mediaUrl(fallback.assets?.projectile),
      hitEffect: mediaUrl(primary?.assets?.hitEffect) ?? mediaUrl(fallback.assets?.hitEffect),
    },
    sectionAnimation,
    questions: resolveQuestions(primary, fallback),
  }
}

/** Explicit, field-by-field merge — never a generic deep merge (a generic one hides what leaks). */
export function resolveMode(primary: Mode, fallback: Mode): ResolvedMode {
  const fallbackSection = (key: SectionKey): Section | undefined => sectionByKey(fallback, key)

  const sections: ResolvedSection[] = []
  for (const key of SECTION_KEYS) {
    const fb = fallbackSection(key)
    if (!fb) continue // a default without this section is a broken seed; drop it loudly, not silently
    sections.push(resolveSection(sectionByKey(primary, key), fb))
  }

  return {
    slug: primary.slug,
    title: pick(primary.title, fallback.title, primary.slug),
    theme: {
      accentColor: pick(primary.theme?.accentColor, fallback.theme?.accentColor, '#d4af37'),
      fontFamily: pick(primary.theme?.fontFamily, fallback.theme?.fontFamily, 'system'),
      bubbleSkin: mediaUrl(primary.theme?.bubbleSkin) ?? mediaUrl(fallback.theme?.bubbleSkin),
      buttonSkin: mediaUrl(primary.theme?.buttonSkin) ?? mediaUrl(fallback.theme?.buttonSkin),
    },
    titleScreen: {
      background: mediaUrl(primary.titleScreen?.background) ?? mediaUrl(fallback.titleScreen?.background),
      logo: mediaUrl(primary.titleScreen?.logo) ?? mediaUrl(fallback.titleScreen?.logo),
      copy: pick(primary.titleScreen?.copy, fallback.titleScreen?.copy, ''),
    },
    sections,
    results: {
      background: mediaUrl(primary.results?.background) ?? mediaUrl(fallback.results?.background),
      finalKnight: {
        low_average:
          mediaUrl(primary.results?.finalKnight?.low_average) ??
          mediaUrl(fallback.results?.finalKnight?.low_average),
        average:
          mediaUrl(primary.results?.finalKnight?.average) ?? mediaUrl(fallback.results?.finalKnight?.average),
        high_average:
          mediaUrl(primary.results?.finalKnight?.high_average) ??
          mediaUrl(fallback.results?.finalKnight?.high_average),
      },
    },
    ai: {
      systemPrompt: pick(primary.ai?.systemPrompt, fallback.ai?.systemPrompt, ''),
      tone: pick(primary.ai?.tone, fallback.ai?.tone, ''),
      guidance: pick(primary.ai?.guidance, fallback.ai?.guidance, ''),
    },
  }
}

/** Load a mode by slug and resolve it against `default`. Null means "no such mode" → 404 at the route. */
export async function loadResolvedMode(slug: string): Promise<ResolvedMode | null> {
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'modes',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
  })
  const primary = docs[0]
  if (!primary) return null

  if (slug === 'default') return resolveMode(primary, primary)

  const { docs: defaultDocs } = await payload.find({
    collection: 'modes',
    where: { slug: { equals: 'default' } },
    limit: 1,
    depth: 1,
  })
  const fallback = defaultDocs[0] ?? primary
  return resolveMode(primary, fallback)
}

/** Sanity check used by dev tooling and tests: does the resolved mode have the required shape for play? */
export function assertPlayable(mode: ResolvedMode): string[] {
  const problems: string[] = []
  if (mode.sections.length !== SECTION_KEYS.length) {
    problems.push(`expected ${SECTION_KEYS.length} sections, got ${mode.sections.length}`)
  }
  for (const section of mode.sections) {
    if (section.questions.length !== 5) {
      problems.push(`section ${section.key}: expected 5 questions, got ${section.questions.length}`)
    }
    for (const question of section.questions) {
      if (question.options.length !== 5) {
        problems.push(`question ${question.id}: expected 5 options, got ${question.options.length}`)
      }
    }
  }
  return problems
}
