import { db } from '@/lib/db'

export interface CsvRow {
  sku: string
  quantity: number
  operation: 'ADD' | 'REMOVE' | 'SET'
  cost_per_unit?: number
  reason?: string
  notes?: string
}

export interface ValidationResult {
  valid: boolean
  rows: Array<{
    rowNumber: number
    data: CsvRow
    valid: boolean
    errors: string[]
  }>
  summary: {
    total: number
    valid: number
    invalid: number
  }
}

export interface ImportError {
  row: number
  sku: string
  error: string
}

/**
 * Parse CSV content into an array of objects
 */
export function parseCsv(csvContent: string): Array<Record<string, string>> {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '')
  if (lines.length === 0) return []

  // Detect delimiter (comma or semicolon)
  const firstLine = lines[0]
  const delimiter = firstLine.includes(';') ? ';' : ','

  const headers = parseCsvLine(firstLine, delimiter)
  const result: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter)
    const row: Record<string, string> = {}

    headers.forEach((header, index) => {
      row[header.trim().toLowerCase().replace(/ /g, '_')] = values[index] || ''
    })

    result.push(row)
  }

  return result
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())

  return result
}

/**
 * Validate stock import CSV rows
 */
export async function validateStockImport(
  rows: Array<Record<string, string>>,
  sellerId?: string
): Promise<ValidationResult> {
  const validationResults: ValidationResult['rows'] = []

  // Get all products for seller to validate SKUs
  const products = await db.product.findMany({
    where: sellerId ? { sellerId } : {},
    select: {
      id: true,
      sku: true,
      name: true,
      currentStock: true,
      sellerId: true
    }
  })

  const productMap = new Map(products.map(p => [p.sku.toLowerCase(), p]))

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []
    const rowNumber = i + 1 // 1-indexed for user display

    // Parse and validate SKU
    const sku = row.sku?.trim()
    if (!sku) {
      errors.push('SKU est requis')
    } else {
      const product = productMap.get(sku.toLowerCase())
      if (!product) {
        errors.push(`SKU introuvable: ${sku}`)
      }
    }

    // Parse and validate quantity
    const quantityStr = row.quantity?.trim()
    const quantity = parseInt(quantityStr, 10)
    if (!quantityStr || isNaN(quantity)) {
      errors.push('Quantité doit être un nombre entier positif')
    } else if (quantity < 0) {
      errors.push('Quantité ne peut pas être négative')
    }

    // Parse and validate operation
    const operation = row.operation?.trim().toUpperCase()
    if (!operation) {
      errors.push('Opération est requise (ADD, REMOVE, ou SET)')
    } else if (!['ADD', 'REMOVE', 'SET'].includes(operation)) {
      errors.push('Opération doit être ADD, REMOVE, ou SET')
    }

    // Validate cost_per_unit for ADD operations
    const costPerUnitStr = row.cost_per_unit?.trim()
    const costPerUnit = costPerUnitStr ? parseFloat(costPerUnitStr) : undefined

    if (operation === 'ADD' && costPerUnitStr && (isNaN(costPerUnit!) || costPerUnit! < 0)) {
      errors.push('Coût par unité doit être un nombre positif pour les opérations ADD')
    }

    // Validate reason for REMOVE operations
    const reason = row.reason?.trim()
    const validReasons = ['SPOILAGE', 'DAMAGE', 'EXPIRED', 'THEFT', 'OTHER', '']

    if (operation === 'REMOVE' && reason && !validReasons.includes(reason.toUpperCase())) {
      errors.push('Raison doit être l\'une des suivantes: SPOILAGE, DAMAGE, EXPIRED, THEFT, OTHER')
    }

    // For REMOVE operations, check that quantity doesn't exceed current stock
    if (operation === 'REMOVE' && !errors.includes('SKU introuvable: ' + sku)) {
      const product = productMap.get(sku?.toLowerCase() || '')
      if (product && quantity > product.currentStock) {
        errors.push(`Stock insuffisant pour ${sku}. Disponible: ${product.currentStock}, demandé: ${quantity}`)
      }
    }

    const csvRow: CsvRow = {
      sku: sku || '',
      quantity: quantity || 0,
      operation: (operation || 'ADD') as 'ADD' | 'REMOVE' | 'SET',
      cost_per_unit: costPerUnit,
      reason: reason?.toUpperCase() as any,
      notes: row.notes?.trim()
    }

    validationResults.push({
      rowNumber,
      data: csvRow,
      valid: errors.length === 0,
      errors
    })
  }

  const validCount = validationResults.filter(r => r.valid).length
  const invalidCount = validationResults.length - validCount

  return {
    valid: invalidCount === 0,
    rows: validationResults,
    summary: {
      total: validationResults.length,
      valid: validCount,
      invalid: invalidCount
    }
  }
}

