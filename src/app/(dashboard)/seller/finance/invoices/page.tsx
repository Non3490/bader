'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Download, Loader2 } from 'lucide-react'

interface Invoice {
  id: string
  ref: string
  cashCollected: number
  refundedAmount: number
  totalNet: number
  status: string
  dateFrom: string
  dateTo: string
  isLocked: boolean
  createdAt: string
}

export default function SellerInvoicesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return
    fetch('/api/invoices')
      .then(r => r.json())
      .then(d => setInvoices(d.invoices ?? []))
      .finally(() => setLoading(false))
  }, [user])

  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-GA', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(v)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-GA')

  const handleDownloadPDF = async (id: string) => {
    setDownloading({ ...downloading, [id]: true })
    try {
      const response = await fetch(`/api/invoices/${id}/pdf`)
      if (!response.ok) throw new Error('Failed to download PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download PDF error:', error)
    } finally {
      setDownloading(d => ({ ...d, [id]: false }))
    }
  }

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" />My Invoices</h1>
          <p className="text-muted-foreground">COD settlement invoices from the platform</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>No invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-3 px-2">Ref</th>
                      <th className="text-left py-3 px-2 hidden md:table-cell">Period</th>
                      <th className="text-right py-3 px-2">Collected</th>
                      <th className="text-right py-3 px-2 hidden md:table-cell">Returned</th>
                      <th className="text-right py-3 px-2">Net</th>
                      <th className="text-center py-3 px-2">Status</th>
                      <th className="text-center py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono">{inv.ref}</td>
                        <td className="py-3 px-2 hidden md:table-cell text-xs text-muted-foreground">
                          {fmtDate(inv.dateFrom)} — {fmtDate(inv.dateTo)}
                        </td>
                        <td className="py-3 px-2 text-right">{fmt(inv.cashCollected)}</td>
                        <td className="py-3 px-2 text-right hidden md:table-cell text-red-600">-{fmt(inv.refundedAmount)}</td>
                        <td className="py-3 px-2 text-right font-bold">{fmt(inv.totalNet)}</td>
                        <td className="py-3 px-2 text-center">
                          <Badge className={inv.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                          }>{inv.status}</Badge>
                        </td>
                        <td className="py-3 px-2 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(inv.id)}
                            disabled={downloading[inv.id]}
                          >
                            {downloading[inv.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
