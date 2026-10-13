import type { CollectionConfig, Field } from 'payload'

import {
  OPTIONS_PER_QUESTION,
  QUESTIONS_PER_SECTION,
  RESERVED_MODE_SLUGS,
  SECTION_BAND_KEYS,
  SECTION_KEYS,
  SECTIONS_PER_MODE,
} from '../game/constants'

/**
 * An upload slot bound to the media collection. Empty inheritance comes from the `default` mode (resolved server-side).
 *
 * `disableDuplicate`: a duplicated mode is a re-skin shell — copy, questions and theme come along,
 * art does not. The admin can then upload only the handful of assets the re-skin changes; every
 * empty slot inherits from `default` (otherwise a duplicate would silently ship the source mode's
 * art as its own and later edits to `default` would never reach it).
 */
const asset = (name: string, label?: string): Field => ({
  name,
  type: 'upload',
  relationTo: 'media',
  disableDuplicate: true,
  ...(label ? { label } : {}),
})

const slots = (names: readonly string[]): Field[] => names.map((name) => asset(name))

/** Exactly three sections, one per discipline, keys distinct and complete. */
const validateSectionKeys = (value: unknown): true | string => {
  const rows = Array.isArray(value) ? value : []
  if (rows.length !== SECTIONS_PER_MODE) {
    return `Exactly ${SECTIONS_PER_MODE} sections are required — the game always has three.`
  }
  const keys = rows.map((row) => (row as { key?: string } | null)?.key).filter(Boolean) as string[]
  if (new Set(keys).size !== keys.length) {
    return 'Section keys must be distinct — each discipline may appear once.'
  }
  const missing = SECTION_KEYS.filter((key) => !keys.includes(key))
  if (missing.length > 0) {
    return `Missing section(s): ${missing.join(', ')}. All of ${SECTION_KEYS.join(', ')} must be present.`
  }
  return true
}

/** One animation entry per section band — the keys the scoring module emits, verbatim. */
const validateSectionAnimationBands = (value: unknown): true | string => {
  const rows = Array.isArray(value) ? value : []
  if (rows.length !== SECTION_BAND_KEYS.length) {
    return `All ${SECTION_BAND_KEYS.length} band entries are required (${SECTION_BAND_KEYS.join(', ')}).`
  }
  const bands = rows.map((row) => (row as { band?: string } | null)?.band).filter(Boolean) as string[]
  if (new Set(bands).size !== bands.length) {
    return 'Each score band may appear only once.'
  }
  const missing = SECTION_BAND_KEYS.filter((band) => !bands.includes(band))
  if (missing.length > 0) {
    return `Missing band(s): ${missing.join(', ')}.`
  }
  return true
}

/**
 * Stored answers key on question keys, so they must be unique. Named `key`, not `id`: a field
 * literally called `id` on an array row becomes the row's primary key in the database, which makes
 * duplicating a mode (or reusing the same keys in a second mode) collide on the shared row table.
 */
const validateQuestionKeys = (value: unknown): true | string => {
  const rows = Array.isArray(value) ? value : []
  const keys = rows.map((row) => (row as { key?: string } | null)?.key).filter(Boolean) as string[]
  if (new Set(keys).size !== keys.length) {
    return 'Question keys must be unique — stored answers are keyed by them.'
  }
  return true
}

/** Five options, scores 0→4 in order: the screen renders five targets, leftmost = lowest score. */
const validateOptionScores = (value: unknown): true | string => {
  const rows = Array.isArray(value) ? value : []
  if (rows.length !== OPTIONS_PER_QUESTION) {
    return `Exactly ${OPTIONS_PER_QUESTION} options are required — the question screen renders ${OPTIONS_PER_QUESTION} targets.`
  }
  for (let i = 0; i < rows.length; i++) {
    const score = (rows[i] as { score?: number } | null)?.score
    if (score !== i) {
      return `Option ${i + 1} must have score ${i}: options run 0 → 4 from left to right.`
    }
  }
  return true
}

const validateSlug = (value: unknown): true | string => {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    return 'Slug must be url-safe: lowercase letters, digits and dashes only (e.g. "electric").'
  }
  if ((RESERVED_MODE_SLUGS as readonly string[]).includes(value)) {
    return `"${value}" is reserved by the app — pick another slug.`
  }
  return true
}

