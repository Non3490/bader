import type { CreateOrderInput } from './order-service'

// ─── Shopify ──────────────────────────────────────────────────────────────────

export interface ShopifyOrderPayload {
  id: number
  payment_gateway: string
  total_price: string
  note: string | null
  shipping_address: {
    first_name: string
    last_name: string
    phone: string
    address1: string
    address2?: string
    city: string
  }
  billing_address?: {
    first_name: string
    last_name: string
    phone: string
    address1: string
    city: string
  }
  line_items: Array<{
    title: string
    sku: string | null
    quantity: number
    price: string
  }>
}

export function mapShopifyOrder(payload: ShopifyOrderPayload): CreateOrderInput {
  const addr = payload.shipping_address ?? payload.billing_address
  const firstItem = payload.line_items[0]
  const street = [addr?.address1, (addr as { address2?: string })?.address2].filter(Boolean).join(' ')

  return {
    recipientName: `${addr?.first_name ?? ''} ${addr?.last_name ?? ''}`.trim(),
    phone: (addr?.phone ?? '').replace(/\D/g, ''),
    address: street || 'No Address Provided',
    city: addr?.city ?? '',
    productName: firstItem?.title ?? 'Unknown Product',
    productSku: firstItem?.sku ?? null,
    quantity: firstItem?.quantity ?? 1,
    codAmount: parseFloat(payload.total_price) || 0,
    note: payload.note ?? null,
    source: 'SHOPIFY'
  }
}

// ─── YouCan ───────────────────────────────────────────────────────────────────

export interface YouCanOrderPayload {
  id: string
  total: number
  notes?: string
  customer: {
    first_name: string
    last_name: string
    phone: string
  }
  shipping_address: {
    city: string
    address: string
  }
  items: Array<{
    name: string
    quantity: number
    price: number
    sku?: string
  }>
}

export function mapYouCanOrder(payload: YouCanOrderPayload): CreateOrderInput {
  const firstItem = payload.items[0]

  return {
    recipientName: `${payload.customer.first_name ?? ''} ${payload.customer.last_name ?? ''}`.trim(),
    phone: (payload.customer.phone ?? '').replace(/\D/g, ''),
    address: payload.shipping_address.address || 'No Address Provided',
    city: payload.shipping_address.city ?? '',
    productName: firstItem?.name ?? 'Unknown Product',
    productSku: firstItem?.sku ?? null,
    quantity: firstItem?.quantity ?? 1,
    codAmount: payload.total || 0,
    note: payload.notes ?? null,
    source: 'YOUCAN'
  }
}

// ─── Dropify ──────────────────────────────────────────────────────────────────

export interface DropifyOrderPayload {
  id: string
  cod_amount: number
  comment?: string
  client: {
    name: string
    phone: string
    address: string
    city: string
  }
  products: Array<{
    name: string
    quantity: number
    price: number
    sku?: string
  }>
}

export function mapDropifyOrder(payload: DropifyOrderPayload): CreateOrderInput {
  const firstProduct = payload.products[0]

  return {
    recipientName: payload.client.name ?? '',
    phone: (payload.client.phone ?? '').replace(/\D/g, ''),
    address: payload.client.address || 'No Address Provided',
    city: payload.client.city ?? '',
    productName: firstProduct?.name ?? 'Unknown Product',
    productSku: firstProduct?.sku ?? null,
    quantity: firstProduct?.quantity ?? 1,
    codAmount: payload.cod_amount || 0,
    note: payload.comment ?? null,
    source: 'DROPIFY'
  }
}

// ─── LightFunnels ────────────────────────────────────────────────────────────────

export interface LightFunnelsOrderPayload {
  id: string
  total_price: number
  notes?: string
  customer: {
    first_name: string
    last_name: string
    phone: string
    email?: string
  }
  shipping_address: {
    address1: string
    address2?: string
    city: string
    zip?: string
  }
  items: Array<{
    name: string
    sku?: string
    quantity: number
    price: number
  }>
}

export function mapLightFunnelsOrder(payload: LightFunnelsOrderPayload): CreateOrderInput {
  const firstItem = payload.items[0]
  const street = [payload.shipping_address.address1, payload.shipping_address.address2].filter(Boolean).join(' ')

  return {
    recipientName: `${payload.customer.first_name ?? ''} ${payload.customer.last_name ?? ''}`.trim(),
    phone: (payload.customer.phone ?? '').replace(/\D/g, ''),
    address: street || 'No Address Provided',
    city: payload.shipping_address.city ?? '',
    productName: firstItem?.name ?? 'Unknown Product',
    productSku: firstItem?.sku ?? null,
    quantity: firstItem?.quantity ?? 1,
    codAmount: payload.total_price || 0,
    note: payload.notes ?? null,
    source: 'LIGHTFUNNELS'
  }
}
