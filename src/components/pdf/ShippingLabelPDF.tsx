import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// 4x6 thermal label = 101.6mm × 152.4mm (288 x 432 points)
const styles = StyleSheet.create({
  page: {
    width: 288,
    height: 432,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 6,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 14, fontWeight: 'bold' },
  tracking: { fontSize: 11, fontWeight: 'bold' },
  section: { marginBottom: 8 },
  label: { fontSize: 7, color: '#666', textTransform: 'uppercase', marginBottom: 2 },
  value: { fontSize: 11, fontWeight: 'bold' },
  valueSm: { fontSize: 10 },
  separator: { borderBottomWidth: 0.5, borderBottomColor: '#ccc', marginVertical: 6 },
  statusBig: {
    marginTop: 8,
    backgroundColor: '#000',
    color: '#fff',
    padding: '6 12',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    borderRadius: 3,
  }
})

interface ShippingLabelProps {
  order: {
    trackingNumber: string
    recipientName: string
    phone: string
    address: string
    city: string
    codAmount: number
    seller: { name: string }
    status: string
  }
}

export function ShippingLabelPDF({ order }: ShippingLabelProps) {
  return (
    <Document>
      <Page size={[288, 432]} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>E-Gabon Prime</Text>
          <Text style={styles.tracking}>#{order.trackingNumber}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Destinataire</Text>
          <Text style={styles.value}>{order.recipientName}</Text>
          <Text style={styles.valueSm}>{order.phone}</Text>
          <Text style={styles.valueSm}>{order.address}</Text>
          <Text style={styles.valueSm}>{order.city}</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.section}>
          <Text style={styles.label}>Expéditeur</Text>
          <Text style={styles.valueSm}>{order.seller.name}</Text>
        </View>

        <Text style={styles.statusBig}>
          {order.codAmount.toLocaleString()} XAF — À PAYER
        </Text>
      </Page>
    </Document>
  )
}
