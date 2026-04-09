import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#f07020',
    paddingBottom: 20,
  },
  brandBlock: {
    flexDirection: 'column',
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f07020',
  },
  brandSub: {
    fontSize: 9,
    color: '#888888',
    letterSpacing: 2,
    marginTop: 2,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'right',
  },
  invoiceNumber: {
    fontSize: 12,
    color: '#555555',
    marginTop: 4,
    textAlign: 'right',
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  colBlock: {
    width: '45%',
  },
  colLabel: {
    fontSize: 9,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  colValue: {
    fontSize: 11,
    color: '#111111',
    marginBottom: 3,
  },
  colValueSub: {
    fontSize: 10,
    color: '#555555',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    padding: '8 12',
    marginBottom: 1,
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
    padding: '8 12',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: '8 12',
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  col40: { width: '45%', fontSize: 10 },
  col15: { width: '15%', fontSize: 10, textAlign: 'center' },
  col20: { width: '20%', fontSize: 10, textAlign: 'right' },
  colHeader: { fontWeight: 'bold', fontSize: 9, color: '#555555', textTransform: 'uppercase' },
  totalsBlock: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginBottom: 5,
  },
  totalLabel: { fontSize: 11, color: '#555555' },
  totalValue: { fontSize: 11, color: '#111111', fontWeight: 'bold' },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    borderTopWidth: 2,
    borderTopColor: '#f07020',
    paddingTop: 8,
    marginTop: 5,
  },
  grandTotalLabel: { fontSize: 13, color: '#111111', fontWeight: 'bold' },
  grandTotalValue: { fontSize: 13, color: '#f07020', fontWeight: 'bold' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#888888',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingTop: 10,
  },
  statusBadge: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    fontSize: 9,
    padding: '3 8',
    borderRadius: 4,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statusBadgeUnpaid: {
    backgroundColor: '#fefce8',
    color: '#ca8a04',
  },
  deliveryInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 4,
  },
  deliveryLabel: {
    fontSize: 9,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  deliveryValue: {
    fontSize: 10,
    color: '#111111',
  }
})

interface InvoiceLineItem {
  description: string
  quantity: number
  unitPrice: number
  amount: number
  category?: string
}

interface InvoicePDFProps {
  invoice: {
    id: string
    ref: string
    createdAt: string
    dateFrom: string
    dateTo: string
    status: string
    subtotal: number
    vat: number
    totalNet: number
    cashCollected: number
    refundedAmount: number
    cycleType: string
    seller: {
      name: string
      email: string
      phone?: string
    }
    deliveryMan?: {
      name: string
      phone?: string
    }
    lineItems?: InvoiceLineItem[]
  }
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  const items = invoice.lineItems || []
  const isPaid = invoice.status === 'PAID'
  const isDeliveryCycle = invoice.cycleType === 'DELIVERY'

  // Build default line items if none exist
  const displayItems = items.length > 0 ? items : [
    {
      description: isDeliveryCycle ? 'Livraison de colis' : 'Ventes COD collectées',
      quantity: 1,
      unitPrice: invoice.subtotal,
      amount: invoice.subtotal,
    }
  ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandName}>E-Gabon Prime</Text>
            <Text style={styles.brandSub}>COD FULFILLMENT PLATFORM</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>FACTURE</Text>
            <Text style={styles.invoiceNumber}>{invoice.ref}</Text>
          </View>
        </View>

        {/* Billed To + Invoice Info */}
        <View style={styles.twoCol}>
          <View style={styles.colBlock}>
            <Text style={styles.colLabel}>Facturé à</Text>
            <Text style={styles.colValue}>{invoice.seller.name}</Text>
            <Text style={styles.colValueSub}>{invoice.seller.email}</Text>
            {invoice.seller.phone && (
              <Text style={styles.colValueSub}>{invoice.seller.phone}</Text>
            )}
          </View>
          <View style={[styles.colBlock, { alignItems: 'flex-end' }]}>
            <Text style={styles.colLabel}>Détails</Text>
            <Text style={styles.colValueSub}>
              Période: {new Date(invoice.dateFrom).toLocaleDateString('fr-FR')} - {new Date(invoice.dateTo).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={styles.colValueSub}>
              Émise le: {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
            </Text>
            <Text style={[styles.statusBadge, isPaid ? styles.statusBadge : styles.statusBadgeUnpaid, { marginTop: 6 }]}>
              {isPaid ? 'PAYÉE' : 'IMPAYÉE'}
            </Text>
          </View>
        </View>

        {/* Delivery Man Info (if applicable) */}
        {isDeliveryCycle && invoice.deliveryMan && (
          <View style={styles.deliveryInfo}>
            <Text style={styles.deliveryLabel}>Livreur assigné</Text>
            <Text style={styles.deliveryValue}>{invoice.deliveryMan.name}</Text>
            {invoice.deliveryMan.phone && (
              <Text style={styles.deliveryValue}>{invoice.deliveryMan.phone}</Text>
            )}
          </View>
        )}

        {/* Items Table */}
        {displayItems.length > 0 && (
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.col40, styles.colHeader]}>Description</Text>
              <Text style={[styles.col15, styles.colHeader]}>Qté</Text>
              <Text style={[styles.col20, styles.colHeader]}>Prix unit.</Text>
              <Text style={[styles.col20, styles.colHeader]}>Total</Text>
            </View>
            {displayItems.map((item, i) => (
              <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={styles.col40}>{item.description}</Text>
                <Text style={styles.col15}>{item.quantity}</Text>
                <Text style={styles.col20}>{item.unitPrice.toLocaleString()} XAF</Text>
                <Text style={styles.col20}>{item.amount.toLocaleString()} XAF</Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Montant collecté</Text>
            <Text style={styles.totalValue}>{invoice.cashCollected.toLocaleString()} XAF</Text>
          </View>
          {invoice.refundedAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Remboursements</Text>
              <Text style={styles.totalValue}>- {invoice.refundedAmount.toLocaleString()} XAF</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Sous-total</Text>
            <Text style={styles.totalValue}>{invoice.subtotal.toLocaleString()} XAF</Text>
          </View>
          {invoice.vat > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>{invoice.vat.toLocaleString()} XAF</Text>
            </View>
          )}
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total NET</Text>
            <Text style={styles.grandTotalValue}>{invoice.totalNet.toLocaleString()} XAF</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          E-Gabon Prime • Plateforme de livraison Cash-on-Delivery • Gabon
        </Text>
      </Page>
    </Document>
  )
}
