import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { themes, defaultThemeId } from './themes'
import Menu from './Menu'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN
const WALKSHED_MINUTES = 15

// Seattle center — all themes show the same location
const SEATTLE_CENTER = [-122.33, 47.60]
const SEATTLE_ZOOM = 11.5

async function fetchWalkshed(lng, lat, minutes) {
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}`
    + `?contours_minutes=${minutes}&polygons=true&access_token=${MAPBOX_TOKEN}`
  const resp = await fetch(url)
  if (!resp.ok) return null
  return resp.json()
}

export default function App() {
  const [themeId, setThemeId] = useState(defaultThemeId)
  const [darkMode, setDarkMode] = useState(false)
  const [popup, setPopup] = useState(null)
  const [walkshed, setWalkshed] = useState(null)
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef(null)

  const theme = themes[themeId]

  // Load GeoJSON from SDOT-sourced files
  useEffect(() => {
    fetch('/line1-alignment.geojson').then(r => r.json()).then(setLine1Data)
    fetch('/line2-alignment.geojson').then(r => r.json()).then(setLine2Data)
    fetch('/all-stations.geojson').then(r => r.json()).then(setStationsData)
  }, [])

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true)
  }, [])

  const mode = darkMode ? 'dark' : 'light'
  const uiColors = theme.ui[mode]
  const lightPreset = theme.mapStyle[mode].lightPreset

  // Apply theme config to the map imperatively (react-map-gl doesn't
  // reactively update the `config` prop on Mapbox Standard styles)
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) return
    map.setConfigProperty('basemap', 'theme', theme.mapStyle.theme)
    map.setConfigProperty('basemap', 'lightPreset', lightPreset)
  }, [themeId, darkMode, mapLoaded, theme.mapStyle.theme, lightPreset])

  // Theme switch only changes style, not location
  const handleThemeSwitch = useCallback((newId) => {
    setThemeId(newId)
    setPopup(null)
  }, [])

  const handleMapClick = useCallback((e) => {
    const features = e.features
    if (features && features.length > 0) {
      const f = features[0]
      if (f.properties?.name) {
        const lng = e.lngLat.lng
        const lat = e.lngLat.lat
        setPopup({
          longitude: lng,
          latitude: lat,
          name: f.properties.name,
          line: f.properties.line,
        })
        // Fetch walkshed isochrone
        fetchWalkshed(lng, lat, WALKSHED_MINUTES).then(setWalkshed)
        return
      }
    }
    // Clicked empty space — clear selection
    setPopup(null)
    setWalkshed(null)
  }, [])

  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  const lineColors = themes['sound-transit'].lines

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`} style={{ '--ui-bg': uiColors.bg, '--ui-text': uiColors.text, '--ui-muted': uiColors.muted, '--ui-accent': theme.ui.accent }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: SEATTLE_CENTER[0],
          latitude: SEATTLE_CENTER[1],
          zoom: SEATTLE_ZOOM,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/standard"
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={mapLoaded ? ['station-circles'] : []}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onLoad={handleMapLoad}
        projection="mercator"
        config={{
          basemap: {
            theme: theme.mapStyle.theme,
            lightPreset: lightPreset,
          },
        }}
      >
        {/* Walkshed isochrone */}
        {mapLoaded && walkshed && (
          <Source id="walkshed" type="geojson" data={walkshed}>
            <Layer
              id="walkshed-fill"
              type="fill"
              paint={{
                'fill-color': lineColors[popup?.line]?.color || '#0054A6',
                'fill-opacity': 0.2,
              }}
            />
            <Layer
              id="walkshed-outline"
              type="line"
              paint={{
                'line-color': lineColors[popup?.line]?.color || '#0054A6',
                'line-width': 2,
                'line-opacity': 0.6,
              }}
            />
          </Source>
        )}

        {/* Line 1 alignment (SDOT data) */}
        {mapLoaded && line1Data && (
          <Source id="line-1" type="geojson" data={line1Data}>
            <Layer
              id="line-1-casing"
              type="line"
              paint={{
                'line-color': '#000000',
                'line-width': 7,
                'line-opacity': 0.3,
              }}
            />
            <Layer
              id="line-1-stroke"
              type="line"
              paint={{
                'line-color': lineColors['1-line'].color,
                'line-width': 4,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        )}

        {/* Line 2 alignment (SDOT data) */}
        {mapLoaded && line2Data && (
          <Source id="line-2" type="geojson" data={line2Data}>
            <Layer
              id="line-2-casing"
              type="line"
              paint={{
                'line-color': '#000000',
                'line-width': 7,
                'line-opacity': 0.3,
              }}
            />
            <Layer
              id="line-2-stroke"
              type="line"
              paint={{
                'line-color': lineColors['2-line'].color,
                'line-width': 4,
                'line-opacity': 0.9,
              }}
            />
          </Source>
        )}

        {/* Stations (SDOT data) */}
        {mapLoaded && stationsData && (
          <Source id="stations" type="geojson" data={stationsData}>
            <Layer
              id="station-glow"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': [
                  'match',
                  ['get', 'line'],
                  '1-line', lineColors['1-line'].color,
                  '2-line', lineColors['2-line'].color,
                  '#ffffff',
                ],
                'circle-opacity': 0.15,
                'circle-blur': 1,
              }}
            />
            <Layer
              id="station-circles"
              type="circle"
              paint={{
                'circle-radius': 5,
                'circle-color': '#ffffff',
                'circle-stroke-width': 2,
                'circle-stroke-color': [
                  'match',
                  ['get', 'line'],
                  '1-line', lineColors['1-line'].color,
                  '2-line', lineColors['2-line'].color,
                  '#ffffff',
                ],
              }}
            />
          </Source>
        )}

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => { setPopup(null); setWalkshed(null) }}
            closeButton={false}
            className="station-popup"
          >
            <div className="popup-content">
              <span
                className="popup-line-dot"
                style={{
                  background: lineColors[popup.line]?.color || '#fff',
                }}
              />
              <span className="popup-name">{popup.name}</span>
            </div>
          </Popup>
        )}
      </Map>

      <Menu
        activeThemeId={themeId}
        darkMode={darkMode}
        onThemeSwitch={handleThemeSwitch}
        onDarkModeToggle={() => setDarkMode(d => !d)}
      />
      <LineLegend />
    </div>
  )
}
