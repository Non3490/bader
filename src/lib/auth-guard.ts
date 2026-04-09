import { Prisma } from '@prisma/client'

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']

/**
 * Returns a Prisma OrderWhereInput that scopes results by the caller's role.
 * - SUPER_ADMIN: sees all orders
 * - ADMIN: sees all orders
 * - SELLER: sees only their own orders (sellerId)
 * - CALL_CENTER: scoped to their parent seller if parentSellerId is set, else all
 * - DELIVERY: sees only orders assigned to them (deliveryManId)
 */
export function scopeByRole(
  userId: string,
  role: string,
  parentSellerId?: string | null
): Prisma.OrderWhereInput {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return {}
    case 'SELLER':
      return { sellerId: userId }
    case 'CALL_CENTER':
      // Unified Agent View: Call center agents see ALL orders from ALL sellers
      return {}
    case 'DELIVERY':
      return { deliveryManId: userId }
    default:
      return { id: 'none' } // No access
  }
}

/**
 * Checks if a user can access a specific order.
 */
export function canAccessOrder(
  userId: string,
  role: string,
  order: { sellerId: string; deliveryManId?: string | null },
  parentSellerId?: string | null
): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  if (role === 'SELLER') return order.sellerId === userId
  if (role === 'CALL_CENTER') return true // Unified Agent View: Can access all orders
  if (role === 'DELIVERY') return order.deliveryManId === userId
  return false
}

/**
 * Helper function to check if a role is an admin role (ADMIN or SUPER_ADMIN)
 */
export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role)
}
