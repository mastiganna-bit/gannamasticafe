'use client'

import { useEffect, useRef, useState } from 'react'

type Coordinates = { lat: number; lng: number }
type GoogleListener = { remove: () => void }
type GoogleLatLng = { lat: number | (() => number); lng: number | (() => number) }
type GoogleMapInstance = {
  setCenter: (position: Coordinates) => void
  setZoom: (zoom: number) => void
  addListener: (event: string, listener: (event: { latLng?: GoogleLatLng }) => void) => GoogleListener
}
type GoogleMarkerInstance = {
  position: GoogleLatLng | null
  map: GoogleMapInstance | null
  addListener: (event: string, listener: () => void) => GoogleListener
}
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance
    marker: {
      AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarkerInstance
      PinElement: new (options: Record<string, unknown>) => { element: HTMLElement }
    }
  }
}

declare global {
  interface Window {
    google?: GoogleMapsApi
    __gannamastiGoogleMapsReady?: () => void
    gm_authFailure?: () => void
  }
}

let googleMapsPromise: Promise<GoogleMapsApi> | null = null

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps?.marker) return Promise.resolve(window.google)
  if (googleMapsPromise) return googleMapsPromise
  googleMapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const callbackName = '__gannamastiGoogleMapsReady'
    window[callbackName] = () => {
      if (window.google) resolve(window.google)
      else reject(new Error('Google Maps did not initialize.'))
      delete window[callbackName]
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => {
      googleMapsPromise = null
      delete window[callbackName]
      reject(new Error('Google Maps could not be loaded.'))
    }
    document.head.appendChild(script)
  })
  return googleMapsPromise
}

function numberCoordinate(value: number | (() => number)) {
  return typeof value === 'function' ? value() : Number(value)
}

export default function GoogleLocationPickerMap({
  apiKey,
  mapId,
  latitude,
  longitude,
  onChange,
  className = '',
  onUnavailable,
}: {
  apiKey: string
  mapId: string
  latitude: number | null
  longitude: number | null
  onChange: (latitude: number, longitude: number) => void
  className?: string
  onUnavailable: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMapInstance | null>(null)
  const markerRef = useRef<GoogleMarkerInstance | null>(null)
  const apiRef = useRef<GoogleMapsApi | null>(null)
  const onChangeRef = useRef(onChange)
  const coordinatesRef = useRef({ latitude, longitude })
  const [ready, setReady] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { coordinatesRef.current = { latitude, longitude } }, [latitude, longitude])

  useEffect(() => {
    let cancelled = false
    const listeners: GoogleListener[] = []

    async function initialize() {
      try {
        window.gm_authFailure = onUnavailable
        const api = await loadGoogleMaps(apiKey)
        if (cancelled || !containerRef.current) return
        apiRef.current = api
        const current = coordinatesRef.current
        const hasLocation = current.latitude !== null && current.longitude !== null
        const center = hasLocation ? { lat: current.latitude!, lng: current.longitude! } : { lat: 28.8955, lng: 76.6066 }
        const map = new api.maps.Map(containerRef.current, {
          center,
          zoom: hasLocation ? 18 : 13,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map

        const placeMarker = (position: Coordinates) => {
          if (!markerRef.current) {
            const pin = new api.maps.marker.PinElement({ background: '#3D6B4F', borderColor: '#FFFFFF', glyphColor: '#FFFFFF', scale: 1.15 })
            const marker = new api.maps.marker.AdvancedMarkerElement({
              map,
              position,
              content: pin.element,
              gmpDraggable: true,
              title: 'Drag to set your exact delivery location',
            })
            listeners.push(marker.addListener('dragend', () => {
              if (!marker.position) return
              onChangeRef.current(numberCoordinate(marker.position.lat), numberCoordinate(marker.position.lng))
            }))
            markerRef.current = marker
          } else {
            markerRef.current.position = position
          }
        }

        if (hasLocation) placeMarker(center)
        listeners.push(map.addListener('click', (event) => {
          if (!event.latLng) return
          const position = { lat: numberCoordinate(event.latLng.lat), lng: numberCoordinate(event.latLng.lng) }
          placeMarker(position)
          onChangeRef.current(position.lat, position.lng)
        }))
        setReady(true)
      } catch {
        if (!cancelled) onUnavailable()
      }
    }

    void initialize()
    return () => {
      cancelled = true
      listeners.forEach((listener) => listener.remove())
      if (markerRef.current) markerRef.current.map = null
      if (window.gm_authFailure === onUnavailable) delete window.gm_authFailure
      markerRef.current = null
      mapRef.current = null
      apiRef.current = null
    }
  }, [apiKey, mapId, onUnavailable])

  useEffect(() => {
    if (!ready || latitude === null || longitude === null || !mapRef.current || !apiRef.current) return
    const position = { lat: latitude, lng: longitude }
    if (!markerRef.current) {
      const pin = new apiRef.current.maps.marker.PinElement({ background: '#3D6B4F', borderColor: '#FFFFFF', glyphColor: '#FFFFFF', scale: 1.15 })
      const marker = new apiRef.current.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position,
        content: pin.element,
        gmpDraggable: true,
        title: 'Drag to set your exact delivery location',
      })
      marker.addListener('dragend', () => {
        if (!marker.position) return
        onChangeRef.current(numberCoordinate(marker.position.lat), numberCoordinate(marker.position.lng))
      })
      markerRef.current = marker
    } else {
      markerRef.current.position = position
    }
    mapRef.current.setCenter(position)
    mapRef.current.setZoom(18)
  }, [latitude, longitude, ready])

  const hasLocation = latitude !== null && longitude !== null
  return (
    <section className={className} aria-label="Choose delivery location on Google Maps">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cocoa">Confirm your delivery pin</p>
          <p className="mt-0.5 text-xs leading-relaxed text-cocoa-muted">Drag the green pin or tap Google Maps to correct the exact location.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${hasLocation ? 'bg-sage/10 text-sage-dark' : 'bg-amber-50 text-amber-700'}`}>
          {hasLocation ? 'PIN SELECTED' : 'SELECT PIN'}
        </span>
      </div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-2xl border border-linen bg-cream sm:h-72" />
      {hasLocation ? <p className="mt-2 text-[11px] text-cocoa-muted">Saved coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)} · Google Maps</p> : <p className="mt-2 text-[11px] font-medium text-amber-700">Use GPS or tap your house location on the map before choosing delivery.</p>}
    </section>
  )
}
