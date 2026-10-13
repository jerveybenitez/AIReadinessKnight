import { describe, expect, it } from 'vitest'

import { assertPlayable, loadResolvedMode, resolveMode } from '@/game/mode-loader'
import type { Mode } from '@/payload-types'

/**
 * The resolver is the seam every mode inherits through: a mode provides only what it overrides,
 * the `default` mode fills the rest, and by the time the game sees a mode there is no inheritance
 * left in it. These tests pin the two properties that matter: canonical section order and
 * per-slot fallback.
 */

const question = (key: string) => ({
  key,
  text: `Text for ${key}`,
  options: [0, 1, 2, 3, 4].map((score) => ({ text: `Option ${score} for ${key}`, score })),
})

const section = (key: 'archery' | 'boxing' | 'swordsmanship', suffix = '') => ({
  key,
  name: `${key} name${suffix}`,
  description: `${key} description${suffix}`,
  icon: '🎯',
  assets: {},
  sectionAnimation: [
    { band: '0-0.9' as const, text: `low${suffix}` },
    { band: '1-2.9' as const, text: `mid${suffix}` },
    { band: '3-4' as const, text: `high${suffix}` },
  ],
  questions: [1, 2, 3, 4, 5].map((n) => question(`${key}-q${n}`)),
})

const mode = (overrides: Partial<Mode>): Mode =>
  ({
    id: 1,
    title: 'Test mode',
    slug: 'test',
    updatedAt: '',
    createdAt: '',
    ...overrides,
  }) as unknown as Mode

const fullDefault = () =>
  mode({
    slug: 'default',
    title: 'Default',
    theme: { accentColor: '#d4af37', fontFamily: 'system' },
    titleScreen: { copy: 'Default copy' },
    sections: [section('archery', '-def'), section('boxing', '-def'), section('swordsmanship', '-def')],
    ai: { systemPrompt: 'Default prompt', tone: 'Direct', guidance: '' },
  })

describe('resolveMode', () => {
  it('orders sections by the canonical key order, never CMS array position', () => {
    const messed = mode({
      slug: 'messed',
      sections: [...fullDefault().sections!].reverse(),
    })
    const resolved = resolveMode(messed, fullDefault())
    expect(resolved.sections.map((s) => s.key)).toEqual(['archery', 'boxing', 'swordsmanship'])
  })

  it('a mode with a missing section inherits it whole from default', () => {
    const primary = mode({ slug: 'partial', sections: [section('boxing', '-own')] })
    const resolved = resolveMode(primary, fullDefault())
    const boxing = resolved.sections.find((s) => s.key === 'boxing')
    const archery = resolved.sections.find((s) => s.key === 'archery')
    expect(boxing?.name).toBe('boxing name-own')
    expect(boxing?.sectionAnimation['0-0.9'].text).toBe('low-own')
    expect(archery?.name).toBe('archery name-def')
  })

  it('a mode with no questions of its own inherits the default section anatomy', () => {
    const primary = mode({ slug: 'partial', sections: [{ ...section('archery'), questions: [] }] })
    const resolved = resolveMode(primary, fullDefault())
    const archery = resolved.sections.find((s) => s.key === 'archery')!
    expect(archery.questions).toHaveLength(5)
    expect(archery.questions[0].text).toBe('Text for archery-q1')
  })

  it('own questions override the default text, ids stay stable', () => {
    const primary = mode({
      slug: 'partial',
      sections: [{ ...section('archery'), questions: [question('archery-q1'), question('archery-q2')] }],
    })
    const resolved = resolveMode(primary, fullDefault())
    const archery = resolved.sections.find((s) => s.key === 'archery')!
    expect(archery.questions).toHaveLength(2)
    expect(archery.questions[0].id).toBe('archery-q1')
  })

  it('a missing band animation falls back band-by-band, not as a block', () => {
    const primary = mode({
      slug: 'partial',
      sections: [{ ...section('archery'), sectionAnimation: [{ band: '3-4', text: 'own high' }] }],
    })
    const resolved = resolveMode(primary, fullDefault())
    const archery = resolved.sections.find((s) => s.key === 'archery')!
    expect(archery.sectionAnimation['3-4'].text).toBe('own high')
    expect(archery.sectionAnimation['1-2.9'].text).toBe('mid-def')
    expect(archery.sectionAnimation['0-0.9'].text).toBe('low-def')
  })

  it('theme, title copy and AI guidance inherit per field', () => {
    const primary = mode({
      slug: 'partial',
      theme: { accentColor: '#00e5ff' },
      ai: { systemPrompt: 'Own prompt' },
    })
    const resolved = resolveMode(primary, fullDefault())
    expect(resolved.theme.accentColor).toBe('#00e5ff')
    expect(resolved.theme.fontFamily).toBe('system')
    expect(resolved.titleScreen.copy).toBe('Default copy')
    expect(resolved.ai.systemPrompt).toBe('Own prompt')
    expect(resolved.ai.tone).toBe('Direct')
  })
})

describe('loadResolvedMode against the seeded default', () => {
  it('resolves the default mode to a playable shape', async () => {
    const resolved = await loadResolvedMode('default')
    expect(resolved).not.toBeNull()
    expect(assertPlayable(resolved!)).toEqual([])
    expect(resolved!.sections.map((s) => s.key)).toEqual(['archery', 'boxing', 'swordsmanship'])
    const allIds = resolved!.sections.flatMap((s) => s.questions.map((q) => q.id))
    expect(allIds).toHaveLength(15)
    expect(allIds[0]).toBe('archery-q1')
    expect(allIds[14]).toBe('swordsmanship-q5')
  })

  it('returns null for an unknown slug (route turns this into a 404)', async () => {
    expect(await loadResolvedMode('nonsense')).toBeNull()
  })
})
