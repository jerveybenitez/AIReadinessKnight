/**
 * M11 electric full-set verification — a headless Playwright pass over /electric now that the mode
 * carries the COMPLETE art set (40 uploads over 43 slots, wired by `pnpm art:wire electric`).
 *
 * The M9 version of this script proved the partial re-skin: one uploaded asset rendering, every
 * other slot falling back to `default`. M11 inverts that claim (see QODER.md M11): after this run
 *
 *   - every art slot that renders resolves to an `electric-*` media URL — title background and
 *     logo, per-section backgrounds and knight poses, targets, projectile, hit effects, band
 *     animations, results background and final knight;
 *   - NO media URL of the `default` mode is reachable anywhere in /electric — asserted for every
 *     scene against the full set of 40 default media docs, across <img> srcs AND CSS
 *     background-images;
 *   - no `.ark-placeholder` is ever reachable and every <img> loads;
 *   - the electric mode's questions are byte-identical to `default`'s (M11 contract — only art,
 *     title, theme and copy may differ);
 *   - the theme fields still take effect (accent #4dd8ff, title heading / results kicker
 *     "Electric") and bands / results / dead-QWEN fallback report behave as the full-set run does.
 *
 * Per-slot fallback (the M9 claim) is no longer demonstrable on `electric` — it lives on a
 * throwaway scratch mode in the M11 fallback re-proof (see docs/modes.md).
 *
 * Screenshots land in docs/modes-proof/ as verify-m11-*.png. Run with the dev server up, wired by
 * `pnpm art:wire electric`, and QWEN_BASE_URL=http://127.0.0.1:9/v1 (the fallback path is what gets
 * verified — never the live endpoint):
 *
 *   node scripts/art/verify-electric.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000/electric'
const OUT = path.resolve(process.cwd(), 'docs/modes-proof')
mkdirSync(OUT, { recursive: true })

// M14: uploads are content-hashed WebP (`electric-title-background@2x.1a2b3c4d.webp`) — the exact
// name lives in the committed manifest written by `pnpm art:wire electric`.
const manifest = JSON.parse(readFileSync(path.resolve(process.cwd(), 'art/electric/upload-manifest.json'), 'utf8'))

let failures = 0
const notes = []
const fail = (msg) => {
  failures += 1
  console.log(`  x ${msg}`)
}
const pass = (msg) => console.log(`  + ${msg}`)

// --- the expected media URLs (public /api/media read — no auth needed) --------------------------
const mediaRes = await fetch(new URL('/api/media?limit=200&depth=0', BASE))
if (!mediaRes.ok) throw new Error(`GET /api/media → HTTP ${mediaRes.status()} (is the dev server up?)`)
const mediaDocs = (await mediaRes.json()).docs
const urlOf = (filename) => {
  const found = mediaDocs.filter((d) => d.filename === filename)
  if (found.length === 0) throw new Error(`media "${filename}" is missing from the database — run \`pnpm art:wire electric\``)
  return decodeURIComponent(found[0].url)
}
const upload = (slot) => {
  const entry = manifest.files[slot]
  if (!entry) throw new Error(`art/electric/upload-manifest.json has no slot "${slot}"`)
  return urlOf(entry.upload)
}

const ELE = {
  titleBackground: upload('title/background@2x.png'),
  titleLogo: upload('title/logo@2x.png'),
  archeryBackground: upload('archery/background@2x.png'),
  archeryKnightIdle: upload('archery/knight.idle@2x.png'),
  archeryKnightAttack: upload('archery/knight.attack@2x.png'),
  archeryTargetIdle: upload('archery/target.idle@2x.png'),
  archeryTargetHit: upload('archery/target.hit@2x.png'),
  archeryProjectile: upload('archery/projectile@2x.png'),
  archeryHitEffect: upload('archery/hitEffect@2x.png'),
  archeryAnim129: upload('archery/animation.1-2.9@2x.png'),
  boxingBackground: upload('boxing/background@2x.png'),
  boxingKnightIdle: upload('boxing/knight.idle@2x.png'),
  boxingKnightAttack: upload('boxing/knight.attack@2x.png'),
  boxingKnightFail: upload('boxing/knight.fail@2x.png'),
  boxingTargetHit: upload('boxing/target.hit@2x.png'),
  boxingHitEffect: upload('boxing/hitEffect@2x.png'),
  boxingAnim09: upload('boxing/animation.0-0.9@2x.png'),
  swordBackground: upload('swordsmanship/background@2x.png'),
  swordKnightIdle: upload('swordsmanship/knight.idle@2x.png'),
  swordKnightAttack: upload('swordsmanship/knight.attack@2x.png'),
  swordKnightCelebrate: upload('swordsmanship/knight.celebrate@2x.png'),
  swordTargetHit: upload('swordsmanship/target.hit@2x.png'),
  swordHitEffect: upload('swordsmanship/hitEffect@2x.png'),
  swordAnim34: upload('swordsmanship/animation.3-4@2x.png'),
  resultsBackground: upload('results/background@2x.png'),
  resultsKnightAverage: upload('results/finalKnight.average@2x.png'),
}

// The full default media set: 43 slots over 40 files (hover reuses idle three times). If these
// are not all present the no-fallback claim cannot be proven — and /default itself would be broken.
// M14 note: default16 coexists in the collection since M12 — "not electric-" alone counts both
// foreign sets (the M11 script predates default16). The foreign union is everything that is not
// an electric-* upload: default AND default16.
const defaultUrls = mediaDocs
  .filter((d) => !d.filename.startsWith('electric-') && !d.filename.startsWith('default16-'))
  .map((d) => decodeURIComponent(d.url))
if (defaultUrls.length !== 40) {
  throw new Error(`expected 40 default media docs, found ${defaultUrls.length} — is /default still fully wired?`)
}
const DEFAULT_SET = new Set(defaultUrls)
const electricCount = mediaDocs.filter((d) => d.filename.startsWith('electric-')).length
if (electricCount !== 40) {
  throw new Error(`expected 40 electric media docs, found ${electricCount} — run \`pnpm art:wire electric\``)
}
console.log(`verifying ${BASE} (full set: ${electricCount} electric uploads vs ${defaultUrls.length} default)`)

// --- the questions are byte-identical to default's (M11 contract) -------------------------------
{
  const modesRes = await fetch(new URL('/api/modes?limit=10&depth=0', BASE))
  if (!modesRes.ok) throw new Error(`GET /api/modes → HTTP ${modesRes.status()}`)
  const modes = (await modesRes.json()).docs
  const def = modes.find((m) => m.slug === 'default')
  const elec = modes.find((m) => m.slug === 'electric')
  if (!def || !elec) throw new Error('modes "default"/"electric" missing from the database')
  const questionsOf = (mode) =>
    JSON.stringify(
      mode.sections.map((s) => ({
        key: s.key,
        questions: s.questions.map((q) => ({
          key: q.key,
          text: q.text,
          options: q.options.map((o) => ({ text: o.text, score: o.score })),
        })),
      })),
    )
  if (questionsOf(def) === questionsOf(elec)) pass('electric questions are byte-identical to default\'s')
  else fail('electric questions differ from default\'s — the M11 contract says art only')
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

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err}`))

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `verify-m11-${name}.png`) })
  notes.push(`shot verify-m11-${name}.png`)
}

const waitImagesSettled = async (where, timeout = 15000) => {
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

const assertNoPlaceholders = async (where) => {
  const placeholders = page.locator('.ark-placeholder')
  const count = await placeholders.count()
  if (count > 0) {
    const labels = await page.locator('.ark-placeholder span').allInnerTexts()
    fail(`${where}: ${count} placeholder(s) visible — ${labels.join(' | ')}`)
  } else {
    pass(`${where}: no placeholders`)
  }
}

/**
 * Every resolved media URL currently in the DOM: <img> srcs plus every element's CSS
 * background-image (the game renders most art as <img>, but the inversion must not have a blind
 * spot). Non-media URLs are filtered out; values are decoded so they compare against the
 * database's URLs.
 */
