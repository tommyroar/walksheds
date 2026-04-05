import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { buildGraph, getNextStation, isJunction, getJunctionHints } from './routeGraph'
import { registerStationIcons } from './stationIcons'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const ARROW_SYMBOLS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }

function ExpandingPill({ longitude, latitude, lines, stopCode, name, junctionHints }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const timer = requestAnimationFrame(() => setExpanded(true))
    return () => cancelAnimationFrame(timer)
  }, [])

  const lineArr = lines.split(',')

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="center">
      <div className={`station-pill ${expanded ? 'expanded' : ''}`}>
        <div className="pill-lines">
          {lineArr.map(num => (
            <span
              key={num}
              className="pill-circle"
              style={{ background: LINE_COLORS[`${num.trim()}-line`]?.color || '#999' }}
            >
              {num.trim()}
            </span>
          ))}
        </div>
        {stopCode != null && <span className="pill-code">{stopCode}</span>}
        <span className="pill-name">{name.replace(' Station', '')}</span>
        {expanded && junctionHints.length > 0 && (
          <div className="pill-hints">
            {junctionHints.map((hint) => (
              <span key={hint.line} className="pill-hint">
                <kbd>{ARROW_SYMBOLS[hint.arrowKey]}</kbd>
                {hint.line === '1-line' ? '1' : '2'}
              </span>
            ))}
          </div>
        )}
      </div>
    </Marker>
  )
}

const SEATTLE_CENTER = [-122.33, 47.60]
const SEATTLE_ZOOM = 11.5

const WALKSHED_OPTIONS = [5, 10, 15]

const WALKSHED_STYLES = {
  15: { opacity: 0.10, outlineOpacity: 0.3 },
  10: { opacity: 0.15, outlineOpacity: 0.4 },
  5:  { opacity: 0.22, outlineOpacity: 0.6 },
}

const LINE_COLORS = {
  '1-line': { color: '#4CAF50', label: '1 Line' },
  '2-line': { color: '#0082C8', label: '2 Line' },
}

const WALKSHED_ACCENT = '#2D2B6B'

