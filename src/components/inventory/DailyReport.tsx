'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Calendar as CalendarIcon, Download, RefreshCcw, Search } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

interface Snapshot {
  id: string
  productId: string
  product: { name: string; sku: string; seller?: { name: string } }
  initialStock: number
  inForDelivery: number
  outForDelivery: number
  finalStock: number
  snapshotDate: string
}

export function DailyReport() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [dateQuery, setDateQuery] = useState('')

  const fetchSnapshots = async (dateStr?: string) => {
    try {
      setLoading(true)
      const url = dateStr ? `/api/stock/daily?date=${dateStr}` : '/api/stock/daily'
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) {
        setSnapshots(data.snapshots || [])
      } else {
        toast.error('Failed to load daily report')
      }
    } catch (error) {
      console.error(error)
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSnapshots()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchSnapshots(dateQuery)
  }

  const exportCSV = () => {
    if (snapshots.length === 0) return toast.error('No data to export')
    
    const headers = ['Date', 'Product', 'SKU', 'Initial', 'In (Added)', 'Out (Removed)', 'Final']
    const csvContent = [
      headers.join(','),
      ...snapshots.map(s => [
        format(new Date(s.snapshotDate), 'yyyy-MM-dd'),
        `"${s.product.name}"`,
        `"${s.product.sku}"`,
        s.initialStock,
        s.inForDelivery,
        s.outForDelivery,
        s.finalStock
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.setAttribute('download', `Daily_Stock_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Card className="mt-6 border-none shadow-none">
      <CardHeader className="px-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Daily Stock Snapshots</CardTitle>
            <CardDescription>View end-of-day balances and stock flow metric captures.</CardDescription>
          </div>
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Input 
                  type="date" 
                  value={dateQuery}
                  onChange={(e) => setDateQuery(e.target.value)}
                  className="w-40 pl-8"
                />
                <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Button type="submit" variant="secondary" size="icon"><Search className="h-4 w-4" /></Button>
            </form>
            <Button variant="outline" size="icon" onClick={() => fetchSnapshots()}><RefreshCcw className="h-4 w-4" /></Button>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                <TableHead>Snapshot Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right border-l">Initial</TableHead>
                <TableHead className="text-right text-blue-600">Stock In</TableHead>
                <TableHead className="text-right text-red-600">Stock Out</TableHead>
                <TableHead className="text-right border-l font-bold">End of Day Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No snapshots captured for the selected date. Snapshots are recorded daily at midnight.
                  </TableCell>
                </TableRow>
              ) : (
                snapshots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {format(new Date(s.snapshotDate), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{s.product.name}</div>
                        <div className="text-xs text-muted-foreground">{s.product.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right border-l font-medium">{s.initialStock}</TableCell>
                    <TableCell className="text-right text-blue-600 font-medium">+{s.inForDelivery}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">-{s.outForDelivery}</TableCell>
                    <TableCell className="text-right border-l text-lg font-bold">{s.finalStock}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