export const Modes: CollectionConfig = {
  slug: 'modes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    group: 'Game',
    description:
      'A mode is a full re-skin of the game served at /<slug>. The "default" mode must always exist; every asset slot another mode leaves empty is inherited from it.',
  },
  access: {
    // The public game loads the mode server-side; only authenticated admins may write.
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: validateSlug,
      hooks: {
        /**
         * The admin Duplicate button sends no data, so the copy would arrive carrying the source's
         * slug and trip the unique index on save. Give the copy `<slug>-copy` (or -2, -3… if that
         * is taken too) — the operator then renames it to the new mode's slug before saving.
         */
        beforeDuplicate: [
          async ({ value, req }) => {
            const base = `${typeof value === 'string' && value.length > 0 ? value : 'mode'}-copy`
            let candidate = base
            for (let n = 2; n <= 99; n += 1) {
              const clash = await req.payload.find({
                collection: 'modes',
                where: { slug: { equals: candidate } },
                limit: 1,
                depth: 0,
                req,
              })
              if (clash.docs.length === 0) break
              candidate = `${base}-${n}`
            }
            return candidate
          },
        ],
      },
      admin: {
        position: 'sidebar',
        description: 'The URL segment: /<slug>. Shared result links do not depend on it, but renaming breaks bookmarks of the game page.',
      },
    },
    {
      name: 'theme',
      type: 'group',
      fields: [
        { name: 'accentColor', type: 'text', defaultValue: '#d4af37' },
        { name: 'fontFamily', type: 'text', defaultValue: 'system' },
        asset('bubbleSkin', 'Speech bubble skin'),
        asset('buttonSkin', 'Button skin'),
      ],
    },
    {
      name: 'titleScreen',
      type: 'group',
      fields: [asset('background'), asset('logo'), { name: 'copy', type: 'textarea' }],
    },
    {
      name: 'sections',
      type: 'array',
      minRows: SECTIONS_PER_MODE,
      maxRows: SECTIONS_PER_MODE,
      labels: { singular: 'Training section', plural: 'Training sections' },
      validate: validateSectionKeys,
      admin: {
        initCollapsed: true,
        description: 'Exactly three training sections. Questions and assets live per section.',
      },
      fields: [
        {
          name: 'key',
          type: 'select',
          required: true,
          options: [...SECTION_KEYS],
          admin: {
            description: 'Stable identity — stored answers and scores reference it. Never repurpose a key.',
          },
        },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'icon', type: 'text' },
        {
          name: 'assets',
          type: 'group',
          fields: [
            asset('background'),
            {
              name: 'knight',
              type: 'group',
              fields: slots(['idle', 'attack', 'celebrate', 'fail']),
            },
            {
              name: 'target',
              type: 'group',
              fields: slots(['idle', 'hover', 'hit']),
            },
            asset('projectile', 'Projectile (archery arrow)'),
            asset('hitEffect', 'Hit effect'),
          ],
        },
        {
          name: 'sectionAnimation',
          type: 'array',
          minRows: SECTION_BAND_KEYS.length,
          maxRows: SECTION_BAND_KEYS.length,
          labels: { singular: 'Band animation', plural: 'Band animations' },
          validate: validateSectionAnimationBands,
          admin: {
            description: 'One animation spec per score band — the text drives the creative, the asset is played at section end.',
          },
          fields: [
            { name: 'band', type: 'select', required: true, options: [...SECTION_BAND_KEYS] },
            { name: 'text', type: 'textarea' },
            asset('asset'),
          ],
        },
        {
          name: 'questions',
          type: 'array',
          minRows: QUESTIONS_PER_SECTION,
          maxRows: QUESTIONS_PER_SECTION,
          labels: { singular: 'Question', plural: 'Questions' },
          validate: validateQuestionKeys,
          admin: { initCollapsed: true },
          fields: [
            {
              name: 'key',
              type: 'text',
              required: true,
              admin: {
                description:
                  'Stable key — every stored answer references it, and duplicated modes copy it as-is. Never change once runs exist on this mode.',
              },
            },
            { name: 'text', type: 'text', required: true },
            {
              name: 'options',
              type: 'array',
              minRows: OPTIONS_PER_QUESTION,
              maxRows: OPTIONS_PER_QUESTION,
              labels: { singular: 'Option', plural: 'Options' },
              validate: validateOptionScores,
              admin: {
                description: 'Five options, score 0 → 4 top to bottom — rendered left to right as five targets.',
              },
              fields: [
                { name: 'text', type: 'text', required: true },
                { name: 'score', type: 'number', required: true, min: 0, max: 4 },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'results',
      type: 'group',
      fields: [
        asset('background'),
        {
          name: 'finalKnight',
          type: 'group',
          fields: [
            asset('low_average', 'Low average — still in training clothes'),
            asset('average', 'Average — plain metal armour'),
            asset('high_average', 'High average — flashy gold and silver armour'),
          ],
        },
      ],
    },
    {
      name: 'ai',
      label: 'QWEN report',
      type: 'group',
      fields: [
        {
          name: 'systemPrompt',
          type: 'textarea',
          admin: {
            description:
              'System prompt for the end-of-game report. Mode-specific: reword to match the client brand. The output schema is enforced by the app.',
          },
        },
        { name: 'tone', type: 'text', admin: { description: 'Tone guidance, e.g. "direct and practical".' } },
        { name: 'guidance', type: 'textarea', admin: { description: 'Extra client-specific guidance folded into the prompt.' } },
      ],
    },
  ],
  timestamps: true,
}