const srcList = () =>
  page.evaluate(() => {
    const out = []
    for (const img of document.images) {
      const src = img.currentSrc || img.src
      if (src.includes('/api/media/file/')) out.push(decodeURIComponent(src))
    }
    for (const el of document.querySelectorAll('*')) {
      const bg = getComputedStyle(el).backgroundImage
      if (!bg || !bg.includes('/api/media/file/')) continue
      for (const m of bg.matchAll(/url\((?:["']?)([^"')]+)(?:["']?)\)/g)) {
        if (m[1].includes('/api/media/file/')) out.push(decodeURIComponent(m[1]))
      }
    }
    return out
  })

/** Strip a possible absolute origin so both `/api/...` and `http://host/api/...` compare equal. */
const normSrc = (s) => {
  const i = s.indexOf('/api/media/file/')
  return i >= 0 ? s.slice(i) : s
}

/**
 * The M11 inversion: no `default` media URL may be reachable in /electric, in any scene. Runs
 * against the full set of 40 default URLs — a mode that resolves a single slot to a default
 * asset fails here even if the playthrough itself looks fine.
 */
const assertNoDefault = async (where) => {
  const list = await srcList()
  const hits = [...new Set(list.map(normSrc).filter((s) => DEFAULT_SET.has(s)))]
  if (hits.length === 0) pass(`${where}: no default media URL reachable`)
  else fail(`${where}: default URL(s) reachable — ${hits.join(' | ')}`)
}

