import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import Map, { Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { registerStationIcons } from './stationIcons'
import { MAPBOX_TOKEN, SEATTLE_CENTER, SEATTLE_ZOOM, LINE_COLORS } from './constants'
import WalkshedLayers from './WalkshedLayers'
import StationPill from './StationPill'

const MapView = forwardRef(function MapView({
  darkMode,
  walksheds,
  enabledWalksheds,
  popup,
  junctionHints,
  line1Data,
  line2Data,
  stationsData,
  onStationClick,
  onDeselect,
}, ref) {
  const mapRef = useRef(null)
  const isDraggingRef = useRef(false)
  const mapLoadedRef = useRef(false)
  const iconsReadyRef = useRef(false)

  // Expose fitBounds and getMap to parent
  useImperativeHandle(ref, () => ({
    fitBounds: (bounds, opts) => mapRef.current?.fitBounds(bounds, opts),
    getMap: () => mapRef.current?.getMap(),
  }))

  // Track map loaded + icons ready for conditional rendering
  const [mapLoaded, setMapLoaded] = useState(false)
  const [iconsReady, setIconsReady] = useState(false)

  const handleMapLoad = useCallback(() => {
    mapLoadedRef.current = true
    setMapLoaded(true)
    if (import.meta.env.DEV) {
      window.__mapForTest = mapRef.current?.getMap()
    }
  }, [])

  useEffect(() => {
    if (!mapLoaded || !stationsData) return
    const map = mapRef.current?.getMap()
    if (!map) return
    registerStationIcons(map, stationsData).then(() => {
      iconsReadyRef.current = true
      setIconsReady(true)
    })
  }, [mapLoaded, stationsData])

  // Apply dark/light mode
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map || !mapLoaded) return
    map.setConfigProperty('basemap', 'lightPreset', darkMode ? 'dusk' : 'day')
  }, [darkMode, mapLoaded])

  const handleDragStart = useCallback(() => { isDraggingRef.current = true }, [])
  const handleDragEnd = useCallback(() => { isDraggingRef.current = false }, [])

  const handleMapClick = useCallback((e) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      return
    }
    const features = e.features
    if (features && features.length > 0) {
      const f = features[0]
      if (f.properties?.name) {
        onStationClick(f.properties.name, e.lngLat.lng, e.lngLat.lat, f.properties.line)
        return
      }
    }
    onDeselect()
  }, [onStationClick, onDeselect])

  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  return (
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
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
      <WalkshedLayers
        walksheds={walksheds}
        enabledWalksheds={enabledWalksheds}
        darkMode={darkMode}
        mapLoaded={mapLoaded}
      />

      {mapLoaded && line1Data && (
        <Source id="line-1" type="geojson" data={line1Data}>
          <Layer id="line-1-casing" type="line" paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }} />
          <Layer id="line-1-stroke" type="line" paint={{ 'line-color': LINE_COLORS['1-line'].color, 'line-width': 4, 'line-opacity': 0.9 }} />
        </Source>
      )}

      {mapLoaded && line2Data && (
        <Source id="line-2" type="geojson" data={line2Data}>
          <Layer id="line-2-casing" type="line" paint={{ 'line-color': '#000000', 'line-width': 7, 'line-opacity': 0.3 }} />
          <Layer id="line-2-stroke" type="line" paint={{ 'line-color': LINE_COLORS['2-line'].color, 'line-width': 4, 'line-opacity': 0.9 }} />
        </Source>
      )}

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

      {popup && (
        <StationPill
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
  )
})

export default MapView
