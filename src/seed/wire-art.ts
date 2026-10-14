/**
 * Wire a processed art set (`art/<slug>/**`) into the CMS — run with `pnpm art:wire [slug]`.
 *
 * The argument is a mode slug; it defaults to `default` so the pre-M11 usage keeps working.
 * `pnpm art:wire electric` wires `art/electric/**` into the `electric` mode (see QODER.md M11).
 *
 * Idempotent: every file is uploaded to the media collection under a unique filename, found-or-
 * created by filename, then the mode's asset slots are updated to point at the media docs.
 * Non-default slugs are namespaced (`electric-archery-knight.idle@2x.png`) so they can never
 * collide with — or accidentally reuse — the `default` mode's media. `target.hover` intentionally
 * reuses the idle media — the CSS lift and glow do the rest. Nothing else on the mode (copy,
 * questions, theme, ai) is touched.
 *
 * M14 — the staged file is a DELIVERY ENCODE, not the source PNG:
 *   - default / electric  → lossy WebP q80 (alpha preserved; a 1280×720 stage does not need
 *     multi-megabyte PNGs — QODER.md M14(a)).
 *   - default16           → LOSSLESS WebP: lossy encoding smears hard pixel edges (pixel-art set);
 *     every file is proven lossless by an in-memory decode-and-compare against the PNG source
 *     before it is uploaded, and the run fails loudly on any mismatch.
 * The upload filename is CONTENT-HASHED (`archery-background@2x.1a2b3c4d.webp`) so an immutable
 * cache (M14(b)) can never serve stale bytes after a re-wire: new bytes → new hash → new URL;
 * the old URL keeps serving the old (valid) bytes it was cached with. After wiring, any media doc
 * in this set's namespace whose filename is not in the current manifest is an orphan of an earlier
 * encode and is DELETED (old bytes must not accumulate in `media/`).
 * `--replace` (M14 semantics check): with hashed names a same-name doc already holds identical
 * bytes (same hash), so find-or-create is a no-op; --replace forces the delete+create anyway.
 * The resulting slot→filename map is written to `art/<slug>/upload-manifest.json` (committed) —
 * verify-electric.mjs / verify-default16.mjs read upload names from it.
 */
import 'dotenv/config'

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { getPayload } from 'payload'
import sharp from 'sharp'

import config from '../payload.config'
import type { Mode } from '../payload-types'

const cliArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const SLUG = cliArgs[0] ?? 'default'
const SET_TITLE = SLUG.charAt(0).toUpperCase() + SLUG.slice(1)
const ART_ROOT = path.join(process.cwd(), 'art', SLUG)
const UPLOAD_PREFIX = SLUG === 'default' ? '' : `${SLUG}-`
const DEFAULT_ALT_PREFIX = 'Default — '
const STAGE = path.join(os.tmpdir(), 'ark-art')
const REPLACE = process.argv.includes('--replace')

interface ArtFile {
  dir: 'title' | 'results' | 'archery' | 'boxing' | 'swordsmanship'
  file: string
  alt: string
}

