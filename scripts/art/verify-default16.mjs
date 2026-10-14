/**
 * M12 default16 full-set verification — a headless Playwright pass over /default16, the 16-bit
 * re-skin shipped by this milestone (43 slots over 40 uploads, wired by `pnpm art:wire default16`
 * onto a mode seeded by `pnpm mode:dup default16` — see QODER.md M12).
 *
 * This is the verify-electric.mjs (M11) shape with the isolation claim widened: `electric` had
 * to prove no URL of ONE foreign set (`default`) was reachable; `default16` ships into a media
 * collection that already carries BOTH prior sets and must prove neither is reachable. After
 * this run
 *
 *   - every art slot that renders resolves to a `default16-*` media URL — title background and
 *     logo, per-section backgrounds and knight poses, targets, projectile, hit effects, band
 *     animations, results background and final knight;
 *   - NO media URL of `default` OR `electric` is reachable anywhere in /default16 — asserted for
 *     every scene against the union of those 80 foreign media docs, across <img> srcs AND CSS
 *     background-images;
 *   - no `.ark-placeholder` is ever reachable and every <img> loads;
 *   - the mode's questions are byte-identical to `default`'s (M12 contract — `mode:dup` copies
 *     them verbatim; only art and title differ, and the copy is default's verbatim too);
 *   - the duplicated theme still takes effect (accent #d4af37, the default mode's gold).
 *
 * Screenshots land in docs/modes-proof/ as verify-m12-*.png. Run with the dev server up on the
 * DEAD QWEN endpoint (QWEN_BASE_URL=http://127.0.0.1:9/v1 — the fallback path is what gets
 * verified, never the live endpoint), wired by `pnpm art:wire default16`:
 *
 *   node scripts/art/verify-default16.mjs
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000/default16'
const OUT = path.resolve(process.cwd(), 'docs/modes-proof')
mkdirSync(OUT, { recursive: true })

let failures = 0
const notes = []
const fail = (msg) => {
  failures += 1
  console.log(`  x ${msg}`)
}
const pass = (msg) => console.log(`  + ${msg}`)

// --- the expected media URLs (public /api/media read — no auth needed) --------------------------
const mediaRes = await fetch(new URL('/api/media?limit=200&depth=0', BASE))
if (!mediaRes.ok) throw new Error(`GET /api/media → HTTP ${mediaRes.status} (is the dev server up?)`)
const mediaDocs = (await mediaRes.json()).docs
const urlOf = (filename) => {
  const found = mediaDocs.filter((d) => d.filename === filename)
  if (found.length === 0) throw new Error(`media "${filename}" is missing from the database — run \`pnpm art:wire default16\``)
  return decodeURIComponent(found[0].url)
}

const D16 = {
  titleBackground: urlOf('default16-title-background@2x.png'),
  titleLogo: urlOf('default16-title-logo@2x.png'),
  archeryBackground: urlOf('default16-archery-background@2x.png'),
  archeryKnightIdle: urlOf('default16-archery-knight.idle@2x.png'),
  archeryKnightAttack: urlOf('default16-archery-knight.attack@2x.png'),
  archeryTargetIdle: urlOf('default16-archery-target.idle@2x.png'),
  archeryTargetHit: urlOf('default16-archery-target.hit@2x.png'),
  archeryProjectile: urlOf('default16-archery-projectile@2x.png'),
  archeryHitEffect: urlOf('default16-archery-hitEffect@2x.png'),
  archeryAnim129: urlOf('default16-archery-animation.1-2.9@2x.png'),
  boxingBackground: urlOf('default16-boxing-background@2x.png'),
  boxingKnightIdle: urlOf('default16-boxing-knight.idle@2x.png'),
  boxingKnightAttack: urlOf('default16-boxing-knight.attack@2x.png'),
  boxingKnightFail: urlOf('default16-boxing-knight.fail@2x.png'),
  boxingTargetHit: urlOf('default16-boxing-target.hit@2x.png'),
  boxingHitEffect: urlOf('default16-boxing-hitEffect@2x.png'),
  boxingAnim09: urlOf('default16-boxing-animation.0-0.9@2x.png'),
  swordBackground: urlOf('default16-swordsmanship-background@2x.png'),
  swordKnightIdle: urlOf('default16-swordsmanship-knight.idle@2x.png'),
  swordKnightAttack: urlOf('default16-swordsmanship-knight.attack@2x.png'),
  swordKnightCelebrate: urlOf('default16-swordsmanship-knight.celebrate@2x.png'),
  swordTargetHit: urlOf('default16-swordsmanship-target.hit@2x.png'),
  swordHitEffect: urlOf('default16-swordsmanship-hitEffect@2x.png'),
  swordAnim34: urlOf('default16-swordsmanship-animation.3-4@2x.png'),
  resultsBackground: urlOf('default16-results-background@2x.png'),
  resultsKnightAverage: urlOf('default16-results-finalKnight.average@2x.png'),
}

// Three sets coexist in one media collection after M11+M12: 40 default + 40 electric + 40
// default16 = 120 docs. The no-foreign claim is only meaningful if BOTH foreign sets are fully
// present (if either were missing the union assertion would be weaker — and that mode would be
// broken). default16 filenames are namespaced, so "everything not default16-" is exactly the
// union of the two foreign sets.
const counts = {
  electric: mediaDocs.filter((d) => d.filename.startsWith('electric-')).length,
  default16: mediaDocs.filter((d) => d.filename.startsWith('default16-')).length,
}
counts.default = mediaDocs.length - counts.electric - counts.default16
if (counts.default !== 40 || counts.electric !== 40 || counts.default16 !== 40) {
  throw new Error(
    `expected 40 docs per set (default/electric/default16), found ${counts.default}/${counts.electric}/${counts.default16} — is every set still fully wired?`,
  )
}
const foreignUrls = mediaDocs
  .filter((d) => !d.filename.startsWith('default16-'))
  .map((d) => decodeURIComponent(d.url))
const FOREIGN_SET = new Set(foreignUrls)
console.log(`verifying ${BASE} (full set: ${counts.default16} default16 uploads vs ${foreignUrls.length} foreign)`)

// --- the questions are byte-identical to default's (M12 contract) -------------------------------
{
  const modesRes = await fetch(new URL('/api/modes?limit=10&depth=0', BASE))
  if (!modesRes.ok) throw new Error(`GET /api/modes → HTTP ${modesRes.status}`)
  const modes = (await modesRes.json()).docs
  const def = modes.find((m) => m.slug === 'default')
  const d16 = modes.find((m) => m.slug === 'default16')
  if (!def || !d16) throw new Error('modes "default"/"default16" missing from the database')
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
  if (questionsOf(def) === questionsOf(d16)) pass('default16 questions are byte-identical to default\'s')
  else fail('default16 questions differ from default\'s — mode:dup must copy them verbatim')
}

// Answer script: target index = score (0->4 left->right). Section means 1.8 / 0.6 / 3.6 -> all
// three section bands exercised, overall 2.0 -> 'average' final knight. (Same as the M11 run.)
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
  await page.screenshot({ path: path.join(OUT, `verify-m12-${name}.png`) })
  notes.push(`shot verify-m12-${name}.png`)
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
 * The M12 isolation claim: no FOREIGN media URL (default or electric) may be reachable in
 * /default16, in any scene. Runs against the full union of both foreign sets — a mode that
 * resolves a single slot to a foreign asset fails here even if the playthrough itself looks
 * fine.
 */
