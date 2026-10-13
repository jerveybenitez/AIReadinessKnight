// M9 — the re-skin proof, driven through the real /admin UI (that is the point of the milestone:
// a non-technical operator must be able to ship a new mode without touching code).
//
// Phase 1: duplicate `default` (three-dot menu → Duplicate), rename the copy to Electric with the
// electric accent, upload exactly ONE asset (archery target idle), save. From this moment the mode
// is fully playable at /electric — uploaded slots render their upload, everything else falls back
// to `default` (verified by scripts/art/verify-electric.mjs, not by this script).
//
// Phase 2: return to the mode and upload the rest of the partial set (target hit + hit effect).
//
// Every step screenshots into docs/modes-proof/ — the deliverable's evidence trail.
//
// Usage (dev server must be running; admin credentials are the local-dev pair):
//   node scripts/re-skin-proof.mjs phase1
//   node scripts/re-skin-proof.mjs phase2
//   node scripts/re-skin-proof.mjs clean    (removes the electric mode + its uploads, for a rerun)

import { chromium } from '@playwright/test'
import { mkdirSync, existsSync, unlinkSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.ARK_BASE ?? 'http://localhost:3000'
const EMAIL = 'admin@ai-ready-knight.local'
const PASSWORD = 'AirKnight!2026'
const SLUG = 'electric'
const SHOTS = path.join(process.cwd(), 'docs', 'modes-proof')
const ART = path.join(process.cwd(), 'art', 'electric', 'archery')

const phase = process.argv[2]
if (!['phase1', 'phase2', 'clean'].includes(phase)) {
  console.error('usage: node scripts/re-skin-proof.mjs phase1|phase2|clean')
  process.exit(1)
}

mkdirSync(SHOTS, { recursive: true })
// phase 2 is a separate invocation but continues the same evidence trail: its first shot is 07.
let shotN = phase === 'phase2' ? 6 : 0
const shot = async (page, name) => {
  shotN += 1
  const file = path.join(SHOTS, `${String(shotN).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  [shot] ${path.relative(process.cwd(), file)}`)
}

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('  [browser console.error]', msg.text().slice(0, 200))
})

// --- login -------------------------------------------------------------------------------------
await page.goto(`${BASE}/admin/login`)
await page.fill('#field-email', EMAIL)
await page.fill('#field-password', PASSWORD)
await page.click('button[type="submit"]')
await page.waitForSelector('span[title="Dashboard"]', { timeout: 30000 })
console.log('logged in as', EMAIL)

// --- small helpers ------------------------------------------------------------------------------
// All API calls go through page.request: it shares the page's cookie jar (so it is authenticated)
// and runs in Node, where fetch failures surface as HTTP errors instead of crashing page.evaluate.
const findModeBySlug = async (slug) => {
  const res = await page.request.get(`${BASE}/api/modes?where[slug][equals]=${slug}&limit=1&depth=0`)
  if (!res.ok()) throw new Error(`GET /api/modes?slug=${slug} → HTTP ${res.status()}`)
  const data = await res.json()
  return data.docs?.[0] ?? null
}

const dismissToasts = async () => {
  await page.evaluate(() => {
    document.querySelectorAll('.payload-toast-close-button').forEach((b) => b.click())
  })
  await page.waitForTimeout(300)
}

/**
 * Save the main form and *prove* it saved: race the success toast against the error toast and
 * throw on error (the previous version waited for the substring "successfully" case-insensitively
 * and false-positived on a 400 "Value must be unique" save). `expectSlug` then re-reads the slug
 * input as a second line of defence.
 */
const saveMainForm = async (expectSlug) => {
  await dismissToasts()
  const save = page.locator('.doc-controls button').filter({ hasText: /^Save$/ })
  await save.first().click()
  const success = page.locator('.payload-toast-container .toast-success').first()
  const error = page.locator('.payload-toast-container .toast-error').first()
  const outcome = await Promise.race([
    success.waitFor({ state: 'attached', timeout: 30000 }).then(() => 'success'),
    error.waitFor({ state: 'attached', timeout: 30000 }).then(() => 'error'),
  ]).catch(() => 'timeout')
  if (outcome !== 'success') {
    const detail = outcome === 'error' ? ((await error.textContent()) ?? '').trim().slice(0, 300) : 'no toast appeared within 30s'
    await shot(page, 'save-failed')
    throw new Error(`save did not succeed (${outcome}): ${detail}`)
  }
  await page.waitForTimeout(600) // let the toast render into the next shot
  if (expectSlug) {
    const slugNow = await page.inputValue('#field-slug')
    if (slugNow !== expectSlug) {
      await shot(page, 'save-failed')
      throw new Error(`save toasted success but slug is "${slugNow}" (expected "${expectSlug}")`)
    }
  }
  console.log(`  saved (success toast confirmed${expectSlug ? `, slug "${expectSlug}"` : ''})`)
}

