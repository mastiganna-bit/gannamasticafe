'use client'

import { useEffect, useRef } from 'react'

interface DriverLocation {
  driverId: string
  driverName: string
  vehicleNumber: string
  latitude: number
  longitude: number
  customerName?: string
  deliveryAddress?: string
  destLat?: number | null
  destLng?: number | null
}

interface AdminDriversMapComponentProps {
  drivers: DriverLocation[]
  focusDriverId?: string | null
}

export default function AdminDriversMapComponent({ drivers, focusDriverId }: AdminDriversMapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const routeLinesRef = useRef<Record<string, any>>({})
  
  // Default Cafe Coordinates (Rohtak location)
  const CAFE_LAT = 28.881093
  const CAFE_LNG = 76.577976

  // Helper to fetch actual road route from OSRM for a driver
  const fetchRouteAndDrawForDriver = async (L: any, map: any, driverId: string, driverLat: number, driverLng: number, destLat: number, destLng: number) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${CAFE_LNG},${CAFE_LAT};${driverLng},${driverLat};${destLng},${destLat}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const data = await res.json()
      
      if (data && data.routes && data.routes.length > 0) {
        const routeCoords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]])
        
        // Remove old route line if exists
        if (routeLinesRef.current[driverId]) {
          map.removeLayer(routeLinesRef.current[driverId])
        }
        
        // Draw actual route
        routeLinesRef.current[driverId] = L.polyline(routeCoords, {
          color: '#3D6B4F',
          weight: 3,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(map)
      } else {
        drawFallbackStraightLine(L, map, driverId, driverLat, driverLng, destLat, destLng)
      }
    } catch (e) {
      console.error('OSRM route fetch failed for driver:', e)
      drawFallbackStraightLine(L, map, driverId, driverLat, driverLng, destLat, destLng)
    }
  }

  const drawFallbackStraightLine = (L: any, map: any, driverId: string, driverLat: number, driverLng: number, destLat: number, destLng: number) => {
    if (routeLinesRef.current[driverId]) {
      map.removeLayer(routeLinesRef.current[driverId])
    }
    routeLinesRef.current[driverId] = L.polyline([[CAFE_LAT, CAFE_LNG], [driverLat, driverLng], [destLat, destLng]], {
      color: '#3D6B4F',
      weight: 3,
      dashArray: '5, 8',
      opacity: 0.7
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
        const map = L.map(mapRef.current).setView([CAFE_LAT, CAFE_LNG], 13)
        mapInstanceRef.current = map

        // Use Google Maps road tiles for landmarks
        L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps'
        }).addTo(map)

        // Cafe icon
        const cafeIcon = L.divIcon({
          html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4); font-size: 16px;">☕</div>`,
          className: 'custom-div-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        })

        const cafeMarker = L.marker([CAFE_LAT, CAFE_LNG], { icon: cafeIcon }).addTo(map)
        cafeMarker.bindPopup("<b>Gannamasti Cafe</b><br>Base Kitchen").openPopup()
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersRef.current = {}
        routeLinesRef.current = {}
      }
    }
  }, [])

  // Sync driver markers on changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      import('leaflet').then((L) => {
        const map = mapInstanceRef.current
        
        // Remove old markers that are no longer in the list
        const currentDriverIds = new Set(drivers.map(d => d.driverId))
        Object.keys(markersRef.current).forEach(key => {
          if (!currentDriverIds.has(key)) {
            // Remove driver marker
            map.removeLayer(markersRef.current[key].driverMarker)
            if (markersRef.current[key].destMarker) {
              map.removeLayer(markersRef.current[key].destMarker)
            }
            if (routeLinesRef.current[key]) {
              map.removeLayer(routeLinesRef.current[key])
              delete routeLinesRef.current[key]
            }
            delete markersRef.current[key]
          }
        })

        // Add or update markers
        drivers.forEach(driver => {
          const key = driver.driverId
          const driverPos = L.latLng(driver.latitude, driver.longitude)
          
          let driverIconHtml = `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px; position: relative;">
            🛵
            <span style="position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background-color: #3D6B4F; color: white; font-family: sans-serif; font-size: 8px; font-weight: bold; padding: 1px 4px; border-radius: 4px; border: 1px solid white; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">${driver.driverName.split(' ')[0]}</span>
          </div>`

          const driverIcon = L.divIcon({
            html: driverIconHtml,
            className: 'custom-div-icon',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })

          if (markersRef.current[key]) {
            // Update existing marker
            markersRef.current[key].driverMarker.setLatLng(driverPos)
            
            // Update destination marker if exists
            if (driver.destLat && driver.destLng) {
              const destPos = L.latLng(driver.destLat, driver.destLng)
              if (markersRef.current[key].destMarker) {
                markersRef.current[key].destMarker.setLatLng(destPos)
              } else {
                const destIcon = L.divIcon({
                  html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 11px;">📍</div>`,
                  className: 'custom-div-icon',
                  iconSize: [24, 24],
                  iconAnchor: [12, 24]
                })
                markersRef.current[key].destMarker = L.marker(destPos, { icon: destIcon }).addTo(map)
                markersRef.current[key].destMarker.bindPopup(`<b>Order for ${driver.customerName}</b><br>${driver.deliveryAddress}`)
              }

              // Update route line
              fetchRouteAndDrawForDriver(L, map, key, driver.latitude, driver.longitude, driver.destLat, driver.destLng)
            } else {
              // Remove destination marker & route if no active delivery
              if (markersRef.current[key].destMarker) {
                map.removeLayer(markersRef.current[key].destMarker)
                markersRef.current[key].destMarker = null
              }
              if (routeLinesRef.current[key]) {
                map.removeLayer(routeLinesRef.current[key])
                delete routeLinesRef.current[key]
              }
            }
          } else {
            // Create new markers
            const driverMarker = L.marker(driverPos, { icon: driverIcon }).addTo(map)
            driverMarker.bindPopup(`<b>${driver.driverName}</b><br>${driver.vehicleNumber}`)

            let destMarker = null
            if (driver.destLat && driver.destLng) {
              const destPos = L.latLng(driver.destLat, driver.destLng)
              const destIcon = L.divIcon({
                html: `<div style="background-color: #D25C37; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 11px;">📍</div>`,
                className: 'custom-div-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 24]
              })
              destMarker = L.marker(destPos, { icon: destIcon }).addTo(map)
              destMarker.bindPopup(`<b>Order for ${driver.customerName}</b><br>${driver.deliveryAddress}`)

              fetchRouteAndDrawForDriver(L, map, key, driver.latitude, driver.longitude, driver.destLat, driver.destLng)
            }

            markersRef.current[key] = {
              driverMarker,
              destMarker
            }
          }
        })
      })
    }
  }, [drivers])

  // Focus on selected driver when focusDriverId changes
  useEffect(() => {
    if (mapInstanceRef.current && focusDriverId) {
      const targetDriver = drivers.find(d => d.driverId === focusDriverId)
      if (targetDriver) {
        import('leaflet').then((L) => {
          const map = mapInstanceRef.current
          map.setView([targetDriver.latitude, targetDriver.longitude], 15, { animate: true })
          
          // Open driver's popup
          if (markersRef.current[focusDriverId]) {
            markersRef.current[focusDriverId].driverMarker.openPopup()
          }
        })
      }
    }
  }, [focusDriverId, drivers])

  return (
    <div className="relative w-full h-[400px] rounded-xl overflow-hidden border border-linen shadow-card">
      <div ref={mapRef} className="w-full h-full z-0" />
    </div>
  )
}
