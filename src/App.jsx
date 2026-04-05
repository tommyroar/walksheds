import { useState, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Marker } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { buildGraph, getNextStation, isJunction, getJunctionHints } from './routeGraph'
import { registerStationIcons } from './stationIcons'
import LineLegend from './LineLegend'
import './App.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

const ARROW_SYMBOLS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }

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
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [iconsReady, setIconsReady] = useState(false)
  const mapRef = useRef(null)
  const selectedStationRef = useRef(null)
  const graphRef = useRef(null)

  useEffect(() => {
    fetch('/line1-alignment.geojson').then(r => r.json()).then(setLine1Data)
    fetch('/line2-alignment.geojson').then(r => r.json()).then(setLine2Data)
    fetch('/all-stations.geojson').then(r => r.json()).then(setStationsData)
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

  const handleWalkshedToggle = useCallback((minutes) => {
    setEnabledWalksheds(prev => {
      const next = new Set(prev)
      if (next.has(minutes)) next.delete(minutes)
      else next.add(minutes)
      return next
    })
  }, [])

  const selectStation = useCallback((name, lng, lat, line, fly = false) => {
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

    if (fly) mapRef.current?.flyTo({ center: [lng, lat], duration: 600 })

    const results = {}
    Promise.all(
      WALKSHED_OPTIONS.map(async (min) => {
        const data = await fetchWalkshed(lng, lat, min)
        if (data) results[min] = data
      })
    ).then(() => {
      if (selectedStationRef.current?.name === name) setWalksheds(results)
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!graphRef.current || !selectedStationRef.current) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      const result = getNextStation(graphRef.current, selectedStationRef.current.name, e.key, currentLine)
      if (!result) return
      e.preventDefault()
      const nextNode = graphRef.current.get(result.name)
      if (!nextNode) return
      selectStation(result.name, nextNode.coords[0], nextNode.coords[1], result.line, true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentLine, selectStation])

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
    <div className="app">
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
          basemap: { theme: 'default', lightPreset: 'day' },
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
                    'text-halo-color': 'rgba(255,255,255,0.8)',
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

        {/* Stations */}
        {mapLoaded && iconsReady && stationsData && (
          <Source id="stations" type="geojson" data={stationsData}>
            <Layer
              id="station-circles"
              type="symbol"
              layout={{
                'icon-image': ['concat', 'station-', ['get', 'lines'], '-', ['to-string', ['get', 'stopCode']]],
                'icon-size': 0.9,
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
            />
          </Source>
        )}

        {/* Selected station — expanded pill */}
        {popup && (
          <Marker longitude={popup.longitude} latitude={popup.latitude} anchor="center">
            <div className="station-expanded-pill">
              <div className="expanded-pill-lines">
                {(popup.lines || popup.line.replace('-line', '')).split(',').map(num => (
                  <span
                    key={num}
                    className="expanded-pill-circle"
                    style={{ background: LINE_COLORS[`${num.trim()}-line`]?.color || '#999' }}
                  >
                    {num.trim()}
                  </span>
                ))}
              </div>
              {popup.stopCode != null && (
                <span className="expanded-pill-code">{popup.stopCode}</span>
              )}
              <span className="expanded-pill-name">{popup.name.replace(' Station', '')}</span>
              {junctionHints.length > 0 && (
                <div className="expanded-pill-hints">
                  {junctionHints.map((hint) => (
                    <span key={hint.line} className="expanded-pill-hint">
                      <kbd>{ARROW_SYMBOLS[hint.arrowKey]}</kbd>
                      {hint.line === '1-line' ? '1' : '2'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Marker>
        )}
      </Map>

      <LineLegend
        lineColors={LINE_COLORS}
        enabledWalksheds={enabledWalksheds}
        walkshedAccent={WALKSHED_ACCENT}
        onWalkshedToggle={handleWalkshedToggle}
      />
    </div>
  )
}
