import { useState, useCallback, useRef } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { themes, defaultThemeId } from './themes'
import { allLines, allStations } from './data/seattle-link'
import ThemeSwitcher from './ThemeSwitcher'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

export default function App() {
  const [themeId, setThemeId] = useState(defaultThemeId)
  const [popup, setPopup] = useState(null)
  const mapRef = useRef(null)

  const theme = themes[themeId]

  const handleThemeSwitch = useCallback((newId) => {
    setThemeId(newId)
    setPopup(null)
    const t = themes[newId]
    mapRef.current?.flyTo({
      center: t.center,
      zoom: t.zoom,
      duration: 2000,
    })
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

  // Build the Mapbox Standard style URL with config
  const mapStyle = `mapbox://styles/mapbox/standard`

  // Only show rail lines for Sound Transit (the home theme)
  const showLines = themeId === 'sound-transit'

  return (
    <div className="app" style={{ '--ui-bg': theme.ui.bg, '--ui-text': theme.ui.text, '--ui-accent': theme.ui.accent }}>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: theme.center[0],
          latitude: theme.center[1],
          zoom: theme.zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        mapboxAccessToken={MAPBOX_TOKEN}
        interactiveLayerIds={showLines ? ['station-circles'] : []}
        onClick={handleMapClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        projection="mercator"
        config={{
          basemap: {
            theme: theme.mapStyle.theme,
            lightPreset: theme.mapStyle.lightPreset,
          },
        }}
      >
        {showLines && (
          <>
            {/* Line 1 */}
            <Source id="line-1" type="geojson" data={allLines.features[0]}>
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
                  'line-color': theme.lines['1-line'].color,
                  'line-width': 4,
                  'line-opacity': 0.9,
                }}
              />
            </Source>

            {/* Line 2 */}
            <Source id="line-2" type="geojson" data={allLines.features[1]}>
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
                  'line-color': theme.lines['2-line'].color,
                  'line-width': 4,
                  'line-opacity': 0.9,
                }}
              />
            </Source>

            {/* Stations */}
            <Source id="stations" type="geojson" data={allStations}>
              <Layer
                id="station-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': [
                    'match',
                    ['get', 'line'],
                    '1-line', theme.lines['1-line'].color,
                    '2-line', theme.lines['2-line'].color,
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
                    '1-line', theme.lines['1-line'].color,
                    '2-line', theme.lines['2-line'].color,
                    '#ffffff',
                  ],
                }}
              />
            </Source>

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
                      background: theme.lines[popup.line]?.color || '#fff',
                    }}
                  />
                  <span className="popup-name">{popup.name}</span>
                </div>
              </Popup>
            )}
          </>
        )}
      </Map>

      <ThemeSwitcher activeThemeId={themeId} onSwitch={handleThemeSwitch} />
      <LineLegend themeId={themeId} />
    </div>
  )
}
