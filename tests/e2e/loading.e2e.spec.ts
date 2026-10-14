import { expect, test, type Page } from '@playwright/test'

/**
 * M14 — asset weight and the loading screen (QODER.md §3.8):
 *
 * - the loading gate shows while there is anything to wait for, tracks real request completions
 *   (aria progressbar value) and contains no game asset (pure CSS/SVG only);
 * - a stalled asset still lets the game start (the gate timeout, test-overridden);
 * - on a throttled connection no scene becomes interactive with unloaded art (the no-pop-in
 *   claim — localhost proves nothing, so this spec throttles);
 * - the report wait shows the indeterminate spinner on the status line, upgrades the words after
 *   a few seconds, and resolves cleanly on the fallback path;
 * - media and audio responses carry the M14(b) cache headers.
 *
 * All of it runs against the dead QWEN endpoint (fallback report path) like the rest of the suite.
 * The gate observations throttle the link first: on an unthrottled localhost the blocking set
 * finishes before the run-resume fetch, and the gate legitimately never appears — nothing waited.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

/**
 * Deterministic slow-link stand-in: every media response lands after `ms`. Route-level delay
 * beats CDP throttling for these assertions — it cannot silently no-op, and per-request latency
 * is exactly what the loading gate and the prefetch exist to cover.
 */
async function delayMedia(page: Page, ms: number) {
  await page.route('**/api/media/file/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await route.continue()
  })
}

/** Assert every rendered image is complete — the machine-readable "nothing popped" check. */
async function expectAllImagesSettled(page: Page, where: string) {
  await page.waitForFunction(
    () => document.images.length > 0 && Array.from(document.images).every((img) => img.complete),
    undefined,
    { timeout: 30000 },
  )
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src),
  )
  expect(broken, `${where}: broken images`).toEqual([])
}

/** Answer all five questions of the current section; the beat auto-advances after each click. */
async function answerSection(page: Page) {
  for (let q = 1; q <= 5; q += 1) {
    await page.waitForFunction(() => {
      const first = document.querySelector<HTMLButtonElement>('.ark-target')
      return !!first && !first.disabled
    }, undefined, { timeout: 30000 })
    await page.locator('.ark-target').nth(2).click()
    if (q < 5) {
      await page.waitForFunction(
        (next) => {
          const el = document.querySelector('.ark-progress')
          return !!el && (el.textContent ?? '').includes(`Question ${next} of 5`)
        },
        q + 1,
        { timeout: 30000 },
      )
    }
  }
}

/** Title → intake → full 15-question run to the results scene. */
async function playThroughToResults(page: Page, knightName: string, company: string) {
  await page.waitForSelector('.ark-title-scene', { timeout: 60000 })
  await page.locator('.ark-title-start').click()
  await page.waitForSelector('.ark-intake-card')
  const inputs = page.locator('.ark-field input')
  await inputs.nth(0).fill(knightName)
  await inputs.nth(1).fill(company)
  await page.locator('.ark-intake-card button[type=submit]').click()
  for (let section = 1; section <= 3; section += 1) {
    await answerSection(page)
    // Every section ends on the band screen; "See the final reckoning" opens results from the last.
    await page.waitForSelector('.ark-section-end-scene', { timeout: 30000 })
    await page.locator('.ark-section-end-scene .ark-btn--primary').click()
  }
  await page.waitForSelector('.ark-results-scene', { timeout: 30000 })
}

