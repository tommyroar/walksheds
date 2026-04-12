/**
 * POI filtering utilities — point-in-polygon, tag aggregation, and filter logic.
 */

/**
 * Ray-casting point-in-polygon test.
 * @param {[number, number]} point - [lng, lat]
 * @param {Array<[number, number]>} ring - polygon ring coordinates
 * @returns {boolean}
 */
export function pointInPolygon([px, py], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Filter POI features to those inside the walkshed polygon.
 * @param {Object} poiFC - GeoJSON FeatureCollection of POIs
 * @param {Object} walkshedFC - GeoJSON FeatureCollection from Mapbox Isochrone
 * @returns {Object} filtered FeatureCollection
 */
export function filterPOIsInWalkshed(poiFC, walkshedFC) {
  const ring = walkshedFC?.features?.[0]?.geometry?.coordinates?.[0]
  if (!ring || !poiFC?.features) return { type: 'FeatureCollection', features: [] }
  const features = poiFC.features.filter(f => {
    const coords = f.geometry?.coordinates
    return coords && pointInPolygon(coords, ring)
  })
  return { type: 'FeatureCollection', features }
}

/**
 * Get all unique tags from POI features with their counts, sorted by count descending.
 * Includes the dominant category color for each tag based on which category uses it most.
 * @param {Array} features - GeoJSON features with properties.tags arrays
 * @param {Object} [categoryColors] - map of category → color (from POI_CATEGORIES)
 * @returns {Array<{tag: string, count: number, color: string|null}>}
 */
export function getAvailableTags(features, categoryColors) {
  const counts = {}
  const catCounts = {} // tag → { category → count }
  for (const f of features) {
    const tags = f.properties?.tags
    if (!Array.isArray(tags)) continue
    const cat = f.properties?.category
    for (const tag of tags) {
      counts[tag] = (counts[tag] || 0) + 1
      if (cat && categoryColors) {
        if (!catCounts[tag]) catCounts[tag] = {}
        catCounts[tag][cat] = (catCounts[tag][cat] || 0) + 1
      }
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => {
      let color = null
      if (categoryColors && catCounts[tag]) {
        const topCat = Object.entries(catCounts[tag]).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (topCat) color = categoryColors[topCat] || null
      }
      return { tag, count, color }
    })
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Filter features to those matching ANY active tag (OR logic).
 * @param {Array} features - GeoJSON features
 * @param {Set<string>} activeTags - tags where at least one must be present
 * @returns {Array} filtered features
 */
export function filterByTags(features, activeTags) {
  if (!activeTags || activeTags.size === 0) return features
  return features.filter(f => {
    const tags = f.properties?.tags
    if (!Array.isArray(tags)) return false
    for (const t of activeTags) {
      if (tags.includes(t)) return true
    }
    return false
  })
}

/**
 * Merge multiple FeatureCollections into one.
 * @param {...Object} fcs - GeoJSON FeatureCollections
 * @returns {Object} merged FeatureCollection
 */
export function mergeFeatureCollections(...fcs) {
  const features = []
  for (const fc of fcs) {
    if (fc?.features) features.push(...fc.features)
  }
  return { type: 'FeatureCollection', features }
}
