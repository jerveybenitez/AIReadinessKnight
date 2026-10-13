import { test, expect } from '@playwright/test'

test.describe('Frontend — game shell', () => {
  test('the homepage redirects to /default and the title scene renders', async ({ page }) => {
    await page.goto('http://localhost:3000/')

    await expect(page).toHaveURL(/\/default$/)
    await expect(page).toHaveTitle(/Default — AI-Ready Knight/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Default')
    await expect(page.getByRole('button', { name: 'Begin training' })).toBeVisible()
  })

  test('intake creates a run and reaches the first question, keyword-playable', async ({ page }) => {
    await page.goto('http://localhost:3000/default')

    await page.getByRole('button', { name: 'Begin training' }).click()

    await page.getByLabel('Knight name').fill('Sir Playwright')
    await page.getByLabel('Company').fill('Test Castle Inc')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    await expect(page.getByRole('heading', { level: 2 })).toContainText('Q1. Is AI a strategic priority')
    await expect(page.getByText('Question 1 of 5 · Section 1 of 3')).toBeVisible()

    const options = page.getByRole('group', { name: 'Answer options' }).getByRole('button')
    await expect(options).toHaveCount(5)

    // Keyboard: focus the first option, arrow to the second, Enter selects it.
    await options.first().focus()
    await page.keyboard.press('ArrowRight')
    const secondOption = options.nth(1)
    await expect(secondOption).toBeFocused()
    await page.keyboard.press('Enter')

    // The answer lands server-side (button lock + selected state)...
    await expect(secondOption).toHaveAttribute('aria-pressed', 'true')

    // ...and after the attack beat the machine advances to question 2 without a reload.
    await expect(page.getByText('Question 2 of 5 · Section 1 of 3')).toBeVisible()
  })

  test('reduced motion: the section stays playable without the attack beat', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/default')

    await page.getByRole('button', { name: 'Begin training' }).click()
    await page.getByLabel('Knight name').fill('Sir Reduced')
    await page.getByLabel('Company').fill('Motion Sickness Ltd')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    await expect(page.getByRole('heading', { level: 2 })).toContainText('Q1.')
    await page.getByRole('button', { name: 'AI is not on our agenda yet' }).click()

    // The attack choreography is skipped entirely; the machine advances on the recorded answer.
    await expect(page.getByText('Question 2 of 5 · Section 1 of 3')).toBeVisible()
  })

  test('section end fires the band animation for the finished section', async ({ page }) => {
    await page.goto('http://localhost:3000/default')

    await page.getByRole('button', { name: 'Begin training' }).click()
    await page.getByLabel('Knight name').fill('Sir Band')
    await page.getByLabel('Company').fill('Low Score Ltd')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    // Answer all five archery questions with the first option (score 0 each) → mean 0 → band 0-0.9.
    for (let question = 1; question <= 5; question += 1) {
      await expect(page.getByText(`Question ${question} of 5 · Section 1 of 3`)).toBeVisible()
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
    }

    await expect(page.getByRole('heading', { level: 2 })).toContainText('training complete')
    await expect(page.getByText('arrow completely misses the target, the knight cries')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next training ground' })).toBeVisible()
  })

  test('an unknown mode is a 404', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/nonsense')
    expect(response?.status()).toBe(404)
  })

  test('a portrait viewport shows rotate-to-play instead of the stage', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1200 })
    await page.goto('http://localhost:3000/default')

    await expect(page.getByText('Rotate your device to play.')).toBeVisible()
    await expect(page.locator('.ark-stage')).toBeHidden()
  })

  test('a full playthrough scores correctly, writes the report once, and the permalink reopens the result in a fresh browser', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000)

    // Every POST to the report endpoint — the cache contract says exactly one per run, and the
    // fresh permalink context below must contribute zero (it reads the cached report).
    const reportPosts: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/runs\/[^/]+\/report$/.test(request.url())) {
        reportPosts.push(request.url())
      }
    })

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/default')

    await page.getByRole('button', { name: 'Begin training' }).click()
    await page.getByLabel('Knight name').fill('Sir Scoresalot')
    await page.getByLabel('Company').fill('Bandcastle Ltd')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    // Section 1 → last option (score 4, mean 4 → band 3-4); section 2 → middle option (score 2,
    // mean 2 → band 1-2.9); section 3 → first option (score 0, mean 0 → band 0-0.9).
    const optionIndex = [4, 2, 0]
    for (let question = 1; question <= 15; question += 1) {
      const section = Math.floor((question - 1) / 5)
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').nth(optionIndex[section]).click()
      if (question % 5 === 0 && question < 15) {
        await page.getByRole('button', { name: 'Next training ground' }).click()
      }
    }
    await page.getByRole('button', { name: 'See the final reckoning' }).click()

    // 15 scores: 5×4 + 5×2 + 5×0 → overall mean 2.0 → final band 'average'.
    await expect(page.getByRole('heading', { level: 2 })).toContainText('The training is complete, Sir Scoresalot')
    await expect(page.getByText('Overall score: 2.0 / 4 · Average')).toBeVisible()

    const archery = page.getByRole('listitem').filter({ hasText: 'AI Use-Case' })
    await expect(archery).toContainText('4.0 / 4')
    await expect(archery).toContainText('3-4')

    const boxing = page.getByRole('listitem').filter({ hasText: 'AI Talent' })
    await expect(boxing).toContainText('2.0 / 4')
    await expect(boxing).toContainText('1-2.9')

    const swordsmanship = page.getByRole('listitem').filter({ hasText: 'AI Execution' })
    await expect(swordsmanship).toContainText('0.0 / 4')
    await expect(swordsmanship).toContainText('0-0.9')

    // The permalink is the access token — reopen it in a context with no storage at all.
    const permalink = page.locator('.ark-results-permalink-text')
    await expect(permalink).toContainText('http://localhost:3000/result/')
    const url = ((await permalink.textContent()) ?? '').trim()

    // The copy button puts the absolute URL on the clipboard.
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(url)

    // The report generates in the background on results mount (QWEN or template fallback —
    // both are complete reports). Open it and check the contract: structured content, a
    // provenance line, and exactly one generation for the run.
    await page.getByRole('button', { name: 'Read the full report' }).click()
    await expect(page.getByRole('heading', { name: 'Readiness report' })).toBeVisible()
    const headline = page.locator('.ark-report-headline')
    await expect(headline).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('.ark-report-provenance')).toHaveText(
      /Written by QWEN from your answers\.|Written from your scores — the AI scribe was offline\./,
    )
    // The schema guarantees 3–5 prioritised steps; the count itself is copy, not contract.
    expect(await page.locator('.ark-report-steps li').count()).toBeGreaterThanOrEqual(3)
    expect(reportPosts).toHaveLength(1)
    const headlineText = ((await headline.textContent()) ?? '').trim()

    // Back to the scores view — same scene, both views reachable.
    await page.getByRole('button', { name: '← Back to scores' }).click()
    await expect(page.getByRole('heading', { name: 'The training is complete, Sir Scoresalot' })).toBeVisible()

    const fresh = await browser.newContext()
    const freshPage = await fresh.newPage()
    const freshReportPosts: string[] = []
    freshPage.on('request', (request) => {
      if (request.method() === 'POST' && /\/runs\/[^/]+\/report$/.test(request.url())) {
        freshReportPosts.push(request.url())
      }
    })
    await freshPage.goto(url)

    await expect(freshPage.getByRole('heading', { level: 2 })).toContainText('The training is complete, Sir Scoresalot')
    await expect(freshPage.getByText('Overall score: 2.0 / 4 · Average')).toBeVisible()
    await expect(freshPage.getByRole('listitem').filter({ hasText: 'AI Talent' })).toContainText('1-2.9')
    await expect(freshPage.getByRole('listitem').filter({ hasText: 'AI Use-Case' })).toContainText('3-4')

    // The cached report reopens identically — and costs nothing: no new generation request.
    await freshPage.getByRole('button', { name: 'Read the full report' }).click()
    await expect(freshPage.locator('.ark-report-headline')).toHaveText(headlineText)
    expect(freshReportPosts).toHaveLength(0)
    await fresh.close()
  })

  test('an unfinished run sent to /result/<runId> redirects into the game and resumes at the frontier', async ({
    page,
    browser,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/default')

    await page.getByRole('button', { name: 'Begin training' }).click()
    await page.getByLabel('Knight name').fill('Sir Halfway')
    await page.getByLabel('Company').fill('Midrun Ltd')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    for (let question = 1; question <= 3; question += 1) {
      await page.getByRole('group', { name: 'Answer options' }).getByRole('button').first().click()
    }
    await expect(page.getByText('Question 4 of 5 · Section 1 of 3')).toBeVisible()

    const runId = await page.evaluate(() => window.sessionStorage.getItem('ark:run:default'))
    expect(runId).toBeTruthy()

    // A fresh browser knows nothing about this run — the URL alone must carry it into the game.
    const fresh = await browser.newContext()
    const freshPage = await fresh.newPage()
    await freshPage.goto(`http://localhost:3000/result/${runId}`)

    await expect(freshPage).toHaveURL(new RegExp(`/default\\?run=${runId as string}$`))
    await expect(freshPage.getByText('Question 4 of 5 · Section 1 of 3')).toBeVisible()
    await fresh.close()
  })

  test('keyboard only: Tab, arrows and Enter carry a full playthrough all the way to the report', async ({ page }) => {
    test.setTimeout(120_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('http://localhost:3000/default')

    // Title: the shell lands focus on the heading; one Tab reaches the only control.
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Begin training' })).toBeFocused()
    await page.keyboard.press('Enter')

    // Intake: heading focused, then Tab walks the fields; everything is typed, nothing is clicked.
    await expect(page.getByRole('heading', { name: 'Knight intake' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Knight name')).toBeFocused()
    await page.keyboard.type('Sir Keyboard')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Company')).toBeFocused()
    await page.keyboard.type('Tabcastle Ltd')
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Industry (optional)')).toBeFocused()
    await page.keyboard.type('Software')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Enter the training grounds' })).toBeFocused()
    await page.keyboard.press('Enter')

    // 15 questions, all answered with the first option (score 0 → every band 0-0.9, final mean 0.0).
    // Per question: the shell focuses the new heading, the first arrow lands the row on option 1,
    // Enter selects it.
    const options = page.getByRole('group', { name: 'Answer options' }).getByRole('button')
    for (let question = 1; question <= 15; question += 1) {
      const inSection = ((question - 1) % 5) + 1
      const sectionNumber = Math.floor((question - 1) / 5) + 1
      const heading = page.getByRole('heading', { level: 2 })

      await expect(heading).toContainText(`Q${inSection}.`)
      await expect(page.getByText(`Question ${inSection} of 5 · Section ${sectionNumber} of 3`)).toBeVisible()
      await expect(heading).toBeFocused()

      await page.keyboard.press('ArrowRight')
      await expect(options.first()).toBeFocused()
      await page.keyboard.press('Enter')

      if (question === 5 || question === 10) {
        await expect(heading).toContainText('training complete')
        await expect(heading).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(page.getByRole('button', { name: 'Next training ground' })).toBeFocused()
        await page.keyboard.press('Enter')
      }
    }

    // The last section-end beat leads into the reckoning.
    const sectionEndHeading = page.getByRole('heading', { level: 2 })
    await expect(sectionEndHeading).toContainText('training complete')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'See the final reckoning' })).toBeFocused()
    await page.keyboard.press('Enter')

    const resultsHeading = page.getByRole('heading', { level: 2 })
    await expect(resultsHeading).toContainText('The training is complete, Sir Keyboard')
    await expect(resultsHeading).toBeFocused()
    await expect(page.getByText('Overall score: 0.0 / 4 · Low average')).toBeVisible()

    // The report opens from the keyboard too (offline fallback wording is expected — the suite
    // runs against a dead endpoint by design).
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Read the full report' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Readiness report' })).toBeVisible()
    await expect(page.locator('.ark-report-provenance')).toHaveText(
      /Written by QWEN from your answers\.|Written from your scores — the AI scribe was offline\./,
      { timeout: 45_000 },
    )
  })

  test('an answer that fails to save raises an alert, leaves the run in place, and can be retried', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    const answerUrl = '**/api/submissions/runs/*/answer'
    await page.route(answerUrl, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'The scribe lost the scrolls (test).' }),
      })
    })

    await page.goto('http://localhost:3000/default')
    await page.getByRole('button', { name: 'Begin training' }).click()
    await page.getByLabel('Knight name').fill('Sir Retry')
    await page.getByLabel('Company').fill('Flaky Keep Ltd')
    await page.getByRole('button', { name: 'Enter the training grounds' }).click()

    await expect(page.getByText('Question 1 of 5 · Section 1 of 3')).toBeVisible()
    const options = page.getByRole('group', { name: 'Answer options' }).getByRole('button')
    await options.nth(2).click()

    // The failure is announced, the machine stays on the question, nothing is marked chosen.
    // (Filtered by content: Next's route announcer is also a role="alert" element on the page.)
    const alert = page.getByRole('alert').filter({ hasText: 'The scribe lost the scrolls' })
    await expect(alert).toHaveText('The scribe lost the scrolls (test).')
    await expect(page.getByText('Question 1 of 5 · Section 1 of 3')).toBeVisible()
    await expect(options.nth(2)).not.toHaveAttribute('aria-pressed', 'true')

    // With the fault removed, the same answer goes through and the run advances normally.
    // (Under reduced motion the advance is immediate, so the pressed state itself is transient —
    // the observable contract here is that question 2 arrives and the alert clears.)
    await page.unroute(answerUrl)
    await options.nth(2).click()
    await expect(page.getByText('Question 2 of 5 · Section 1 of 3')).toBeVisible()
    await expect(alert).toHaveCount(0)
  })

  test('an unreachable server while restoring a run shows the recovery screen, and Try again recovers', async ({ page }) => {
    const runUrl = '**/api/submissions/runs/*'
    await page.route(runUrl, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'The keep is unreachable (test).' }),
      })
    })

    await page.goto('http://localhost:3000/default?run=missing-run')

    // The recovery scene is a real scene: its heading takes focus and both ways out are present.
    const heading = page.getByRole('heading', { name: 'Your session could not be restored' })
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
    await expect(page.getByText('The keep is unreachable (test).')).toBeVisible()

    // Once the server answers again, Try again resolves the dead pointer to a fresh title screen.
    await page.unroute(runUrl)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Begin training' })).toBeVisible()
  })

  test('an unknown /result/<runId> is a 404', async ({ page }) => {
    const response = await page.goto('http://localhost:3000/result/definitely-not-a-run')

    expect(response?.status()).toBe(404)
    await expect(page.locator('body')).toContainText(/404|could not be found/i)
    await expect(page.locator('.ark-stage')).toHaveCount(0)
  })
})
