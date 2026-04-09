'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface LatLng {
  lat: number
  lng: number
}

interface PolygonMapProps {
  initialPolygon?: LatLng[]
  onChange?: (polygon: LatLng[]) => void
  readOnly?: boolean
  height?: string
  existingZones?: Array<{ id: string; name: string; polygon: LatLng[]; driverName?: string }>
}

export function PolygonMap({
  initialPolygon = [],
  onChange,
  readOnly = false,
  height = '400px',
  existingZones = []
}: PolygonMapProps) {
  const [polygon, setPolygon] = useState<LatLng[]>(initialPolygon)
  const [isDrawing, setIsDrawing] = useState(false)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polygonLayerRef = useRef<L.Polygon | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const clickLineLayerRef = useRef<L.Polyline | null>(null)
  const existingZonesLayersRef = useRef<L.Polygon[]>([])

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Create map
    const map = L.map(mapContainerRef.current, {
      center: [0.39, 9.45] as L.LatLngExpression,
      zoom: 12,
      zoomControl: true
    })

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map)

    mapRef.current = map

    // Add click handler
    if (!readOnly) {
      map.on('click', (e: any) => {
        if (!isDrawing) return
        const newPoint = { lat: e.latlng.lat, lng: e.latlng.lng }
        const newPolygon = [...polygon, newPoint]
        setPolygon(newPolygon)
        onChange?.(newPolygon)
      })
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [readOnly, isDrawing, polygon, onChange])

  // Draw polygon and markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing
    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current)
    }
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (clickLineLayerRef.current) {
      map.removeLayer(clickLineLayerRef.current)
    }

    // Draw polygon if we have 3+ points
    if (polygon.length >= 3) {
      const polygonLayer = L.polygon(polygon.map(p => [p.lat, p.lng]), {
        color: '#f06a00',
        fillColor: '#f06a00',
        fillOpacity: 0.2,
        weight: 2
      }).addTo(map)
      polygonLayerRef.current = polygonLayer

      // Fit bounds - only if bounds is valid
      try {
        const bounds = L.latLngBounds(polygon.map(p => [p.lat, p.lng]))
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30] })
        }
      } catch (e) {
        console.warn('Error fitting bounds:', e)
      }
    }

    // Draw markers for each point
    if (!readOnly) {
      polygon.forEach((point, idx) => {
        const marker = L.marker([point.lat, point.lng], {
          opacity: isDrawing ? 1 : 0.7
        }).addTo(map)

        // Delete on click
        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e)
          if (!isDrawing) {
            const newPolygon = polygon.filter((_, i) => i !== idx)
            setPolygon(newPolygon)
            onChange?.(newPolygon)
          }
        })

        markersRef.current.push(marker)
      })
    }

    // Draw line showing current drawing path
    if (isDrawing && polygon.length > 0) {
      const clickLine = L.polyline(polygon.map(p => [p.lat, p.lng]), {
        color: '#f06a00',
        dashArray: '5, 10',
        weight: 2,
        opacity: 0.6
      }).addTo(map)
      clickLineLayerRef.current = clickLine
    }
  }, [polygon, isDrawing, readOnly, onChange])

  // Draw existing zones
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clear existing zones layers
    existingZonesLayersRef.current.forEach(layer => map.removeLayer(layer))
    existingZonesLayersRef.current = []

    // Colors for existing zones (blue, green, purple to differentiate from current orange)
    const zoneColors = ['#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#0891b2', '#f59e0b']

    existingZones.forEach((zone, index) => {
      if (zone.polygon && zone.polygon.length >= 3) {
        const color = zoneColors[index % zoneColors.length]
        const zonePolygon = L.polygon(
          zone.polygon.map(p => [p.lat, p.lng]),
          {
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5', // Dashed line to show it's an existing zone
            interactive: false // Don't interfere with click events
          }
        ).addTo(map)

        // Add tooltip with zone info
        const center = zone.polygon.reduce(
          (acc, p) => ({ lat: acc.lat + p.lat / zone.polygon.length, lng: acc.lng + p.lng / zone.polygon.length }),
          { lat: 0, lng: 0 }
        )
        L.tooltip({
          permanent: false,
          direction: 'center',
          className: 'zone-tooltip'
        })
          .setContent(`<strong>${zone.name}</strong><br/>${zone.driverName || 'No driver'}`)
          .setLatLng([center.lat, center.lng])
          .addTo(map)

        existingZonesLayersRef.current.push(zonePolygon)
      }
    })
  }, [existingZones])

  const handleReset = () => {
    setPolygon([])
    onChange?.([])
    setIsDrawing(false)
  }

  const handleComplete = () => {
    if (polygon.length < 3) {
      alert('Please add at least 3 points')
      return
    }
    setIsDrawing(false)
  }

  return (
    <div className="relative w-full rounded-lg border border-border overflow-hidden" style={{ height }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />

      {/* Controls */}
      {!readOnly && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setIsDrawing(!isDrawing)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isDrawing ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isDrawing ? 'Stop drawing' : 'Start drawing polygon'}
          >
            {isDrawing ? 'Drawing...' : 'Draw Polygon'}
          </button>

          <button
            type="button"
            onClick={handleComplete}
            disabled={polygon.length < 3}
            className="px-3 py-2 text-sm font-medium bg-green-500 text-white rounded-md transition-colors hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Complete polygon"
          >
            Complete
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={polygon.length === 0}
            className="px-3 py-2 text-sm font-medium bg-red-500 text-white rounded-md transition-colors hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset polygon"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Drawing mode indicator */}
      {isDrawing && (
        <div className="absolute top-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 text-sm">
          <span className="text-orange-500 font-medium">
            Click on map to add points (minimum 3)
          </span>
        </div>
      )}

      {/* Point counter */}
      {polygon.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 text-sm">
          <span className="font-medium">Points: {polygon.length}</span>
        </div>
      )}

      {/* Hint for markers */}
      {!isDrawing && !readOnly && polygon.length >= 3 && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-3 text-xs text-muted-foreground max-w-48">
          Click markers to delete points
        </div>
      )}

      {/* Legend for existing zones */}
      {existingZones.length > 0 && (
        <div className="absolute top-16 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 text-xs space-y-2">
          <p className="font-medium text-gray-900 mb-2">Zone Legend:</p>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-orange-500"></div>
            <span>Current zone</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-500 border-b-2 border-dashed"></div>
            <span>Existing zones</span>
          </div>
          <div className="border-t pt-2 mt-2">
            <p className="text-muted-foreground mb-1">Covered areas:</p>
            {existingZones.slice(0, 3).map((zone, i) => (
              <div key={zone.id} className="flex items-center gap-2">
                <div className="w-4 h-1 rounded" style={{
                  backgroundColor: ['#3b82f6', '#22c55e', '#a855f7'][i % 3]
                }}></div>
                <span className="truncate max-w-24">{zone.name}</span>
              </div>
            ))}
            {existingZones.length > 3 && (
              <p className="text-muted-foreground">+{existingZones.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
