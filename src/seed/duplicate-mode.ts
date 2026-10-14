/**
 * Duplicate the `default` mode's content into a new mode — run with `pnpm mode:dup <slug>`.
 *
 * This is the scripted equivalent of the admin-UI "duplicate default" flow used for the electric
 * mode (see docs/modes.md): the new mode gets an identical copy of theme, title copy, sections,
 * questions/options/scores and AI settings, under its own slug. Asset relations are intentionally
 * NOT copied — every art slot starts empty and is filled by `pnpm art:wire <slug>` with the
 * mode's own namespaced media, so a re-skinned mode never serves another mode's files.
 *
 * Idempotent: refuses to run if the slug already exists (admin edits are never overwritten).
 */
import 'dotenv/config'

import { getPayload } from 'payload'

import config from '../payload.config'
import type { Mode } from '../payload-types'

const slug = process.argv[2]
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('usage: pnpm mode:dup <slug>  (lowercase letters, digits, dashes)')
  process.exit(1)
}
if (slug === 'default') {
  console.error('The "default" mode is seeded by `pnpm seed`, not duplicated.')
  process.exit(1)
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'modes',
  where: { slug: { equals: slug } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
if (existing.docs.length > 0) {
  console.error(`A "${slug}" mode already exists — nothing to do (admin edits are never overwritten).`)
  process.exit(1)
}

const found = await payload.find({
  collection: 'modes',
  where: { slug: { equals: 'default' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const source = found.docs[0] as Mode | undefined
if (!source) {
  console.error('No "default" mode in the database — run `pnpm seed` first.')
  process.exit(1)
}

// Strip per-row ids so Payload creates fresh nested rows; drop every asset relation (wired later
// by art:wire with the mode's own namespaced media).
const sections = (source.sections ?? []).map((section) => ({
  key: section.key,
  name: section.name,
  description: section.description,
  icon: section.icon,
  sectionAnimation: (section.sectionAnimation ?? []).map((row) => ({ band: row.band, text: row.text })),
  questions: (section.questions ?? []).map((question) => ({
    key: question.key,
    text: question.text,
    options: (question.options ?? []).map((option) => ({ text: option.text, score: option.score })),
  })),
}))

await payload.create({
  collection: 'modes',
  data: {
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    slug,
    theme: source.theme,
    titleScreen: { copy: source.titleScreen?.copy },
    sections,
    ai: source.ai,
  },
  overrideAccess: true,
})

console.log(`Duplicated "default" into "${slug}" — ${sections.length} sections, art slots empty.`)
console.log(`Next: pnpm art:wire ${slug}`)

process.exit(0)