test.describe('M14 loading screen', () => {
  test('the loading gate shows while there is anything to wait for, then hands over', async ({
    page,
  }) => {
    test.setTimeout(90000)
    await delayMedia(page, 3000)
    await page.goto(`${BASE}/default`)
    const bar = page.locator('.ark-loading-bar')
    await expect(bar).toBeVisible({ timeout: 30000 })
    await expect(page.locator('#ark-loading-heading')).toBeVisible()
    const total = Number(await bar.getAttribute('aria-valuemax'))
    expect(total).toBeGreaterThan(0)
    // Mid-flight: the bar mounts at 0 (honest), then with 3s per-request latency and a ~10-URL
    // blocking set it must be observable at a partial value — proof it tracks real completions,
    // not a timed fake bar that jumps straight to full.
    await page.waitForFunction(
      (max) => {
        const el = document.querySelector('.ark-loading-bar')
        const now = el ? Number(el.getAttribute('aria-valuenow')) : -1
        return now > 0 && now < max
      },
      total,
      { timeout: 15000 },
    )
    // The bar reaches the max only when every URL has settled. Tolerant predicate: once the gate
    // opens, the loading scene unmounts and the bar element disappears — a missing bar IS the
    // "all done" signal, not a failure to reach it.
    await page.waitForFunction(
      (max) => {
        const el = document.querySelector('.ark-loading-bar')
        return !el || Number(el.getAttribute('aria-valuenow')) >= max
      },
      total,
      { timeout: 60000 },
    )
    // The loading screen cannot wait on the thing it is loading — no game asset inside it.
    const loadingMediaImgs = await page.locator('.ark-loading-scene img[src*="/api/media/"]').count()
    expect(loadingMediaImgs).toBe(0)
    await page.waitForSelector('.ark-title-scene', { timeout: 30000 })
    await expectAllImagesSettled(page, 'title after the gate')
  })

  test('a stalled asset still lets the game start (gate timeout)', async ({ page }) => {
    // Stall every media request (never settle), and shrink the gate timeout so the test stays
    // fast. The game must open anyway — §3.8: a loading screen that can trap a player is worse
    // than none. (Untrottled: the gate would legitimately flash past, so no throttle here.)
    await page.addInitScript(() => {
      ;(window as { __ARK_ASSET_TIMEOUT_MS__?: number }).__ARK_ASSET_TIMEOUT_MS__ = 1500
    })
    await page.route('**/api/media/file/**', () => {
      // Hold every request open until the test tears the page down.
    })
    await page.goto(`${BASE}/default`)
    await page.waitForSelector('.ark-title-scene', { timeout: 30000 })
    await expect(page.locator('.ark-title-start')).toBeVisible()
    await page.unrouteAll({ behavior: 'ignoreErrors' })
  })

  test('no pop-in on a throttled playthrough — every scene is interactive fully loaded', async ({
    page,
  }) => {
    test.setTimeout(240000)
    await delayMedia(page, 800)
    await page.goto(`${BASE}/default`)
    await page.waitForSelector('.ark-title-scene', { timeout: 90000 })
    await expectAllImagesSettled(page, 'title')

    await page.locator('.ark-title-start').click()
    await page.waitForSelector('.ark-intake-card')
    const inputs = page.locator('.ark-field input')
    await inputs.nth(0).fill('Sir Throttle')
    await inputs.nth(1).fill('Slow Link Ltd')
    await page.locator('.ark-intake-card button[type=submit]').click()

    // The no-pop-in claim: the moment a scene's targets are enabled, its art must already be
    // complete (mid-throttle the section-1 prefetch had the whole section to work with).
    for (let section = 1; section <= 3; section += 1) {
      await page.waitForFunction(
        (s) => {
          const el = document.querySelector('.ark-progress')
          const first = document.querySelector<HTMLButtonElement>('.ark-target')
          return (
            !!el &&
            (el.textContent ?? '').includes(`Section ${s} of 3`) &&
            !!first &&
            !first.disabled
          )
        },
        section,
        { timeout: 30000 },
      )
      await expectAllImagesSettled(page, `section ${section} question 1`)
      await answerSection(page)
      if (section < 3) {
        await page.waitForSelector('.ark-section-end-scene', { timeout: 30000 })
        await expectAllImagesSettled(page, `section ${section} end`)
        await page.locator('.ark-section-end-scene .ark-btn--primary').click()
      }
    }
  })

  test('report wait: spinner on the status line, long-wait words, fallback resolves', async ({
    page,
  }) => {
    test.setTimeout(120000)
    // Hold the report response ~9s — inside the realistic live-endpoint 6–9s window — so the
    // spinner and the long-wait word swap are deterministic (against the dead endpoint the
    // fallback would otherwise land in ~1s, before an assertion could poll).
    await page.route('**/api/submissions/runs/*/report', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 9000))
      await route.continue()
    })
    await page.goto(`${BASE}/default`)
    await playThroughToResults(page, 'Sir Report', 'Fallback Industries')

    const status = page.locator('.ark-results-report-status')
    // Beat 1 — the indeterminate spinner sits beside the existing words while the wait is young.
    await expect(page.locator('.ark-spinner')).toBeVisible({ timeout: 15000 })
    await expect(status).toContainText('scribe is writing', { timeout: 15000 })
    // Beat 2 — after a few seconds the wait needs MORE words, not just motion (M14).
    await expect(status).toContainText('can take up to 25 seconds', { timeout: 15000 })
    // Beat 3 — the held response resolves; spinner goes, the fallback words land.
    await expect(status).toContainText('offline', { timeout: 30000 })
    await expect(page.locator('.ark-spinner')).toHaveCount(0)
  })

  test('M14(b) cache headers: media immutable, audio long-lived', async ({ page }) => {
    const listRes = await page.request.get(`${BASE}/api/media?limit=1&depth=0`)
    const doc = (await listRes.json()).docs[0]
    const mediaRes = await page.request.get(`${BASE}${doc.url}`)
    expect(mediaRes.headers()['cache-control']).toContain('immutable')
    const audioRes = await page.request.get(`${BASE}/audio/music-title.wav`)
    expect(audioRes.headers()['cache-control']).toContain('max-age=86400')
  })
})
