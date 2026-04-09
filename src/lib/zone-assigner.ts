import { db } from '@/lib/db'

interface LatLng {
  lat: number
  lng: number
}

/**
 * Point-in-polygon algorithm using ray-casting
 * Returns true if the point is inside the polygon
 */
function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat
    const yi = polygon[i].lng
    const xj = polygon[j].lat
    const yj = polygon[j].lng

    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Geocode address to coordinates using Nominatim (OpenStreetMap)
 * This is a fallback when coordinates are not directly available
 * Note: In production, you may want to use a paid geocoding service
 */
async function geocodeAddress(address: string, city: string): Promise<LatLng | null> {
  try {
    const query = `${address}, ${city}, Gabon`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=1`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Gabon-COD-Platform' // Required by Nominatim terms of use
      }
    })

    if (!response.ok) {
      console.error('Geocoding failed:', response.statusText)
      return null
    }

    const data = await response.json()

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }

    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

/**
 * Find a delivery zone that contains the given coordinates
 */
export async function findDeliveryZoneForCoordinates(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    // Get all delivery zones with a driver assigned
    const zones = await db.deliveryZone.findMany({
      where: {
        driverId: { not: null }
      },
      select: {
        id: true,
        polygon: true
      }
    })

    for (const zone of zones) {
      const polygon = zone.polygon as LatLng[]

      if (polygon && polygon.length >= 3) {
        if (isPointInPolygon({ lat, lng }, polygon)) {
          return zone.id
        }
      }
    }

    return null
  } catch (error) {
    console.error('Find delivery zone error:', error)
    return null
  }
}

/**
 * Assign an order to a delivery zone based on its address/city
 * This function is called when an order's status changes to SHIPPED
 */
export async function assignOrderToDeliveryZone(
  orderId: string,
  address: string,
  city: string
): Promise<{ success: boolean; zoneId?: string; driverId?: string }> {
  try {
    // First, try to geocode the address
    const coordinates = await geocodeAddress(address, city)

    if (!coordinates) {
      console.log('Could not geocode address for order:', orderId)
      return { success: false }
    }

    // Find a delivery zone containing these coordinates
    const zoneId = await findDeliveryZoneForCoordinates(
      coordinates.lat,
      coordinates.lng
    )

    if (!zoneId) {
      console.log('No delivery zone found for coordinates:', coordinates)
      return { success: false }
    }

    // Get the delivery zone with its driver
    const deliveryZone = await db.deliveryZone.findUnique({
      where: { id: zoneId },
      include: {
        driver: {
          select: { id: true }
        }
      }
    })

    if (!deliveryZone || !deliveryZone.driverId) {
      console.log('Delivery zone has no assigned driver:', zoneId)
      return { success: false }
    }

    // Update the order with the delivery zone and driver
    await db.order.update({
      where: { id: orderId },
      data: {
        deliveryZoneId: zoneId,
        deliveryManId: deliveryZone.driverId
      }
    })

    console.log(
      `Order ${orderId} auto-assigned to zone ${zoneId} and driver ${deliveryZone.driverId}`
    )

    return {
      success: true,
      zoneId,
      driverId: deliveryZone.driverId
    }
  } catch (error) {
    console.error('Assign order to delivery zone error:', error)
    return { success: false }
  }
}

/**
 * Batch assign multiple orders to delivery zones
 * Useful for bulk updates or initialization
 */
export async function batchAssignOrdersToDeliveryZones(
  orderIds: string[]
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const orderId of orderIds) {
    try {
      const order = await db.order.findUnique({
        where: { id: orderId },
        select: {
          address: true,
          city: true,
          deliveryManId: true,
          deliveryZoneId: true
        }
      })

      if (!order) {
        failed++
        continue
      }

      // Skip if already assigned to a zone or driver
      if (order.deliveryManId || order.deliveryZoneId) {
        failed++
        continue
      }

      const result = await assignOrderToDeliveryZone(
        orderId,
        order.address,
        order.city
      )

      if (result.success) {
        success++
      } else {
        failed++
      }
    } catch (error) {
      console.error(`Failed to assign order ${orderId}:`, error)
      failed++
    }
  }

  return { success, failed }
}
