import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/products
export async function GET() {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const where = (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') ? { sellerId: user.id } : {}

    const products = await db.product.findMany({
      where,
      include: {
        stocks: {
          include: {
            movements: { take: 5, orderBy: { createdAt: 'desc' } },
            warehouse: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const totalProducts = products.length
    const totalStock = products.flatMap(p => p.stocks).reduce((s, st) => s + st.quantity, 0)
    const lowStock = products.filter(p =>
      p.stocks.some(s => s.quantity > 0 && s.quantity <= s.alertLevel)
    ).length
    const outOfStock = products.filter(p =>
      p.stocks.length === 0 || p.stocks.every(s => s.quantity === 0)
    ).length
    const totalValue = products.flatMap(p => p.stocks).reduce((s, st) => {
      const product = products.find(p => p.stocks.some(ps => ps.id === st.id))
      return s + (st.quantity * (product?.costPrice ?? 0))
    }, 0)

    // Strip costPrice for CALL_CENTER role
    const shouldStripCost = user.role === 'CALL_CENTER'

    return NextResponse.json({
      products: products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        shortDescription: p.shortDescription,
        longDescription: p.longDescription,
        imageUrl: p.imageUrl,
        supplierName: p.supplierName,
        supplierPhone: p.supplierPhone,
        cargoName: p.cargoName,
        cargoPhone: p.cargoPhone,
        quantityPricing: p.quantityPricing,
        category: p.category,
        costPrice: shouldStripCost ? undefined : p.costPrice,
        sellPrice: p.sellPrice,
        isActive: p.isActive,
        authorizeOpen: p.authorizeOpen,
        totalStock: p.stocks.reduce((s, st) => s + st.quantity, 0),
        stocks: p.stocks.map(s => ({
          id: s.id,
          warehouseId: s.warehouseId,
          warehouse: s.warehouse ? { name: s.warehouse.name, city: s.warehouse.city } : s.warehouse,
          quantity: s.quantity,
          alertLevel: s.alertLevel,
          movements: s.movements.map(m => ({
            id: m.id,
            type: m.type,
            quantity: m.quantity,
            reason: m.reason,
            createdAt: m.createdAt.toISOString()
          }))
        }))
      })),
      stats: shouldStripCost
        ? { totalProducts, totalStock, lowStock, outOfStock }
        : { totalProducts, totalStock, lowStock, outOfStock, totalValue }
    })
  } catch (error) {
    console.error('Products GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/products
export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    if (user.role !== 'ADMIN' && user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const {
      sku,
      name,
      shortDescription,
      longDescription,
      imageUrl,
      supplierName,
      supplierPhone,
      cargoName,
      cargoPhone,
      quantityPricing,
      category,
      costPrice,
      sellPrice,
      warehouseId,
      initialStock = 0,
      alertLevel = 5
    } = body

    if (!sku || !name) {
      return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 })
    }

    const effectiveSellerId = user.id

    // Check unique sku per seller
    const existing = await db.product.findUnique({
      where: { sellerId_sku: { sellerId: effectiveSellerId, sku } }
    })
    if (existing) {
      return NextResponse.json({ error: 'SKU already exists for this seller' }, { status: 409 })
    }

    const product = await db.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          sellerId: effectiveSellerId,
          sku,
          name,
          shortDescription,
          longDescription,
          imageUrl,
          supplierName,
          supplierPhone,
          cargoName,
          cargoPhone,
          quantityPricing: quantityPricing ? JSON.stringify(quantityPricing) : null,
          category,
          costPrice: parseFloat(String(costPrice)) || 0,
          sellPrice: parseFloat(String(sellPrice)) || 0
        }
      })

      if (warehouseId) {
        const stock = await tx.stock.create({
          data: {
            productId: newProduct.id,
            sellerId: effectiveSellerId,
            warehouseId,
            quantity: parseInt(String(initialStock)) || 0,
            alertLevel: parseInt(String(alertLevel)) || 5
          }
        })

        if (initialStock > 0) {
          await tx.stockMovement.create({
            data: {
              stockId: stock.id,
              type: 'MANUAL_IN',
              quantity: parseInt(String(initialStock)),
              reason: 'Initial stock'
            }
          })
        }
      }

      return newProduct
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    console.error('Products POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
