/**
 * M14 1:1 un-smeared proof for default16 — after the lossless-WebP re-encode, pixel edges must
 * survive delivery EXACTLY as the source PNGs have them. The mechanical half (bit-exact
 * ensureAlpha().raw() round-trip per file) lives in wire-art.ts; this is the eyeball half:
 * clip screenshots of the rendered knight + targets at deviceScaleFactor 1 (one device pixel
 * per source pixel inside the clip) so a smeared/interpolated decode would be visible.
 *
 * Dev server must be up. Output: docs/modes-proof/default16-1to1-<name>.png
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const BASE = process.env.VERIFY_URL ?? 'http://localhost:3000'
const OUT = path.resolve(process.cwd(), 'docs/modes-proof')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome' })
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const page = await context.newPage()
await page.goto(`${BASE}/default16`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.ark-title-scene', { timeout: 60000 })
await page.locator('.ark-title-start').click()
await page.waitForSelector('.ark-intake-card', { timeout: 15000 })
const inputs = page.locator('.ark-field input')
await inputs.nth(0).fill('Pixel Knight')
await inputs.nth(1).fill('Sixteen Industries')
await page.locator('.ark-intake-card button[type=submit]').click()
await page.waitForSelector('.ark-question-scene', { timeout: 30000 })
await page.waitForFunction(
  () => {
    const el = document.querySelector('.ark-progress')
    return !!el && (el.textContent ?? '').includes('Question 1 of 5')
  },
  undefined,
  { timeout: 30000 },
)
await page.waitForFunction(
  () => document.images.length > 0 && Array.from(document.images).every((img) => img.complete),
  undefined,
  { timeout: 30000 },
)

const clipOf = async (selector, name) => {
  const loc = page.locator(selector).first()
  await loc.waitFor({ state: 'visible', timeout: 10000 })
  const box = await loc.boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  await page.screenshot({ path: path.join(OUT, `default16-1to1-${name}.png`), clip: box })
  console.log(`default16-1to1-${name}.png — ${Math.round(box.width)}x${Math.round(box.height)} @1x`)
}

await clipOf('.ark-knight-scene', 'knight')
await clipOf('.ark-target', 'target')
await context.close()
await browser.close()
console.log('captured')
