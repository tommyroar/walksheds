/**
 * Seattle Link Light Rail — Lines 1 and 2
 *
 * GeoJSON LineStrings for the two active Link lines,
 * traced along actual station coordinates.
 *
 * Line 1: Northgate → Angle Lake (Blue)
 * Line 2: Redmond Technology → South Bellevue (opening segment, Orange)
 *         The 2 Line will eventually extend through Seattle;
 *         for now we show the East Link segment.
 */

export const line1 = {
  type: 'Feature',
  properties: { id: '1-line', name: '1 Line' },
  geometry: {
    type: 'LineString',
    coordinates: [
      // Northgate
      [-122.3281, 47.7063],
      // Roosevelt
      [-122.3166, 47.6897],
      // U District
      [-122.3118, 47.6614],
      // University of Washington
      [-122.3038, 47.6498],
      // Capitol Hill
      [-122.3225, 47.6192],
      // Westlake
      [-122.3375, 47.6115],
      // University Street
      [-122.3362, 47.6076],
      // Pioneer Square
      [-122.3320, 47.6021],
      // International District / Chinatown
      [-122.3270, 47.5982],
      // Stadium
      [-122.3280, 47.5910],
      // SODO
      [-122.3274, 47.5800],
      // Beacon Hill
      [-122.3118, 47.5685],
      // Mount Baker
      [-122.2976, 47.5763],
      // Columbia City
      [-122.2929, 47.5594],
      // Othello
      [-122.2812, 47.5383],
      // Rainier Beach
      [-122.2687, 47.5221],
      // Tukwila International Blvd
      [-122.2882, 47.4876],
      // SeaTac / Airport
      [-122.2967, 47.4449],
      // Angle Lake
      [-122.2978, 47.4322],
    ],
  },
}

export const line2 = {
  type: 'Feature',
  properties: { id: '2-line', name: '2 Line' },
  geometry: {
    type: 'LineString',
    coordinates: [
      // South Bellevue
      [-122.1805, 47.5882],
      // East Main
      [-122.1842, 47.6018],
      // Bellevue Downtown
      [-122.1985, 47.6152],
      // Wilburton
      [-122.1878, 47.6223],
      // Spring District / 120th
      [-122.1780, 47.6270],
      // BelRed / 130th
      [-122.1651, 47.6280],
      // Overlake Village
      [-122.1487, 47.6311],
      // Redmond Technology
      [-122.1291, 47.6434],
    ],
  },
}

export const stationsLine1 = {
  type: 'FeatureCollection',
  features: line1.geometry.coordinates.map((coord, i) => {
    const names = [
      'Northgate', 'Roosevelt', 'U District', 'University of Washington',
      'Capitol Hill', 'Westlake', 'University Street', 'Pioneer Square',
      'International District / Chinatown', 'Stadium', 'SODO', 'Beacon Hill',
      'Mount Baker', 'Columbia City', 'Othello', 'Rainier Beach',
      'Tukwila International Blvd', 'SeaTac / Airport', 'Angle Lake',
    ]
    return {
      type: 'Feature',
      properties: { name: names[i], line: '1-line' },
      geometry: { type: 'Point', coordinates: coord },
    }
  }),
}

export const stationsLine2 = {
  type: 'FeatureCollection',
  features: line2.geometry.coordinates.map((coord, i) => {
    const names = [
      'South Bellevue', 'East Main', 'Bellevue Downtown', 'Wilburton',
      'Spring District / 120th', 'BelRed / 130th', 'Overlake Village',
      'Redmond Technology',
    ]
    return {
      type: 'Feature',
      properties: { name: names[i], line: '2-line' },
      geometry: { type: 'Point', coordinates: coord },
    }
  }),
}

export const allLines = {
  type: 'FeatureCollection',
  features: [line1, line2],
}

export const allStations = {
  type: 'FeatureCollection',
  features: [...stationsLine1.features, ...stationsLine2.features],
}