/**
 * Process validated stock import rows
 */
export async function processStockImport(
  validRows: Array<{ rowNumber: number; data: CsvRow }>,
  performedBy: string,
  adminId?: string
): Promise<{ success: boolean; processed: number; errors: ImportError[] }> {
  const errors: ImportError[] = []
  let processed = 0

  // Process in transaction - if any fails, all fail
  try {
    await db.$transaction(async (tx) => {
      for (const row of validRows) {
        try {
          // Find product by SKU
          const product = await tx.product.findFirst({
            where: {
              sku: { equals: row.data.sku, mode: 'insensitive' }
            },
            select: {
              id: true,
              name: true,
              currentStock: true,
              sellerId: true
            }
          })

          if (!product) {
            errors.push({
              row: row.rowNumber,
              sku: row.data.sku,
              error: 'Produit introuvable'
            })
            throw new Error(`Produit introuvable: ${row.data.sku}`)
          }

          const { operation, quantity, cost_per_unit, reason, notes } = row.data
          const notesWithReason = notes ? `${reason || ''} - ${notes}` : reason || ''

          if (operation === 'ADD') {
            // Add stock
            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: { increment: quantity }
              }
            })

            await tx.stockMovement.create({
              data: {
                stockId: product.id,
                type: 'MANUAL_IN',
                quantity,
                reason: notesWithReason || 'Import CSV: ADD',
                adminId,
                balanceAfter: product.currentStock + quantity,
                costPerUnit: cost_per_unit,
                createdAt: new Date()
              }
            })

            processed++
          } else if (operation === 'REMOVE') {
            // Remove stock (already validated that sufficient stock exists)
            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: { decrement: quantity }
              }
            })

            await tx.stockMovement.create({
              data: {
                stockId: product.id,
                type: 'MANUAL_OUT',
                quantity,
                reason: notesWithReason || 'Import CSV: REMOVE',
                adminId,
                balanceAfter: product.currentStock - quantity,
                createdAt: new Date()
              }
            })

            processed++
          } else if (operation === 'SET') {
            // Set stock to specific value
            await tx.product.update({
              where: { id: product.id },
              data: {
                currentStock: quantity
              }
            })

            const difference = quantity - product.currentStock
            const type = difference > 0 ? 'MANUAL_IN' : difference < 0 ? 'MANUAL_OUT' : 'ADJUST'

            await tx.stockMovement.create({
              data: {
                stockId: product.id,
                type,
                quantity: Math.abs(difference),
                reason: notesWithReason || `Import CSV: SET to ${quantity}`,
                adminId,
                balanceAfter: quantity,
                createdAt: new Date()
              }
            })

            processed++
          }
        } catch (error) {
          console.error(`Error processing row ${row.rowNumber}:`, error)
          errors.push({
            row: row.rowNumber,
            sku: row.data.sku,
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          })
          throw error // Rollback transaction
        }
      }
    })

    return {
      success: errors.length === 0,
      processed,
      errors
    }
  } catch (error) {
    return {
      success: false,
      processed: 0,
      errors: [{
        row: 0,
        sku: '',
        error: error instanceof Error ? error.message : 'Erreur lors du traitement de l\'import'
      }]
    }
  }
}

/**
 * Generate CSV template for stock import
 */
export function generateStockImportTemplate(): string {
  const headers = ['sku', 'quantity', 'operation', 'cost_per_unit', 'reason', 'notes']
  const examples = [
    'PROD-001,50,ADD,1500,PURCHASE,Monthly restock',
    'PROD-002,3,REMOVE,,SPOILAGE,Found expired in warehouse',
    'PROD-003,100,SET,,COUNT,Physical inventory count'
  ]

  return [
    headers.join(','),
    ...examples,
    '',
    'Operations: ADD (add stock), REMOVE (remove stock), SET (set to specific value)',
    'Reasons (for REMOVE): SPOILAGE, DAMAGE, EXPIRED, THEFT, OTHER',
    'cost_per_unit: Required for ADD operations (purchase cost)'
  ].join('\n')
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const errors: string[] = []

  if (result.summary.invalid > 0) {
    errors.push(`${result.summary.invalid} sur ${result.summary.total} lignes contiennent des erreurs:\n`)

    result.rows
      .filter(row => !row.valid)
      .forEach(row => {
        errors.push(`Ligne ${row.rowNumber} (SKU: ${row.data.sku}):`)
        row.errors.forEach(error => {
          errors.push(`  - ${error}`)
        })
      })
  }

  return errors.join('\n')
}
