// Types and constants that can be used in both client and server components

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SELLER' | 'CALL_CENTER' | 'DELIVERY'

export const roleLabels: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Administrator',
  ADMIN: 'Administrator',
  SELLER: 'Seller',
  CALL_CENTER: 'Call Center Agent',
  DELIVERY: 'Delivery Agent'
}

export const roleColors: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  SELLER: 'bg-blue-100 text-blue-800',
  CALL_CENTER: 'bg-green-100 text-green-800',
  DELIVERY: 'bg-orange-100 text-orange-800'
}