const FILES: ArtFile[] = [
  { dir: 'title', file: 'background@2x.png', alt: 'Default — title screen background: the training yard at golden hour, gate open' },
  { dir: 'title', file: 'logo@2x.png', alt: 'Default — AI-READY KNIGHT wordmark logo' },
  { dir: 'results', file: 'background@2x.png', alt: 'Default — results background: the quiet training yard in evening light' },
  { dir: 'results', file: 'finalKnight.low_average@2x.png', alt: 'Default — final knight, low average: still in training clothes' },
  { dir: 'results', file: 'finalKnight.average@2x.png', alt: 'Default — final knight, average: plain metal armour' },
  { dir: 'results', file: 'finalKnight.high_average@2x.png', alt: 'Default — final knight, high average: gold and silver armour' },
  { dir: 'archery', file: 'background@2x.png', alt: 'Default — archery background: palisade range with a clear target row' },
  { dir: 'archery', file: 'knight.idle@2x.png', alt: 'Default — archery knight, idle with bow at her side' },
  { dir: 'archery', file: 'knight.attack@2x.png', alt: 'Default — archery knight, drawing the bow' },
  { dir: 'archery', file: 'knight.celebrate@2x.png', alt: 'Default — archery knight, celebrating with bow raised' },
  { dir: 'archery', file: 'knight.fail@2x.png', alt: 'Default — archery knight, dejected' },
  { dir: 'archery', file: 'target.idle@2x.png', alt: 'Default — archery target, idle' },
  { dir: 'archery', file: 'target.hit@2x.png', alt: 'Default — archery target, hit (dented, no arrow baked in)' },
  { dir: 'archery', file: 'projectile@2x.png', alt: 'Default — archery arrow projectile' },
  { dir: 'archery', file: 'hitEffect@2x.png', alt: 'Default — archery hit effect burst' },
  { dir: 'archery', file: 'animation.3-4@2x.png', alt: 'Default — archery section animation, band 3-4 (bullseye)' },
  { dir: 'archery', file: 'animation.1-2.9@2x.png', alt: 'Default — archery section animation, band 1-2.9' },
  { dir: 'archery', file: 'animation.0-0.9@2x.png', alt: 'Default — archery section animation, band 0-0.9' },
  { dir: 'boxing', file: 'background@2x.png', alt: 'Default — boxing hall background with a clear hanging row' },
  { dir: 'boxing', file: 'knight.idle@2x.png', alt: 'Default — boxing knight, idle guard' },
  { dir: 'boxing', file: 'knight.attack@2x.png', alt: 'Default — boxing knight, punching' },
  { dir: 'boxing', file: 'knight.celebrate@2x.png', alt: 'Default — boxing knight, celebrating' },
  { dir: 'boxing', file: 'knight.fail@2x.png', alt: 'Default — boxing knight, dejected' },
  { dir: 'boxing', file: 'target.idle@2x.png', alt: 'Default — boxing punching bag, idle' },
  { dir: 'boxing', file: 'target.hit@2x.png', alt: 'Default — boxing punching bag, hit (dented and swinging)' },
  { dir: 'boxing', file: 'hitEffect@2x.png', alt: 'Default — boxing hit effect burst' },
  { dir: 'boxing', file: 'animation.3-4@2x.png', alt: 'Default — boxing section animation, band 3-4' },
  { dir: 'boxing', file: 'animation.1-2.9@2x.png', alt: 'Default — boxing section animation, band 1-2.9' },
  { dir: 'boxing', file: 'animation.0-0.9@2x.png', alt: 'Default — boxing section animation, band 0-0.9' },
  { dir: 'swordsmanship', file: 'background@2x.png', alt: 'Default — swordsmanship yard background with a clear standing row' },
  { dir: 'swordsmanship', file: 'knight.idle@2x.png', alt: 'Default — swordsmanship knight, idle with wooden sword' },
  { dir: 'swordsmanship', file: 'knight.attack@2x.png', alt: 'Default — swordsmanship knight, sword swing' },
  { dir: 'swordsmanship', file: 'knight.celebrate@2x.png', alt: 'Default — swordsmanship knight, celebrating sword raised' },
  { dir: 'swordsmanship', file: 'knight.fail@2x.png', alt: 'Default — swordsmanship knight, dejected' },
  { dir: 'swordsmanship', file: 'target.idle@2x.png', alt: 'Default — swordsmanship training dummy, idle' },
  { dir: 'swordsmanship', file: 'target.hit@2x.png', alt: 'Default — swordsmanship training dummy, hit (chopped)' },
  { dir: 'swordsmanship', file: 'hitEffect@2x.png', alt: 'Default — swordsmanship hit effect slash' },
  { dir: 'swordsmanship', file: 'animation.3-4@2x.png', alt: 'Default — swordsmanship section animation, band 3-4' },
  { dir: 'swordsmanship', file: 'animation.1-2.9@2x.png', alt: 'Default — swordsmanship section animation, band 1-2.9' },
  { dir: 'swordsmanship', file: 'animation.0-0.9@2x.png', alt: 'Default — swordsmanship section animation, band 0-0.9' },
]

const payload = await getPayload({ config })

// M14(a): lossy q80 for the painterly sets; LOSSLESS for the pixel-art set. sharp's WebP encoder
// preserves alpha in both modes, so transparent sprites stay transparent. `exact: true` matters:
// libwebp otherwise discards the RGB values under fully-transparent pixels (invisible, but the
// round-trip proof below is bit-exact, and "lossless" should mean lossless).
const LOSSLESS = SLUG === 'default16'
const webpOptions = LOSSLESS ? { lossless: true, exact: true } : { quality: 80 }

