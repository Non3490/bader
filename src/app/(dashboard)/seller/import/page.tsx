'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ImportResult {
  total: number
  imported: number
  duplicates: number
  message: string
}

export default function SellerImportPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
  }, [user, userLoading, router])

  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim())
      return headers.reduce((obj: Record<string, string>, h, i) => {
        obj[h] = values[i] ?? ''
        return obj
      }, {})
    })
  }

  const handleImport = async () => {
    if (!csvText.trim()) return toast.error('Paste CSV data first')
    const rows = parseCSV(csvText)
    if (rows.length === 0) return toast.error('No valid rows found')

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/orders/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: rows })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
      toast.success(data.message)
      setCsvText('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="h-6 w-6" />Import Orders</h1>
          <p className="text-muted-foreground">Bulk import orders from a CSV file</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>CSV Format</CardTitle>
            <CardDescription>
              Required columns: <code className="bg-muted px-1 rounded">recipientName</code>, <code className="bg-muted px-1 rounded">phone</code>, <code className="bg-muted px-1 rounded">city</code>, <code className="bg-muted px-1 rounded">productName</code>, <code className="bg-muted px-1 rounded">codAmount</code><br/>
              Optional: <code className="bg-muted px-1 rounded">address</code>, <code className="bg-muted px-1 rounded">productSku</code>, <code className="bg-muted px-1 rounded">quantity</code>, <code className="bg-muted px-1 rounded">note</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded p-3 text-xs font-mono">
              recipientName,phone,city,address,productName,productSku,quantity,codAmount,note<br/>
              John Doe,+24101234567,Libreville,Quartier Louis,Widget A,WGT-001,1,15000,
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Paste CSV Data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Paste your CSV data here (including header row)..."
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={12}
              className="font-mono text-sm"
            />
            <Button onClick={handleImport} disabled={loading || !csvText.trim()} className="w-full">
              {loading ? 'Importing...' : `Import Orders`}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className={result.imported > 0 ? 'border-green-200 bg-green-50 dark:bg-green-950/30' : 'border-orange-200 bg-orange-50'}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                {result.imported > 0
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <AlertCircle className="h-5 w-5 text-orange-600" />
                }
                <div>
                  <p className="font-medium">{result.message}</p>
                  <p className="text-sm text-muted-foreground">
                    Total: {result.total} | Imported: {result.imported} | Duplicates: {result.duplicates}
                  </p>
                </div>
              </div>
              {result.imported > 0 && (
                <Button className="mt-3" variant="outline" onClick={() => router.push('/seller/orders')}>
                  View Orders
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
