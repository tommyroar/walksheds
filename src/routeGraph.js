/**
 * Route graph for keyboard navigation along light rail lines.
 *
 * Defines station order per line, builds an adjacency graph,
 * and resolves arrow-key directions to the best neighbor station
 * based on geographic bearing.
 */

// Ordered station lists per line (north→south for Line 1, west→east for Line 2)
const LINE_1_ORDER = [
  'NE 145th Station',
  'Northgate Station',
  'Roosevelt Station',
  'U District Station',
  'University of Washington Station',
  'Capitol Hill Station',
  'Westlake Station',
  'University Street Station',
  'Pioneer Square Station',
  'International District Station',
  'Stadium Station',
  'SODO Station',
  'Beacon Hill Station',
  'Mount Baker Station',
  'Columbia City Station',
  'Othello Station',
  'Rainier Beach Station',
  'Tukwila International Blvd Station',
  'Airport / SeaTac Station',
  'Angle Lake Station',
]

const LINE_2_ORDER = [
  'International District Station',
  'Judkins Park Station',
  'Mercer Island Station',
  'South Bellevue Station',
  'East Main Station',
  'Bellevue Downtown Station',
  'Wilburton Station',
  'Spring District/120th Station',
  'Bel-Red/130th Station',
  'Overlake Village Station',
  'Redmond Technology Center Station',
]

// Arrow key → target bearing in degrees (0=N, 90=E, 180=S, 270=W)
const ARROW_BEARINGS = {
  ArrowUp: 0,
  ArrowRight: 90,
  ArrowDown: 180,
  ArrowLeft: 270,
}

/**
 * Compute bearing in degrees from point A to point B.
 * Returns 0-360 where 0=N, 90=E, 180=S, 270=W.
 */
function bearing(lngA, latA, lngB, latB) {
  const toRad = Math.PI / 180
  const dLng = (lngB - lngA) * toRad
  const lat1 = latA * toRad
  const lat2 = latB * toRad
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  const deg = (Math.atan2(y, x) * 180) / Math.PI
  return (deg + 360) % 360
}

/**
 * Angular difference between two bearings (0-180).
 */
function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Build adjacency graph from station GeoJSON.
 * Returns a Map of stationName → { coords: [lng, lat], line, neighbors: [{ name, coords, line }] }
 */
export function buildGraph(stationsGeoJSON) {
  const stations = new Map()

  // Index all stations by name
  for (const f of stationsGeoJSON.features) {
    const name = f.properties.name
    const coords = f.geometry.coordinates
    const line = f.properties.line
    if (!stations.has(name)) {
      stations.set(name, { coords, line, neighbors: [] })
    }
  }

  // Wire up adjacency from ordered lists
  function wireAdjacency(order) {
    for (let i = 0; i < order.length; i++) {
      const cur = stations.get(order[i])
      if (!cur) continue

      if (i > 0) {
        const prev = stations.get(order[i - 1])
        if (prev && !cur.neighbors.some(n => n.name === order[i - 1])) {
          cur.neighbors.push({ name: order[i - 1], coords: prev.coords })
        }
      }
      if (i < order.length - 1) {
        const next = stations.get(order[i + 1])
        if (next && !cur.neighbors.some(n => n.name === order[i + 1])) {
          cur.neighbors.push({ name: order[i + 1], coords: next.coords })
        }
      }
    }
  }

  wireAdjacency(LINE_1_ORDER)
  wireAdjacency(LINE_2_ORDER)

  return stations
}

/**
 * Given the current station and an arrow key, return the best neighbor
 * station to navigate to, or null if no good match.
 *
 * The algorithm computes the geographic bearing from the current station
 * to each neighbor, then picks the neighbor whose bearing is closest to
 * the arrow key's cardinal direction. A match within 90° is required.
 */
export function getNextStation(graph, currentStationName, arrowKey) {
  const targetBearing = ARROW_BEARINGS[arrowKey]
  if (targetBearing === undefined) return null

  const current = graph.get(currentStationName)
  if (!current || current.neighbors.length === 0) return null

  let bestName = null
  let bestDiff = Infinity

  for (const neighbor of current.neighbors) {
    const b = bearing(current.coords[0], current.coords[1], neighbor.coords[0], neighbor.coords[1])
    const diff = angleDiff(b, targetBearing)
    if (diff < bestDiff) {
      bestDiff = diff
      bestName = neighbor.name
    }
  }

  // Only navigate if the best match is within 90° of the arrow direction
  if (bestDiff > 90) return null

  return bestName
}
