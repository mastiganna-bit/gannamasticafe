'use client'

import { useEffect, useRef } from 'react'

interface DriverRouteMapComponentProps {
  driverLat: number
  driverLng: number
  destLat: number
  destLng: number
}

export default function DriverRouteMapComponent({
  driverLat,
  driverLng,
  destLat,
  destLng
}: DriverRouteMapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)

  useEffect(() => {
    // Inject Leaflet CSS dynamically if not already loaded
    const linkId = 'leaflet-css'
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Dynamic import of Leaflet client-side only
    import('leaflet').then((L) => {
      if (!mapRef.current) return

      // Initialize map instance if not already done
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current)
        mapInstanceRef.current = map

        // Use Google Maps road tiles for landmarks
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps'
        }).addTo(map)

        // Driver scooter icon
        const driverIcon = L.divIcon({
          html: `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">🛵</div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })

        // Destination drop-off icon
        const destIcon = L.divIcon({
          html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">📍</div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        })

        // Add markers and polyline
        const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map)
        const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map)
        
        // Draw route line
        const routeLine = L.polyline([[driverLat, driverLng], [destLat, destLng]], {
          color: '#3D6B4F',
          weight: 4,
          dashArray: '5, 10'
        }).addTo(map)

        driverMarkerRef.current = driverMarker
        destMarkerRef.current = destMarker
        routeLineRef.current = routeLine

        // Fit map bounds to encompass both points
        const bounds = L.latLngBounds([[driverLat, driverLng], [destLat, destLng]])
        map.fitBounds(bounds, { padding: [30, 30] })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        driverMarkerRef.current = null
        destMarkerRef.current = null
        routeLineRef.current = null
      }
    }
  }, [])

  // Sync positions when coordinates update
  useEffect(() => {
    if (mapInstanceRef.current) {
      import('leaflet').then((L) => {
        const map = mapInstanceRef.current
        
        if (driverMarkerRef.current) {
          driverMarkerRef.current.setLatLng([driverLat, driverLng])
        }
        if (destMarkerRef.current) {
          destMarkerRef.current.setLatLng([destLat, destLng])
        }
        if (routeLineRef.current) {
          routeLineRef.current.setLatLngs([[driverLat, driverLng], [destLat, destLng]])
        }

        // Fit map bounds on updates
        const bounds = L.latLngBounds([[driverLat, driverLng], [destLat, destLng]])
        map.fitBounds(bounds, { padding: [30, 30] })
      })
    }
  }, [driverLat, driverLng, destLat, destLng])

  return (
    <div className="relative w-full h-[180px] rounded-xl overflow-hidden border border-linen shadow-xs">
      <div ref={mapRef} className="w-full h-full z-0" />
    </div>
  )
}
