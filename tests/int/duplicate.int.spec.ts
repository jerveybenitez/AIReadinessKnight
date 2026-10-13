import { copyFile, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { assertPlayable, loadResolvedMode } from '@/game/mode-loader'
import type { Media, Mode } from '@/payload-types'

/**
 * The re-skin proof at API level (M9): duplicating a mode must produce a re-skin *shell* —
 * copy, questions and theme come along; every art slot starts empty so the game falls back to
 * `default` until the operator uploads what the re-skin changes.
 *
 * This is the regression net for the two defects that made `payload.duplicate` unusable:
 *  - questions declaring a field named `id` became the array row's primary key, so the copied
 *    rows collided in `modes_sections_questions` (fixed by the `key` rename);
 *  - without `disableDuplicate` on upload fields, the duplicate silently snapped to the source
 *    mode's art — later edits to `default` would never reach it.
 */

const SRC_SLUG = 'dup-src-int'
const DST_SLUG = 'dup-dst-int'
const MEDIA_NAME = 'dup-test-target.png'
const TEST_SECTION_KEYS = ['archery', 'boxing', 'swordsmanship'] as const

let payload: Payload
let media: Media

const STAGE = path.join(os.tmpdir(), 'ark-dup-int')

const cleanModes = async () => {
  await payload.delete({ collection: 'modes', where: { slug: { in: [SRC_SLUG, DST_SLUG] } }, overrideAccess: true })
}

const cleanMedia = async () => {
  await payload.delete({ collection: 'media', where: { filename: { like: MEDIA_NAME.slice(0, -4) } }, overrideAccess: true })
}

const sectionData = (key: (typeof TEST_SECTION_KEYS)[number]) => ({
  key,
  name: `${key} name`,
  description: `${key} description`,
  icon: '🎯',
  sectionAnimation: [
    { band: '0-0.9' as const, text: 'low' },
    { band: '1-2.9' as const, text: 'mid' },
    { band: '3-4' as const, text: 'high' },
  ],
  questions: [1, 2, 3, 4, 5].map((n) => ({
    key: `${key}-q${n}`,
    text: `Text for ${key}-q${n}`,
    options: [0, 1, 2, 3, 4].map((score) => ({ text: `Option ${score}`, score })),
  })),
})

/** Every upload slot on a raw mode doc, as [path, value] pairs. */
const slotsOf = (mode: Mode): [string, unknown][] => {
  const slots: [string, unknown][] = [
    ['theme.bubbleSkin', mode.theme?.bubbleSkin],
    ['theme.buttonSkin', mode.theme?.buttonSkin],
    ['titleScreen.background', mode.titleScreen?.background],
    ['titleScreen.logo', mode.titleScreen?.logo],
    ['results.background', mode.results?.background],
    ['results.finalKnight.low_average', mode.results?.finalKnight?.low_average],
    ['results.finalKnight.average', mode.results?.finalKnight?.average],
    ['results.finalKnight.high_average', mode.results?.finalKnight?.high_average],
  ]
  for (const section of mode.sections ?? []) {
    const key = section.key
    slots.push([`${key}.assets.background`, section.assets?.background])
    for (const pose of ['idle', 'attack', 'celebrate', 'fail'] as const) {
      slots.push([`${key}.assets.knight.${pose}`, section.assets?.knight?.[pose]])
    }
    for (const state of ['idle', 'hover', 'hit'] as const) {
      slots.push([`${key}.assets.target.${state}`, section.assets?.target?.[state]])
    }
    slots.push([`${key}.assets.projectile`, section.assets?.projectile])
    slots.push([`${key}.assets.hitEffect`, section.assets?.hitEffect])
    for (const row of section.sectionAnimation ?? []) {
      slots.push([`${key}.animation.${row.band}`, row.asset])
    }
  }
  return slots
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })

  // Leftovers from an interrupted previous run.
  await cleanModes()
  await cleanMedia()

  await mkdir(STAGE, { recursive: true })
  const staged = path.join(STAGE, MEDIA_NAME)
  await copyFile(path.join(process.cwd(), 'art', 'default', 'archery', 'target.idle@2x.png'), staged)
  media = await payload.create({
    collection: 'media',
    data: { alt: 'Duplicate-test electric target' },
    filePath: staged,
    overrideAccess: true,
  })
}, 60_000)

afterAll(async () => {
  await cleanModes()
  await cleanMedia()
})

