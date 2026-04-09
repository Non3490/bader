/**
 * GPS-Based Delivery Assignment Service
 * Uses Google Maps Geocoding API to find nearest available delivery drivers
 */

import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { db } from '@/lib/db'

interface DeliveryManLocation {
  id: string
  name: string
  phone: string | null
  lastLat: number | null
  lastLng: number | null
  lastLocationUpdate: Date | null
}

interface GeocodeResult {
  lat: number
  lng: number
  formattedAddress: string
}

interface NearestDriverSuggestion {
  driver: DeliveryManLocation
  distanceKm: number
  estimatedMinutes: number
}

// Google Maps Geocoding setup
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY

/**
 * Geocode an address to get coordinates
 */
async function geocodeAddress(address: string, city: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured')
    return null
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(`${address}, ${city}, Gabon`)}&key=${GOOGLE_MAPS_API_KEY}`
    )
    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      console.error('Geocoding failed:', data.status, data.error_message)
      return null
    }

    const location = data.results[0].geometry.location
    return {
      lat: location.lat,
      lng: location.lng,
      formattedAddress: data.results[0].formatted_address
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

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
 * Get all delivery men in a specific zone (or all if no zone)
 * Only includes drivers that are currently online
 */
async function getDeliveryMenInZone(zoneId?: string | null): Promise<DeliveryManLocation[]> {
  // Get all delivery men in zone who are online and active
  const drivers = await db.user.findMany({
    where: {
      role: 'DELIVERY',
      isActive: true,
      zoneId: zoneId || undefined,
      agentSession: {
        isOnline: true
      }
    },
    select: {
      id: true,
      name: true,
      phone: true
    }
  })

  // Get last known locations from delivery location records
  const driverIds = drivers.map(d => d.id)
  const locations = await db.deliveryLocation.findMany({
    where: {
      driverId: { in: driverIds }
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['driverId']
  })

  // Merge locations with drivers
  const locationMap = new Map(
    locations.map(loc => [loc.driverId, { lat: loc.lat, lng: loc.lng, updatedAt: loc.createdAt }])
  )

  return drivers.map(driver => {
    const loc = locationMap.get(driver.id)
    return {
      ...driver,
      lastLat: loc?.lat ?? null,
      lastLng: loc?.lng ?? null,
      lastLocationUpdate: loc?.updatedAt ?? null
    }
  })
}

/**
 * Find nearest available drivers for a delivery address
 */
export async function findNearestDrivers(
  address: string,
  city: string,
  zoneId?: string | null,
  limit: number = 5
): Promise<{
  suggestions: NearestDriverSuggestion[]
  orderLocation: GeocodeResult | null
}> {
  try {
    // Geocode the delivery address
    const orderLocation = await geocodeAddress(address, city)

    if (!orderLocation) {
      return {
        suggestions: [],
        orderLocation: null
      }
    }

    // Get delivery men in zone (or all)
    const drivers = await getDeliveryMenInZone(zoneId)

    // Calculate distances for all drivers with known locations
    const distances: NearestDriverSuggestion[] = drivers
      .filter(driver => driver.lastLat !== null && driver.lastLng !== null)
      .map(driver => {
        const distanceKm = calculateDistance(
          orderLocation.lat,
          orderLocation.lng,
          driver.lastLat!,
          driver.lastLng!
        )

        // Estimate travel time (assuming 30km/h average in urban Gabon)
        const estimatedMinutes = Math.ceil((distanceKm / 30) * 60)

        return {
          driver,
          distanceKm: Math.round(distanceKm * 100) / 100,
          estimatedMinutes
        }
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)

    return {
      suggestions: distances,
      orderLocation
    }
  } catch (error) {
    console.error('Find nearest drivers error:', error)
    return {
      suggestions: [],
      orderLocation: null
    }
  }
}

/**
 * Get single nearest driver suggestion
 */
export async function suggestNearestDriver(
  address: string,
  city: string,
  zoneId?: string | null
): Promise<{
  driver: DeliveryManLocation | null
  distanceKm: number | null
  estimatedMinutes: number | null
}> {
  const result = await findNearestDrivers(address, city, zoneId, 1)

  if (result.suggestions.length === 0) {
    return {
      driver: null,
      distanceKm: null,
      estimatedMinutes: null
    }
  }

  const topSuggestion = result.suggestions[0]
  return {
    driver: topSuggestion.driver,
    distanceKm: topSuggestion.distanceKm,
    estimatedMinutes: topSuggestion.estimatedMinutes
  }
}
