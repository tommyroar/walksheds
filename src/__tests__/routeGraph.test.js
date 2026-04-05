import { describe, it, expect } from 'vitest'
import { buildGraph, getNextStation, isJunction, getJunctionHints } from '../routeGraph'

const mockStations = {
  type: 'FeatureCollection',
  features: [
    // Shared stations (both lines)
    { type: 'Feature', properties: { name: 'Capitol Hill Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3202, 47.6191] } },
    { type: 'Feature', properties: { name: 'Capitol Hill Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3202, 47.6191] } },
    { type: 'Feature', properties: { name: 'Westlake Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3367, 47.6116] } },
    { type: 'Feature', properties: { name: 'Westlake Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3367, 47.6116] } },
    { type: 'Feature', properties: { name: 'Pioneer Square Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3312, 47.6026] } },
    { type: 'Feature', properties: { name: 'Pioneer Square Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3312, 47.6026] } },
    { type: 'Feature', properties: { name: 'International District Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3280, 47.5984] } },
    { type: 'Feature', properties: { name: 'International District Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3280, 47.5984] } },
    // Line 1 only (south of junction)
    { type: 'Feature', properties: { name: 'Stadium Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3272, 47.5911] } },
    { type: 'Feature', properties: { name: 'SODO Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3274, 47.5811] } },
    // Line 2 only (east of junction)
    { type: 'Feature', properties: { name: 'Judkins Park Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3045, 47.5903] } },
    { type: 'Feature', properties: { name: 'Mercer Island Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.2332, 47.5882] } },
  ],
}

describe('routeGraph', () => {
  const graph = buildGraph(mockStations)

  it('builds graph with unique station entries', () => {
    // 8 unique station names
    expect(graph.size).toBe(8)
  })

  it('shared stations belong to both lines', () => {
    const id = graph.get('International District Station')
    expect(id.lines.has('1-line')).toBe(true)
    expect(id.lines.has('2-line')).toBe(true)
  })

  it('International District is a junction', () => {
    expect(isJunction(graph, 'International District Station')).toBe(true)
    expect(isJunction(graph, 'Capitol Hill Station')).toBe(false)
  })

  it('junction hints show diverging directions', () => {
    const hints = getJunctionHints(graph, 'International District Station')
    expect(hints.length).toBeGreaterThan(0)
    const hintLabels = hints.map(h => h.label)
    // Should mention Stadium (Line 1) and Judkins Park (Line 2)
    expect(hintLabels.some(l => l.includes('Stadium'))).toBe(true)
    expect(hintLabels.some(l => l.includes('Judkins Park'))).toBe(true)
  })

  describe('line-aware navigation', () => {
    it('ArrowDown from Intl District on Line 1 goes to Stadium', () => {
      const result = getNextStation(graph, 'International District Station', 'ArrowDown', '1-line')
      expect(result.name).toBe('Stadium Station')
      expect(result.line).toBe('1-line')
    })

    it('ArrowRight from Intl District on Line 2 goes to Judkins Park', () => {
      const result = getNextStation(graph, 'International District Station', 'ArrowRight', '2-line')
      expect(result.name).toBe('Judkins Park Station')
      expect(result.line).toBe('2-line')
    })

    it('ArrowUp from Intl District on Line 2 goes to Pioneer Square staying on Line 2', () => {
      const result = getNextStation(graph, 'International District Station', 'ArrowUp', '2-line')
      expect(result.name).toBe('Pioneer Square Station')
      expect(result.line).toBe('2-line')
    })

    it('ArrowLeft from Judkins Park goes back to Intl District on Line 2', () => {
      const result = getNextStation(graph, 'Judkins Park Station', 'ArrowLeft', '2-line')
      expect(result.name).toBe('International District Station')
      expect(result.line).toBe('2-line')
    })

    it('ArrowDown from Pioneer Square on Line 2 goes to Intl District on Line 2', () => {
      const result = getNextStation(graph, 'Pioneer Square Station', 'ArrowDown', '2-line')
      expect(result.name).toBe('International District Station')
      expect(result.line).toBe('2-line')
    })

    it('returns null for invalid direction at terminal', () => {
      const result = getNextStation(graph, 'SODO Station', 'ArrowDown', '1-line')
      expect(result).toBeNull()
    })

    it('returns null for non-arrow key', () => {
      const result = getNextStation(graph, 'Westlake Station', 'Enter', '1-line')
      expect(result).toBeNull()
    })
  })
})
