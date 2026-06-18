'use client'

import { useEffect, useRef } from 'react'

interface DriverRouteMapComponentProps {
  driverLat: number | null
  driverLng: number | null
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

  // Helper to fetch actual road route from OSRM
  const fetchRouteAndDraw = async (L: any, map: any, fromLat: number, fromLng: number, toLat: number, toLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
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
    routeLineRef.current = L.polyline([[fromLat, fromLng], [toLat, toLng]], {
      color: '#3D6B4F',
      weight: 4,
      dashArray: '5, 10'
    }).addTo(map)
  }

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
        const centerLat = driverLat || destLat
        const centerLng = driverLng || destLng
        const map = L.map(mapRef.current).setView([centerLat, centerLng], 15)
        mapInstanceRef.current = map

        // Use Google Maps road tiles for landmarks
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps'
        }).addTo(map)

        // Destination drop-off icon
        const destIcon = L.divIcon({
          html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">📍</div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        })

        const destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(map)
        destMarkerRef.current = destMarker

        // Add driver marker if available
        if (driverLat !== null && driverLng !== null) {
          const driverIcon = L.divIcon({
            html: `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">🛵</div>`,
            className: 'custom-div-icon',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })

          const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map)
          driverMarkerRef.current = driverMarker

          fetchRouteAndDraw(L, map, driverLat, driverLng, destLat, destLng)

          const bounds = L.latLngBounds([[driverLat, driverLng], [destLat, destLng]])
          map.fitBounds(bounds, { padding: [30, 30] })
        } else {
          // Just center on destination
          map.setView([destLat, destLng], 16)
        }
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
        
        if (destMarkerRef.current) {
          destMarkerRef.current.setLatLng([destLat, destLng])
        }

        if (driverLat !== null && driverLng !== null) {
          if (driverMarkerRef.current) {
            driverMarkerRef.current.setLatLng([driverLat, driverLng])
          } else {
            const driverIcon = L.divIcon({
              html: `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">🛵</div>`,
              className: 'custom-div-icon',
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            })
            driverMarkerRef.current = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map)
          }

          fetchRouteAndDraw(L, map, driverLat, driverLng, destLat, destLng)

          // Fit bounds
          const bounds = L.latLngBounds([[driverLat, driverLng], [destLat, destLng]])
          map.fitBounds(bounds, { padding: [30, 30] })
        } else {
          // No driver coordinates, just center on destination
          map.panTo([destLat, destLng])
        }
      })
    }
  }, [driverLat, driverLng, destLat, destLng])

  return (
    <div className="relative w-full h-[180px] rounded-xl overflow-hidden border border-linen shadow-xs">
      <div ref={mapRef} className="w-full h-full z-0" />
    </div>
  )
}
