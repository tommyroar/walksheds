import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { themes, defaultThemeId } from './themes'
import ThemeSwitcher from './ThemeSwitcher'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

// Seattle center — all themes show the same location
const SEATTLE_CENTER = [-122.33, 47.60]
const SEATTLE_ZOOM = 11.5

export default function App() {
  const [themeId, setThemeId] = useState(defaultThemeId)
  const [popup, setPopup] = useState(null)
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
        setPopup({
          longitude: e.lngLat.lng,
          latitude: e.lngLat.lat,
          name: f.properties.name,
          line: f.properties.line,
        })
      }
    } else {
      setPopup(null)
    }
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
    <div className="app" style={{ '--ui-bg': theme.ui.bg, '--ui-text': theme.ui.text, '--ui-accent': theme.ui.accent }}>
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
            lightPreset: theme.mapStyle.lightPreset,
          },
        }}
      >
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
            onClose={() => setPopup(null)}
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

      <ThemeSwitcher activeThemeId={themeId} onSwitch={handleThemeSwitch} />
      <LineLegend themeId={themeId} />
    </div>
  )
}
