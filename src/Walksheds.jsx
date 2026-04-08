import { useState, useCallback, useRef, useEffect } from 'react'
import { buildGraph, isJunction, getJunctionHints } from './routeGraph'
import { fetchWalkshed, getLargestEnabledBounds } from './mapbox'
import { WALKSHED_OPTIONS, LINE_COLORS, WALKSHED_ACCENT_LIGHT, WALKSHED_ACCENT_DARK } from './constants'
import { parseStationPath, buildStationPath, findStationByCode, parseWalkshedParams, buildWalkshedParams } from './deepLink'
import { useNavigation } from './useNavigation'
import MapView from './MapView'
import LineLegend from './LineLegend'
import './walksheds.css'

function computeLegendPosition(map, walksheds, enabledWalksheds) {
  if (!map) return 'bottom-left'
  const bounds = getLargestEnabledBounds(walksheds, enabledWalksheds)
  if (!bounds) return 'bottom-left'

  try {
    const topLeft = map.project(bounds[0])
    const bottomRight = map.project(bounds[1])
    const wsLeft = Math.min(topLeft.x, bottomRight.x)
    const wsBottom = Math.max(topLeft.y, bottomRight.y)
    // Legend is ~180px wide, ~280px tall, at bottom-left with 16px margin + 32px bottom
    const container = map.getContainer()
    const h = container.clientHeight
    const legendBottom = h - 32
    const legendLeft = 16
    const legendRight = legendLeft + 180
    const legendTop = legendBottom - 280
    // Check if walkshed polygon overlaps the bottom-left legend area
    if (wsLeft < legendRight && wsBottom > legendTop) {
      return 'bottom-right'
    }
  } catch {
    // map.project can throw if map not ready
  }
  return 'bottom-left'
}