/** Open every section row — the operator's "expand all" click. */
const showAllSections = async () => {
  await page.waitForSelector('#field-sections button.array-field__header-action', { timeout: 30000 })
  await page.evaluate(() => {
    const header = document.querySelector('#field-sections > .array-field__header')
    const btn = [...(header?.querySelectorAll('button.array-field__header-action') ?? [])].find((b) => (b.textContent ?? '').trim() === 'Show All')
    btn?.click()
  })
  await page.waitForTimeout(900)
}

/**
 * Scroll a field into view so its lazily-rendered content mounts. The admin only mounts nested
 * fields when they come near the viewport, and an unmounted field cannot be scrolled to — so we
 * walk up the id path (`field-a__b__c` → `field-a__b` → … → `#field-sections`) and scroll the
 * nearest mounted ancestor, retrying until the field is visible.
 */
const field = async (id) => {
  const locator = page.locator(`#${id}`)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.evaluate((fid) => {
      if (document.getElementById(fid)) {
        document.getElementById(fid).scrollIntoView({ block: 'center' })
        return
      }
      const parts = fid.split('__')
      for (let n = parts.length - 1; n >= 1; n -= 1) {
        const ancestor = document.getElementById(parts.slice(0, n).join('__'))
        if (ancestor) {
          ancestor.scrollIntoView({ block: 'center' })
          return
        }
      }
      document.getElementById('field-sections')?.scrollIntoView({ block: 'start' })
    }, id)
    await page.waitForTimeout(900)
    if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) return locator
  }
  throw new Error(`field ${id} never became visible`)
}

/** Empty upload field → Create New → file + alt → drawer Save. */
const uploadTo = async (fieldId, file, alt, altName) => {
  const box = await field(fieldId)
  console.log(`uploading ${path.basename(file)} → ${fieldId}`)
  await box.getByRole('button', { name: 'Create New' }).click()
  // the media drawer renders in a portal at the end of <body>: its file input and alt field are
  // the last of their kind on the page, and the drawer's Save is the last "Save" button in DOM order
  const fileInput = page.locator('input[type="file"]').last()
  await fileInput.waitFor({ state: 'attached', timeout: 15000 })
  await fileInput.setInputFiles(file)
  await page.locator('#field-alt').last().fill(alt)
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Save', exact: true }).last().click()
  await page.locator('#field-alt').last().waitFor({ state: 'hidden', timeout: 30000 })
  // the field now shows the uploaded media instead of the dropzone
  await box.getByText(altName, { exact: false }).first().waitFor({ timeout: 20000 })
  console.log(`  ${altName} is attached to the field`)
}

// --- clean (rerun support) ----------------------------------------------------------------------
// Deletes only this script's artefacts: the mode whose slug is `electric`, and media docs that are
// either tagged "Electric re-skin —" (the alt this script writes) or carry the bare art filename
// (default-mode media are all prefixed like `archery-target.idle@2x.png`, so they can never match).
if (phase === 'clean') {
  const mode = await findModeBySlug(SLUG)
  if (mode) {
    const res = await page.request.delete(`${BASE}/api/modes/${mode.id}`)
    console.log(`deleted mode ${SLUG} (id ${mode.id}) → HTTP ${res.status()}`)
  } else {
    console.log('no electric mode present')
  }

  const BASE_NAMES = ['target.idle@2x.png', 'target.hit@2x.png', 'hitEffect@2x.png']
  const list = await page.request.get(`${BASE}/api/media?limit=100&depth=0`)
  if (!list.ok()) throw new Error(`GET /api/media → HTTP ${list.status()}`)
  const { docs } = await list.json()
  const doomed = docs.filter(
    (m) =>
      (m.alt ?? '').startsWith('Electric re-skin') ||
      BASE_NAMES.some((name) => (m.filename ?? '').startsWith(name.replace(/\.png$/, ''))),
  )
  for (const m of doomed) {
    const res = await page.request.delete(`${BASE}/api/media/${m.id}`)
    console.log(`deleted media ${m.filename} (id ${m.id}, alt "${m.alt}") → HTTP ${res.status()}`)
    const onDisk = path.join(process.cwd(), 'media', m.filename)
    if (existsSync(onDisk)) {
      unlinkSync(onDisk)
      console.log(`  removed leftover file media/${m.filename}`)
    }
  }
  if (doomed.length === 0) console.log('no electric uploads present')

  const modes = await page.request.get(`${BASE}/api/modes?limit=50&depth=0`)
  const state = (await modes.json()).docs.map((m) => `${m.slug} (id ${m.id})`)
  console.log(`modes in the database: ${state.join(', ')}`)
  await browser.close()
  process.exit(0)
}