/** Encode one source PNG to the delivery WebP. Returns buffer, sizes and the content hash. */
async function encodeDelivery(entry: ArtFile) {
  const sourcePath = path.join(ART_ROOT, entry.dir, entry.file)
  const sourceBuffer = await readFile(sourcePath)
  const encoded = await sharp(sourceBuffer).webp(webpOptions).toBuffer()
  // The pixel-art contract: lossless means bit-identical RGBA when decoded back. Prove it before
  // anything uploads — a smeared edge shipped to production would be exactly the M14 caution.
  if (LOSSLESS) {
    const [srcRaw, outRaw] = await Promise.all([
      sharp(sourceBuffer).ensureAlpha().raw().toBuffer(),
      sharp(encoded).ensureAlpha().raw().toBuffer(),
    ])
    if (!srcRaw.equals(outRaw)) {
      throw new Error(`lossless round-trip FAILED for ${entry.dir}/${entry.file} — pixels changed`)
    }
  }
  const hash = createHash('sha1').update(encoded).digest('hex').slice(0, 8)
  return { encoded, hash, sourceBytes: sourceBuffer.byteLength }
}

const manifest: Record<string, { upload: string; bytes: number; sourceBytes: number }> = {}

async function mediaId(entry: ArtFile): Promise<number> {
  const slotKey = `${entry.dir}/${entry.file}`
  const { encoded, hash, sourceBytes } = await encodeDelivery(entry)
  const slot = `${entry.dir}-${entry.file.replace(/\.png$/, '')}`
  const uploadName = `${UPLOAD_PREFIX}${slot}.${hash}.webp`
  manifest[slotKey] = { upload: uploadName, bytes: encoded.byteLength, sourceBytes }

  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: uploadName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) {
    if (!REPLACE) return existing.docs[0].id
    console.log(`  replacing media/${uploadName}`)
    await payload.delete({ collection: 'media', id: existing.docs[0].id, overrideAccess: true })
  }
  await mkdir(STAGE, { recursive: true })
  const staged = path.join(STAGE, uploadName)
  await writeFile(staged, encoded)
  const doc = await payload.create({
    collection: 'media',
    data: { alt: `${SET_TITLE} — ${entry.alt.slice(DEFAULT_ALT_PREFIX.length)}` },
    filePath: staged,
    overrideAccess: true,
  })
  return doc.id
}

console.log(`Uploading ${FILES.length} files from art/${SLUG}/ (webp ${LOSSLESS ? 'lossless' : 'q80'}) …`)
const ids = new Map<string, number>()
for (const entry of FILES) {
  ids.set(`${entry.dir}/${entry.file}`, await mediaId(entry))
}
const id = (key: string): number => {
  const value = ids.get(key)
  if (!value) throw new Error(`art file missing from the table: ${key}`)
  return value
}

// Orphan cleanup (M14): delete media docs in THIS set's namespace whose filename is not in the
// current manifest — leftovers of an earlier encode (different hash). media/ must not accumulate
// dead bytes; the old URLs stay valid in any browser cache for the life of that cache entry, which
// is exactly the immutable-cache contract.
{
  const keep = new Set(Object.values(manifest).map((m) => m.upload))
  const inNamespace = (filename: string) =>
    SLUG === 'default'
      ? !filename.startsWith('electric-') && !filename.startsWith('default16-')
      : filename.startsWith(`${SLUG}-`)
  const all = await payload.find({ collection: 'media', limit: 200, depth: 0, overrideAccess: true })
  for (const doc of all.docs) {
    const filename = doc.filename
    if (typeof filename !== 'string') continue
    if (keep.has(filename) || !inNamespace(filename)) continue
    // Only art-shaped names — never touch anything a human uploaded under an odd name.
    if (!filename.includes('@2x.') || !/\.(png|webp)$/.test(filename)) continue
    console.log(`  orphan: deleting media/${filename}`)
    await payload.delete({ collection: 'media', id: doc.id, overrideAccess: true })
  }
}

// The committed manifest — verify-electric.mjs / verify-default16.mjs read upload names from here.
await writeFile(
  path.join(ART_ROOT, 'upload-manifest.json'),
  `${JSON.stringify({ slug: SLUG, lossless: LOSSLESS, files: manifest }, null, 2)}\n`,
)
{
  const delivered = Object.values(manifest).reduce((n, m) => n + m.bytes, 0)
  const source = Object.values(manifest).reduce((n, m) => n + m.sourceBytes, 0)
  console.log(
    `delivered weight: ${(delivered / 1024 / 1024).toFixed(2)} MB webp vs ${(source / 1024 / 1024).toFixed(2)} MB png source (art/${SLUG}/)`,
  )
}

