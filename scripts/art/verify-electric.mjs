/**
 * M9 re-skin verification — a headless Playwright pass over /electric (the partial mode shipped
 * through /admin). This is the literal done-when: "a mode with only one uploaded asset is still
 * fully playable."
 *
 * Plays the complete 15-question run and asserts, scene by scene:
 *   - the uploaded archery target idle (the ONLY electric asset after phase 1) is what renders,
 *     and the default archery target idle is shadowed;
 *   - everything electric does not override still renders the default media URL — background,
 *     knight poses, projectile, hit target, hit effect, section animations, title, results;
 *   - no `.ark-placeholder` is ever reachable and every <img> loads;
 *   - boxing / swordsmanship / title / results contain ZERO electric URLs (the re-skin is scoped);
 *   - the theme fields took effect (accent #4dd8ff on the stage, title copy says "Electric");
 *   - bands / results / dead-QWEN fallback report behave exactly as the full-set run does.
 *
 * Two expectation levels:
 *   node scripts/art/verify-electric.mjs          → partial: one uploaded asset (after phase 1)
 *   node scripts/art/verify-electric.mjs full     → all three uploaded (after phase 2)
 *
 * Screenshots land in docs/modes-proof/ as verify-<mode>-*.png. Run with the dev server up and
 * QWEN_BASE_URL=http://127.0.0.1:9/v1 (the fallback path is what gets verified — never the live
 * endpoint).
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000/electric'
const ELEVEL = process.argv[2] ?? 'partial'
if (!['partial', 'full'].includes(ELEVEL)) {
  console.error('usage: node scripts/art/verify-electric.mjs [partial|full]')
  process.exit(1)
}
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
if (!mediaRes.ok) throw new Error(`GET /api/media → HTTP ${mediaRes.status()} (is the dev server up?)`)
const mediaDocs = (await mediaRes.json()).docs
const mediaUrl = (filename) => {
  const found = mediaDocs.filter((d) => d.filename === filename)
  if (found.length === 0) throw new Error(`media "${filename}" is missing from the database`)
  return decodeURIComponent(found[0].url)
}

const upload = mediaDocs.find((d) => d.filename === 'target.idle@2x.png')
if (!upload || !(upload.alt ?? '').startsWith('Electric re-skin')) {
  throw new Error('no media "target.idle@2x.png" tagged "Electric re-skin" — run phase1 of scripts/re-skin-proof.mjs first')
}
// inside a decoded src this string is unambiguous: the default's URL has `archery-` between
// `/file/` and `target`, so it can never contain this needle.
const ELEC = {
  idle: '/api/media/file/target.idle@2x.png',
  hit: '/api/media/file/target.hit@2x.png',
  effect: '/api/media/file/hitEffect@2x.png',
}
const ELEC_ALL = [ELEC.idle, ELEC.hit, ELEC.effect]
const DEF = {
  archeryBackground: mediaUrl('archery-background@2x.png'),
  archeryKnightIdle: mediaUrl('archery-knight.idle@2x.png'),
  archeryTargetIdle: mediaUrl('archery-target.idle@2x.png'),
  archeryTargetHit: mediaUrl('archery-target.hit@2x.png'),
  archeryHitEffect: mediaUrl('archery-hitEffect@2x.png'),
  archeryProjectile: mediaUrl('archery-projectile@2x.png'),
  archeryAnim129: mediaUrl('archery-animation.1-2.9@2x.png'),
  boxingBackground: mediaUrl('boxing-background@2x.png'),
  boxingKnightIdle: mediaUrl('boxing-knight.idle@2x.png'),
  boxingKnightFail: mediaUrl('boxing-knight.fail@2x.png'),
  boxingTargetHit: mediaUrl('boxing-target.hit@2x.png'),
  boxingHitEffect: mediaUrl('boxing-hitEffect@2x.png'),
  boxingAnim09: mediaUrl('boxing-animation.0-0.9@2x.png'),
  swordBackground: mediaUrl('swordsmanship-background@2x.png'),
  swordKnightIdle: mediaUrl('swordsmanship-knight.idle@2x.png'),
  swordKnightCelebrate: mediaUrl('swordsmanship-knight.celebrate@2x.png'),
  swordTargetHit: mediaUrl('swordsmanship-target.hit@2x.png'),
  swordHitEffect: mediaUrl('swordsmanship-hitEffect@2x.png'),
  swordAnim34: mediaUrl('swordsmanship-animation.3-4@2x.png'),
  titleBackground: mediaUrl('title-background@2x.png'),
  titleLogo: mediaUrl('title-logo@2x.png'),
  resultsKnightAverage: mediaUrl('results-finalKnight.average@2x.png'),
  resultsBackground: mediaUrl('results-background@2x.png'),
}
console.log(`verifying ${BASE} in "${ELEVEL}" mode`)
console.log(`  electric upload: ${ELEC.idle}`)

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
  await page.screenshot({ path: path.join(OUT, `verify-${ELEVEL}-${name}.png`) })
  notes.push(`shot verify-${ELEVEL}-${name}.png`)
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

/** Which resolved media URL sits behind every <img> currently in the DOM. */
const srcList = () =>
  page.evaluate(() => Array.from(document.images).map((img) => decodeURIComponent(img.currentSrc || img.src)))

