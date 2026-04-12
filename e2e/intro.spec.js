import { test, expect } from '@playwright/test'

test.describe('Intro walkthrough', () => {
  test('runs the full intro via Next buttons and shows walksheds', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.addInitScript(() => {
      try { localStorage.removeItem('walksheds_intro_v1_seen') } catch {}
    })

    await page.goto('/walksheds/')
    await page.waitForSelector('.mapboxgl-canvas', { timeout: 15000 })

    const title = page.locator('.intro-title')
    const nextBtn = page.locator('.intro-btn-primary')
    const exitBtn = page.locator('.intro-btn-secondary')

    const getWalkshedLayers = () => page.evaluate(() => {
      const m = window.__mapForTest
      if (!m) return []
      return m.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('walkshed-'))
    })

    // Step 1: Welcome
    await expect(title).toHaveText('Welcome to Walksheds', { timeout: 5000 })
    await expect(exitBtn).toHaveText('Skip')
    await expect(nextBtn).toHaveText('Start tour')
    await nextBtn.click()

    // Step 2: Westlake — pill + 5-min walkshed appear
    await expect(title).toHaveText('Westlake Station', { timeout: 4000 })
    await expect(page.locator('.station-pill')).toBeVisible({ timeout: 6000 })
    await expect.poll(getWalkshedLayers, { timeout: 8000 }).toContain('walkshed-fill-light-5')
    await expect(exitBtn).toHaveText('Exit')
    await expect(nextBtn).toHaveText('Next')
    await nextBtn.click()

    // Step 3: 10 minutes
    await expect(title).toHaveText('10 minutes on foot', { timeout: 4000 })
    await expect.poll(getWalkshedLayers, { timeout: 5000 }).toContain('walkshed-fill-light-10')
    await nextBtn.click()

    // Step 4: 15 minutes
    await expect(title).toHaveText('15 minutes on foot', { timeout: 4000 })
    await expect.poll(getWalkshedLayers, { timeout: 5000 }).toContain('walkshed-fill-light-15')
    await nextBtn.click()

    // Step 5: Symphony
    await expect(title).toHaveText('Move along the line', { timeout: 4000 })
    await nextBtn.click()

    // Step 6: Back to Westlake
    await expect(title).toHaveText('Back to Westlake', { timeout: 4000 })
    await nextBtn.click()

    // Step 7: Your turn — final step, only Got it button
    await expect(title).toHaveText('Your turn', { timeout: 4000 })
    await expect(nextBtn).toHaveText('Got it')
    await expect(exitBtn).not.toBeVisible()
    await nextBtn.click()

    // Intro should be dismissed
    await expect(page.locator('.intro-overlay')).not.toBeVisible({ timeout: 2000 })

    expect(pageErrors, 'no uncaught page errors').toEqual([])
  })

  test('Exit button closes the intro mid-tour', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('walksheds_intro_v1_seen') } catch {}
    })

    await page.goto('/walksheds/')
    await page.waitForSelector('.intro-card', { timeout: 10000 })

    // Start the tour
    await page.locator('.intro-btn-primary').click()
    await expect(page.locator('.intro-title')).toHaveText('Westlake Station', { timeout: 4000 })

    // Exit mid-tour
    await page.locator('.intro-btn-secondary', { hasText: 'Exit' }).click()
    await expect(page.locator('.intro-overlay')).not.toBeVisible({ timeout: 2000 })
  })
})
