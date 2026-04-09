'use client'

import { useEffect, useState } from 'react'
import { TopBar, KpiStrip, PageShell } from '@/components/layout'
import { Search, TrendingUp, TrendingDown, Award, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DriverPerf {
  id: string
  name: string
  delivered: number
  returned: number
  cancelled: number
  postponed: number
  inProgress: number
  totalCashCollected: number
  deliveryRate: string
  avgDeliveriesPerDay: string
}

const PERIODS = [
  { label: "Aujourd'hui", value: 1 },
  { label: '7 jours', value: 7 },
  { label: '30 jours', value: 30 },
  { label: '90 jours', value: 90 },
]

export default function DeliveryPerformancePage() {
  const [performance, setPerformance] = useState<DriverPerf[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState(7)
  const [searchQuery, setSearchQuery] = useState('')

  const loadPerformance = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/delivery/performance?period=${period}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setPerformance(data.performance ?? [])
    } catch {
      toast.error('Impossible de charger les performances')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPerformance() }, [period])

  const filtered = performance.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalDelivered = performance.reduce((s, d) => s + d.delivered, 0)
  const totalReturned = performance.reduce((s, d) => s + d.returned, 0)
  const totalCash = performance.reduce((s, d) => s + d.totalCashCollected, 0)
  const avgRate = performance.length > 0
    ? (performance.reduce((s, d) => s + parseFloat(d.deliveryRate), 0) / performance.length).toFixed(1)
    : '0.0'

  const kpiItems = [
    { label: 'Total Livrées', value: String(totalDelivered), subtitle: `SUR ${period}J`, color: 'success' as const },
    { label: 'Total Retournées', value: String(totalReturned), subtitle: `SUR ${period}J`, color: 'dark' as const },
    { label: 'Taux Moyen', value: `${avgRate}%`, subtitle: 'LIVRAISON', color: 'orange' as const },
    { label: 'Cash Total', value: totalCash.toLocaleString(), subtitle: 'FCFA', color: 'info' as const },
  ]

  if (loading) {
    return (
      <PageShell role="admin" activePage="delivery-performance">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </PageShell>
    )
  }

  // Sort by delivery rate desc
  const sorted = [...filtered].sort((a, b) => parseFloat(b.deliveryRate) - parseFloat(a.deliveryRate))

  return (
    <PageShell role="admin" activePage="delivery-performance">
      <div className="min-h-screen bg-background">
        <TopBar title="Performance des Livreurs" />

        <div className="p-8 pt-[70px] pb-12 space-y-8">
          <KpiStrip items={kpiItems} />

          {/* Filters */}
          <div className="bg-[#f8f8f8] p-4 rounded-xl flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un livreur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-white border border-[#e5e5e5] text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Performance Cards */}
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <TrendingUp className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">Aucune donnée de performance</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sorted.map((driver, index) => {
                const rate = parseFloat(driver.deliveryRate)
                const isTop = index === 0
                return (
                  <div key={driver.id} className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-all ${isTop ? 'border-orange-200 ring-1 ring-orange-200' : 'border-[#e5e5e5]'}`}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base ${isTop ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'}`}>
                        {index === 0 ? <Award className="w-5 h-5" /> : driver.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-900 truncate">{driver.name}</h4>
                        <p className="text-xs text-gray-400">#{index + 1} classement</p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                        rate >= 80 ? 'bg-green-100 text-green-600' :
                        rate >= 60 ? 'bg-yellow-100 text-yellow-600' :
                        'bg-red-100 text-red-500'
                      }`}>
                        {driver.deliveryRate}%
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(100, rate)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-lg p-2.5">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        <div>
                          <p className="text-[10px] text-gray-400">Livrées</p>
                          <p className="text-sm font-bold text-gray-800">{driver.delivered}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-lg p-2.5">
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                        <div>
                          <p className="text-[10px] text-gray-400">Retournées</p>
                          <p className="text-sm font-bold text-gray-800">{driver.returned}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-lg p-2.5">
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                        <div>
                          <p className="text-[10px] text-gray-400">Reportées</p>
                          <p className="text-sm font-bold text-gray-800">{driver.postponed}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-lg p-2.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                        <div>
                          <p className="text-[10px] text-gray-400">Moy/jour</p>
                          <p className="text-sm font-bold text-gray-800">{driver.avgDeliveriesPerDay}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-[#f8f8f8] rounded-lg text-xs flex justify-between">
                      <span className="text-gray-400">Cash collecté</span>
                      <span className="font-bold text-gray-800">{driver.totalCashCollected.toLocaleString()} FCFA</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
