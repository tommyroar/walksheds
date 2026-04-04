import { describe, it, expect } from 'vitest'
import { themes, themeIds, defaultThemeId } from '../themes'

describe('themes', () => {
  it('exports four themes', () => {
    expect(themeIds).toHaveLength(4)
  })

  it('default theme is sound-transit', () => {
    expect(defaultThemeId).toBe('sound-transit')
  })

  it.each(themeIds)('theme "%s" has required fields', (id) => {
    const theme = themes[id]
    expect(theme.id).toBe(id)
    expect(theme.label).toBeTruthy()
    expect(theme.mapStyle.theme).toBeTruthy()
    expect(theme.mapStyle.lightPreset).toBeTruthy()
    expect(Object.keys(theme.lines).length).toBeGreaterThan(0)
    expect(theme.ui.accent).toMatch(/^#/)
  })

  it('sound transit has lines 1 and 2', () => {
    const st = themes['sound-transit']
    expect(st.lines['1-line'].color).toBe('#0054A6')
    expect(st.lines['2-line'].color).toBe('#F3901D')
  })

  it('all line colors are valid hex', () => {
    for (const theme of Object.values(themes)) {
      for (const line of Object.values(theme.lines)) {
        expect(line.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })
})
