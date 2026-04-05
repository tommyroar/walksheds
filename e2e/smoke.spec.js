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

  test('hamburger menu is visible', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('.menu-toggle')
    await expect(toggle).toBeVisible({ timeout: 10000 })
  })

  test('menu opens and shows style section', async ({ page }) => {
    await page.goto('/')
    await page.locator('.menu-toggle').click()
    const panel = page.locator('.menu-panel')
    await expect(panel).toBeVisible()
    const title = page.locator('.menu-section-title').first()
    await expect(title).toHaveText('Style')
  })

  test('has all four theme buttons in menu', async ({ page }) => {
    await page.goto('/')
    await page.locator('.menu-toggle').click()
    const buttons = page.locator('.menu-theme-btn')
    await expect(buttons).toHaveCount(4)
  })

  test('can switch to MTA theme via menu', async ({ page }) => {
    await page.goto('/')
    await page.locator('.menu-toggle').click()
    const mtaBtn = page.locator('.menu-theme-btn', { hasText: 'MTA' })
    await mtaBtn.click()
    await expect(mtaBtn).toHaveClass(/active/)
  })

  test('line legend displays', async ({ page }) => {
    await page.goto('/')
    const legend = page.locator('.line-legend')
    await expect(legend).toBeVisible({ timeout: 10000 })
  })

  test('accessible via LAN hostname', async ({ request }) => {
    const hostname = process.env.LAN_HOSTNAME
    if (!hostname) test.skip()
    const resp = await request.get(`http://${hostname}:5187/`)
    expect(resp.status()).toBe(200)
  })
})
