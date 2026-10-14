import { test, expect } from '@playwright/test'

/**
 * Audio (M13, QODER.md §3.7). The suite drives real browsers (navigator.webdriver === true), so
 * the engine defaults to muted unless a test explicitly opts in via the `ark:muted` storage
 * seed — the muted path is the default under test, and these specs cover the paths that matter:
 * persistence, degradation, and a clean console with sound on.
 */

const AUDIO_URL = /\/audio\/[^/]+\.wav$/

/** Seed an unmuted engine before any app script runs. */
async function soundOn(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('ark:muted', '0')
  })
}

function trackAudio(page: import('@playwright/test').Page) {
  const requested = new Set<string>()
  page.on('request', (request) => {
    const match = AUDIO_URL.exec(request.url())
    if (match) requested.add(match[0])
  })
  return requested
}

function trackConsoleErrors(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  return errors
}

async function beginRun(page: import('@playwright/test').Page, knightName: string) {
  await page.getByRole('button', { name: 'Begin training' }).click()
  await page.getByLabel('Knight name').fill(knightName)
  await page.getByLabel('Company').fill('Soundcastle Ltd')
  await page.getByRole('button', { name: 'Enter the training grounds' }).click()
  await expect(page.getByText('Question 1 of 5 · Section 1 of 3')).toBeVisible()
}

test.describe('Audio — the shared sound set (§3.7)', () => {
  test('the sound toggle is keyboard-reachable on the scene and its state persists across a reload', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000/default')

    // Under automation the engine starts muted (the suite's silent default).
    const toggle = page.getByRole('button', { name: 'Unmute sound' })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // Tab order on the title: heading → Begin training → the sound toggle.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Begin training' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(toggle).toBeFocused()

    // Unmute → label flips → survives a reload.
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Mute sound' })).toHaveAttribute('aria-pressed', 'false')

    // And re-muting persists just the same.
    await page.getByRole('button', { name: 'Mute sound' }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Unmute sound' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a corrupted sound file degrades to silence: the question still advances, no console errors', async ({
    page,
  }) => {
    await soundOn(page)
    const requested = trackAudio(page)
    const consoleErrors = trackConsoleErrors(page)

    // The archery bow-release is deliberately undecodable garbage.
    await page.route('**/audio/attack-archery.wav', async (route) => {
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: 'this is not a wave file' })
    })

    await page.goto('http://localhost:3000/default')
    await beginRun(page, 'Sir Static')

    const options = page.getByRole('group', { name: 'Answer options' }).getByRole('button')
    await options.first().click()

    // The machine advances exactly as it would with a healthy file — the 700ms choreography
    // timer owns the advance, audio never does (ADR 0003 + §3.7 degradation).
    await expect(page.getByText('Question 2 of 5 · Section 1 of 3')).toBeVisible()
    expect(requested.has('/audio/attack-archery.wav')).toBe(true)
    expect(consoleErrors).toEqual([])
  })

  test('a failed report generation plays the error cue and the results screen stays intact', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await soundOn(page)
    const requested = trackAudio(page)
    await page.route('**/api/submissions/runs/*/report', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'nope' }) })
    })

    // Reduced motion collapses the attack beat so the 15-question march stays well inside the
    // timeout; the error cue under test is unaffected by motion settings.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/default')
    await beginRun(page, 'Sir Scribeless')
    for (let question = 1; question <= 5; question += 1) {
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
    }
    await page.getByRole('button', { name: 'Next training ground' }).click()
    for (let question = 1; question <= 5; question += 1) {
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
    }
    await page.getByRole('button', { name: 'Next training ground' }).click()
    for (let question = 1; question <= 5; question += 1) {
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
    }
    await page.getByRole('button', { name: 'See the final reckoning' }).click()

    await expect(page.getByText('The report could not be written yet.')).toBeVisible()
    expect(requested.has('/audio/ui-error.wav')).toBe(true)
  })

  test('sound on: the same set loads in default, electric and default16 with zero console errors', async ({
    browser,
  }) => {
    const perMode = new Map<string, Set<string>>()
    const consoleErrors: string[] = []

    // A fresh context per mode: Chrome serves repeat media-element loads from a per-context
    // cache with no network traffic, so watching one page across navigations would miss the
    // music beds on the later modes. Fresh contexts observe every request honestly.
    for (const [i, mode] of ['default', 'electric', 'default16'].entries()) {
      const context = await browser.newContext()
      const page = await context.newPage()
      await soundOn(page)
      const requested = trackAudio(page)
      const contextErrors = trackConsoleErrors(page)
      try {
        await page.goto(`http://localhost:3000/${mode}`)
        await beginRun(page, `Sir Crossmode ${i}`)
        await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
        await expect(page.getByText('Question 2 of 5 · Section 1 of 3')).toBeVisible()
        perMode.set(mode, requested)
        consoleErrors.push(...contextErrors)
      } finally {
        await context.close()
      }
    }

    // Every mode answers question 1 with the archery attack + impact and hears the title and
    // gameplay beds — identical URL sets prove the one-shared-set contract.
    for (const mode of ['default', 'electric', 'default16']) {
      const set = perMode.get(mode) ?? new Set<string>()
      for (const expected of [
        '/audio/music-title.wav',
        '/audio/music-gameplay.wav',
        '/audio/attack-archery.wav',
        '/audio/impact.wav',
      ]) {
        expect(set.has(expected), `${mode} should request ${expected}`).toBe(true)
      }
    }
    expect([...perMode.get('default') ?? []].sort()).toEqual([...(perMode.get('electric') ?? [])].sort())
    expect([...perMode.get('default') ?? []].sort()).toEqual([...(perMode.get('default16') ?? [])].sort())
    expect(consoleErrors).toEqual([])
  })

  test('a full default playthrough fires every cue in the set at its moment', async ({ page }) => {
    test.setTimeout(120_000)
    await soundOn(page)
    const requested = trackAudio(page)
    const consoleErrors = trackConsoleErrors(page)

    await page.goto('http://localhost:3000/default')
    await beginRun(page, 'Sir Cuecheck')

    // Section 1 → score 4 (band 3-4), section 2 → score 2 (band 1-2.9), section 3 → score 0
    // (band 0-0.9) — the full choreography plays out (no reduced motion) so every attack and
    // impact cue has its beat.
    const optionIndex = [4, 2, 0]
    for (let question = 1; question <= 15; question += 1) {
      const section = Math.floor((question - 1) / 5)
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').nth(optionIndex[section]).click()
      if (question % 5 === 0 && question < 15) {
        await page.getByRole('button', { name: 'Next training ground' }).click()
      }
    }
    await page.getByRole('button', { name: 'See the final reckoning' }).click()
    await expect(page.getByRole('heading', { level: 2 })).toContainText('The training is complete, Sir Cuecheck')

    const expected = [
      'music-title',
      'music-gameplay',
      'music-results',
      'attack-archery',
      'attack-boxing',
      'attack-swordsmanship',
      'impact',
      'sting-high',
      'sting-mid',
      'sting-low',
      'results-reveal',
      'ui-hover',
      'ui-select',
    ]
    for (const cue of expected) {
      expect(requested.has(`/audio/${cue}.wav`), `cue ${cue} should have fired`).toBe(true)
    }
    // The generic attack fallback is only fetched when a section cue is missing (never, in the
    // shipped set) and ui-error only fires on a surfaced failure (none in a clean run).
    expect(requested.has('/audio/attack-generic.wav')).toBe(false)
    expect(requested.has('/audio/ui-error.wav')).toBe(false)
    expect(consoleErrors).toEqual([])
  })
})
