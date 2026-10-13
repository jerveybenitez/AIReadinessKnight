/**
 * M8 in-game verification — a headless Playwright pass over /default with the full art set wired.
 *
 * Plays the complete 15-question run and asserts, scene by scene, that:
 *   - every hero image loads (no broken <img>) and NO `.ark-placeholder` is reachable;
 *   - the melee guard holds: no `.ark-arrow` element ever appears in boxing/swordsmanship;
 *   - each section ends on the band the answer pattern produces (pose + beat + copy);
 *   - results land on the expected band and the dead-QWEN fallback report reads as a report.
 *
 * Screenshots land in docs/art-sample/ as verify-*.png. Run with the dev server up:
 *   node scripts/art/verify-in-game.mjs
 * Intended to run against a server with QWEN_BASE_URL=http://127.0.0.1:9/v1 so the fallback path
 * is what gets verified (never the live endpoint).
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000/default'
const OUT = path.resolve(process.cwd(), 'docs/art-sample')
mkdirSync(OUT, { recursive: true })

let failures = 0
const notes = []
const fail = (msg) => {
  failures += 1
  console.log(`  x ${msg}`)
}
const pass = (msg) => console.log(`  + ${msg}`)

// Answer script: target index = score (0->4 left->right). Section means 1.8 / 0.6 / 3.6 -> all
// three section bands exercised, overall 2.0 -> 'average' final knight.
const PLAN = [
  { key: 'archery', scores: [3, 2, 1, 2, 1], band: '1-2.9', pose: 'idle' },
  { key: 'boxing', scores: [1, 0, 1, 0, 1], band: '0-0.9', pose: 'fail' },
  { key: 'swordsmanship', scores: [4, 3, 4, 3, 4], band: '3-4', pose: 'celebrate' },
]

// Bundled chromium-1208 download is incomplete on this machine (PROGRESS M4 note); the e2e suite
// runs on the system Chrome via PW_CHANNEL=chrome — mirror that, overridable for other setups.
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await context.newPage()

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err}`))

const shot = async (name) => {
  await page.screenshot({ path: path.join(OUT, `verify-${name}.png`) })
  notes.push(`shot verify-${name}.png`)
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

// One recorded answer + its attack beat. Screenshots/side-asserts are timed inside the 700ms beat
// (flight 380 + hold 320) so they capture real choreography states.
const answer = async (index, opts = {}) => {
  await waitTargetsEnabled()
  await page.locator('.ark-target').nth(index).click()

  if (opts.ranged) {
    await page.waitForSelector('.ark-arrow', { timeout: 5000 })
    pass(`attack: projectile flying to target ${index} (ranged)`)
  }
  if (opts.melee) {
    await page.waitForSelector('.ark-target-impact', { timeout: 5000 })
    const arrows = await page.locator('.ark-arrow').count()
    if (arrows !== 0) fail(`melee attack rendered ${arrows} .ark-arrow element(s)`)
    else pass('attack: no projectile element (melee guard holds)')
  }
  if (opts.flightShot) {
    await page.waitForTimeout(110)
    await shot(opts.flightShot)
  }
  if (opts.impactShot) {
    await page.waitForSelector('.ark-target-impact', { timeout: 5000 })
    await page.waitForTimeout(430)
    await shot(opts.impactShot)
  }
  if (opts.meleeShot) {
    await page.waitForTimeout(420)
    await shot(opts.meleeShot)
  }
}

try {
  // --- title -----------------------------------------------------------------------------------
  console.log('title')
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ark-title-start', { timeout: 90000 })
  await waitImagesSettled('title')
  await assertNoPlaceholders('title')
  await shot('01-title')

  // --- intake ----------------------------------------------------------------------------------
  console.log('intake')
  await page.locator('.ark-title-start').click()
  await page.waitForSelector('.ark-intake-card', { timeout: 15000 })
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

    // Section entry — idle scene, background, knight and five targets all real art.
    await waitImagesSettled(`${section.key} q1`)
    await assertNoPlaceholders(`${section.key} q1`)

    if (s === 0) {
      await shot('03-archery-q1') // bare banner text over the sky — the readability worst case
      await page.locator('.ark-target').nth(3).hover()
      await page.waitForSelector('.ark-bubble', { timeout: 5000 })
      pass('hover shows the speech bubble')
      await shot('03b-archery-q1-hover')
    } else if (s === 1) {
      await shot('07-boxing-q1')
    } else {
      await shot('10-sword-q1')
    }

    for (let q = 0; q < section.scores.length; q += 1) {
      const index = section.scores[q]
      const opts = {}
      if (s === 0 && q === 0) Object.assign(opts, { ranged: true, flightShot: '04-archery-flight' })
      if (s === 0 && q === 1) Object.assign(opts, { impactShot: '05-archery-impact' })
      if (s === 1 && q === 0) Object.assign(opts, { melee: true, meleeShot: '08-boxing-attack' })
      if (s === 2 && q === 0) Object.assign(opts, { melee: true, meleeShot: '11-sword-attack' })

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
    const beatLoaded = await page
      .locator('img.ark-section-anim-slot')
      .evaluate((img) => img.complete && img.naturalWidth > 0)
      .catch(() => false)
    if (!beatLoaded) fail(`${section.key} end: beat asset did not load`)
    else pass(`${section.key} end: beat strip loaded`)
    notes.push(`${section.key} copy: "${copy}"`)
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
  console.log(`\nVERIFICATION FAILED — ${failures} problem(s)`)
  process.exit(1)
}
console.log('\nIN-GAME VERIFICATION PASSED')