const assertNoForeign = async (where) => {
  const list = await srcList()
  const hits = [...new Set(list.map(normSrc).filter((s) => FOREIGN_SET.has(s)))]
  if (hits.length === 0) pass(`${where}: no foreign media URL reachable`)
  else fail(`${where}: foreign URL(s) reachable — ${hits.join(' | ')}`)
}

/**
 * The per-slot assertions: `must` entries prove a (default16) URL is rendered as a substring of
 * a src; `mustNot` entries prove a URL is shadowed.
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
  if (heading === 'Default16') pass('title heading reads "Default16" (the duplicated title)')
  else fail(`title heading is "${heading}", expected "Default16"`)
  const accent = await page.evaluate(() => {
    const el = document.querySelector('.ark-viewport')
    return el ? getComputedStyle(el).getPropertyValue('--ark-accent').trim().toLowerCase() : null
  })
  if (accent === '#d4af37') pass('stage accent is the duplicated theme (#d4af37)')
  else fail(`stage accent is "${accent}", expected "#d4af37"`)
  await checkSrcs('title', {
    must: [
      ['default16 title background renders', D16.titleBackground],
      ['default16 title logo renders', D16.titleLogo],
    ],
  })
  await assertNoForeign('title')
  await shot('01-title')

  // --- intake ----------------------------------------------------------------------------------
  console.log('intake')
  await page.locator('.ark-title-start').click()
  await page.waitForSelector('.ark-intake-card', { timeout: 15000 })
  // mode:dup copies default's title copy verbatim (M12 contract: only art + title may differ) —
  // assert it renders, not that it names the mode.
  const cardText = (await page.locator('.ark-intake-card').innerText()).trim()
  if (cardText.length > 0) pass('intake copy renders (duplicated default copy)')
  else fail('intake copy is empty')
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

    // Section entry — idle scene, background, knight and five targets, all default16 now.
    await waitImagesSettled(`${section.key} q1`)
    await assertNoPlaceholders(`${section.key} q1`)

    if (s === 0) {
      await checkSrcs('archery q1', {
        must: [
          ['default16 archery background renders', D16.archeryBackground],
          ['default16 archery knight idle renders', D16.archeryKnightIdle],
          ['default16 archery target idle renders', D16.archeryTargetIdle],
        ],
      })
      await shot('03-archery-q1')
      await page.locator('.ark-target').nth(3).hover()
      await page.waitForSelector('.ark-bubble', { timeout: 5000 })
      pass('hover shows the speech bubble (hover pose re-uses the default16 idle)')
      await shot('03b-archery-q1-hover')
      await page.mouse.move(10, 10) // clear hover before the attack beat scans
    } else if (s === 1) {
      await checkSrcs('boxing q1', {
        must: [
          ['default16 boxing background renders', D16.boxingBackground],
          ['default16 boxing knight idle renders', D16.boxingKnightIdle],
        ],
      })
      await shot('07-boxing-q1')
    } else {
      await checkSrcs('swordsmanship q1', {
        must: [
          ['default16 swordsmanship background renders', D16.swordBackground],
          ['default16 swordsmanship knight idle renders', D16.swordKnightIdle],
        ],
      })
      await shot('10-sword-q1')
    }
    await assertNoForeign(`${section.key} q1`)

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
                ['default16 target idle still on the untouched targets', D16.archeryTargetIdle],
                ['default16 projectile flies', D16.archeryProjectile],
                ['default16 target hit renders in the overlay', D16.archeryTargetHit],
                ['default16 hit effect renders in the overlay', D16.archeryHitEffect],
              ],
            })
            if (await waitSrc(D16.archeryKnightAttack)) pass('archery attack: knight swapped to the default16 attack pose')
            else fail('archery attack: default16 attack pose never rendered')
            await assertNoForeign('archery attack')
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
                ['default16 boxing target hit renders in the overlay', D16.boxingTargetHit],
                ['default16 boxing hit effect renders in the overlay', D16.boxingHitEffect],
              ],
            })
            if (await waitSrc(D16.boxingKnightAttack)) pass('boxing attack: knight swapped to the default16 attack pose')
            else fail('boxing attack: default16 attack pose never rendered')
            await assertNoForeign('boxing attack')
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
                ['default16 swordsmanship target hit renders in the overlay', D16.swordTargetHit],
                ['default16 swordsmanship hit effect renders in the overlay', D16.swordHitEffect],
              ],
            })
            if (await waitSrc(D16.swordKnightAttack)) pass('swordsmanship attack: knight swapped to the default16 attack pose')
            else fail('swordsmanship attack: default16 attack pose never rendered')
            await assertNoForeign('swordsmanship attack')
          },
        })
      }

      await answer(index, opts)
      if (q < section.scores.length - 1) await waitQuestion(s + 1, q + 2) // the beat auto-advances
    }

    // Section end — band pose beside the band beat strip, copy copied verbatim from default.
    await page.waitForSelector('.ark-section-end-scene', { timeout: 30000 })
    await waitImagesSettled(`${section.key} section end`)
    await assertNoPlaceholders(`${section.key} section end`)
    const pose = await page.locator('.ark-section-anim-knight').getAttribute('data-pose')
    if (pose !== section.pose) fail(`${section.key} end: pose ${pose}, expected ${section.pose}`)
    else pass(`${section.key} end: pose '${pose}' on band ${section.band}`)
    const copy = (await page.locator('.ark-section-end-copy').innerText()).trim()
    notes.push(`${section.key} copy: "${copy}"`)
    const anim = s === 0 ? D16.archeryAnim129 : s === 1 ? D16.boxingAnim09 : D16.swordAnim34
    const poseUrl = s === 0 ? D16.archeryKnightIdle : s === 1 ? D16.boxingKnightFail : D16.swordKnightCelebrate
    const animLoaded = await page
      .locator('img.ark-section-anim-slot')
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false)
    if (!animLoaded) fail(`${section.key} end: beat asset did not load`)
    else pass(`${section.key} end: beat strip loaded`)
    await checkSrcs(`${section.key} section end`, {
      must: [
        [`default16 band animation renders (${anim.split('/').pop()})`, anim],
        [`default16 band knight pose renders (${poseUrl.split('/').pop()})`, poseUrl],
      ],
    })
    await assertNoForeign(`${section.key} section end`)
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
  // the kicker is the raw slug (styled uppercase in CSS) — for default16 it is literally "default16"
  const kicker = (await page.locator('.ark-results-kicker').innerText()).trim()
  if (kicker.toLowerCase() === 'default16') pass('results kicker reads "default16"')
  else fail(`results kicker is "${kicker}", expected "default16"`)

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
      ['default16 average final knight renders', D16.resultsKnightAverage],
      ['default16 results background renders', D16.resultsBackground],
    ],
  })
  await assertNoForeign('results')
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
  await assertNoForeign('report')
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
  console.log(`\nDEFAULT16 FULL-SET VERIFICATION FAILED (M12) — ${failures} problem(s)`)
  process.exit(1)
}
console.log('\nDEFAULT16 FULL-SET VERIFICATION PASSED (M12)')
