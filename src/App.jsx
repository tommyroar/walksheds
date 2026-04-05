import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { themes, defaultThemeId } from './themes'
import { buildGraph, getNextStation } from './routeGraph'
import Menu from './Menu'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const SEATTLE_CENTER = [-122.33, 47.60]
const SEATTLE_ZOOM = 11.5

const WALKSHED_OPTIONS = [5, 10, 15]

// Walkshed colors: subtle variations keyed by minutes.
// These adapt to the theme accent via opacity layering.
// Convert a polygon FeatureCollection to LineString for line-placement labels
function polygonToLine(geojson) {
  if (!geojson?.features?.length) return geojson
  return {
    type: 'FeatureCollection',
    features: geojson.features.map(f => ({
      type: 'Feature',
      properties: f.properties,
      geometry: {
        type: 'LineString',
        coordinates: f.geometry.coordinates[0],
      },
    })),
  }
}

const WALKSHED_STYLES = {
  15: { opacity: 0.10, outlineOpacity: 0.3 },
  10: { opacity: 0.15, outlineOpacity: 0.4 },
  5:  { opacity: 0.22, outlineOpacity: 0.6 },
}


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
  const [walksheds, setWalksheds] = useState({}) // { 5: geojson, 10: geojson, 15: geojson }
  const [enabledWalksheds, setEnabledWalksheds] = useState(new Set([5, 10, 15]))
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef(null)
  const selectedStationRef = useRef(null)
  const graphRef = useRef(null)

  const theme = themes[themeId]

  useEffect(() => {
    fetch('/line1-alignment.geojson').then(r => r.json()).then(setLine1Data)
    fetch('/line2-alignment.geojson').then(r => r.json()).then(setLine2Data)
    fetch('/all-stations.geojson').then(r => r.json()).then(setStationsData)
  }, [])

  // Build route graph when station data loads
  useEffect(() => {
    if (stationsData) {
      graphRef.current = buildGraph(stationsData)
    }
  }, [stationsData])

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true)
  }, [])

  const mode = darkMode ? 'dark' : 'light'
  const uiColors = theme.ui[mode]
  const lightPreset = theme.mapStyle[mode].lightPreset

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) return
    map.setConfigProperty('basemap', 'theme', theme.mapStyle.theme)
    map.setConfigProperty('basemap', 'lightPreset', lightPreset)
  }, [themeId, darkMode, mapLoaded, theme.mapStyle.theme, lightPreset])

  const handleThemeSwitch = useCallback((newId) => {
    setThemeId(newId)
    setPopup(null)
  }, [])

  const handleWalkshedToggle = useCallback((minutes) => {
    setEnabledWalksheds(prev => {
      const next = new Set(prev)
      if (next.has(minutes)) next.delete(minutes)
      else next.add(minutes)
      return next
    })
  }, [])

  // Select a station: set popup, fetch walksheds, fly to it
  const selectStation = useCallback((name, lng, lat, line, fly = false) => {
    selectedStationRef.current = { name, lng, lat }
    setPopup({ longitude: lng, latitude: lat, name, line })
    setWalksheds({})

    if (fly) {
      mapRef.current?.flyTo({ center: [lng, lat], duration: 600 })
    }

    // Fetch all walkshed isochrones in parallel
    const results = {}
    Promise.all(
      WALKSHED_OPTIONS.map(async (min) => {
        const data = await fetchWalkshed(lng, lat, min)
        if (data) results[min] = data
      })
    ).then(() => {
      if (selectedStationRef.current?.name === name) {
        setWalksheds(results)
      }
    })
  }, [])

  const handleMapClick = useCallback((e) => {
    const features = e.features
    if (features && features.length > 0) {
      const f = features[0]
      if (f.properties?.name) {
        selectStation(f.properties.name, e.lngLat.lng, e.lngLat.lat, f.properties.line)
        return
      }
    }
    selectedStationRef.current = null
    setPopup(null)
    setWalksheds({})
  }, [selectStation])

  // Arrow key navigation along route
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!graphRef.current || !selectedStationRef.current) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

      const nextName = getNextStation(graphRef.current, selectedStationRef.current.name, e.key)
      if (!nextName) return

      e.preventDefault()
      const nextNode = graphRef.current.get(nextName)
      if (!nextNode) return

      // Find the line for this station from the GeoJSON
      const feature = stationsData?.features.find(f => f.properties.name === nextName)
      const line = feature?.properties.line || nextNode.line

      selectStation(nextName, nextNode.coords[0], nextNode.coords[1], line, true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stationsData, selectStation])

  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  const lineColors = themes['sound-transit'].lines
  const walkshedAccent = theme.ui.accent

  // Render walksheds largest-first so smaller ones layer on top
  const walkshedLayers = [15, 10, 5]

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
        {/* Walkshed isochrones — rendered largest to smallest */}
        {walkshedLayers.map((min) => {
          const data = walksheds[min]
          if (!mapLoaded || !data || !enabledWalksheds.has(min)) return null
          const style = WALKSHED_STYLES[min]
          const lineData = polygonToLine(data)
          return (
            <span key={`walkshed-group-${min}`}>
              <Source id={`walkshed-${min}`} type="geojson" data={data}>
                <Layer
                  id={`walkshed-fill-${min}`}
                  type="fill"
                  paint={{
                    'fill-color': walkshedAccent,
                    'fill-opacity': style.opacity,
                  }}
                />
                <Layer
                  id={`walkshed-outline-${min}`}
                  type="line"
                  paint={{
                    'line-color': walkshedAccent,
                    'line-width': min === 5 ? 2 : 1.5,
                    'line-opacity': style.outlineOpacity,
                  }}
                />
              </Source>
              <Source id={`walkshed-label-${min}`} type="geojson" data={lineData}>
                <Layer
                  id={`walkshed-label-${min}`}
                  type="symbol"
                  layout={{
                    'symbol-placement': 'line',
                    'text-field': `${min} min`,
                    'text-size': 11,
                    'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                    'symbol-spacing': 150,
                    'text-keep-upright': true,
                  }}
                  paint={{
                    'text-color': walkshedAccent,
                    'text-halo-color': darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
                    'text-halo-width': 1.5,
                  }}
                />
              </Source>
            </span>
          )
        })}

        {/* Line 1 alignment */}
        {mapLoaded && line1Data && (
          <Source id="line-1" type="geojson" data={line1Data}>
            <Layer
              id="line-1-casing"
              type="line"
              paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }}
            />
            <Layer
              id="line-1-stroke"
              type="line"
              paint={{ 'line-color': lineColors['1-line'].color, 'line-width': 4, 'line-opacity': 0.9 }}
            />
          </Source>
        )}

        {/* Line 2 alignment */}
        {mapLoaded && line2Data && (
          <Source id="line-2" type="geojson" data={line2Data}>
            <Layer
              id="line-2-casing"
              type="line"
              paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }}
            />
            <Layer
              id="line-2-stroke"
              type="line"
              paint={{ 'line-color': lineColors['2-line'].color, 'line-width': 4, 'line-opacity': 0.9 }}
            />
          </Source>
        )}

        {/* Stations */}
        {mapLoaded && stationsData && (
          <Source id="stations" type="geojson" data={stationsData}>
            <Layer
              id="station-glow"
              type="circle"
              paint={{
                'circle-radius': 10,
                'circle-color': ['match', ['get', 'line'], '1-line', lineColors['1-line'].color, '2-line', lineColors['2-line'].color, '#ffffff'],
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
                'circle-stroke-color': ['match', ['get', 'line'], '1-line', lineColors['1-line'].color, '2-line', lineColors['2-line'].color, '#ffffff'],
              }}
            />
          </Source>
        )}

        {popup && (
          <Popup
            longitude={popup.longitude}
            latitude={popup.latitude}
            anchor="bottom"
            onClose={() => { setPopup(null); setWalksheds({}); selectedStationRef.current = null }}
            closeButton={false}
            className="station-popup"
          >
            <div className="popup-content">
              <span className="popup-line-dot" style={{ background: lineColors[popup.line]?.color || '#fff' }} />
              <span className="popup-name">{popup.name}</span>
            </div>
          </Popup>
        )}
      </Map>

      <Menu
        activeThemeId={themeId}
        darkMode={darkMode}
        enabledWalksheds={enabledWalksheds}
        onThemeSwitch={handleThemeSwitch}
        onDarkModeToggle={() => setDarkMode(d => !d)}
        onWalkshedToggle={handleWalkshedToggle}
      />
      <LineLegend enabledWalksheds={enabledWalksheds} themeAccent={theme.ui.accent} />
    </div>
  )
}
