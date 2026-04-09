/**
 * Bundle Detection Unit Tests
 * Tests for src/lib/bundle-detection.ts
 *
 * Run: npm test bundle-detection
 */

import { detectAndAssignBundle, getBundleOrders, getBundleStats } from '../bundle-detection'
import { db } from '../db'

describe('Bundle Detection', () => {
  const testPhone = '+241060000001'
  const seller1Id = 'seller-test-1'
  const seller2Id = 'seller-test-2'

  beforeEach(async () => {
    // Clean up test data
    await db.order.deleteMany({
      where: {
        phone: { startsWith: '+241060000' }
      }
    })
  })

  afterEach(async () => {
    // Clean up test data
    await db.order.deleteMany({
      where: {
        phone: { startsWith: '+241060000' }
      }
    })
  })

  describe('detectAndAssignBundle', () => {
    test('does NOT bundle single seller order', async () => {
      const order = await db.order.create({
        data: {
          trackingNumber: 'TEST001',
          recipientName: 'Test Customer',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
        }
      })

      const result = await detectAndAssignBundle(order.id)

      // Should not bundle (only 1 seller)
      expect(result).toBeUndefined()

      const updated = await db.order.findUnique({
        where: { id: order.id }
      })

      expect(updated?.bundleGroupId).toBeNull()
    })

    test('creates bundle for 2+ sellers, same customer, same day', async () => {
      const today = new Date()

      // Create first order from seller 1
      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST002',
          recipientName: 'Bundle Test Customer',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address 1',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
          createdAt: today,
        }
      })

      // Create second order from seller 2
      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST003',
          recipientName: 'Bundle Test Customer',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address 2',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
        }
      })

      // Run bundle detection on second order
      const result = await detectAndAssignBundle(order2.id)

      expect(result).toBeDefined()
      expect(result?.bundleGroupId).toBeDefined()
      expect(result?.orderCount).toBe(2)
      expect(result?.sellerCount).toBe(2)

      // Both orders should have same bundleGroupId
      const updated1 = await db.order.findUnique({ where: { id: order1.id } })
      const updated2 = await db.order.findUnique({ where: { id: order2.id } })

      expect(updated1?.bundleGroupId).not.toBeNull()
      expect(updated2?.bundleGroupId).not.toBeNull()
      expect(updated1?.bundleGroupId).toBe(updated2?.bundleGroupId)
    })

    test('does NOT bundle orders from different days', async () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const today = new Date()

      // Create order yesterday from seller 1
      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST004',
          recipientName: 'Multi Day Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
          createdAt: yesterday,
        }
      })

      // Create order today from seller 2
      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST005',
          recipientName: 'Multi Day Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
        }
      })

      await detectAndAssignBundle(order2.id)

      const updated1 = await db.order.findUnique({ where: { id: order1.id } })
      const updated2 = await db.order.findUnique({ where: { id: order2.id } })

      // Neither should be bundled (different days)
      expect(updated1?.bundleGroupId).toBeNull()
      expect(updated2?.bundleGroupId).toBeNull()
    })

    test('does NOT bundle confirmed orders', async () => {
      const today = new Date()

      // Create confirmed order from seller 1
      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST006',
          recipientName: 'Confirmed Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'CONFIRMED',
          createdAt: today,
        }
      })

      // Create new order from seller 2
      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST007',
          recipientName: 'Confirmed Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
        }
      })

      await detectAndAssignBundle(order2.id)

      const updated1 = await db.order.findUnique({ where: { id: order1.id } })
      const updated2 = await db.order.findUnique({ where: { id: order2.id } })

      // Neither should be bundled (confirmed order excluded)
      expect(updated1?.bundleGroupId).toBeNull()
      expect(updated2?.bundleGroupId).toBeNull()
    })

    test('reuses existing bundleGroupId', async () => {
      const today = new Date()
      const existingBundleId = 'existing-bundle-id'

      // Create first order with existing bundle
      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST008',
          recipientName: 'Reuse Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
          createdAt: today,
          bundleGroupId: existingBundleId,
        }
      })

      // Create second order without bundle
      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST009',
          recipientName: 'Reuse Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
        }
      })

      const result = await detectAndAssignBundle(order2.id)

      // Should reuse existing bundle ID
      expect(result?.bundleGroupId).toBe(existingBundleId)

      const updated2 = await db.order.findUnique({ where: { id: order2.id } })
      expect(updated2?.bundleGroupId).toBe(existingBundleId)
    })
  })

  describe('getBundleOrders', () => {
    test('returns all orders in a bundle', async () => {
      const today = new Date()
      const bundleGroupId = 'test-bundle-id'

      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST010',
          recipientName: 'Bundle Query Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
          createdAt: today,
          bundleGroupId,
        }
      })

      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST011',
          recipientName: 'Bundle Query Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
          bundleGroupId,
        }
      })

      const bundleOrders = await getBundleOrders(bundleGroupId)

      expect(bundleOrders).toHaveLength(2)
      expect(bundleOrders.map(o => o.id)).toContain(order1.id)
      expect(bundleOrders.map(o => o.id)).toContain(order2.id)
    })

    test('excludes cancelled and returned orders', async () => {
      const bundleGroupId = 'test-bundle-filter'

      await db.order.create({
        data: {
          trackingNumber: 'TEST012',
          recipientName: 'Filter Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'CANCELLED',
          createdAt: new Date(),
          bundleGroupId,
        }
      })

      const activeOrder = await db.order.create({
        data: {
          trackingNumber: 'TEST013',
          recipientName: 'Filter Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: new Date(),
          bundleGroupId,
        }
      })

      const bundleOrders = await getBundleOrders(bundleGroupId)

      expect(bundleOrders).toHaveLength(1)
      expect(bundleOrders[0].id).toBe(activeOrder.id)
    })
  })

  describe('getBundleStats', () => {
    test('calculates correct bundle statistics', async () => {
      const today = new Date()
      const bundleGroupId = 'test-bundle-stats'

      const order1 = await db.order.create({
        data: {
          trackingNumber: 'TEST014',
          recipientName: 'Stats Test',
          phone: testPhone,
          sellerId: seller1Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 50000,
          status: 'NEW',
          createdAt: today,
          bundleGroupId,
        }
      })

      const order2 = await db.order.create({
        data: {
          trackingNumber: 'TEST015',
          recipientName: 'Stats Test',
          phone: testPhone,
          sellerId: seller2Id,
          address: 'Test Address',
          city: 'Libreville',
          codAmount: 60000,
          status: 'NEW',
          createdAt: today,
          bundleGroupId,
        }
      })

      const stats = await getBundleStats(bundleGroupId)

      expect(stats).toBeDefined()
      expect(stats?.orderCount).toBe(2)
      expect(stats?.sellerCount).toBe(2)
      expect(stats?.totalCod).toBe(110000)
      expect(stats?.bundleGroupId).toBe(bundleGroupId)
    })

    test('returns null for non-existent bundle', async () => {
      const stats = await getBundleStats('non-existent-bundle')
      expect(stats).toBeNull()
    })
  })
})
