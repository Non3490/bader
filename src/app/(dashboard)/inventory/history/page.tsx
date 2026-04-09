'use client'

import { useEffect, useState } from 'react'
import { Search, ArrowDownLeft, ArrowUpRight, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Movement {
  id: string
  type: string
  quantity: number
  quantityBefore: number
  quantityAfter: number
  note: string | null
  createdAt: string
  stock: {
    product: { name: string; sku: string | null }
    warehouse: { name: string; city: string } | null
  }
  createdBy: { name: string } | null
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ADD: { label: 'Entrée', color: 'bg-green-100 text-green-700' },
  DEDUCT: { label: 'Sortie', color: 'bg-red-100 text-red-700' },
  SET: { label: 'Ajustement', color: 'bg-blue-100 text-blue-700' },
  TRANSFER: { label: 'Transfert', color: 'bg-purple-100 text-purple-700' },
  RETURN: { label: 'Retour', color: 'bg-orange-100 text-orange-700' },
}

export default function InventoryHistoryPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const fetchMovements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const res = await fetch(`/api/admin/inventory/movements?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMovements(data.movements ?? [])
    } catch {
      toast.error('Impossible de charger l\'historique')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMovements() }, [typeFilter])

  const filtered = movements.filter((m) => {
    const q = searchQuery.toLowerCase()
    return (
      m.stock?.product?.name?.toLowerCase().includes(q) ||
      (m.stock?.product?.sku || '').toLowerCase().includes(q) ||
      (m.note || '').toLowerCase().includes(q)
    )
  })

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historique des mouvements</h1>
          <p className="text-sm text-muted-foreground">Toutes les entrées et sorties de stock</p>
        </div>
        <button onClick={fetchMovements} className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Rechercher par produit, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="all">Tous les types</option>
          <option value="ADD">Entrées</option>
          <option value="DEDUCT">Sorties</option>
          <option value="SET">Ajustements</option>
          <option value="RETURN">Retours</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-semibold">Date</th>
                  <th className="text-left py-3 px-4 font-semibold">Produit</th>
                  <th className="text-center py-3 px-4 font-semibold">Type</th>
                  <th className="text-right py-3 px-4 font-semibold">Avant</th>
                  <th className="text-center py-3 px-4 font-semibold">Variation</th>
                  <th className="text-right py-3 px-4 font-semibold">Après</th>
                  <th className="text-left py-3 px-4 font-semibold">Entrepôt</th>
                  <th className="text-left py-3 px-4 font-semibold">Par</th>
                  <th className="text-left py-3 px-4 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">Aucun mouvement trouvé</td>
                  </tr>
                ) : filtered.map((m) => {
                  const typeInfo = TYPE_LABELS[m.type] ?? { label: m.type, color: 'bg-gray-100 text-gray-700' }
                  const isPositive = m.type === 'ADD' || m.type === 'RETURN' || (m.type === 'SET' && m.quantity > 0)
                  return (
                    <tr key={m.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{m.stock?.product?.name ?? '—'}</div>
                        <div className="text-xs text-gray-400 font-mono">{m.stock?.product?.sku ?? ''}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">{m.quantityBefore}</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={`flex items-center justify-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {isPositive ? '+' : ''}{m.type === 'DEDUCT' ? -m.quantity : m.quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">{m.quantityAfter}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{m.stock?.warehouse?.name ?? '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{m.createdBy?.name ?? '—'}</td>
                      <td className="py-3 px-4 text-xs text-gray-400">{m.note || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
