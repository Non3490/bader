'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useUser } from '@/hooks/use-user'
import {
  Truck,
  Settings,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCcw,
  Percent,
  Target
} from 'lucide-react'

interface DeliveryManWithStats {
  id: string
  name: string
  email: string
  totalDeliveries: number
  onTimeRate: number
  feeConfig: {
    costPerDelivery: number
    bonusAmount: number
    penaltyAmount: number
  }
  totalFees: number
  bonusAmount: number
  penaltyAmount: number
  netEarnings: number
  status: string
}

interface OverallStats {
  totalDeliveries: number
  avgOnTimeRate: number
  totalFeesPaid: number
  totalBonusPaid: number
  totalPenalties: number
}

export default function DeliveryFeesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [deliveryMen, setDeliveryMen] = useState<DeliveryManWithStats[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Config dialog state
  const [configOpen, setConfigOpen] = useState(false)
  const [selectedDeliveryMan, setSelectedDeliveryMan] = useState('')
  const [costPerDelivery, setCostPerDelivery] = useState('1500')
  const [bonusAmount, setBonusAmount] = useState('200')
  const [penaltyAmount, setPenaltyAmount] = useState('300')

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (user && user.role !== 'SELLER') {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    if (!user || user.role === 'SELLER') return

    setLoading(true)
    try {
      const response = await fetch('/api/finance/delivery-fees')
      if (response.ok) {
        const data = await response.json()
        setDeliveryMen(data.deliveryMen || [])
        setOverallStats(data.overallStats || null)
      }
    } catch (error) {
      console.error('Failed to fetch delivery fees:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDeliveryMan) return

    try {
      const response = await fetch('/api/finance/delivery-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryManId: selectedDeliveryMan,
          costPerDelivery: parseFloat(costPerDelivery),
          bonusAmount: parseFloat(bonusAmount),
          penaltyAmount: parseFloat(penaltyAmount)
        })
      })

      if (response.ok) {
        fetchData()
        setConfigOpen(false)
        setSelectedDeliveryMan('')
        setCostPerDelivery('1500')
        setBonusAmount('200')
        setPenaltyAmount('300')
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save delivery fee config')
    }
  }

  const openConfigDialog = (deliveryMan: DeliveryManWithStats) => {
    setSelectedDeliveryMan(deliveryMan.id)
    setCostPerDelivery(deliveryMan.feeConfig.costPerDelivery.toString())
    setBonusAmount(deliveryMan.feeConfig.bonusAmount.toString())
    setPenaltyAmount(deliveryMan.feeConfig.penaltyAmount.toString())
    setConfigOpen(true)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GA', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(value)
  }

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user || user.role === 'SELLER') {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Truck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              This page is only accessible to admin and delivery coordinators
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Delivery Man Fees</h1>
            <p className="text-muted-foreground">
              Configure and track delivery man performance & earnings
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Overall Stats */}
        {overallStats && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  <p className="text-2xl font-bold">{overallStats.totalDeliveries}</p>
                  <Truck className="h-6 w-6 mx-auto text-blue-600 mt-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Avg On-Time Rate</p>
                  <p className={`text-2xl font-bold ${overallStats.avgOnTimeRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {overallStats.avgOnTimeRate.toFixed(1)}%
                  </p>
                  <Percent className={`h-6 w-6 mx-auto mt-2 ${overallStats.avgOnTimeRate >= 90 ? 'text-green-600' : 'text-yellow-600'}`} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Total Fees Paid</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(overallStats.totalFeesPaid)}
                  </p>
                  <DollarSign className="h-6 w-6 mx-auto text-red-600 mt-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Bonus Paid</p>
                  <p className="text-2xl font-bold text-green-600">
                    +{formatCurrency(overallStats.totalBonusPaid)}
                  </p>
                  <TrendingUp className="h-6 w-6 mx-auto text-green-600 mt-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Penalties</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{formatCurrency(overallStats.totalPenalties)}
                  </p>
                  <TrendingDown className="h-6 w-6 mx-auto text-red-600 mt-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Fee Settings Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Settings Summary</CardTitle>
            <CardDescription>Standard fee configuration for all delivery men</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label>Base Delivery Fee</Label>
                <div className="text-xl font-bold">FCFA 1,500</div>
              </div>
              <div>
                <Label>On-Time Bonus</Label>
                <div className="text-xl font-bold text-green-600">+FCFA 200</div>
              </div>
              <div>
                <Label>Late Penalty</Label>
                <div className="text-xl font-bold text-red-600">-FCFA 300</div>
              </div>
              <div>
                <Label>Target On-Time Rate</Label>
                <div className="text-xl font-bold flex items-center gap-2">
                  &gt;90%
                  <Target className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Men Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Delivery Men Performance</CardTitle>
            <Dialog open={configOpen} onOpenChange={setConfigOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Fee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Configure Delivery Man Fees</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div>
                    <Label>Delivery Man</Label>
                    <select
                      value={selectedDeliveryMan}
                      onChange={(e) => setSelectedDeliveryMan(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      required
                    >
                      <option value="">Select delivery man...</option>
                      {deliveryMen.map((dm) => (
                        <option key={dm.id} value={dm.id}>
                          {dm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cost per Delivery (XAF)</Label>
                      <Input
                        type="number"
                        value={costPerDelivery}
                        onChange={(e) => setCostPerDelivery(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Bonus Amount (XAF)</Label>
                      <Input
                        type="number"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Penalty Amount (XAF)</Label>
                    <Input
                      type="number"
                      value={penaltyAmount}
                      onChange={(e) => setPenaltyAmount(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Save Configuration
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Delivery Man</th>
                    <th className="text-center py-2 px-4 font-medium">Deliveries (30d)</th>
                    <th className="text-center py-2 px-4 font-medium">On-Time Rate</th>
                    <th className="text-right py-2 px-4 font-medium">Cost/Delivery</th>
                    <th className="text-right py-2 px-4 font-medium">Bonus</th>
                    <th className="text-right py-2 px-4 font-medium">Penalty</th>
                    <th className="text-right py-2 px-4 font-medium">Net Earnings</th>
                    <th className="text-center py-2 px-4 font-medium">Status</th>
                    <th className="text-center py-2 px-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryMen.map((dm) => (
                    <tr key={dm.id} className="border-b">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-sm">{dm.name}</div>
                          <div className="text-sm text-muted-foreground">{dm.email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{dm.totalDeliveries}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={dm.onTimeRate >= 90 ? 'default' : 'secondary'}>
                          {dm.onTimeRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{formatCurrency(dm.feeConfig.costPerDelivery)}</td>
                      <td className="py-3 px-4 text-right text-green-600">+{formatCurrency(dm.bonusAmount)}</td>
                      <td className="py-3 px-4 text-right text-red-600">-{formatCurrency(dm.penaltyAmount)}</td>
                      <td className="py-3 px-4 text-right font-bold">{formatCurrency(dm.netEarnings)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={dm.status === 'ACTIVE' ? 'default' : 'destructive'}>
                          {dm.status === 'ACTIVE' ? 'Active' : 'On Probation'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="outline" size="sm" onClick={() => openConfigDialog(dm)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
