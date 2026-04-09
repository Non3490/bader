/**
 * Label Generator Unit Tests
 * Tests for 4x6 thermal label generation
 *
 * Run: npm test label-generator
 */

import { jsPDF } from 'jspdf'

// Simplified label generator for testing (same logic as call-center page)
function generate4x6Label(order: any): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [102, 152] // 4x6 inches = ~102x152mm
  })

  // Tracking Number - Large and Bold
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(order.trackingNumber, 51, 10, { align: 'center' })

  // Divider line
  doc.setLineWidth(0.3)
  doc.line(8, 14, 94, 14)

  // Customer Name
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Customer:', 8, 20)
  doc.setFont('helvetica', 'bold')
  doc.text(order.customerName, 8, 25)

  // Phone
  doc.setFont('helvetica', 'normal')
  doc.text('Phone:', 8, 31)
  doc.setFont('helvetica', 'bold')
  doc.text(order.customerPhone, 8, 36)

  // Address
  doc.setFont('helvetica', 'normal')
  doc.text('Address:', 8, 42)
  doc.setFont('helvetica', 'normal')
  const addressLines = doc.splitTextToSize(order.customerAddress, 80)
  doc.text(addressLines, 8, 47)

  const addressHeight = addressLines.length * 4.5

  // City
  doc.setFont('helvetica', 'bold')
  doc.text(order.city, 8, 47 + addressHeight + 2)

  // Divider line
  doc.setLineWidth(0.3)
  const yPos = 47 + addressHeight + 8
  doc.line(8, yPos, 94, yPos)

  // Product Name + Quantity
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Product:', 8, yPos + 6)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const productText = `${order.productName} (x${order.quantity})`
  const productLines = doc.splitTextToSize(productText, 80)
  doc.text(productLines, 8, yPos + 11)

  const productHeight = productLines.length * 4.5

  // Seller Name
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Seller:', 8, yPos + 11 + productHeight + 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(order.sellerName || 'N/A', 8, yPos + 16 + productHeight)

  // Divider line
  doc.setLineWidth(0.3)
  const codYPos = yPos + 16 + productHeight + 6
  doc.line(8, codYPos, 94, codYPos)

  // COD Amount - Large and Bold
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('COD:', 8, codYPos + 6)
  doc.setFontSize(16)
  doc.text(`${order.codAmount.toLocaleString('en-GA')} XAF`, 51, codYPos + 6, { align: 'center' })

  // Signature box
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature:', 8, codYPos + 20)
  doc.rect(8, codYPos + 22, 86, 15)

  return doc.output('blob')
}

