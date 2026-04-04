import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('/')
    expect(response.status()).toBe(200)
  })

  test('map canvas renders', async ({ page }) => {
    await page.goto('/')
    // Mapbox GL renders into a canvas element
    const canvas = page.locator('.mapboxgl-canvas')
    await expect(canvas).toBeVisible({ timeout: 15000 })
  })

  test('theme switcher is visible', async ({ page }) => {
    await page.goto('/')
    const switcher = page.locator('.theme-switcher')
    await expect(switcher).toBeVisible({ timeout: 10000 })
  })

  test('has all four theme buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.theme-switcher', { timeout: 10000 })
    const buttons = page.locator('.theme-btn')
    await expect(buttons).toHaveCount(4)
  })

  test('can switch to NYC theme', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.theme-switcher', { timeout: 10000 })
    const nycBtn = page.locator('.theme-btn', { hasText: 'MTA' })
    await nycBtn.click()
    await expect(nycBtn).toHaveClass(/active/)
  })

  test('line legend displays', async ({ page }) => {
    await page.goto('/')
    const legend = page.locator('.line-legend')
    await expect(legend).toBeVisible({ timeout: 10000 })
  })

  test('accessible via LAN hostname', async ({ request }) => {
    // Catches allowedHosts misconfiguration — the localhost tests won't
    const hostname = process.env.LAN_HOSTNAME
    if (!hostname) test.skip()
    const resp = await request.get(`http://${hostname}:5187/`)
    expect(resp.status()).toBe(200)
  })
})
