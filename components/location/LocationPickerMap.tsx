'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker as LeafletMarker } from 'leaflet'
import GoogleLocationPickerMap from './GoogleLocationPickerMap'

const ROHTAK_CENTER: [number, number] = [28.8955, 76.6066]

type Props = {
  latitude: number | null
  longitude: number | null
  onChange: (latitude: number, longitude: number) => void
  className?: string
}

export default function LocationPickerMap(props: Props) {
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  const googleMapId = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() || 'DEMO_MAP_ID'
  const [googleUnavailable, setGoogleUnavailable] = useState(false)
  const handleGoogleUnavailable = useCallback(() => setGoogleUnavailable(true), [])

  if (googleMapsKey && !googleUnavailable) {
    return <GoogleLocationPickerMap {...props} apiKey={googleMapsKey} mapId={googleMapId} onUnavailable={handleGoogleUnavailable} />
  }
  return <OpenStreetLocationPickerMap {...props} />
}

function OpenStreetLocationPickerMap({ latitude, longitude, onChange, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<LeafletMarker | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      if (!containerRef.current || mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !containerRef.current) return
      leafletRef.current = L

      const hasLocation = latitude !== null && longitude !== null
      const center: [number, number] = hasLocation ? [latitude, longitude] : ROHTAK_CENTER
      const map = L.map(containerRef.current, {
        center,
        zoom: hasLocation ? 17 : 13,
        zoomControl: true,
        attributionControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)
      mapRef.current = map

      const pinIcon = L.divIcon({
        className: 'location-picker-pin-wrapper',
        html: '<span class="location-picker-pin" aria-hidden="true"><span></span></span>',
        iconSize: [36, 46],
        iconAnchor: [18, 44],
      })

      const placeMarker = (lat: number, lng: number) => {
        if (!markerRef.current) {
          const marker = L.marker([lat, lng], { draggable: true, icon: pinIcon, title: 'Delivery location' }).addTo(map)
          marker.on('dragend', () => {
            const position = marker.getLatLng()
            onChangeRef.current(position.lat, position.lng)
          })
          markerRef.current = marker
        } else {
          markerRef.current.setLatLng([lat, lng])
        }
      }

      if (hasLocation) placeMarker(latitude, longitude)
      map.on('click', ({ latlng }) => {
        placeMarker(latlng.lat, latlng.lng)
        onChangeRef.current(latlng.lat, latlng.lng)
      })
      window.setTimeout(() => map.invalidateSize(), 0)
    }

    void initialize()
    return () => {
      cancelled = true
      markerRef.current = null
      leafletRef.current = null
      mapRef.current?.remove()
      mapRef.current = null
    }
    // The map is initialized once; coordinate changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (latitude === null || longitude === null || !mapRef.current || !leafletRef.current) return
    const L = leafletRef.current
    if (!markerRef.current) {
      const pinIcon = L.divIcon({
        className: 'location-picker-pin-wrapper',
        html: '<span class="location-picker-pin" aria-hidden="true"><span></span></span>',
        iconSize: [36, 46],
        iconAnchor: [18, 44],
      })
      const marker = L.marker([latitude, longitude], { draggable: true, icon: pinIcon, title: 'Delivery location' }).addTo(mapRef.current)
      marker.on('dragend', () => {
        const position = marker.getLatLng()
        onChangeRef.current(position.lat, position.lng)
      })
      markerRef.current = marker
    } else {
      markerRef.current.setLatLng([latitude, longitude])
    }
    mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 17))
  }, [latitude, longitude])

  const hasLocation = latitude !== null && longitude !== null
  return (
    <section className={className} aria-label="Choose delivery location on map">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-cocoa">Confirm your delivery pin</p>
          <p className="mt-0.5 text-xs leading-relaxed text-cocoa-muted">Drag the green pin or tap the map to correct the exact location.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${hasLocation ? 'bg-sage/10 text-sage-dark' : 'bg-amber-50 text-amber-700'}`}>
          {hasLocation ? 'PIN SELECTED' : 'SELECT PIN'}
        </span>
      </div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-2xl border border-linen bg-cream sm:h-72" />
      {hasLocation ? (
        <p className="mt-2 text-[11px] text-cocoa-muted">Saved coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
      ) : (
        <p className="mt-2 text-[11px] font-medium text-amber-700">Use GPS or tap your house location on the map before choosing delivery.</p>
      )}
    </section>
  )
}
