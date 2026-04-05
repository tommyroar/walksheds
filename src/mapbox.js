import { MAPBOX_TOKEN } from './constants'

export async function fetchWalkshed(lng, lat, minutes) {
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}`
    + `?contours_minutes=${minutes}&polygons=true&access_token=${MAPBOX_TOKEN}`
  const resp = await fetch(url)
  if (!resp.ok) return null
  return resp.json()
}

export function polygonToLine(geojson) {
  if (!geojson?.features?.length) return geojson
  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => ({
      type: 'Feature',
      properties: f.properties,
      geometry: { type: 'LineString', coordinates: f.geometry.coordinates[0] },
    })),
  }
}

export function getLargestEnabledBounds(walksheds, enabledWalksheds) {
  const sorted = [...enabledWalksheds].sort((a, b) => b - a)
  for (const min of sorted) {
    const ws = walksheds[min]
    const coords = ws?.features?.[0]?.geometry?.coordinates?.[0]
    if (!coords) continue
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const [cLng, cLat] of coords) {
      if (cLng < minLng) minLng = cLng
      if (cLng > maxLng) maxLng = cLng
      if (cLat < minLat) minLat = cLat
      if (cLat > maxLat) maxLat = cLat
    }
    return [[minLng, minLat], [maxLng, maxLat]]
  }
  return null
}
