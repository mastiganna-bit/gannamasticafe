'use client'

import { useEffect, useRef } from 'react'

interface MapComponentProps {
  latitude: number
  longitude: number
  destLat?: number | null
  destLng?: number | null
  customerName?: string
  deliveryAddress?: string
}

export default function MapComponent({
  latitude,
  longitude,
  destLat,
  destLng,
  customerName,
  deliveryAddress
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const driverMarkerRef = useRef<any>(null)
  const destMarkerRef = useRef<any>(null)
  const routeLineRef = useRef<any>(null)

  const CAFE_LAT = 28.881093
  const CAFE_LNG = 76.577976

  // Helper to fetch actual road route from OSRM
  const fetchRouteAndDraw = async (L: any, map: any, fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    try {
      // Fetch route from Cafe to Driver to Customer Home
      const url = `https://router.project-osrm.org/route/v1/driving/${CAFE_LNG},${CAFE_LAT};${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const data = await res.json()
      
      if (data && data.routes && data.routes.length > 0) {
        const routeCoords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
        
        // Remove old route line if exists
        if (routeLineRef.current) {
          map.removeLayer(routeLineRef.current)
        }
        
        // Draw actual route
        routeLineRef.current = L.polyline(routeCoords, {
          color: '#3D6B4F',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(map)
      } else {
        drawFallbackStraightLine(L, map, fromLat, fromLng, toLat, toLng)
      }
    } catch (e) {
      console.error('OSRM route fetch failed, using straight line:', e)
      drawFallbackStraightLine(L, map, fromLat, fromLng, toLat, toLng)
    }
  }

  const drawFallbackStraightLine = (L: any, map: any, fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current)
    }
    const points = [[CAFE_LAT, CAFE_LNG], [fromLat, fromLng]]
    if (toLat && toLng) {
      points.push([toLat, toLng])
    }
    routeLineRef.current = L.polyline(points, {
      color: '#3D6B4F',
      weight: 4,
      dashArray: '5, 10'
    }).addTo(map)
  }

  useEffect(() => {
    // Inject Leaflet CSS dynamically
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
        const map = L.map(mapRef.current).setView([latitude, longitude], 15)
        
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps'
        }).addTo(map)

        // Cafe icon
        const cafeIcon = L.divIcon({
          html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 11px;">☕</div>`,
          className: 'custom-div-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
        const cafeMarker = L.marker([CAFE_LAT, CAFE_LNG], { icon: cafeIcon }).addTo(map)
        cafeMarker.bindPopup("<b>Gannamasti Cafe</b>")

        // Custom delivery icon (green scooter/pin)
        const deliveryIcon = L.divIcon({
          html: `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">🛵</div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
        const driverMarker = L.marker([latitude, longitude], { icon: deliveryIcon }).addTo(map)
        driverMarker.bindPopup("<b>Delivery Agent</b><br>Out for delivery...").openPopup()
        driverMarkerRef.current = driverMarker

        // Destination drop-off icon
        if (destLat && destLng) {
          const destIcon = L.divIcon({
            html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 11px;">📍</div>`,
            className: 'custom-div-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
          })
          const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map)
          destMarker.bindPopup(`<b>${customerName || 'Customer'}</b><br>${deliveryAddress || ''}`)
          destMarkerRef.current = destMarker

          fetchRouteAndDraw(L, map, latitude, longitude, destLat, destLng)
          const bounds = L.latLngBounds([[CAFE_LAT, CAFE_LNG], [latitude, longitude], [destLat, destLng]])
          map.fitBounds(bounds, { padding: [30, 30] })
        } else {
          map.setView([latitude, longitude], 15)
        }

        mapInstanceRef.current = map
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

  // Update marker position dynamically when coordinates change
  useEffect(() => {
    if (mapInstanceRef.current && driverMarkerRef.current) {
      import('leaflet').then((L) => {
        const map = mapInstanceRef.current
        const newLatLng = L.latLng(latitude, longitude)
        driverMarkerRef.current.setLatLng(newLatLng)
        
        if (destLat && destLng) {
          if (destMarkerRef.current) {
            destMarkerRef.current.setLatLng([destLat, destLng])
          }
          fetchRouteAndDraw(L, map, latitude, longitude, destLat, destLng)
          
          const bounds = L.latLngBounds([[CAFE_LAT, CAFE_LNG], newLatLng, [destLat, destLng]])
          map.fitBounds(bounds, { padding: [30, 30] })
        } else {
          map.panTo(newLatLng)
        }
      })
    }
  }, [latitude, longitude, destLat, destLng])

  return (
    <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-linen shadow-xs">
      <div ref={mapRef} className="w-full h-full z-0" />
    </div>
  )
}