/**
 * The per-slot assertions: `must` entries prove an (electric) URL is rendered as a substring of a
 * src; `mustNot` entries prove a URL is shadowed.
 */
const checkSrcs = async (where, { must = [], mustNot = [] }) => {
  const list = await srcList()
  for (const [label, needle] of must) {
    if (list.some((s) => s.includes(needle))) pass(`${where}: ${label}`)
    else fail(`${where}: ${label} — no src contains ${needle}\n      srcs: ${list.join(' | ')}`)
  }
  for (const [label, needle] of mustNot) {
    const hits = list.filter((s) => s.includes(needle))
    if (hits.length === 0) pass(`${where}: ${label}`)
    else fail(`${where}: ${label} — ${hits.length} img(s) use ${needle}\n      srcs: ${list.join(' | ')}`)
  }
}

/** Wait until some src contains `needle` (pose swaps race the flight moment) — true when seen. */
const waitSrc = async (needle, timeout = 4000) => {
  try {
    await page.waitForFunction(
      (n) => Array.from(document.images).some((img) => decodeURIComponent(img.currentSrc || img.src).includes(n)),
      needle,
      { timeout },
    )
    return true
  } catch {
    return false
  }
}

const waitQuestion = (section, question) =>
  page.waitForFunction(
    ({ s, q }) => {
      const el = document.querySelector('.ark-progress')
      return !!el && el.textContent.includes(`Question ${q} of 5`) && el.textContent.includes(`Section ${s} of 3`)
    },
    { s: section, q: question },
    { timeout: 30000 },
  )

const waitTargetsEnabled = () =>
  page.waitForFunction(() => {
    const first = document.querySelector('.ark-target')
    return !!first && !first.disabled
  }, undefined, { timeout: 30000 })

