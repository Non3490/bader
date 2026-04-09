/**
 * Get Driver Route (deliveries sorted by proximity)
 * GET /api/driver/route?lat=&lng=
 * Returns deliveries sorted by distance from driver's current location
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireDriverAuth } from '@/lib/driver-auth'
import { db } from '@/lib/db'

/**
 * Calculate Haversine distance between two coordinates in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Geocode address to get coordinates (simplified - no Google Maps API)
 * For Gabon, we'll use a basic lat/lng estimation by city
 */
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Libreville': { lat: 0.3924, lng: 9.4536 },
  'Port-Gentil': { lat: -0.7177, lng: 8.7815 },
  'Franceville': { lat: -1.6333, lng: 13.5833 },
  'Oyem': { lat: 1.6000, lng: 11.5833 },
  'Moanda': { lat: -1.5667, lng: 13.2333 },
  'Lambarene': { lat: -0.2272, lng: 10.2387 }
}

function getCityCoordinates(city: string): { lat: number; lng: number } | null {
  return CITY_COORDINATES[city] || null
}

export async function GET(request: NextRequest) {
  try {
    const driver = await requireDriverAuth()
    const searchParams = request.nextUrl.searchParams
    const driverLat = searchParams.get('lat')
    const driverLng = searchParams.get('lng')

    // Get driver's active deliveries
    const deliveries = await db.delivery.findMany({
      where: {
        driverId: driver.id,
        status: { in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] }
      },
      include: {
        order: {
          select: {
            id: true,
            trackingNumber: true,
            recipientName: true,
            phone: true,
            address: true,
            city: true,
            codAmount: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // If no location provided, return deliveries in default order
    if (!driverLat || !driverLng) {
      return NextResponse.json({
        deliveries,
        sorted: false,
        message: 'Provide lat/lng to sort by proximity'
      })
    }

    const lat = parseFloat(driverLat)
    const lng = parseFloat(driverLng)

    // Add distance to each delivery
    const deliveriesWithDistance = deliveries.map(delivery => {
      const coords = getCityCoordinates(delivery.order.city)
      const distance = coords
        ? calculateDistance(lat, lng, coords.lat, coords.lng)
        : null

      return {
        ...delivery,
        distance,
        estimatedMinutes: distance ? Math.ceil((distance / 30) * 60) : null // Assuming 30km/h average
      }
    })

    // Sort by distance (null distances go last)
    const sortedDeliveries = deliveriesWithDistance.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return (a.distance || 0) - (b.distance || 0)
    })

    // Calculate totals
    const totalDeliveries = sortedDeliveries.length
    const totalCOD = sortedDeliveries.reduce((sum, d) => sum + d.order.codAmount, 0)

    return NextResponse.json({
      deliveries: sortedDeliveries,
      sorted: true,
      summary: {
        totalDeliveries,
        totalCOD
      }
    })

  } catch (error: any) {
    if (error.message === 'DRIVER_NOT_AUTHENTICATED') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    console.error('Get route error:', error)
    return NextResponse.json(
      { error: 'Failed to get route' },
      { status: 500 }
    )
  }
}