export default function Walksheds() {
  const [popup, setPopup] = useState(null)
  const [walksheds, setWalksheds] = useState({})
  const [enabledWalksheds, setEnabledWalksheds] = useState(() => {
    const fromUrl = parseWalkshedParams(window.location.search)
    return fromUrl || new Set([5, 10, 15])
  })
  const [currentLine, setCurrentLine] = useState(null)
  const [junctionHints, setJunctionHints] = useState([])
  const [darkMode, setDarkMode] = useState(false)
  const [line1Data, setLine1Data] = useState(null)
  const [line2Data, setLine2Data] = useState(null)
  const [stationsData, setStationsData] = useState(null)
  const [legendCollapsed, setLegendCollapsed] = useState(() => window.innerWidth < 480)
  const [legendPosition, setLegendPosition] = useState('bottom-left')
  const mapViewRef = useRef(null)
  const selectedStationRef = useRef(null)
  const graphRef = useRef(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    fetch(`${base}line1-alignment.geojson`).then(r => r.json()).then(setLine1Data)
    fetch(`${base}line2-alignment.geojson`).then(r => r.json()).then(setLine2Data)
    fetch(`${base}all-stations.geojson`).then(r => r.json()).then(setStationsData)
  }, [])

  useEffect(() => {
    if (stationsData) graphRef.current = buildGraph(stationsData)
  }, [stationsData])

  const handleWalkshedToggle = useCallback((minutes) => {
    const next = new Set(enabledWalksheds)
    if (next.has(minutes)) next.delete(minutes)
    else next.add(minutes)
    setEnabledWalksheds(next)

    if (Object.keys(walksheds).length) {
      const map = mapViewRef.current?.getMap()
      setLegendPosition(computeLegendPosition(map, walksheds, next))
    }
  }, [enabledWalksheds, walksheds])

  const selectStation = useCallback((name, lng, lat, line) => {
    selectedStationRef.current = { name, lng, lat }
    const feat = stationsData?.features.find(f => f.properties.name === name)
    const stopCode = feat?.properties.stopCode ?? null
    const lines = feat?.properties.lines ?? line.replace('-line', '')
    setPopup({ longitude: lng, latitude: lat, name, line, stopCode, lines })
    setCurrentLine(line)
    setWalksheds({})
    setLegendCollapsed(true)

    // Sync URL
    if (stopCode != null) {
      const base = import.meta.env.BASE_URL
      const lineNum = line.replace('-line', '')
      const path = buildStationPath(lineNum, stopCode, base) + buildWalkshedParams(enabledWalksheds)
      window.history.replaceState(null, '', path)
    }

    if (graphRef.current && isJunction(graphRef.current, name)) {
      setJunctionHints(getJunctionHints(graphRef.current, name))
    } else {
      setJunctionHints([])
    }

    const results = {}
    Promise.all(
      WALKSHED_OPTIONS.map(async (min) => {
        const data = await fetchWalkshed(lng, lat, min)
        if (data) results[min] = data
      })
    ).then(() => {
      if (selectedStationRef.current?.name !== name) return
      setWalksheds(results)

      const bounds = getLargestEnabledBounds(results, enabledWalksheds)
      if (bounds) {
        mapViewRef.current?.fitBounds(bounds, { padding: 60, duration: 600 })
      }

      const map = mapViewRef.current?.getMap()
      setLegendPosition(computeLegendPosition(map, results, enabledWalksheds))
    })
  }, [stationsData, enabledWalksheds])

  // Re-fit map when walkshed toggles change
  useEffect(() => {
    if (!Object.keys(walksheds).length) return
    const bounds = getLargestEnabledBounds(walksheds, enabledWalksheds)
    if (bounds) {
      mapViewRef.current?.fitBounds(bounds, { padding: 60, duration: 600 })
    }
  }, [enabledWalksheds, walksheds])

  const handleDeselect = useCallback(() => {
    selectedStationRef.current = null
    setPopup(null)
    setWalksheds({})
    setCurrentLine(null)
    setJunctionHints([])
    setLegendCollapsed(false)
    setLegendPosition('bottom-left')
    window.history.replaceState(null, '', import.meta.env.BASE_URL)
  }, [])

  // Resolve deep link on initial load
  useEffect(() => {
    if (!stationsData || resolvedRef.current) return
    resolvedRef.current = true
    const base = import.meta.env.BASE_URL
    const parsed = parseStationPath(window.location.pathname, base)
    if (!parsed) return
    const station = findStationByCode(stationsData, parsed.line, parsed.stopCode)
    if (!station) return
    // Defer to avoid synchronous setState in effect body (lint: react-hooks/set-state-in-effect)
    queueMicrotask(() => selectStation(station.name, station.lng, station.lat, station.line))
  }, [stationsData, selectStation])

  // Sync walkshed query params when toggles change
  useEffect(() => {
    if (!selectedStationRef.current) return
    const feat = stationsData?.features.find(f => f.properties.name === selectedStationRef.current.name)
    if (!feat) return
    const base = import.meta.env.BASE_URL
    const lineNum = currentLine?.replace('-line', '')
    if (!lineNum) return
    const path = buildStationPath(lineNum, feat.properties.stopCode, base) + buildWalkshedParams(enabledWalksheds)
    window.history.replaceState(null, '', path)
  }, [enabledWalksheds, stationsData, currentLine])

  useNavigation({ graphRef, selectedStationRef, currentLine, selectStation })

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      <MapView
        ref={mapViewRef}
        darkMode={darkMode}
        walksheds={walksheds}
        enabledWalksheds={enabledWalksheds}
        popup={popup}
        junctionHints={junctionHints}
        line1Data={line1Data}
        line2Data={line2Data}
        stationsData={stationsData}
        onStationClick={selectStation}
        onDeselect={handleDeselect}
      />

      <LineLegend
        lineColors={LINE_COLORS}
        enabledWalksheds={enabledWalksheds}
        walkshedAccent={darkMode ? WALKSHED_ACCENT_DARK : WALKSHED_ACCENT_LIGHT}
        onWalkshedToggle={handleWalkshedToggle}
        darkMode={darkMode}
        onDarkModeToggle={() => setDarkMode(d => !d)}
        collapsed={legendCollapsed}
        onToggleCollapse={() => setLegendCollapsed(c => !c)}
        position={legendPosition}
      />
    </div>
  )
}
