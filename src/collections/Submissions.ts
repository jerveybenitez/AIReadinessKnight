import type { CollectionConfig } from 'payload'

import {
  FINAL_BAND_KEYS,
  MAX_ANSWERS,
  OPTIONS_PER_QUESTION,
  SECTION_BAND_KEYS,
  SECTION_KEYS,
} from '../game/constants'

/** One answer per question id — re-answering replaces, never appends (enforced here and in run state). */
const validateAnswerQuestionIds = (value: unknown): true | string => {
  const rows = Array.isArray(value) ? value : []
  const ids = rows.map((row) => (row as { questionId?: string } | null)?.questionId).filter(Boolean) as string[]
  if (new Set(ids).size !== ids.length) {
    return 'Each question may hold only one answer — re-answering must replace the previous one.'
  }
  return true
}

export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'companyName',
    defaultColumns: ['companyName', 'knightName', 'mode', 'updatedAt'],
    group: 'Game',
    description:
      'Player runs. Confidential: readable only by authenticated admins. The public game reads and writes runs exclusively through run-id-keyed server endpoints.',
  },
  access: {
    // Players never touch this collection directly — all game traffic goes through
    // dedicated endpoints keyed by the unguessable runId (server-side, overrideAccess).
    create: () => false,
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'runId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Unguessable public id (nanoid). The results permalink /results/<runId> is the access token — never a sequential number.',
      },
    },
    { name: 'mode', type: 'relationship', relationTo: 'modes', required: true, index: true },
    { name: 'knightName', type: 'text', required: true },
    { name: 'companyName', type: 'text', required: true },
    { name: 'industry', type: 'text' },
    {
      name: 'answers',
      type: 'array',
      maxRows: MAX_ANSWERS,
      labels: { singular: 'Answer', plural: 'Answers' },
      validate: validateAnswerQuestionIds,
      admin: { description: 'One entry per answered question, written as the player answers.' },
      fields: [
        { name: 'questionId', type: 'text', required: true },
        { name: 'sectionKey', type: 'select', required: true, options: [...SECTION_KEYS] },
        { name: 'optionIndex', type: 'number', required: true, min: 0, max: OPTIONS_PER_QUESTION - 1 },
        { name: 'score', type: 'number', required: true, min: 0, max: OPTIONS_PER_QUESTION - 1 },
      ],
    },
    {
      name: 'scores',
      type: 'group',
      admin: { description: 'Computed server-side from the answers (see src/game/scoring.ts).' },
      fields: [
        {
          name: 'sections',
          type: 'array',
          labels: { singular: 'Section score', plural: 'Section scores' },
          fields: [
            { name: 'key', type: 'select', options: [...SECTION_KEYS] },
            { name: 'mean', type: 'number' },
            { name: 'band', type: 'select', options: [...SECTION_BAND_KEYS] },
          ],
        },
        { name: 'finalMean', type: 'number' },
        { name: 'finalBand', type: 'select', options: [...FINAL_BAND_KEYS] },
      ],
    },
    {
      name: 'report',
      type: 'group',
      admin: { description: 'QWEN report, generated once per run and cached here.' },
      fields: [
        {
          name: 'status',
          type: 'select',
          options: ['pending', 'ready', 'fallback'],
          defaultValue: 'pending',
        },
        { name: 'data', type: 'json' },
        { name: 'generatedAt', type: 'date' },
      ],
    },
  ],
  timestamps: true,
}
