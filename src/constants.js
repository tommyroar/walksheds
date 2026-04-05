export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

export const SEATTLE_CENTER = [-122.33, 47.60]
export const SEATTLE_ZOOM = 11.5

export const WALKSHED_OPTIONS = [5, 10, 15]
export const WALKSHED_RENDER_ORDER = [15, 10, 5]

export const WALKSHED_STYLES = {
  light: {
    15: { opacity: 0.12, outlineOpacity: 0.6, lineWidth: 2 },
    10: { opacity: 0.18, outlineOpacity: 0.7, lineWidth: 2.5 },
    5:  { opacity: 0.25, outlineOpacity: 0.85, lineWidth: 3 },
  },
  dark: {
    15: { opacity: 0.20, outlineOpacity: 0.7, lineWidth: 2.5 },
    10: { opacity: 0.28, outlineOpacity: 0.8, lineWidth: 3 },
    5:  { opacity: 0.35, outlineOpacity: 0.95, lineWidth: 3.5 },
  },
}

export const LINE_COLORS = {
  '1-line': { color: '#4CAF50', label: '1 Line' },
  '2-line': { color: '#0082C8', label: '2 Line' },
}

export const WALKSHED_ACCENT_LIGHT = '#3A37A0'
export const WALKSHED_ACCENT_DARK = '#7DF9FF'
