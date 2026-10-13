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
    await expect(page.getByText('Section 1 of 3 · Question 1 of 5')).toBeVisible()

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

    // ...and after the beat the machine advances to question 2 without a reload.
    await expect(page.getByText('Section 1 of 3 · Question 2 of 5')).toBeVisible()
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
})
