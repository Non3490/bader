'use client'

import { useEffect, useState } from 'react'
import { Search, Save, RefreshCw, Package, AlertTriangle, CheckCircle, Plus, Minus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface StockItem {
  id: string
  quantity: number
  alertLevel: number
  product: {
    id: string
    name: string
    sku: string | null
    category: string | null
  }
  warehouse: { name: string; city: string } | null
}

interface Edit {
  stockId: string
  delta: number
  operation: 'add' | 'set' | 'deduct'
  note: string
}

export default function UpdateInventoryPage() {
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [edits, setEdits] = useState<Record<string, Edit>>({})

  const fetchStocks = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stock')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStocks(data.stocks ?? [])
    } catch {
      toast.error('Impossible de charger le stock')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStocks() }, [])

  const filtered = stocks.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      s.product.name.toLowerCase().includes(q) ||
      (s.product.sku || '').toLowerCase().includes(q) ||
      (s.product.category || '').toLowerCase().includes(q)
    )
  })

  const setEdit = (stockId: string, field: keyof Edit, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [stockId]: { stockId, delta: 0, operation: 'add', note: '', ...prev[stockId], [field]: value },
    }))
  }

  const handleSave = async (stockId: string) => {
    const edit = edits[stockId]
    if (!edit || edit.delta === 0) { toast.warning('Entrez une quantité à modifier'); return }
    setSaving(stockId)
    try {
      const res = await fetch('/api/stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stockId,
          quantity: edit.delta,
          operation: edit.operation,
          note: edit.note || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Stock mis à jour')
      setEdits((prev) => { const next = { ...prev }; delete next[stockId]; return next })
      fetchStocks()
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mettre à jour le stock</h1>
          <p className="text-sm text-muted-foreground">Ajuster les quantités produit par produit</p>
        </div>
        <button onClick={fetchStocks} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Rechercher par nom, SKU, catégorie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold">Produit</th>
                  <th className="text-center py-3 px-4 font-semibold">Stock actuel</th>
                  <th className="text-center py-3 px-4 font-semibold">Seuil alerte</th>
                  <th className="text-left py-3 px-4 font-semibold">Opération</th>
                  <th className="text-center py-3 px-4 font-semibold">Quantité</th>
                  <th className="text-left py-3 px-4 font-semibold">Note</th>
                  <th className="text-center py-3 px-4 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">Aucun produit trouvé</td>
                  </tr>
                ) : filtered.map((s) => {
                  const edit = edits[s.id]
                  const isLow = s.quantity > 0 && s.quantity <= s.alertLevel
                  const isOut = s.quantity === 0
                  return (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-gray-400 shrink-0" />
                          <div>
                            <div className="font-medium">{s.product.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{s.product.sku ?? ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`font-bold text-lg ${isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-gray-800'}`}>
                          {s.quantity}
                        </span>
                        {isOut && <AlertTriangle className="h-3 w-3 text-red-500 inline ml-1" />}
                        {isLow && <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-1" />}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500">{s.alertLevel}</td>
                      <td className="py-3 px-4">
                        <select
                          value={edit?.operation ?? 'add'}
                          onChange={(e) => setEdit(s.id, 'operation', e.target.value)}
                          className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                        >
                          <option value="add">+ Ajouter</option>
                          <option value="deduct">− Déduire</option>
                          <option value="set">= Définir</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => setEdit(s.id, 'delta', Math.max(0, (edit?.delta ?? 0) - 1))}
                            className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
                          ><Minus className="h-3 w-3" /></button>
                          <input
                            type="number"
                            min="0"
                            value={edit?.delta ?? 0}
                            onChange={(e) => setEdit(s.id, 'delta', Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-16 text-center border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                          <button
                            onClick={() => setEdit(s.id, 'delta', (edit?.delta ?? 0) + 1)}
                            className="w-7 h-7 flex items-center justify-center border rounded hover:bg-gray-100"
                          ><Plus className="h-3 w-3" /></button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Raison..."
                          value={edit?.note ?? ''}
                          onChange={(e) => setEdit(s.id, 'note', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleSave(s.id)}
                          disabled={saving === s.id}
                          className="flex items-center gap-1 mx-auto px-3 py-1.5 bg-orange-500 text-white rounded text-xs font-medium hover:bg-orange-600 disabled:opacity-60"
                        >
                          {saving === s.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <CheckCircle className="h-3 w-3" />
                          }
                          Sauver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