// One recorded answer + its attack beat. The scan runs at the flight/impact moment so the overlay
// (target-hit + hit-effect sprites, rendered at beat start, shown at impact) is already in the DOM.
const answer = async (index, opts = {}) => {
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

try {
  // --- title -----------------------------------------------------------------------------------
  console.log('title')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ark-title-start', { timeout: 90000 })
  await waitImagesSettled('title')
  await assertNoPlaceholders('title')
  const heading = (await page.locator('#ark-title-heading').innerText()).trim()
  if (heading === 'Electric') pass('title heading reads "Electric"')
  else fail(`title heading is "${heading}", expected "Electric"`)
  const accent = await page.evaluate(() => {
    const el = document.querySelector('.ark-viewport')
    return el ? getComputedStyle(el).getPropertyValue('--ark-accent').trim().toLowerCase() : null
  })
  if (accent === '#4dd8ff') pass('stage accent is the electric theme (#4dd8ff)')
  else fail(`stage accent is "${accent}", expected "#4dd8ff"`)
  await checkSrcs('title', {
    must: [
      ['electric title background renders', ELE.titleBackground],
      ['electric title logo renders', ELE.titleLogo],
    ],
  })
  await assertNoDefault('title')
  await shot('01-title')

  // --- intake ----------------------------------------------------------------------------------
  console.log('intake')
  await page.locator('.ark-title-start').click()
  await page.waitForSelector('.ark-intake-card', { timeout: 15000 })
  const cardText = await page.locator('.ark-intake-card').innerText()
  if (cardText.includes('Electric')) pass('intake copy carries the mode title')
  else fail('intake copy does not mention "Electric"')
  await shot('02-intake')
  const inputs = page.locator('.ark-field input')
  await inputs.nth(0).fill('Sir Verifier')
  await inputs.nth(1).fill('Full Set Industries')
  await inputs.nth(2).fill('Software')
  await page.locator('.ark-intake-card button[type=submit]').click()
  await waitQuestion(1, 1)

  // --- the three sections ----------------------------------------------------------------------
  for (let s = 0; s < PLAN.length; s += 1) {
    const section = PLAN[s]
    console.log(`${section.key} (section ${s + 1})`)
    await page.waitForSelector('.ark-question-scene', { timeout: 30000 })
    if (s > 0) await waitQuestion(s + 1, 1)

    // Section entry — idle scene, background, knight and five targets, all electric now.
    await waitImagesSettled(`${section.key} q1`)
    await assertNoPlaceholders(`${section.key} q1`)

    if (s === 0) {
      await checkSrcs('archery q1', {
        must: [
          ['electric archery background renders', ELE.archeryBackground],
          ['electric archery knight idle renders', ELE.archeryKnightIdle],
          ['electric archery target idle renders', ELE.archeryTargetIdle],
        ],
      })
      await shot('03-archery-q1')
      await page.locator('.ark-target').nth(3).hover()
      await page.waitForSelector('.ark-bubble', { timeout: 5000 })
      pass('hover shows the speech bubble (hover pose re-uses the electric idle)')
      await shot('03b-archery-q1-hover')
      await page.mouse.move(10, 10) // clear hover before the attack beat scans
    } else if (s === 1) {
      await checkSrcs('boxing q1', {
        must: [
          ['electric boxing background renders', ELE.boxingBackground],
          ['electric boxing knight idle renders', ELE.boxingKnightIdle],
        ],
      })
      await shot('07-boxing-q1')
    } else {
      await checkSrcs('swordsmanship q1', {
        must: [
          ['electric swordsmanship background renders', ELE.swordBackground],
          ['electric swordsmanship knight idle renders', ELE.swordKnightIdle],
        ],
      })
      await shot('10-sword-q1')
    }
    await assertNoDefault(`${section.key} q1`)

    for (let q = 0; q < section.scores.length; q += 1) {
      const index = section.scores[q]
      const opts = {}
      if (s === 0 && q === 0) {
        Object.assign(opts, {
          ranged: true,
          flightShot: '04-archery-flight',
          scan: async () => {
            await checkSrcs('archery attack', {
              must: [
                ['electric target idle still on the untouched targets', ELE.archeryTargetIdle],
                ['electric projectile flies', ELE.archeryProjectile],
                ['electric target hit renders in the overlay', ELE.archeryTargetHit],
                ['electric hit effect renders in the overlay', ELE.archeryHitEffect],
              ],
            })
            if (await waitSrc(ELE.archeryKnightAttack)) pass('archery attack: knight swapped to the electric attack pose')
            else fail('archery attack: electric attack pose never rendered')
            await assertNoDefault('archery attack')
          },
        })
      }
      if (s === 0 && q === 1) Object.assign(opts, { impactShot: '05-archery-impact' })
      if (s === 1 && q === 0) {
        Object.assign(opts, {
          melee: true,
          meleeShot: '08-boxing-attack',
          scan: async () => {
            await checkSrcs('boxing attack', {
              must: [
                ['electric boxing target hit renders in the overlay', ELE.boxingTargetHit],
                ['electric boxing hit effect renders in the overlay', ELE.boxingHitEffect],
              ],
            })
            if (await waitSrc(ELE.boxingKnightAttack)) pass('boxing attack: knight swapped to the electric attack pose')
            else fail('boxing attack: electric attack pose never rendered')
            await assertNoDefault('boxing attack')
          },
        })
      }
      if (s === 2 && q === 0) {
        Object.assign(opts, {
          melee: true,
          meleeShot: '11-sword-attack',
          scan: async () => {
            await checkSrcs('swordsmanship attack', {
              must: [
                ['electric swordsmanship target hit renders in the overlay', ELE.swordTargetHit],
                ['electric swordsmanship hit effect renders in the overlay', ELE.swordHitEffect],
              ],
            })
            if (await waitSrc(ELE.swordKnightAttack)) pass('swordsmanship attack: knight swapped to the electric attack pose')
            else fail('swordsmanship attack: electric attack pose never rendered')
            await assertNoDefault('swordsmanship attack')
          },
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
    const anim = s === 0 ? ELE.archeryAnim129 : s === 1 ? ELE.boxingAnim09 : ELE.swordAnim34
    const poseUrl = s === 0 ? ELE.archeryKnightIdle : s === 1 ? ELE.boxingKnightFail : ELE.swordKnightCelebrate
    const animLoaded = await page
      .locator('img.ark-section-anim-slot')
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false)
    if (!animLoaded) fail(`${section.key} end: beat asset did not load`)
    else pass(`${section.key} end: beat strip loaded`)
    await checkSrcs(`${section.key} section end`, {
      must: [
        [`electric band animation renders (${anim.split('/').pop()})`, anim],
        [`electric band knight pose renders (${poseUrl.split('/').pop()})`, poseUrl],
      ],
    })
    await assertNoDefault(`${section.key} section end`)
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
  // the kicker is styled text-transform: uppercase, so innerText is "ELECTRIC"
  const kicker = (await page.locator('.ark-results-kicker').innerText()).trim()
  if (kicker.toLowerCase() === 'electric') pass('results kicker reads "Electric"')
  else fail(`results kicker is "${kicker}", expected "Electric"`)

  // Dead QWEN endpoint -> the deterministic fallback must arrive; the screen never blocks.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.ark-results-report-status')
      return !!el && el.textContent.includes('offline')
    },
    undefined,
    { timeout: 45000 },
  )
  pass('report status: fallback arrived with the endpoint dead')
  await assertNoPlaceholders('results')
  await checkSrcs('results', {
    must: [
      ['electric average final knight renders', ELE.resultsKnightAverage],
      ['electric results background renders', ELE.resultsBackground],
    ],
  })
  await assertNoDefault('results')
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
  await assertNoDefault('report')
  await shot('14-report-fallback')
} catch (error) {
  failures += 1
  console.log(`\nRUN FAILED: ${error instanceof Error ? error.message : error}`)
  await shot('99-failure').catch(() => {})
} finally {
  await context.close()
  await browser.close()
}

console.log('\n--- notes ---')
for (const note of notes) console.log(`  ${note}`)
if (consoleErrors.length > 0) {
  console.log('\n--- console errors (informational) ---')
  for (const line of consoleErrors.slice(0, 10)) console.log(`  ${line}`)
}

if (failures > 0) {
  console.log(`\nELECTRIC FULL-SET VERIFICATION FAILED (M11) — ${failures} problem(s)`)
  process.exit(1)
}
console.log('\nELECTRIC FULL-SET VERIFICATION PASSED (M11)')
