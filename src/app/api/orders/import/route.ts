import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createOrderFromWebhook } from '@/lib/order-service'
import { autoAssignOrder } from '@/lib/agent-assign'

interface ValidationError {
  rowIndex: number
  errors: string[]
}

function validateOrderRow(row: any, rowIndex: number): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Support both old (customerName/customerPhone) and new (recipientName/phone) field names
  const recipientName = row.recipientName || row.customerName
  const phone = row.phone || row.customerPhone
  const address = row.address || row.customerAddress

  // Check required fields
  if (!recipientName || typeof recipientName !== 'string' || recipientName.trim() === '') {
    errors.push('CustomerName is required')
  }

  if (!phone || typeof phone !== 'string' || phone.trim() === '') {
    errors.push('Phone is required')
  }

  if (!row.city || typeof row.city !== 'string' || row.city.trim() === '') {
    errors.push('City is required')
  }

  if (!row.productName || typeof row.productName !== 'string' || row.productName.trim() === '') {
    errors.push('ProductName is required')
  }

  if (!row.codAmount || isNaN(parseFloat(row.codAmount))) {
    errors.push('CODAmount must be a valid number')
  }

  return { valid: errors.length === 0, errors }
}

export async function POST(request: Request) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized to import orders' }, { status: 403 })
    }

    const body = await request.json()
    const { orders } = body

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'No orders provided' }, { status: 400 })
    }

    // Validate all rows first
    const validationErrors: ValidationError[] = []

    for (let i = 0; i < orders.length; i++) {
      const { valid, errors } = validateOrderRow(orders[i], i + 1)
      if (!valid) {
        validationErrors.push({ rowIndex: i + 1, errors })
      }
    }

    // If there are validation errors, return them before processing
    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Validation failed',
        validationErrors,
        validRows: orders.length - validationErrors.length,
        totalRows: orders.length,
      }, { status: 400 })
    }

    // Process all valid orders
    let importedCount = 0
    let duplicateCount = 0

    for (const row of orders) {
      // Support both old (customerName/customerPhone) and new (recipientName/phone) field names
      const recipientName = row.recipientName || row.customerName
      const phone = row.phone || row.customerPhone
      const address = row.address || row.customerAddress

      const result = await createOrderFromWebhook(
        {
          recipientName: String(recipientName),
          phone: String(phone),
          address: address ? String(address) : 'No Address Provided',
          city: String(row.city),
          productName: String(row.productName),
          productSku: row.productSku ? String(row.productSku) : null,
          quantity: parseInt(row.quantity, 10) || 1,
          codAmount: parseFloat(row.codAmount) || 0,
          note: row.note || row.notes ? String(row.note || row.notes) : null,
          source: 'IMPORT'
        },
        user.id
      )

      if ('duplicate' in result) {
        duplicateCount++
      } else {
        importedCount++
        autoAssignOrder(result.created.id, user.role === 'SELLER' ? user.id : null).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      total: orders.length,
      imported: importedCount,
      duplicates: duplicateCount,
      message: `Imported ${importedCount} orders successfully${duplicateCount > 0 ? `. Skipped ${duplicateCount} duplicates.` : '.'}`
    })
  } catch (error: unknown) {
    console.error('Order import error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import orders' },
      { status: 500 }
    )
  }
}
