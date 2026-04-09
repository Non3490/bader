'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/use-user'
import { toast } from 'sonner'

interface BlacklistEntry {
  id: string
  phone: string
  reason: string | null
  autoFlagged: boolean
  createdAt: string
  removedAt: string | null
  removedBy: string | null
  isActive: boolean
  orderCount: number
  confirmationRate: number
  deliveryRate: number
}

export default function BlacklistPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [newPhone, setNewPhone] = useState('')
  const [newReason, setNewReason] = useState('')

  // Check auth and redirect if needed
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
      return
    }
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.push('/unauthorized')
      return
    }
  }, [user, userLoading, router])

  const fetchBlacklist = async () => {
    setLoading(true)
    try {
      const searchParams = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''
      const res = await fetch(`/api/blacklist${searchParams}`)
      const data = await res.json()
      setBlacklist(data.blacklist ?? [])
    } catch (error) {
      toast.error('Failed to load blacklist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchBlacklist()
  }, [user])

  const handleAdd = async () => {
    if (!newPhone) return

    try {
      const res = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone, reason: newReason })
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Failed to add to blacklist')
        return
      }

      toast.success(`${newPhone} added to blacklist`)
      setNewPhone('')
      setNewReason('')
      fetchBlacklist()
    } catch {
      toast.error('Failed to add to blacklist')
    }
  }

  const handleRemove = async (phone: string) => {
    if (!confirm('Remove this phone from blacklist?')) return

    try {
      const res = await fetch(`/api/blacklist/${encodeURIComponent(phone)}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        toast.error('Failed to remove from blacklist')
        return
      }

      toast.success(`${phone} removed from blacklist`)
      fetchBlacklist()
    } catch {
      toast.error('Failed to remove from blacklist')
    }
  }

  // Early return if user is null or not authorized
  if (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return null
  }

  const stats = {
    total: blacklist.length,
    autoFlagged: blacklist.filter(b => b.autoFlagged).length,
    manual: blacklist.filter(b => !b.autoFlagged).length
  }

  if (userLoading || loading) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Blacklist</h1>
              <p className="text-muted-foreground">Manage blacklisted phone numbers</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: <Trash2 className="h-5 w-5 text-red-600" />, bg: 'bg-red-50 dark:bg-red-900/20', value: stats.total, label: 'Total Blacklisted' },
              { icon: <Search className="h-5 w-5 text-orange-600" />, bg: 'bg-orange-50 dark:bg-orange-900/20', value: stats.autoFlagged, label: 'Auto-Flagged' },
              { icon: <Plus className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-50 dark:bg-blue-900/20', value: stats.manual, label: 'Manually Added' }
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={cn('p-3 rounded-full', stat.bg)}>
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add Manual Entry */}
          <Card>
            <CardHeader>
              <CardTitle>Add to Blacklist</CardTitle>
              <CardDescription>Manually add a phone number to blacklist</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleAdd() }} className="flex gap-3">
                <Input
                  placeholder="Phone number (+241...)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Reason (optional)"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!newPhone}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Blacklist Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Blacklisted Numbers</span>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <Button variant="outline" onClick={fetchBlacklist} disabled={loading}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blacklist.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No phone numbers in blacklist</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Added</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Auto-Flagged</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Orders</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Confirm %</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Deliver %</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Reason</th>
                        <th className="text-left py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-bold uppercase text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/10">
                      {blacklist.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-3 px-4">
                            <span className="font-mono text-sm">{entry.phone}</span>
                          </td>
                          <td className="py-3 px-4">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={entry.autoFlagged ? 'default' : 'secondary'}>
                              {entry.autoFlagged ? 'Auto' : 'Manual'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold">{entry.orderCount}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={entry.confirmationRate < 50 ? 'destructive' : entry.confirmationRate < 70 ? 'secondary' : 'default'}>
                              {entry.confirmationRate}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={entry.deliveryRate < 50 ? 'destructive' : entry.deliveryRate < 70 ? 'secondary' : 'default'}>
                              {entry.deliveryRate}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <span className="text-sm truncate">{entry.reason || '-'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={entry.isActive ? 'destructive' : 'secondary'}>
                              {entry.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {entry.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(entry.phone)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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

  return null
}
