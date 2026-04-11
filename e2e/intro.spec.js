import { test, expect } from '@playwright/test'

test.describe('Intro walkthrough', () => {
  test('runs the full intro and shows walksheds', async ({ page }) => {
    const consoleMsgs = []
    const pageErrors = []
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`
      consoleMsgs.push(text)
      // Stream to test output as we go so we see it even on timeout
      // eslint-disable-next-line no-console
      console.log(text)
    })
    page.on('pageerror', (err) => {
      pageErrors.push(String(err))
      // eslint-disable-next-line no-console
      console.log('PAGE ERROR:', String(err))
    })

    // Make sure the intro flag isn't set from a previous run
    await page.addInitScript(() => {
      try { localStorage.removeItem('walksheds_intro_v1_seen') } catch {}
    })

    await page.goto('/walksheds/')
    await page.waitForSelector('.mapboxgl-canvas', { timeout: 15000 })

    // Welcome modal should be visible
    const introCard = page.locator('.intro-card')
    await expect(introCard).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.intro-title')).toHaveText('Welcome to Walksheds')

    // Start the tour
    await page.locator('.intro-btn-primary', { hasText: 'Start tour' }).click()

    // Helper: returns the list of walkshed Mapbox layer IDs currently in the map style
    const getWalkshedLayers = () => page.evaluate(() => {
      const mapInstance = window.__mapForTest
      if (!mapInstance) return 'NO_MAP_REF'
      return mapInstance.getStyle().layers
        .map((l) => l.id)
        .filter((id) => id.startsWith('walkshed-'))
    })

    // Step 2: Westlake Station — pill AND 5-minute walkshed must both appear
    // before the title moves on (this is the bug we just fixed).
    await expect(page.locator('.intro-title')).toHaveText('Westlake Station', { timeout: 4000 })
    await expect(page.locator('.station-pill')).toBeVisible({ timeout: 6000 })
    await expect.poll(getWalkshedLayers, { timeout: 8000 }).toContain('walkshed-fill-light-5')
    // Title should still be on Westlake while we wait — proves we don't auto-advance
    // before the walkshed actually loads
    await expect(page.locator('.intro-title')).toHaveText('Westlake Station')

    // Step 3: 10 minutes
    await expect(page.locator('.intro-title')).toHaveText('10 minutes on foot', { timeout: 8000 })
    await expect.poll(getWalkshedLayers, { timeout: 5000 }).toContain('walkshed-fill-light-10')

    // Step 4: 15 minutes
    await expect(page.locator('.intro-title')).toHaveText('15 minutes on foot', { timeout: 8000 })
    await expect.poll(getWalkshedLayers, { timeout: 5000 }).toContain('walkshed-fill-light-15')

    // Step 5: Symphony hop
    await expect(page.locator('.intro-title')).toHaveText('Move along the line', { timeout: 8000 })

    // Step 6: Back to Westlake
    await expect(page.locator('.intro-title')).toHaveText('Back to Westlake', { timeout: 8000 })

    // Step 7: Your turn (terminal step, has Got it button)
    await expect(page.locator('.intro-title')).toHaveText('Your turn', { timeout: 8000 })
    await expect(page.locator('.intro-btn-primary', { hasText: 'Got it' })).toBeVisible()

    // Dump captured logs/errors at the end so they appear regardless of pass/fail
    console.log('--- console messages ---')
    for (const m of consoleMsgs) console.log(`[${m.type}] ${m.text}`)
    console.log('--- page errors ---')
    for (const e of pageErrors) console.log(e)

    expect(pageErrors, 'no uncaught page errors').toEqual([])
  })
})
