/**
 * Transit agency map styles.
 *
 * Each theme defines a Mapbox Standard style configuration (theme + lightPreset)
 * inspired by a real transit agency's visual identity. The map always shows
 * Seattle — these only change the map's look and feel, not the location.
 *
 * The `lines` property stores the agency's line colors for reference/legend;
 * the actual Seattle rail line colors are always Sound Transit's.
 */

export const themes = {
  'sound-transit': {
    id: 'sound-transit',
    label: 'Sound Transit',
    mapStyle: {
      theme: 'monochrome',
      lightPreset: 'dusk',
    },
    lines: {
      '1-line': { color: '#0054A6', label: '1 Line' },
      '2-line': { color: '#F3901D', label: '2 Line' },
    },
    ui: {
      accent: '#0054A6',
      accentAlt: '#F3901D',
      bg: '#1a1a2e',
      text: '#e0e0e0',
    },
  },

  'london-underground': {
    id: 'london-underground',
    label: 'TfL',
    mapStyle: {
      theme: 'monochrome',
      lightPreset: 'night',
    },
    lines: {
      bakerloo:           { color: '#B36305', label: 'Bakerloo' },
      central:            { color: '#E32017', label: 'Central' },
      circle:             { color: '#FFD300', label: 'Circle' },
      district:           { color: '#00782A', label: 'District' },
      'hammersmith-city':  { color: '#F3A9BB', label: 'Hammersmith & City' },
      jubilee:            { color: '#A0A5A9', label: 'Jubilee' },
      metropolitan:       { color: '#9B0056', label: 'Metropolitan' },
      northern:           { color: '#000000', label: 'Northern' },
      piccadilly:         { color: '#003688', label: 'Piccadilly' },
      victoria:           { color: '#0098D4', label: 'Victoria' },
      'waterloo-city':     { color: '#95CDBA', label: 'Waterloo & City' },
      elizabeth:          { color: '#6950A1', label: 'Elizabeth' },
    },
    ui: {
      accent: '#E32017',
      accentAlt: '#003688',
      bg: '#0a0a1a',
      text: '#d0d0d0',
    },
  },

  'nyc-subway': {
    id: 'nyc-subway',
    label: 'MTA',
    mapStyle: {
      theme: 'monochrome',
      lightPreset: 'dusk',
    },
    lines: {
      'ace':   { color: '#0039A6', label: 'A C E' },
      'bdfm':  { color: '#FF6319', label: 'B D F M' },
      'g':     { color: '#6CBE45', label: 'G' },
      'jz':    { color: '#996633', label: 'J Z' },
      'l':     { color: '#A7A9AC', label: 'L' },
      'nqrw':  { color: '#FCCC0A', label: 'N Q R W' },
      '123':   { color: '#EE352E', label: '1 2 3' },
      '456':   { color: '#00933C', label: '4 5 6' },
      '7':     { color: '#B933AD', label: '7' },
      's':     { color: '#808183', label: 'S' },
    },
    ui: {
      accent: '#0039A6',
      accentAlt: '#EE352E',
      bg: '#111118',
      text: '#d8d8d8',
    },
  },

  'tokyo-metro': {
    id: 'tokyo-metro',
    label: 'Tokyo Metro',
    mapStyle: {
      theme: 'monochrome',
      lightPreset: 'dawn',
    },
    lines: {
      ginza:      { color: '#FF9500', label: 'Ginza' },
      marunouchi: { color: '#F62E36', label: 'Marunouchi' },
      hibiya:     { color: '#B5B5AC', label: 'Hibiya' },
      tozai:      { color: '#009BBF', label: 'Tozai' },
      chiyoda:    { color: '#00BB85', label: 'Chiyoda' },
      yurakucho:  { color: '#C1A470', label: 'Yurakucho' },
      hanzomon:   { color: '#8F76D6', label: 'Hanzomon' },
      namboku:    { color: '#00AC9B', label: 'Namboku' },
      fukutoshin: { color: '#9C5E31', label: 'Fukutoshin' },
    },
    ui: {
      accent: '#F62E36',
      accentAlt: '#009BBF',
      bg: '#16161e',
      text: '#d4d4d4',
    },
  },
}

export const themeIds = Object.keys(themes)
export const defaultThemeId = 'sound-transit'
