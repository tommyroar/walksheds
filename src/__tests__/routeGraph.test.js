import { describe, it, expect } from 'vitest'
import { buildGraph, getNextStation } from '../routeGraph'

const mockStations = {
  type: 'FeatureCollection',
  features: [
    // Line 1 stations (north to south)
    { type: 'Feature', properties: { name: 'Northgate Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3283, 47.7030] } },
    { type: 'Feature', properties: { name: 'Roosevelt Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3160, 47.6766] } },
    { type: 'Feature', properties: { name: 'U District Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3141, 47.6603] } },
    { type: 'Feature', properties: { name: 'International District Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3280, 47.5984] } },
    { type: 'Feature', properties: { name: 'Stadium Station', line: '1-line' }, geometry: { type: 'Point', coordinates: [-122.3272, 47.5911] } },
    // Line 2 stations (west to east from junction)
    { type: 'Feature', properties: { name: 'Judkins Park Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.3045, 47.5903] } },
    { type: 'Feature', properties: { name: 'Mercer Island Station', line: '2-line' }, geometry: { type: 'Point', coordinates: [-122.2332, 47.5882] } },
  ],
}

describe('routeGraph', () => {
  const graph = buildGraph(mockStations)

  it('builds graph with all stations', () => {
    expect(graph.size).toBe(7)
  })

  it('International District has neighbors on both lines', () => {
    const id = graph.get('International District Station')
    const neighborNames = id.neighbors.map(n => n.name)
    // Line 1 neighbors
    expect(neighborNames).toContain('Stadium Station')
    // Line 2 neighbor
    expect(neighborNames).toContain('Judkins Park Station')
  })

  it('ArrowDown from Northgate goes south to Roosevelt', () => {
    const next = getNextStation(graph, 'Northgate Station', 'ArrowDown')
    expect(next).toBe('Roosevelt Station')
  })

  it('ArrowUp from Roosevelt goes north to Northgate', () => {
    const next = getNextStation(graph, 'Roosevelt Station', 'ArrowUp')
    expect(next).toBe('Northgate Station')
  })

  it('ArrowRight from Intl District goes east to Judkins Park', () => {
    const next = getNextStation(graph, 'International District Station', 'ArrowRight')
    expect(next).toBe('Judkins Park Station')
  })

  it('ArrowLeft from Judkins Park goes west to Intl District', () => {
    const next = getNextStation(graph, 'Judkins Park Station', 'ArrowLeft')
    expect(next).toBe('International District Station')
  })

  it('ArrowRight from Judkins Park goes east to Mercer Island', () => {
    const next = getNextStation(graph, 'Judkins Park Station', 'ArrowRight')
    expect(next).toBe('Mercer Island Station')
  })

  it('returns null for invalid direction at terminal', () => {
    const next = getNextStation(graph, 'Northgate Station', 'ArrowUp')
    // Northgate is the northernmost in our mock — ArrowUp has no neighbor
    // (Roosevelt is south, so ArrowUp won't match within 90°)
    expect(next).toBeNull()
  })

  it('returns null for non-arrow key', () => {
    const next = getNextStation(graph, 'Northgate Station', 'Enter')
    expect(next).toBeNull()
  })
})
