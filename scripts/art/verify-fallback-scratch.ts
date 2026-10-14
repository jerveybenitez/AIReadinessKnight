/**
 * M11 per-slot fallback re-proof — the M9 claim ("a mode with only one uploaded asset is still
 * fully playable, every other slot falls back to `default` per slot") was proven BY `electric`
 * being partial. M11 completed `electric`, which retires that evidence, so this script re-proves
 * the same claim on a throwaway scratch mode (QODER.md M11: "re-prove it on a throwaway scratch
 * mode (create, verify, delete)").
 *
 * What it does, in order:
 *   1. duplicate `default` via the local API (no art comes along — asset fields disableDuplicate),
 *   2. rename the copy to `scratch-fallback` and upload exactly ONE asset — the electric archery
 *      target idle — so the mode is 1-of-43 uploaded,
 *   3. play the scratch mode's complete 15-question run headlessly and assert, per scene: the one
 *      upload renders; every other slot renders the `default` media URL (per-slot fallback); the
 *      uploaded slot's default counterpart is shadowed; no `.ark-placeholder` appears; the
 *      dead-QWEN fallback report arrives,
 *   4. delete the scratch mode and any submissions it collected — the throwaway is removed even
 *      if the run failed.
 *
 * The operator-facing story (the path a non-technical user follows to ship a mode) stays the M9
 * proof in docs/modes-proof/ — this script is the automated regression of the same resolution
 * rule. Screenshots land in docs/modes-proof/ as verify-scratch-*.png. Run with the dev server
 * up and (like verify-electric) QWEN_BASE_URL=http://127.0.0.1:9/v1:
 *
 *   pnpm art:verify-fallback
 */
import 'dotenv/config'

import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { getPayload } from 'payload'

import config from '../../src/payload.config'

// M14: uploads are content-hashed WebP — exact names come from the committed manifests written by
// `pnpm art:wire` (electric for the one upload, default for every fallback slot).
const manifestOf = (slug: string): Record<string, { upload: string }> =>
  JSON.parse(readFileSync(path.resolve(process.cwd(), 'art', slug, 'upload-manifest.json'), 'utf8')).files
const ELEC_FILES = manifestOf('electric')
const DEF_FILES = manifestOf('default')

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000'
const SCRATCH_SLUG = 'scratch-fallback'
const SCRATCH_TITLE = 'Scratch fallback'
const OUT = path.resolve(process.cwd(), 'docs/modes-proof')
mkdirSync(OUT, { recursive: true })

let failures = 0
const notes: string[] = []
const fail = (msg: string): void => {
  failures += 1
  console.log(`  x ${msg}`)
}
const pass = (msg: string): void => console.log(`  + ${msg}`)

const payload = await getPayload({ config })

// --- rerun support: a leftover scratch mode from a failed run is removed first ------------------
const stale = await payload.find({
  collection: 'modes',
  where: { slug: { equals: SCRATCH_SLUG } },
  limit: 10,
  depth: 0,
  overrideAccess: true,
})
for (const doc of stale.docs) {
  console.log(`removing stale scratch mode (id ${doc.id})`)
  await payload.delete({ collection: 'submissions', where: { mode: { equals: doc.id } }, overrideAccess: true })
  await payload.delete({ collection: 'modes', id: doc.id, overrideAccess: true })
}

