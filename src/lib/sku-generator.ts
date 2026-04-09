import { db } from '@/lib/db'

const CATEGORY_PREFIXES: Record<string, string> = {
  'skincare': 'CRM',
  'haircare': 'HRO',
  'bodycare': 'BDY',
  'cosmetics': 'COS',
  'fragrance': 'FRG',
  'accessories': 'ACC',
  'clothing': 'CLT',
  'jewelry': 'JWL',
  'electronics': 'ELC',
  'home': 'HOM',
  'food': 'FOD',
  'other': 'OTH',
}

export const CATEGORIES = Object.keys(CATEGORY_PREFIXES) as string[]

/**
 * Generate next SKU sequence number for a given category and seller
 */
export async function getNextSkuSequence(category: string, sellerId: string): Promise<number> {
  const prefix = CATEGORY_PREFIXES[category] || 'OTH'

  // Find the highest SKU sequence for this seller and category
  const latestProduct = await db.product.findFirst({
    where: {
      sellerId,
      sku: {
        startsWith: prefix,
      },
    },
    orderBy: {
      sku: 'desc',
    },
  })

  if (!latestProduct) {
    return 1 // First SKU for this category
  }

  // Extract sequence number from latest SKU (format: PREFIX-XXX)
  const match = latestProduct.sku.match(new RegExp(`^${prefix}-(\\d+)$`))
  if (match) {
    return parseInt(match[1], 10) + 1
  }

  return 1
}

/**
 * Generate a new SKU based on category and seller
 */
export async function generateSKU(category: string, sellerId: string): Promise<string> {
  const prefix = CATEGORY_PREFIXES[category] || 'OTH'
  const sequence = await getNextSkuSequence(category, sellerId)

  // Format: PREFIX-XXX (zero-padded to 3 digits)
  return `${prefix}-${String(sequence).padStart(3, '0')}`
}

/**
 * Validate SKU format
 */
export function isValidSKU(sku: string): boolean {
  // SKU should match: CATEGORY-XXX format
  const parts = sku.split('-')
  if (parts.length !== 2) {
    return false
  }

  const [prefix, number] = parts

  // Check if prefix is valid
  if (!Object.values(CATEGORY_PREFIXES).includes(prefix)) {
    return false
  }

  // Check if number is valid (3 digits)
  const numberRegex = /^\d{3}$/
  if (!numberRegex.test(number)) {
    return false
  }

  return true
}

/**
 * Extract category from SKU
 */
export function getCategoryFromSKU(sku: string): string | null {
  const prefix = sku.split('-')[0]
  const category = Object.entries(CATEGORY_PREFIXES).find(([_, p]) => p === prefix)?.[0]
  return category || null
}
