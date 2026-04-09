'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'

interface StockSnapshot {
  id: string
  productId: string
  productName: string
  sku: string
  seller: string
  date: string
  snapshotDate: string
  initialStock: number
  inForDelivery: number
  outForDelivery: number
  finalStock: number
}

interface SnapshotStats {
  totalInitialStock: number
  totalInForDelivery: number
  totalOutForDelivery: number
  totalFinalStock: number
  snapshotCount: number
}

export default function StockSnapshotsPage() {
  const [snapshots, setSnapshots] = useState<StockSnapshot[]>([])
  const [stats, setStats] = useState<SnapshotStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)

  const [startDate, setStartDate] = useState(
    format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [productId, setProductId] = useState('')

  useEffect(() => {
    fetchSnapshots()
  }, [startDate, endDate, productId])

  const fetchSnapshots = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
      })
      if (productId) params.append('productId', productId)

      const response = await fetch(`/api/stock-snapshots?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch snapshots')
      }

      const data = await response.json()
      setSnapshots(data.snapshots || [])

      // Calculate stats
      const stats = data.snapshots?.reduce(
        (acc: SnapshotStats, s: StockSnapshot) => ({
          totalInitialStock: acc.totalInitialStock + s.initialStock,
          totalInForDelivery: acc.totalInForDelivery + s.inForDelivery,
          totalOutForDelivery: acc.totalOutForDelivery + s.outForDelivery,
          totalFinalStock: acc.totalFinalStock + s.finalStock,
          snapshotCount: acc.snapshotCount + 1,
        }),
        { totalInitialStock: 0, totalInForDelivery: 0, totalOutForDelivery: 0, totalFinalStock: 0, snapshotCount: 0 }
      )
      setStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const triggerSnapshots = async () => {
    setTriggering(true)
    setError(null)

    try {
      const response = await fetch('/api/stock/snapshot-trigger')
      if (!response.ok) {
        throw new Error('Failed to trigger snapshots')
      }

      const data = await response.json()
      alert(`Created ${data.count} stock snapshots`)
      fetchSnapshots()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setTriggering(false)
    }
  }

  const exportCSV = async () => {
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        csv: 'true',
      })

      const response = await fetch(`/api/stock-snapshots?${params}`)
      if (!response.ok) {
        throw new Error('Failed to export CSV')
      }

      const csv = await response.text()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `stock-snapshots-${startDate}-${endDate}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  if (loading && snapshots.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading snapshots...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Daily Stock Snapshots</h1>
        <p className="text-gray-600">View and manage daily stock snapshots</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Filter by product ID"
              className="border rounded px-3 py-2 w-64"
            />
          </div>
          <button
            onClick={fetchSnapshots}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={exportCSV}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Export CSV
          </button>
          <button
            onClick={triggerSnapshots}
            disabled={triggering}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {triggering ? 'Creating...' : 'Create Snapshots'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Snapshots</div>
            <div className="text-2xl font-bold">{stats.snapshotCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Initial Stock</div>
            <div className="text-2xl font-bold text-blue-600">{stats.totalInitialStock}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">In Delivery</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.totalInForDelivery}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Out Delivery</div>
            <div className="text-2xl font-bold text-orange-600">{stats.totalOutForDelivery}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600 mb-1">Final Stock</div>
            <div className="text-2xl font-bold text-green-600">{stats.totalFinalStock}</div>
          </div>
        </div>
      )}

      {/* Stock Flow Chart */}
      {stats && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="text-lg font-semibold mb-4">Stock Flow Overview</h3>
          <div className="h-32 flex items-center justify-between px-8">
            <div className="text-center flex-1">
              <div className="h-16 bg-blue-500 rounded-t flex items-end justify-center">
                <span className="text-white font-bold pb-2">{stats.totalInitialStock}</span>
              </div>
              <div className="text-sm font-medium mt-2">Initial</div>
            </div>
            <div className="text-3xl text-gray-400">→</div>
            <div className="text-center flex-1">
              <div className="h-16 bg-yellow-500 rounded-t flex items-end justify-center">
                <span className="text-white font-bold pb-2">{stats.totalInForDelivery}</span>
              </div>
              <div className="text-sm font-medium mt-2">In Delivery</div>
            </div>
            <div className="text-3xl text-gray-400">→</div>
            <div className="text-center flex-1">
              <div className="h-16 bg-orange-500 rounded-t flex items-end justify-center">
                <span className="text-white font-bold pb-2">{stats.totalOutForDelivery}</span>
              </div>
              <div className="text-sm font-medium mt-2">Out Delivery</div>
            </div>
            <div className="text-3xl text-gray-400">→</div>
            <div className="text-center flex-1">
              <div className="h-16 bg-green-500 rounded-t flex items-end justify-center">
                <span className="text-white font-bold pb-2">{stats.totalFinalStock}</span>
              </div>
              <div className="text-sm font-medium mt-2">Final</div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Initial</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">In Delivery</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Out Delivery</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium">{snapshot.productName}</td>
                <td className="px-4 py-3 text-sm">{snapshot.sku}</td>
                <td className="px-4 py-3 text-sm">{snapshot.seller}</td>
                <td className="px-4 py-3 text-sm">{format(new Date(snapshot.snapshotDate), 'yyyy-MM-dd')}</td>
                <td className="px-4 py-3 text-sm text-right text-blue-600">{snapshot.initialStock}</td>
                <td className="px-4 py-3 text-sm text-right text-yellow-600">{snapshot.inForDelivery}</td>
                <td className="px-4 py-3 text-sm text-right text-orange-600">{snapshot.outForDelivery}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600 font-medium">{snapshot.finalStock}</td>
              </tr>
            ))}
            {snapshots.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No snapshots found for the selected date range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
