'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, DollarSign, TrendingDown, Package, Loader2, RefreshCw, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

interface StockAlert {
  productId: string
  productName: string
  sku: string | null
  currentStock: number
  reorderPoint: number
  sellerName: string | null
}

interface ValuationItem {
  productId: string
  productName: string
  sku: string | null
  quantity: number
  costPrice: number
  totalValue: number
}

interface MovementSummary {
  totalAdded: number
  totalDeducted: number
  totalReturned: number
  periodDays: number
}

type ReportType = 'alerts' | 'valuation' | 'movement'

export default function InventoryReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('alerts')
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [valuation, setValuation] = useState<ValuationItem[]>([])
  const [movement, setMovement] = useState<MovementSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = async (type: ReportType) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/inventory/reports?type=${type}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (type === 'alerts') setAlerts(Array.isArray(data) ? data : (data.alerts ?? []))
      else if (type === 'valuation') setValuation(Array.isArray(data) ? data : (data.items ?? []))
      else if (type === 'movement') setMovement(data)
    } catch {
      toast.error('Impossible de charger le rapport')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport(reportType) }, [reportType])

  const tabs: { key: ReportType; label: string; icon: React.ReactNode }[] = [
    { key: 'alerts', label: 'Alertes Stock', icon: <AlertTriangle className="h-4 w-4" /> },
    { key: 'valuation', label: 'Valorisation', icon: <DollarSign className="h-4 w-4" /> },
    { key: 'movement', label: 'Analyse Mouvements', icon: <BarChart3 className="h-4 w-4" /> },
  ]

  const totalValuation = valuation.reduce((s, v) => s + v.totalValue, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports Inventaire</h1>
          <p className="text-sm text-muted-foreground">Analyse et suivi de votre stock</p>
        </div>
        <button
          onClick={() => fetchReport(reportType)}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setReportType(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              reportType === tab.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {/* Alerts Report */}
          {reportType === 'alerts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-700">{alerts.filter(a => a.currentStock === 0).length}</p>
                  <p className="text-sm text-red-600">Ruptures de stock</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-700">{alerts.filter(a => a.currentStock > 0).length}</p>
                  <p className="text-sm text-yellow-600">Stocks faibles</p>
                </div>
              </div>
              {alerts.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <Package className="h-10 w-10 mx-auto mb-2 text-green-400" />
                  <p className="font-medium text-green-600">Aucune alerte stock — tout est bien approvisionné !</p>
                </div>
              ) : (
                <div className="bg-white border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-4 font-semibold">Produit</th>
                        <th className="text-left py-3 px-4 font-semibold">Vendeur</th>
                        <th className="text-right py-3 px-4 font-semibold">Stock actuel</th>
                        <th className="text-right py-3 px-4 font-semibold">Seuil réapprovisionnement</th>
                        <th className="text-center py-3 px-4 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.productId} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">{a.productName}</div>
                            <div className="text-xs font-mono text-gray-400">{a.sku ?? ''}</div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{a.sellerName ?? '—'}</td>
                          <td className="py-3 px-4 text-right font-bold text-red-600">{a.currentStock}</td>
                          <td className="py-3 px-4 text-right text-gray-500">{a.reorderPoint}</td>
                          <td className="py-3 px-4 text-center">
                            {a.currentStock === 0
                              ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Rupture</span>
                              : <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Stock faible</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Valuation Report */}
          {reportType === 'valuation' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Valeur totale du stock</p>
                <p className="text-3xl font-bold text-green-700">
                  FCFA {totalValuation.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">{valuation.length} produits valorisés</p>
              </div>
              {valuation.length === 0 ? (
                <div className="text-center py-16 text-gray-400">Aucune donnée de valorisation disponible</div>
              ) : (
                <div className="bg-white border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-4 font-semibold">Produit</th>
                        <th className="text-right py-3 px-4 font-semibold">Quantité</th>
                        <th className="text-right py-3 px-4 font-semibold">Coût unitaire</th>
                        <th className="text-right py-3 px-4 font-semibold">Valeur totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuation.sort((a, b) => b.totalValue - a.totalValue).map((v) => (
                        <tr key={v.productId} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="font-medium">{v.productName}</div>
                            <div className="text-xs font-mono text-gray-400">{v.sku ?? ''}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">{v.quantity}</td>
                          <td className="py-3 px-4 text-right text-gray-500">FCFA {(v.costPrice ?? 0).toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-bold text-green-700">FCFA {(v.totalValue ?? 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Movement Analysis */}
          {reportType === 'movement' && (
            <div className="space-y-4">
              {!movement ? (
                <div className="text-center py-16 text-gray-400">Aucune donnée de mouvement disponible</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">+{movement.totalAdded}</p>
                    <p className="text-sm text-green-600">Entrées</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">-{movement.totalDeducted}</p>
                    <p className="text-sm text-red-600">Sorties</p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-orange-700">+{movement.totalReturned}</p>
                    <p className="text-sm text-orange-600">Retours</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{movement.periodDays}j</p>
                    <p className="text-sm text-blue-600">Période analysée</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