function polygonToLine(geojson) {
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

async function fetchWalkshed(lng, lat, minutes) {
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}`
    + `?contours_minutes=${minutes}&polygons=true&access_token=${MAPBOX_TOKEN}`
  const resp = await fetch(url)
  if (!resp.ok) return null
  return resp.json()
}

export default function App() {
  const [popup, setPopup] = useState(null)
  const [walksheds, setWalksheds] = useState({})
  const [enabledWalksheds, setEnabledWalksheds] = useState(new Set([5, 10, 15]))
  const [currentLine, setCurrentLine] = useState(null)
  const [junctionHints, setJunctionHints] = useState([])
  const [darkMode, setDarkMode] = useState(false)
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [iconsReady, setIconsReady] = useState(false)
  const mapRef = useRef(null)
  const selectedStationRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}line1-alignment.geojson`).then(r => r.json()).then(setLine1Data)
    fetch(`${base}line2-alignment.geojson`).then(r => r.json()).then(setLine2Data)
    fetch(`${base}all-stations.geojson`).then(r => r.json()).then(setStationsData)
  }, [])

  useEffect(() => {
    if (stationsData) graphRef.current = buildGraph(stationsData)
  }, [stationsData])

  useEffect(() => {
    if (!mapLoaded || !stationsData) return
    const map = mapRef.current?.getMap()
    if (!map) return
    registerStationIcons(map, stationsData).then(() => setIconsReady(true))
  }, [mapLoaded, stationsData])

  const handleMapLoad = useCallback(() => setMapLoaded(true), [])

  // Apply dark/light mode to map
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) return
    map.setConfigProperty('basemap', 'lightPreset', darkMode ? 'dusk' : 'day')
  }, [darkMode, mapLoaded])

  const handleWalkshedToggle = useCallback((minutes) => {
    setEnabledWalksheds(prev => {
      const next = new Set(prev)
      if (next.has(minutes)) next.delete(minutes)
      else next.add(minutes)
      return next
    })
  }, [])

  const selectStation = useCallback((name, lng, lat, line) => {
    selectedStationRef.current = { name, lng, lat }
    const feat = stationsData?.features.find(f => f.properties.name === name)
    const stopCode = feat?.properties.stopCode ?? null
    const lines = feat?.properties.lines ?? line.replace('-line', '')
    setPopup({ longitude: lng, latitude: lat, name, line, stopCode, lines })
    setCurrentLine(line)
    setWalksheds({})

    if (graphRef.current && isJunction(graphRef.current, name)) {
      setJunctionHints(getJunctionHints(graphRef.current, name))
    } else {
      setJunctionHints([])
    }

    // Fetch all walkshed isochrones, then fit map to 15-min bounds
    const results = {}
    Promise.all(
      WALKSHED_OPTIONS.map(async (min) => {
        const data = await fetchWalkshed(lng, lat, min)
        if (data) results[min] = data
      })
    ).then(() => {
      if (selectedStationRef.current?.name !== name) return
      setWalksheds(results)

      // Fit map to 15-min walkshed bounds with buffer
      const ws15 = results[15]
      if (ws15?.features?.[0]?.geometry?.coordinates?.[0]) {
        const coords = ws15.features[0].geometry.coordinates[0]
        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
        for (const [cLng, cLat] of coords) {
          if (cLng < minLng) minLng = cLng
          if (cLng > maxLng) maxLng = cLng
          if (cLat < minLat) minLat = cLat
          if (cLat > maxLat) maxLat = cLat
        }
        mapRef.current?.fitBounds(
          [[minLng, minLat], [maxLng, maxLat]],
          { padding: 60, duration: 600 }
        )
      }
    })
  }, [stationsData])

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
    setCurrentLine(null)
    setJunctionHints([])
  }, [selectStation])

  // Navigate to adjacent station in a given arrow-key direction
  const navigateDirection = useCallback((arrowKey) => {
    if (!graphRef.current || !selectedStationRef.current) return false
    const result = getNextStation(graphRef.current, selectedStationRef.current.name, arrowKey, currentLine)
    if (!result) return false
    const nextNode = graphRef.current.get(result.name)
    if (!nextNode) return false
    selectStation(result.name, nextNode.coords[0], nextNode.coords[1], result.line)
    return true
  }, [currentLine, selectStation])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      if (navigateDirection(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateDirection])

  // Trackpad scroll / mouse wheel navigation (when a station is selected)
  useEffect(() => {
    const SCROLL_THRESHOLD = 80
    let accumX = 0
    let accumY = 0
    let cooldown = false

    const handleWheel = (e) => {
      if (!selectedStationRef.current) return

      accumX += e.deltaX
      accumY += e.deltaY

      if (cooldown) return

      let arrowKey = null
      // Map scroll direction to route navigation:
      // Scroll/swipe toward top of screen → go north (up the route)
      // deltaY < 0 = scroll toward top of screen (regardless of natural scroll setting,
      // the OS normalizes deltaY so negative = toward top)
      if (Math.abs(accumY) > Math.abs(accumX)) {
        if (accumY < -SCROLL_THRESHOLD) arrowKey = 'ArrowUp'
        else if (accumY > SCROLL_THRESHOLD) arrowKey = 'ArrowDown'
      } else {
        if (accumX < -SCROLL_THRESHOLD) arrowKey = 'ArrowLeft'
        else if (accumX > SCROLL_THRESHOLD) arrowKey = 'ArrowRight'
      }

      if (arrowKey && navigateDirection(arrowKey)) {
        e.preventDefault()
        accumX = 0
        accumY = 0
        cooldown = true
        setTimeout(() => { cooldown = false }, 400)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => window.removeEventListener('wheel', handleWheel)
  }, [navigateDirection])

  // Touch swipe navigation (mobile)
  useEffect(() => {
    let startX = 0
    let startY = 0
    const SWIPE_THRESHOLD = 50

    const handleTouchStart = (e) => {
      if (!selectedStationRef.current) return
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const handleTouchEnd = (e) => {
      if (!selectedStationRef.current) return
      const dx = e.changedTouches[0].clientX - startX
      const dy = e.changedTouches[0].clientY - startY

      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return

      // Drag/pan semantics: dragging up reveals what's south (like panning a map)
      let arrowKey = null
      if (Math.abs(dy) > Math.abs(dx)) {
        arrowKey = dy < 0 ? 'ArrowDown' : 'ArrowUp'
      } else {
        arrowKey = dx < 0 ? 'ArrowRight' : 'ArrowLeft'
      }

      navigateDirection(arrowKey)
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigateDirection])

  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  const walkshedLayers = [15, 10, 5]

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
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
            theme: 'default',
            lightPreset: 'day',
            showPointOfInterestLabels: true,
            densityPointOfInterestLabels: 5,
          },
        }}
      >
        {/* Walkshed isochrones */}
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
                  paint={{ 'fill-color': WALKSHED_ACCENT, 'fill-opacity': style.opacity }}
                />
                <Layer
                  id={`walkshed-outline-${min}`}
                  type="line"
                  paint={{ 'line-color': WALKSHED_ACCENT, 'line-width': min === 5 ? 2 : 1.5, 'line-opacity': style.outlineOpacity }}
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
                    'text-color': WALKSHED_ACCENT,
                    'text-halo-color': darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)',
                    'text-halo-width': 1.5,
                  }}
                />
              </Source>
            </span>
          )
        })}

        {/* Line 1 */}
        {mapLoaded && line1Data && (
          <Source id="line-1" type="geojson" data={line1Data}>
            <Layer id="line-1-casing" type="line" paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }} />
            <Layer id="line-1-stroke" type="line" paint={{ 'line-color': LINE_COLORS['1-line'].color, 'line-width': 4, 'line-opacity': 0.9 }} />
          </Source>
        )}

        {/* Line 2 */}
        {mapLoaded && line2Data && (
          <Source id="line-2" type="geojson" data={line2Data}>
            <Layer id="line-2-casing" type="line" paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }} />
            <Layer id="line-2-stroke" type="line" paint={{ 'line-color': LINE_COLORS['2-line'].color, 'line-width': 4, 'line-opacity': 0.9 }} />
          </Source>
        )}

        {/* Stations — hide selected so the Marker replaces it seamlessly */}
        {mapLoaded && iconsReady && stationsData && (
          <Source id="stations" type="geojson" data={stationsData}>
            <Layer
              id="station-circles"
              type="symbol"
              filter={popup ? ['!=', ['get', 'name'], popup.name] : ['has', 'name']}
              layout={{
                'icon-image': ['concat', 'station-', darkMode ? 'dark' : 'light', '-', ['get', 'lines'], '-', ['to-string', ['get', 'stopCode']]],
                'icon-size': 0.9,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
            />
          </Source>
        )}

        {/* Selected station — starts as compact pill, expands to show name */}
        {popup && (
          <ExpandingPill
            key={popup.name}
            longitude={popup.longitude}
            latitude={popup.latitude}
            lines={popup.lines || popup.line.replace('-line', '')}
            stopCode={popup.stopCode}
            name={popup.name}
            junctionHints={junctionHints}
          />
        )}
      </Map>

      <LineLegend
        lineColors={LINE_COLORS}
        enabledWalksheds={enabledWalksheds}
        walkshedAccent={WALKSHED_ACCENT}
        onWalkshedToggle={handleWalkshedToggle}
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(d => !d)}
      />
    </div>
  )
}