const found = await payload.find({
  collection: 'modes',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const mode = found.docs[0] as Mode | undefined
if (!mode) {
  console.error(`No "${SLUG}" mode in the database.`)
  console.error(
    SLUG === 'default'
      ? 'Run `pnpm seed` first.'
      : 'Create the mode in /admin (or duplicate `default` — see docs/modes.md) first.',
  )
  process.exit(1)
}

const sectionAssets = (key: 'archery' | 'boxing' | 'swordsmanship') => ({
  background: id(`${key}/background@2x.png`),
  knight: {
    idle: id(`${key}/knight.idle@2x.png`),
    attack: id(`${key}/knight.attack@2x.png`),
    celebrate: id(`${key}/knight.celebrate@2x.png`),
    fail: id(`${key}/knight.fail@2x.png`),
  },
  target: {
    idle: id(`${key}/target.idle@2x.png`),
    // Hover deliberately reuses the idle sprite — the CSS lift and glow do the rest.
    hover: id(`${key}/target.idle@2x.png`),
    hit: id(`${key}/target.hit@2x.png`),
  },
  projectile: key === 'archery' ? id('archery/projectile@2x.png') : null,
  hitEffect: id(`${key}/hitEffect@2x.png`),
})

const sections = (mode.sections ?? []).map((section) => {
  const key = section.key as 'archery' | 'boxing' | 'swordsmanship'
  return {
    id: section.id,
    key: section.key,
    name: section.name,
    description: section.description,
    icon: section.icon,
    assets: sectionAssets(key),
    sectionAnimation: (section.sectionAnimation ?? []).map((row) => ({
      id: row.id,
      band: row.band,
      text: row.text,
      asset: id(`${key}/animation.${row.band}@2x.png`),
    })),
    questions: section.questions,
  }
})

await payload.update({
  collection: 'modes',
  id: mode.id,
  overrideAccess: true,
  data: {
    titleScreen: {
      background: id('title/background@2x.png'),
      logo: id('title/logo@2x.png'),
      copy: mode.titleScreen?.copy,
    },
    sections,
    results: {
      background: id('results/background@2x.png'),
      finalKnight: {
        low_average: id('results/finalKnight.low_average@2x.png'),
        average: id('results/finalKnight.average@2x.png'),
        high_average: id('results/finalKnight.high_average@2x.png'),
      },
    },
  },
})

// --- verify: re-read the mode with relations populated and report every slot.
const check = await payload.find({
  collection: 'modes',
  where: { slug: { equals: SLUG } },
  limit: 1,
  depth: 1,
  overrideAccess: true,
})
const updated = check.docs[0] as Mode
let checked = 0
let missing = 0
const urlOf = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: string | null }).url
    return typeof url === 'string' ? url : null
  }
  return null
}
const report = (label: string, value: unknown) => {
  const url = urlOf(value)
  checked += 1
  if (!url) missing += 1
  console.log(`  ${url ? 'ok  ' : 'MISS'} ${label.padEnd(34)} ${url ?? '(empty)'}`)
}

report('titleScreen.background', updated.titleScreen?.background)
report('titleScreen.logo', updated.titleScreen?.logo)
for (const section of updated.sections ?? []) {
  const key = section.key
  report(`${key}.assets.background`, section.assets?.background)
  for (const pose of ['idle', 'attack', 'celebrate', 'fail'] as const) {
    report(`${key}.assets.knight.${pose}`, section.assets?.knight?.[pose])
  }
  for (const state of ['idle', 'hover', 'hit'] as const) {
    report(`${key}.assets.target.${state}`, section.assets?.target?.[state])
  }
  if (key === 'archery') report(`${key}.assets.projectile`, section.assets?.projectile)
  report(`${key}.assets.hitEffect`, section.assets?.hitEffect)
  for (const row of section.sectionAnimation ?? []) {
    report(`${key}.animation.${row.band}`, row.asset)
  }
}
report('results.background', updated.results?.background)
for (const slot of ['low_average', 'average', 'high_average'] as const) {
  report(`results.finalKnight.${slot}`, updated.results?.finalKnight?.[slot])
}

console.log(missing === 0 ? `\nAll ${checked} slots wired.` : `\n${missing} of ${checked} slots are still empty.`)
process.exit(missing === 0 ? 0 : 1)