/**
 * The re-skin assertions: `must` entries prove a URL (upload or default fallback) is rendered,
 * `mustNot` entries prove a URL is shadowed / absent from this scene.
 */
const checkSrcs = async (where, { must = [], mustNot = [] }) => {
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

// One recorded answer + its attack beat. The scan runs at the flight moment so the overlay
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
      ['title background (default)', DEF.titleBackground],
      ['title logo (default)', DEF.titleLogo],
    ],
    mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
  })
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

    // Section entry — idle scene, background, knight and five targets.
    await waitImagesSettled(`${section.key} q1`)
    await assertNoPlaceholders(`${section.key} q1`)

    if (s === 0) {
      // THE phase-1 proof: the uploaded electric target idle renders; its default counterpart is
      // shadowed; background and knight fall back to default.
      await checkSrcs('archery q1', {
        must: [
          ['uploaded electric target idle renders', ELEC.idle],
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
          ['boxing background (default)', DEF.boxingBackground],
          ['boxing knight idle (default)', DEF.boxingKnightIdle],
        ],
        mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
      })
      await shot('07-boxing-q1')
    } else {
      await checkSrcs('swordsmanship q1', {
        must: [
          ['swordsmanship background (default)', DEF.swordBackground],
          ['swordsmanship knight idle (default)', DEF.swordKnightIdle],
        ],
        mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
      })
      await shot('10-sword-q1')
    }

    for (let q = 0; q < section.scores.length; q += 1) {
      const index = section.scores[q]
      const opts = {}
      if (s === 0 && q === 0) {
        Object.assign(opts, {
          ranged: true,
          flightShot: '04-archery-flight',
          scan: () =>
            checkSrcs('archery attack', {
              must: [
                ['electric target idle still on the untouched targets', ELEC.idle],
                ['default projectile flies (fallback)', DEF.archeryProjectile],
                ...(ELEVEL === 'full'
                  ? [
                      ['uploaded electric target hit renders', ELEC.hit],
                      ['uploaded electric hit effect renders', ELEC.effect],
                    ]
                  : [
                      ['default target hit in the overlay (fallback)', DEF.archeryTargetHit],
                      ['default hit effect in the overlay (fallback)', DEF.archeryHitEffect],
                    ]),
              ],
              mustNot:
                ELEVEL === 'full'
                  ? [
                      ['default archery target hit is shadowed', DEF.archeryTargetHit],
                      ['default archery hit effect is shadowed', DEF.archeryHitEffect],
                    ]
                  : [
                      ['electric target hit not uploaded yet (partial)', ELEC.hit],
                      ['electric hit effect not uploaded yet (partial)', ELEC.effect],
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
              mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
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
              mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
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
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false)
    if (!animLoaded) fail(`${section.key} end: beat asset did not load`)
    else pass(`${section.key} end: beat strip loaded`)
    await checkSrcs(`${section.key} section end`, {
      must: [
        [`band animation falls back to default (${anim.split('/').pop()})`, anim],
        [`band knight pose falls back to default (${poseUrl.split('/').pop()})`, poseUrl],
      ],
      mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
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
      ['average final knight (default)', DEF.resultsKnightAverage],
      ['results background (default)', DEF.resultsBackground],
    ],
    mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
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
  await checkSrcs('report', {
    mustNot: ELEC_ALL.map((u) => [`electric URL absent (${u.split('/').pop()})`, u]),
  })
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
  console.log(`\nELECTRIC VERIFICATION FAILED (${ELEVEL}) — ${failures} problem(s)`)
  process.exit(1)
}
console.log(`\nELECTRIC RE-SKIN VERIFICATION PASSED (${ELEVEL})`)
