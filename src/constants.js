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
export const WALKSHED_ACCENT_DARK = '#69F0AE'
