import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('/')
    expect(response.status()).toBe(200)
  })

  test('map canvas renders', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('.mapboxgl-canvas')
    await expect(canvas).toBeVisible({ timeout: 15000 })
  })

  test('legend is visible with line info', async ({ page }) => {
    await page.goto('/')
    const legend = page.locator('.line-legend')
    await expect(legend).toBeVisible({ timeout: 10000 })
    const title = page.locator('.legend-title').first()
    await expect(title).toHaveText('Link light rail')
  })

  test('legend has walkshed toggles', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.line-legend', { timeout: 10000 })
    const items = page.locator('.legend-walkshed-item')
    await expect(items).toHaveCount(3)
  })

  test('clicking walkshed toggle dims it', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.line-legend', { timeout: 10000 })
    const item = page.locator('.legend-walkshed-item').first()
    await item.click()
    await expect(item).toHaveClass(/dimmed/)
  })

  test('clicking dimmed walkshed toggle re-enables it', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.line-legend', { timeout: 10000 })
    const item = page.locator('.legend-walkshed-item').first()
    await item.click()
    await expect(item).toHaveClass(/dimmed/)
    await item.click()
    await expect(item).not.toHaveClass(/dimmed/)
  })

  test('accessible via LAN hostname', async ({ request }) => {
    const hostname = process.env.LAN_HOSTNAME
    if (!hostname) test.skip()
    const resp = await request.get(`http://${hostname}:5187/`)
    expect(resp.status()).toBe(200)
  })
})
