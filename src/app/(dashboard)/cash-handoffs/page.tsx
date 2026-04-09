'use client'

import { useEffect, useState } from 'react'
import { TopBar, KpiStrip, PageShell } from '@/components/layout'
import { Search, Wallet, CheckCircle, Clock, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface CashHandoff {
  id: string
  shiftDate: string
  cashAmount: number
  status: string
  notes: string | null
  createdAt: string
  driver: { id: string; name: string; phone: string } | null
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:   { label: 'En attente',  color: 'bg-yellow-100 text-yellow-600', icon: <Clock className="w-3.5 h-3.5" /> },
  CONFIRMED: { label: 'Confirmé',   color: 'bg-green-100 text-green-600',   icon: <CheckCircle className="w-3.5 h-3.5" /> },
  DISPUTED:  { label: 'Litigieux',  color: 'bg-red-100 text-red-500',       icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

export default function CashHandoffsPage() {
  const [handoffs, setHandoffs] = useState<CashHandoff[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadHandoffs = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/admin/cash-handoffs?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHandoffs(data.handoffs ?? [])
    } catch {
      toast.error('Impossible de charger les remises cash')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadHandoffs() }, [statusFilter])

  const filtered = handoffs.filter((h) => {
    const q = searchQuery.toLowerCase()
    return (
      (h.driver?.name || '').toLowerCase().includes(q) ||
      (h.driver?.phone || '').includes(q) ||
      (h.notes || '').toLowerCase().includes(q)
    )
  })

  const totalCash = handoffs.reduce((s, h) => s + h.cashAmount, 0)
  const pendingCash = handoffs.filter((h) => h.status === 'PENDING').reduce((s, h) => s + h.cashAmount, 0)
  const confirmedCash = handoffs.filter((h) => h.status === 'CONFIRMED').reduce((s, h) => s + h.cashAmount, 0)

  const kpiItems = [
    { label: 'Total Remises', value: String(handoffs.length), subtitle: 'ENREGISTRÉES', color: 'info' as const },
    { label: 'Total Cash', value: totalCash.toLocaleString(), subtitle: 'FCFA', color: 'orange' as const },
    { label: 'Confirmé', value: confirmedCash.toLocaleString(), subtitle: 'FCFA', color: 'success' as const },
    { label: 'En attente', value: pendingCash.toLocaleString(), subtitle: 'FCFA', color: 'dark' as const },
  ]

  if (loading) {
    return (
      <PageShell role="admin" activePage="cash-handoffs">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell role="admin" activePage="cash-handoffs">
      <div className="min-h-screen bg-background">
        <TopBar
          title="Remises Cash"
          actions={
            <button
              onClick={() => loadHandoffs(true)}
              disabled={refreshing}
              className="flex items-center gap-2 bg-white border border-[#e5e5e5] text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          }
        />

        <div className="p-8 pt-[70px] pb-12 space-y-8">
          <KpiStrip items={kpiItems} />

          {/* Filters */}
          <div className="bg-[#f8f8f8] p-4 rounded-xl flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par livreur, téléphone, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value) }}
              className="bg-white border border-[#e5e5e5] rounded-lg px-4 py-2.5 text-sm focus:outline-none"
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente</option>
              <option value="CONFIRMED">Confirmé</option>
              <option value="DISPUTED">Litigieux</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#e5e5e5] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Livreur</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date de Shift</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Montant</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Statut</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Notes</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Créé le</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-gray-400">
                        <Wallet className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">Aucune remise cash trouvée</p>
                      </td>
                    </tr>
                  ) : filtered.map((h) => {
                    const st = STATUS_LABELS[h.status] || { label: h.status, color: 'bg-gray-100 text-gray-500', icon: null }
                    return (
                      <tr key={h.id} className="border-b border-[#f5f5f5] hover:bg-[#fafafa] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                              {(h.driver?.name || '?')[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{h.driver?.name || '—'}</p>
                              <p className="text-xs text-gray-400">{h.driver?.phone || ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{new Date(h.shiftDate).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{h.cashAmount.toLocaleString()} FCFA</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${st.color}`}>
                            {st.icon}{st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{h.notes || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString('fr-FR')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
