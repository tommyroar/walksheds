export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

export const SEATTLE_CENTER = [-122.33, 47.60]
export const SEATTLE_ZOOM = 11.5

export const WALKSHED_OPTIONS = [5, 10, 15]
export const WALKSHED_RENDER_ORDER = [15, 10, 5]

export const WALKSHED_STYLES = {
  light: {
    15: { opacity: 0.10, outlineOpacity: 1.0, lineWidth: 2 },
    10: { opacity: 0.15, outlineOpacity: 1.0, lineWidth: 2.5 },
    5:  { opacity: 0.22, outlineOpacity: 1.0, lineWidth: 3 },
  },
  dark: {
    15: { opacity: 0.10, outlineOpacity: 1.0, lineWidth: 2 },
    10: { opacity: 0.15, outlineOpacity: 1.0, lineWidth: 2.5 },
    5:  { opacity: 0.22, outlineOpacity: 1.0, lineWidth: 3 },
  },
}

export const LINE_COLORS = {
  '1-line': { color: '#4CAF50', label: '1 Line' },
  '2-line': { color: '#0082C8', label: '2 Line' },
}

export const WALKSHED_ACCENT_LIGHT = '#0082C8'
export const WALKSHED_ACCENT_DARK = '#4CAF50'

export const POI_CATEGORIES = {
  restaurant: { color: '#E67E22', group: 'dining', label: 'Restaurant' },
  cafe:       { color: '#E67E22', group: 'dining', label: 'Cafe' },
  bar:        { color: '#E67E22', group: 'dining', label: 'Bar' },
  fast_food:  { color: '#E67E22', group: 'dining', label: 'Fast Food' },
  pub:        { color: '#E67E22', group: 'dining', label: 'Pub' },
  bakery:     { color: '#E67E22', group: 'dining', label: 'Bakery' },
  ice_cream:  { color: '#E67E22', group: 'dining', label: 'Ice Cream' },
  museum:     { color: '#8E44AD', group: 'attractions', label: 'Museum' },
  gallery:    { color: '#8E44AD', group: 'attractions', label: 'Gallery' },
  attraction: { color: '#8E44AD', group: 'attractions', label: 'Attraction' },
  artwork:    { color: '#8E44AD', group: 'attractions', label: 'Artwork' },
  viewpoint:  { color: '#8E44AD', group: 'attractions', label: 'Viewpoint' },
  park:       { color: '#27AE60', group: 'parks', label: 'Park' },
  playground: { color: '#27AE60', group: 'parks', label: 'Playground' },
  garden:     { color: '#27AE60', group: 'parks', label: 'Garden' },
}

export const POI_GROUP_COLORS = {
  dining: '#E67E22',
  attractions: '#8E44AD',
  parks: '#27AE60',
}

export const POI_FILES = ['restaurants', 'attractions', 'parks']

export const POI_INTERACTIVE_LAYERS = ['poi-circles']