describe('Label Generator', () => {
  test('generates valid PDF with correct dimensions', () => {
    const testOrder = {
      trackingNumber: 'TEST123',
      customerName: 'John Doe',
      customerPhone: '+241 06 00 00 01',
      customerAddress: '123 Main St, Libreville',
      city: 'Libreville',
      codAmount: 50000,
      sellerName: 'Test Seller',
      productName: 'Test Product',
      quantity: 1,
    }

    const blob = generate4x6Label(testOrder)

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(10000) // Should be > 10KB
    expect(blob.type).toBe('application/pdf')
  })

  test('includes all required fields in PDF', async () => {
    const testOrder = {
      trackingNumber: 'TRK001',
      customerName: 'Jane Smith',
      customerPhone: '+241 06 00 00 02',
      customerAddress: '456 Oak Ave',
      city: 'Port-Gentil',
      codAmount: 75000,
      sellerName: 'Fashion Gabon',
      productName: 'Dress',
      quantity: 2,
    }

    const blob = generate4x6Label(testOrder)
    const pdfText = await blob.text()

    expect(pdfText).toContain('TRK001')
    expect(pdfText).toContain('Jane Smith')
    expect(pdfText).toContain('+241 06 00 00 02')
    expect(pdfText).toContain('456 Oak Ave')
    expect(pdfText).toContain('Port-Gentil')
    expect(pdfText).toContain('75000 XAF')
    expect(pdfText).toContain('Fashion Gabon')
    expect(pdfText).toContain('Dress')
    expect(pdfText).toContain('x2')
    expect(pdfText).toContain('Signature')
  })

  test('handles long address text correctly', async () => {
    const longAddress = '1234 Very Long Street Name Extended, Quarter 5, Zone A, Libreville, Gabon'

    const testOrder = {
      trackingNumber: 'TEST999',
      customerName: 'Test Customer',
      customerPhone: '+241 06 00 00 03',
      customerAddress: longAddress,
      city: 'Libreville',
      codAmount: 50000,
      sellerName: 'Test Seller',
      productName: 'Test Product',
      quantity: 1,
    }

    const blob = generate4x6Label(testOrder)
    const pdfText = await blob.text()

    expect(pdfText).toContain('Very Long Street')
    expect(blob.size).toBeGreaterThan(10000)
  })

  test('handles large COD amounts correctly', async () => {
    const testOrder = {
      trackingNumber: 'TEST9999',
      customerName: 'Test Customer',
      customerPhone: '+241 06 00 00 04',
      customerAddress: 'Test Address',
      city: 'Libreville',
      codAmount: 999999, // Large amount
      sellerName: 'Test Seller',
      productName: 'Test Product',
      quantity: 1,
    }

    const blob = generate4x6Label(testOrder)
    const pdfText = await blob.text()

    expect(pdfText).toContain('999,999 XAF')
  })

  test('handles multiple quantity correctly', async () => {
    const testOrder = {
      trackingNumber: 'TEST888',
      customerName: 'Test Customer',
      customerPhone: '+241 06 00 00 05',
      customerAddress: 'Test Address',
      city: 'Libreville',
      codAmount: 50000,
      sellerName: 'Test Seller',
      productName: 'Test Product',
      quantity: 5,
    }

    const blob = generate4x6Label(testOrder)
    const pdfText = await blob.text()

    expect(pdfText).toContain('x5')
  })

  test('handles missing seller name', async () => {
    const testOrder = {
      trackingNumber: 'TEST777',
      customerName: 'Test Customer',
      customerPhone: '+241 06 00 00 06',
      customerAddress: 'Test Address',
      city: 'Libreville',
      codAmount: 50000,
      sellerName: null, // Missing seller name
      productName: 'Test Product',
      quantity: 1,
    }

    const blob = generate4x6Label(testOrder)
    const pdfText = await blob.text()

    expect(pdfText).toContain('N/A') // Should show "N/A" for missing seller
  })
})

describe('Label Generator Performance', () => {
  test('generates 100 labels in under 10 seconds', () => {
    const orders = Array.from({ length: 100 }, (_, i) => ({
      trackingNumber: `TRK${String(i).padStart(5, '0')}`,
      customerName: `Customer ${i}`,
      customerPhone: '+241 06 00 00 00',
      customerAddress: `${i} Test Street, Libreville`,
      city: 'Libreville',
      codAmount: 50000 + (i * 1000),
      sellerName: `Seller ${i % 10}`,
      productName: `Product ${i}`,
      quantity: 1,
    }))

    const start = performance.now()
    const blobs = orders.map(generate4x6Label)
    const totalSize = blobs.reduce((sum, blob) => sum + blob.size, 0)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(10000) // < 10 seconds
    expect(totalSize).toBeGreaterThan(1000000) // Should be > 1MB
  })

  test('maintains consistent PDF sizes', () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      trackingNumber: `TRK${String(i).padStart(3, '0')}`,
      customerName: 'Customer Name',
      customerPhone: '+241 06 00 00 00',
      customerAddress: 'Test Address, Libreville',
      city: 'Libreville',
      codAmount: 50000,
      sellerName: 'Test Seller',
      productName: 'Test Product',
      quantity: 1,
    }))

    const blobs = orders.map(generate4x6Label)
    const sizes = blobs.map(b => b.size)

    // All sizes should be in similar range (15-25KB)
    const minSize = Math.min(...sizes)
    const maxSize = Math.max(...sizes)

    expect(minSize).toBeGreaterThan(15000) // > 15KB
    expect(maxSize).toBeLessThan(25000) // < 25KB
  })
})