describe('duplicating a mode (the re-skin path)', () => {
  it('produces an empty-art shell that inherits default until assets are uploaded', async () => {
    // --- source: a mode with ONE asset uploaded and the usual copy. ---
    const src = (await payload.create({
      collection: 'modes',
      data: {
        title: 'Dup source',
        slug: SRC_SLUG,
        theme: { accentColor: '#123456', fontFamily: 'system' },
        titleScreen: { copy: 'Source copy' },
        sections: TEST_SECTION_KEYS.map((key) =>
          key === 'archery'
            ? {
                ...sectionData(key),
                assets: { target: { idle: media.id } },
              }
            : sectionData(key),
        ),
      },
      overrideAccess: true,
    })) as Mode

    const dst = (await payload.duplicate({
      collection: 'modes',
      id: src.id,
      data: { slug: DST_SLUG, title: 'Dup destination' },
    })) as Mode

    expect(dst.id).not.toBe(src.id)
    expect(dst.slug).toBe(DST_SLUG)

    // The quiz comes along — same question keys, now legal in a second mode.
    const srcKeys = (src.sections ?? []).flatMap((s) => (s.questions ?? []).map((q) => q.key))
    const dstKeys = (dst.sections ?? []).flatMap((s) => (s.questions ?? []).map((q) => q.key))
    expect(dstKeys).toEqual(srcKeys)
    expect(dstKeys).toHaveLength(15)

    // ...but every art slot starts empty, including the one the source had filled.
    for (const [slot, value] of slotsOf(dst)) {
      expect(value, `${slot} must be empty on the duplicate`).toBeNull()
    }

    // Theme/copy carry over (they are copy, not art).
    expect(dst.theme?.accentColor).toBe('#123456')
    expect(dst.titleScreen?.copy).toBe('Source copy')
  })

  it('re-resolves: uploaded slots render, empty slots fall back to default', async () => {
    const raw = (await payload.find({
      collection: 'modes',
      where: { slug: { equals: DST_SLUG } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })).docs[0] as Mode

    // The operator uploads exactly one asset to the duplicated mode (admin flow, at API level).
    const sections = (raw.sections ?? []).map((section) =>
      section.key === 'archery'
        ? { ...section, assets: { ...section.assets, target: { ...section.assets?.target, idle: media.id } } }
        : section,
    )
    await payload.update({
      collection: 'modes',
      id: raw.id,
      data: { sections, theme: { accentColor: '#4dd8ff' } },
      overrideAccess: true,
    })

    const resolved = await loadResolvedMode(DST_SLUG)
    const fallback = await loadResolvedMode('default')
    expect(resolved).not.toBeNull()
    expect(fallback).not.toBeNull()
    expect(assertPlayable(resolved!)).toEqual([])

    const archery = resolved!.sections.find((s) => s.key === 'archery')!
    const fbArchery = fallback!.sections.find((s) => s.key === 'archery')!

    // The uploaded slot renders the upload...
    expect(archery.assets.target.idle).toBe(media.url)
    // ...every other slot falls back to whatever `default` resolves to (may be null pre-art:wire).
    expect(archery.assets.target.hit).toBe(fbArchery.assets.target.hit)
    expect(archery.assets.knight.idle).toBe(fbArchery.assets.knight.idle)
    expect(archery.assets.background).toBe(fbArchery.assets.background)

    // Own theme wins; the inherited quiz keeps its keys; the play shape is complete.
    expect(resolved!.theme.accentColor).toBe('#4dd8ff')
    expect(archery.questions[0].id).toBe('archery-q1')
    expect(resolved!.sections.flatMap((s) => s.questions).length).toBe(15)
  })

  it('a second duplicate of the same source still succeeds (no key collision anywhere)', async () => {
    // Replace the first destination: two modes may hold the same question keys now.
    await payload.delete({ collection: 'modes', where: { slug: { equals: DST_SLUG } }, overrideAccess: true })

    const srcDocs = (await payload.find({
      collection: 'modes',
      where: { slug: { equals: SRC_SLUG } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })).docs
    const again = await payload.duplicate({
      collection: 'modes',
      id: srcDocs[0].id,
      data: { slug: DST_SLUG, title: 'Dup destination 2' },
    })
    expect(again.slug).toBe(DST_SLUG)
    expect((again.sections ?? []).flatMap((s) => s.questions ?? []).map((q) => q.key)).toContain('archery-q1')
  })
})
