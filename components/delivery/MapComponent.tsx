'use client'

import { useEffect, useRef } from 'react'

interface MapComponentProps {
  latitude: number
  longitude: number
}

export default function MapComponent({ latitude, longitude }: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

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
        const map = L.map(mapRef.current).setView([latitude, longitude], 16)
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors'
        }).addTo(map)

        // Custom delivery icon (green scooter/pin)
        const deliveryIcon = L.divIcon({
          html: `<div style="background-color: #3D6B4F; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); font-size: 14px;">🛵</div>`,
          className: 'custom-div-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })

        const marker = L.marker([latitude, longitude], { icon: deliveryIcon }).addTo(map)
        marker.bindPopup("<b>Delivery Agent</b><br>Out for delivery...").openPopup()

        mapInstanceRef.current = map
        markerRef.current = marker
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [])

  // Update marker position dynamically when coordinates change
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current) {
      import('leaflet').then((L) => {
        const newLatLng = L.latLng(latitude, longitude)
        markerRef.current.setLatLng(newLatLng)
        mapInstanceRef.current.panTo(newLatLng)
      })
    }
  }, [latitude, longitude])

  return (
    <div className="relative w-full h-[220px] rounded-xl overflow-hidden border border-linen shadow-xs">
      <div ref={mapRef} className="w-full h-full z-0" />
    </div>
  )
}