// --- phase 1: duplicate → rename → save → upload ONE asset -------------------------------------
if (phase === 'phase1') {
  const existingElectric = await findModeBySlug(SLUG)
  if (existingElectric) {
    console.error(`mode "${SLUG}" already exists (id ${existingElectric.id}) — run clean first:`)
    console.error('  node scripts/re-skin-proof.mjs clean')
    await browser.close()
    process.exit(1)
  }

  await page.goto(`${BASE}/admin/collections/modes?limit=10`)
  await page.waitForSelector('table tbody tr', { timeout: 30000 })
  await page.waitForTimeout(1200)
  await shot(page, 'modes-list-before')

  // The list is sorted by recency, so "the first row" is not reliable — target the row whose slug
  // cell reads exactly `default` (the previous run duplicated the wrong row this way and then
  // collided on the unique slug).
  const defaultRow = page
    .locator('table tbody tr')
    .filter({ has: page.locator('td.cell-slug', { hasText: /^default$/ }) })
    .first()
  if ((await defaultRow.count()) === 0) throw new Error('no modes row with slug "default" in the list')
  const href = await defaultRow.locator('a[href*="/collections/modes/"]:not([href*="/create"])').first().getAttribute('href')
  await page.goto(`${BASE}${href}`)
  await page.waitForSelector('#field-slug', { timeout: 30000 })
  const defaultId = page.url().match(/modes\/(\d+)/)?.[1]
  const openedSlug = await page.inputValue('#field-slug')
  if (openedSlug !== 'default') throw new Error(`opened the wrong row: slug is "${openedSlug}", expected "default"`)
  console.log('opened default mode (id %s)', defaultId)
  await page.waitForTimeout(1500) // hydrate

  // three-dot → Duplicate
  await page.locator('.doc-controls .popup-button').last().click()
  const duplicate = page.locator('#action-duplicate')
  await duplicate.waitFor({ state: 'visible', timeout: 15000 })
  await duplicate.click()
  await page.waitForURL(
    (url) => {
      const m = url.toString().match(/\/collections\/modes\/(\d+)/)
      return !!m && m[1] !== defaultId
    },
    { timeout: 30000 },
  )
  await page.waitForSelector('#field-slug', { timeout: 30000 })
  const newId = page.url().match(/modes\/(\d+)/)?.[1]
  const copySlug = await page.inputValue('#field-slug')
  if (!copySlug.startsWith('default-copy')) throw new Error(`duplicate slug is "${copySlug}", expected it to start with "default-copy" (the beforeDuplicate hook)`)
  console.log('duplicate created (id %s), slug is now "%s"', newId, copySlug)
  await page.waitForTimeout(1200)
  await shot(page, 'duplicate-opened')

  // rename to the new mode
  await page.fill('#field-title', 'Electric')
  await page.fill('#field-slug', SLUG)
  await page.fill('#field-theme__accentColor', '#4dd8ff')
  await saveMainForm(SLUG)
  await shot(page, 'electric-renamed-and-saved')

  // open every section row, then upload exactly one asset
  await showAllSections()
  await field('field-sections__0__assets__target__idle')
  await shot(page, 'target-idle-empty-before-upload')

  await uploadTo('field-sections__0__assets__target__idle', path.join(ART, 'target.idle@2x.png'), 'Electric re-skin — archery target, idle', 'target.idle@2x.png')
  await shot(page, 'target-idle-uploaded')
  await saveMainForm(SLUG)
  await shot(page, 'phase1-saved')
  console.log(`phase 1 complete — mode ${SLUG} (id ${newId}) is playable at /${SLUG}`)
}

// --- phase 2: the rest of the partial set ------------------------------------------------------
if (phase === 'phase2') {
  const mode = await findModeBySlug(SLUG)
  if (!mode) {
    console.error(`no ${SLUG} mode in the database — run phase1 first`)
    process.exit(1)
  }
  await page.goto(`${BASE}/admin/collections/modes/${mode.id}`)
  await page.waitForSelector('#field-slug', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await showAllSections()

  await uploadTo('field-sections__0__assets__target__hit', path.join(ART, 'target.hit@2x.png'), 'Electric re-skin — archery target, hit', 'target.hit@2x.png')
  await shot(page, 'target-hit-uploaded')
  await uploadTo('field-sections__0__assets__hitEffect', path.join(ART, 'hitEffect@2x.png'), 'Electric re-skin — archery hit effect', 'hitEffect@2x.png')
  await shot(page, 'hit-effect-uploaded')
  await saveMainForm(SLUG)
  await shot(page, 'phase2-saved')
  console.log(`phase 2 complete — partial set for ${SLUG} uploaded and saved`)
}

await browser.close()