// --- create: duplicate default -> rename -> upload exactly one asset ----------------------------
const defaultMode = (
  await payload.find({ collection: 'modes', where: { slug: { equals: 'default' } }, limit: 1, depth: 0, overrideAccess: true })
).docs[0]
if (!defaultMode) {
  console.error('no "default" mode in the database — run `pnpm seed` first.')
  process.exit(1)
}
const targetIdleName = ELEC_FILES['archery/target.idle@2x.png']?.upload
if (!targetIdleName) {
  console.error('art/electric/upload-manifest.json has no "archery/target.idle@2x.png" slot.')
  process.exit(1)
}
const targetIdle = (
  await payload.find({
    collection: 'media',
    where: { filename: { equals: targetIdleName } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
).docs[0]
if (!targetIdle) {
  console.error(`media "${targetIdleName}" is missing — run \`pnpm art:wire electric\` first.`)
  process.exit(1)
}

const copy = await payload.duplicate({ collection: 'modes', id: defaultMode.id, overrideAccess: true })
const scratchId = copy.id

// Set slug + title, and the single upload on the archery section's target idle slot. Everything
// else the duplicate carried (copy, questions, theme) is left exactly as it came.
const sections = (copy.sections ?? []).map((section, index) =>
  index === 0
    ? {
        ...section,
        assets: {
          ...(section.assets ?? {}),
          target: { ...(section.assets?.target ?? {}), idle: targetIdle.id },
        },
      }
    : section,
)
await payload.update({
  collection: 'modes',
  id: scratchId,
  overrideAccess: true,
  data: { slug: SCRATCH_SLUG, title: SCRATCH_TITLE, sections },
})
console.log(`scratch mode ready: ${BASE}/${SCRATCH_SLUG} (id ${scratchId}) — 1 of 43 slots uploaded`)
console.log(`  uploaded slot: archery section / target idle -> ${targetIdle.filename}`)

// --- expected URLs (public /api/media read — no auth needed) ------------------------------------
const mediaRes = await fetch(new URL('/api/media?limit=200&depth=0', BASE))
if (!mediaRes.ok) throw new Error(`GET /api/media → HTTP ${mediaRes.status} (is the dev server up?)`)
const mediaDocs = (await mediaRes.json()).docs as { filename: string; url: string }[]
const mediaUrl = (filename: string): string => {
  const found = mediaDocs.filter((d) => d.filename === filename)
  if (found.length === 0) throw new Error(`media "${filename}" is missing from the database`)
  return decodeURIComponent(found[0].url)
}

// The single upload: inside a decoded src this string is unambiguous — the default's URL has
// `archery-` between `/file/` and `target`, so it can never contain this needle.
const ELEC = decodeURIComponent(targetIdle.url ?? mediaUrl(targetIdle.filename ?? ''))
const def = (slot: string): string => {
  const entry = DEF_FILES[slot]
  if (!entry) throw new Error(`art/default/upload-manifest.json has no slot "${slot}"`)
  return mediaUrl(entry.upload)
}
const DEF = {
  archeryBackground: def('archery/background@2x.png'),
  archeryKnightIdle: def('archery/knight.idle@2x.png'),
  archeryTargetIdle: def('archery/target.idle@2x.png'),
  archeryTargetHit: def('archery/target.hit@2x.png'),
  archeryHitEffect: def('archery/hitEffect@2x.png'),
  archeryProjectile: def('archery/projectile@2x.png'),
  archeryAnim129: def('archery/animation.1-2.9@2x.png'),
  boxingBackground: def('boxing/background@2x.png'),
  boxingKnightIdle: def('boxing/knight.idle@2x.png'),
  boxingKnightFail: def('boxing/knight.fail@2x.png'),
  boxingTargetHit: def('boxing/target.hit@2x.png'),
  boxingHitEffect: def('boxing/hitEffect@2x.png'),
  boxingAnim09: def('boxing/animation.0-0.9@2x.png'),
  swordBackground: def('swordsmanship/background@2x.png'),
  swordKnightIdle: def('swordsmanship/knight.idle@2x.png'),
  swordKnightCelebrate: def('swordsmanship/knight.celebrate@2x.png'),
  swordTargetHit: def('swordsmanship/target.hit@2x.png'),
  swordHitEffect: def('swordsmanship/hitEffect@2x.png'),
  swordAnim34: def('swordsmanship/animation.3-4@2x.png'),
  titleBackground: def('title/background@2x.png'),
  titleLogo: def('title/logo@2x.png'),
  resultsKnightAverage: def('results/finalKnight.average@2x.png'),
  resultsBackground: def('results/background@2x.png'),
}

// Answer script: target index = score (0->4 left->right). Section means 1.8 / 0.6 / 3.6 -> all
// three section bands exercised, overall 2.0 -> 'average' final knight. (Same as the full-set run.)
const PLAN = [
  { key: 'archery', scores: [3, 2, 1, 2, 1], band: '1-2.9', pose: 'idle' },
  { key: 'boxing', scores: [1, 0, 1, 0, 1], band: '0-0.9', pose: 'fail' },
  { key: 'swordsmanship', scores: [4, 3, 4, 3, 4], band: '3-4', pose: 'celebrate' },
]

// Bundled chromium download is incomplete on this machine (PROGRESS M4 note); the e2e suite runs
// on system Chrome via PW_CHANNEL=chrome — mirror that, overridable.
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await context.newPage()

const consoleErrors: string[] = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err}`))

const shot = async (name: string): Promise<void> => {
  await page.screenshot({ path: path.join(OUT, `verify-scratch-${name}.png`) })
  notes.push(`shot verify-scratch-${name}.png`)
}

const waitImagesSettled = async (where: string, timeout = 15000): Promise<void> => {
  try {
    await page.waitForFunction(
      () => document.images.length > 0 && Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout },
    )
    const broken = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => img.naturalWidth === 0)
        .map((img) => img.currentSrc || img.src),
    )
    if (broken.length > 0) fail(`${where}: broken images — ${broken.join(', ')}`)
    else pass(`${where}: ${await page.evaluate(() => document.images.length)} images loaded`)
  } catch {
    fail(`${where}: images never settled`)
  }
}

const assertNoPlaceholders = async (where: string): Promise<void> => {
  const placeholders = page.locator('.ark-placeholder')
  const count = await placeholders.count()
  if (count > 0) {
    const labels = await page.locator('.ark-placeholder span').allInnerTexts()
    fail(`${where}: ${count} placeholder(s) visible — ${labels.join(' | ')}`)
  } else {
    pass(`${where}: no placeholders`)
  }
}

/** Which resolved media URL sits behind every <img> currently in the DOM. */
const srcList = (): Promise<string[]> =>
  page.evaluate(() => Array.from(document.images).map((img) => decodeURIComponent(img.currentSrc || img.src)))

/**
 * The fallback assertions: `must` entries prove a URL (upload or default fallback) is rendered,
 * `mustNot` entries prove a URL is shadowed / absent from this scene.
 */
const checkSrcs = async (
  where: string,
  { must = [], mustNot = [] }: { must?: [string, string][]; mustNot?: [string, string][] },
): Promise<void> => {
  const list = await srcList()
  for (const [label, needle] of must) {
    if (list.some((s) => s.includes(needle))) pass(`${where}: ${label}`)
    else fail(`${where}: ${label} — no img src contains ${needle}\n      srcs: ${list.join(' | ')}`)
  }
  for (const [label, needle] of mustNot) {
    const hits = list.filter((s) => s.includes(needle))
    if (hits.length === 0) pass(`${where}: ${label}`)
    else fail(`${where}: ${label} — ${hits.length} img(s) use ${needle}\n      srcs: ${list.join(' | ')}`)
  }
}

const waitQuestion = (section: number, question: number) =>
  page.waitForFunction(
    ({ s, q }) => {
      const el = document.querySelector('.ark-progress')
      const text = el?.textContent ?? ''
      return text.includes(`Question ${q} of 5`) && text.includes(`Section ${s} of 3`)
    },
    { s: section, q: question },
    { timeout: 30000 },
  )

const waitTargetsEnabled = () =>
  page.waitForFunction(() => {
    const first = document.querySelector<HTMLButtonElement>('.ark-target')
    return !!first && !first.disabled
  }, undefined, { timeout: 30000 })

interface AnswerOpts {
  ranged?: boolean
  melee?: boolean
  flightShot?: string
  meleeShot?: string
  impactShot?: string
  scan?: () => Promise<void> | void
}

// One recorded answer + its attack beat. The scan runs at the flight/impact moment so the overlay
// (target-hit + hit-effect sprites, rendered at beat start, shown at impact) is already in the DOM.
const answer = async (index: number, opts: AnswerOpts = {}): Promise<void> => {
  await waitTargetsEnabled()
  await page.locator('.ark-target').nth(index).click()

  if (opts.ranged) {
    await page.waitForSelector('.ark-arrow', { timeout: 5000 })
    pass(`attack: projectile flying to target ${index} (ranged)`)
    if (opts.scan) await opts.scan()
    if (opts.flightShot) {
      await page.waitForTimeout(110)
      await shot(opts.flightShot)
    }
  }
  if (opts.melee) {
    await page.waitForSelector('.ark-target-impact', { timeout: 5000 })
    const arrows = await page.locator('.ark-arrow').count()
    if (arrows !== 0) fail(`melee attack rendered ${arrows} .ark-arrow element(s)`)
    else pass('attack: no projectile element (melee guard holds)')
    if (opts.scan) await opts.scan()
    if (opts.meleeShot) {
      await page.waitForTimeout(420)
      await shot(opts.meleeShot)
    }
  }
  if (opts.impactShot) {
    await page.waitForSelector('.ark-target-impact', { timeout: 5000 })
    await page.waitForTimeout(430)
    await shot(opts.impactShot)
  }
}

let browserClosed = false
const closeBrowser = async (): Promise<void> => {
  if (browserClosed) return
  browserClosed = true
  await context.close().catch(() => {})
  await browser.close().catch(() => {})
}

try {
  // --- title -----------------------------------------------------------------------------------
  console.log(`title (/${SCRATCH_SLUG})`)
  await page.goto(`${BASE}/${SCRATCH_SLUG}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ark-title-start', { timeout: 90000 })
  await waitImagesSettled('title')
  await assertNoPlaceholders('title')
  const heading = (await page.locator('#ark-title-heading').innerText()).trim()
  if (heading === SCRATCH_TITLE) pass(`title heading reads "${SCRATCH_TITLE}"`)
  else fail(`title heading is "${heading}", expected "${SCRATCH_TITLE}"`)
  const accent = await page.evaluate(() => {
    const el = document.querySelector('.ark-viewport')
    return el ? getComputedStyle(el).getPropertyValue('--ark-accent').trim().toLowerCase() : null
  })
  if (accent === '#d4af37') pass('stage accent carries the duplicated default theme (#d4af37)')
  else fail(`stage accent is "${accent}", expected "#d4af37"`)
  await checkSrcs('title', {
    must: [
      ['title background falls back to default', DEF.titleBackground],
      ['title logo falls back to default', DEF.titleLogo],
    ],
    mustNot: [['the one upload is scoped to archery (absent here)', ELEC]],
  })
  await shot('01-title')

  // --- intake ----------------------------------------------------------------------------------
  console.log('intake')
  await page.locator('.ark-title-start').click()
  await page.waitForSelector('.ark-intake-card', { timeout: 15000 })
  const cardText = await page.locator('.ark-intake-card').innerText()
  if (cardText.includes(SCRATCH_TITLE)) pass('intake copy carries the mode title')
  else fail(`intake copy does not mention "${SCRATCH_TITLE}"`)
  await shot('02-intake')
  const inputs = page.locator('.ark-field input')
  await inputs.nth(0).fill('Sir Fallback')
  await inputs.nth(1).fill('Almost Empty Industries')
  await inputs.nth(2).fill('Software')
  await page.locator('.ark-intake-card button[type=submit]').click()
  await waitQuestion(1, 1)

  // --- the three sections ----------------------------------------------------------------------
  for (let s = 0; s < PLAN.length; s += 1) {
    const section = PLAN[s]
    console.log(`${section.key} (section ${s + 1})`)
    await page.waitForSelector('.ark-question-scene', { timeout: 30000 })
    if (s > 0) await waitQuestion(s + 1, 1)

    // Section entry — idle scene, background, knight and five targets.
    await waitImagesSettled(`${section.key} q1`)
    await assertNoPlaceholders(`${section.key} q1`)

    if (s === 0) {
      // THE proof: the one uploaded electric asset renders; its default counterpart is shadowed;
      // background and knight fall back to default.
      await checkSrcs('archery q1', {
        must: [
          ['uploaded electric target idle renders', ELEC],
          ['archery background falls back to default', DEF.archeryBackground],
          ['archery knight idle falls back to default', DEF.archeryKnightIdle],
        ],
        mustNot: [['default archery target idle is shadowed', DEF.archeryTargetIdle]],
      })
      await shot('03-archery-q1')
      await page.locator('.ark-target').nth(3).hover()
      await page.waitForSelector('.ark-bubble', { timeout: 5000 })
      pass('hover shows the speech bubble (hover pose falls back to the default target)')
      await shot('03b-archery-q1-hover')
      await page.mouse.move(10, 10) // clear hover before the attack beat scans
    } else if (s === 1) {
      await checkSrcs('boxing q1', {
        must: [
          ['boxing background falls back to default', DEF.boxingBackground],
          ['boxing knight idle falls back to default', DEF.boxingKnightIdle],
        ],
        mustNot: [['the one upload is scoped to archery (absent here)', ELEC]],
      })
      await shot('07-boxing-q1')
    } else {
      await checkSrcs('swordsmanship q1', {
        must: [
          ['swordsmanship background falls back to default', DEF.swordBackground],
          ['swordsmanship knight idle falls back to default', DEF.swordKnightIdle],
        ],
        mustNot: [['the one upload is scoped to archery (absent here)', ELEC]],
      })
      await shot('10-sword-q1')
    }

    for (let q = 0; q < section.scores.length; q += 1) {
      const index = section.scores[q]
      const opts: AnswerOpts = {}
      if (s === 0 && q === 0) {
        Object.assign(opts, {
          ranged: true,
          flightShot: '04-archery-flight',
          scan: () =>
            checkSrcs('archery attack', {
              must: [
                ['uploaded electric target idle still on the untouched targets', ELEC],
                ['default projectile flies (fallback)', DEF.archeryProjectile],
                ['default target hit in the overlay (fallback)', DEF.archeryTargetHit],
                ['default hit effect in the overlay (fallback)', DEF.archeryHitEffect],
              ],
            }),
        })
      }
      if (s === 0 && q === 1) Object.assign(opts, { impactShot: '05-archery-impact' })
      if (s === 1 && q === 0) {
        Object.assign(opts, {
          melee: true,
          meleeShot: '08-boxing-attack',
          scan: () =>
            checkSrcs('boxing attack', {
              must: [
                ['default boxing target hit in the overlay (fallback)', DEF.boxingTargetHit],
                ['default boxing hit effect in the overlay (fallback)', DEF.boxingHitEffect],
              ],
              mustNot: [['the one upload stays scoped to archery', ELEC]],
            }),
        })
      }
      if (s === 2 && q === 0) {
        Object.assign(opts, {
          melee: true,
          meleeShot: '11-sword-attack',
          scan: () =>
            checkSrcs('swordsmanship attack', {
              must: [
                ['default swordsmanship target hit in the overlay (fallback)', DEF.swordTargetHit],
                ['default swordsmanship hit effect in the overlay (fallback)', DEF.swordHitEffect],
              ],
              mustNot: [['the one upload stays scoped to archery', ELEC]],
            }),
        })
      }

      await answer(index, opts)
      if (q < section.scores.length - 1) await waitQuestion(s + 1, q + 2) // the beat auto-advances
    }

    // Section end — band pose beside the band beat strip, copy from the CMS.
    await page.waitForSelector('.ark-section-end-scene', { timeout: 30000 })
    await waitImagesSettled(`${section.key} section end`)
    await assertNoPlaceholders(`${section.key} section end`)
    const pose = await page.locator('.ark-section-anim-knight').getAttribute('data-pose')
    if (pose !== section.pose) fail(`${section.key} end: pose ${pose}, expected ${section.pose}`)
    else pass(`${section.key} end: pose '${pose}' on band ${section.band}`)
    const copy = (await page.locator('.ark-section-end-copy').innerText()).trim()
    notes.push(`${section.key} copy: "${copy}"`)
    const anim = s === 0 ? DEF.archeryAnim129 : s === 1 ? DEF.boxingAnim09 : DEF.swordAnim34
    const poseUrl = s === 0 ? DEF.archeryKnightIdle : s === 1 ? DEF.boxingKnightFail : DEF.swordKnightCelebrate
    const animLoaded = await page
      .locator('img.ark-section-anim-slot')
      .evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)
      .catch(() => false)
    if (!animLoaded) fail(`${section.key} end: beat asset did not load`)
    else pass(`${section.key} end: beat strip loaded`)
    await checkSrcs(`${section.key} section end`, {
      must: [
        [`band animation falls back to default (${anim.split('/').pop()})`, anim],
        [`band knight pose falls back to default (${poseUrl.split('/').pop()})`, poseUrl],
      ],
      mustNot: [['the one upload stays scoped to archery', ELEC]],
    })
    await shot(s === 0 ? '06-archery-section-end' : s === 1 ? '09-boxing-section-end' : '12-sword-section-end')

    await page.locator('.ark-section-end-scene .ark-btn--primary').click()
  }

  // --- results ---------------------------------------------------------------------------------
  console.log('results')
  await page.waitForSelector('.ark-results-scene', { timeout: 30000 })
  await page.waitForFunction(
    () => {
      const img = document.querySelector('img.ark-results-final-knight')
      return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
    },
    undefined,
    { timeout: 15000 },
  )
  const overall = (await page.locator('.ark-results-overall').innerText()).trim()
  if (!overall.includes('2.0 / 4') || !overall.includes('Average')) fail(`overall line unexpected: "${overall}"`)
  else pass(`overall line: "${overall}"`)
  // the kicker is styled text-transform: uppercase, so innerText is "SCRATCH FALLBACK"
  const kicker = (await page.locator('.ark-results-kicker').innerText()).trim()
  if (kicker.toLowerCase() === SCRATCH_TITLE.toLowerCase()) pass(`results kicker reads "${SCRATCH_TITLE}"`)
  else fail(`results kicker is "${kicker}", expected "${SCRATCH_TITLE}"`)

  // Dead QWEN endpoint -> the deterministic fallback must arrive; the screen never blocks.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.ark-results-report-status')
      return (el?.textContent ?? '').includes('offline')
    },
    undefined,
    { timeout: 45000 },
  )
  pass('report status: fallback arrived with the endpoint dead')
  await assertNoPlaceholders('results')
  await checkSrcs('results', {
    must: [
      ['average final knight falls back to default', DEF.resultsKnightAverage],
      ['results background falls back to default', DEF.resultsBackground],
    ],
    mustNot: [['the one upload stays scoped to archery', ELEC]],
  })
  await shot('13-results')

  await page.locator('.ark-results-report-row .ark-btn').click()
  await page.waitForSelector('.ark-report-headline', { timeout: 15000 })
  const provenance = (await page.locator('.ark-report-provenance').innerText()).trim()
  const headline = (await page.locator('.ark-report-headline').innerText()).trim()
  if (!provenance.includes('offline')) fail(`report provenance unexpected: "${provenance}"`)
  else pass(`report provenance: "${provenance}"`)
  if (headline.length === 0) fail('report headline empty')
  else notes.push(`headline: "${headline}"`)
  await assertNoPlaceholders('report')
  await checkSrcs('report', { mustNot: [['the one upload stays scoped to archery', ELEC]] })
  await shot('14-report-fallback')
} catch (error) {
  failures += 1
  console.log(`\nRUN FAILED: ${error instanceof Error ? error.message : error}`)
  await shot('99-failure').catch(() => {})
} finally {
  await closeBrowser()
}

// --- delete the throwaway ------------------------------------------------------------------------
const removed = await payload.delete({
  collection: 'submissions',
  where: { mode: { equals: scratchId } },
  overrideAccess: true,
})
console.log(`deleted ${removed.docs.length} scratch submission(s)`)
await payload.delete({ collection: 'modes', id: scratchId, overrideAccess: true })
console.log(`deleted scratch mode ${scratchId} (/${SCRATCH_SLUG})`)

console.log('\n--- notes ---')
for (const note of notes) console.log(`  ${note}`)
if (consoleErrors.length > 0) {
  console.log('\n--- console errors (informational) ---')
  for (const line of consoleErrors.slice(0, 10)) console.log(`  ${line}`)
}

if (failures > 0) {
  console.log(`\nSCRATCH FALLBACK VERIFICATION FAILED — ${failures} problem(s)`)
  process.exit(1)
}
console.log('\nSCRATCH FALLBACK VERIFICATION PASSED')
process.exit(0)
