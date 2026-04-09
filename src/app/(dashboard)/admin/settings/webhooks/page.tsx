'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/use-user'
import { Settings, Copy, Trash2, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Platform {
  id: string
  platform: string
  isActive: boolean
  lastHit: string | null
  webhookUrl: string
  configured: boolean
}

interface WebhookActivity {
  id: string
  platform: string
  status: string
  eventType: string
  trackingNumber: string | null
  reason: string | null
  createdAt: string
}

const PLATFORM_CONFIG = {
  SHOPIFY: {
    name: 'Shopify',
    icon: '🛒',
    color: 'bg-green-100 text-green-800',
    bgColor: 'bg-green-50',
    description: 'HMAC-SHA256 signature verification'
  },
  YOUCAN: {
    name: 'YouCan',
    icon: '🟡',
    color: 'bg-yellow-100 text-yellow-800',
    bgColor: 'bg-yellow-50',
    description: 'Bearer token verification'
  },
  DROPIFY: {
    name: 'Dropify',
    icon: '📦',
    color: 'bg-blue-100 text-blue-800',
    bgColor: 'bg-blue-50',
    description: 'Bearer token verification'
  },
  LIGHTFUNNELS: {
    name: 'LightFunnels',
    icon: '💡',
    color: 'bg-purple-100 text-purple-800',
    bgColor: 'bg-purple-50',
    description: 'Bearer token verification'
  }
}

export default function WebhooksSettingsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [recentActivity, setRecentActivity] = useState<WebhookActivity[]>([])
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!userLoading && (!user || user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      router.push('/unauthorized')
      return
    }
    if (user) {
      fetchWebhookSettings()
    }
  }, [user, userLoading, router])

  const fetchWebhookSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/webhooks')
      if (res.ok) {
        const data = await res.json()
        setPlatforms(data.platforms || [])
        setRecentActivity(data.recentActivity || [])
      }
    } catch (error) {
      console.error('Failed to fetch webhook settings:', error)
      toast.error('Failed to load webhook settings')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Webhook URL copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy URL')
    }
  }

  const handleSaveSecret = async (platform: string) => {
    const secret = secrets[platform]
    if (!secret?.trim()) {
      toast.error('Please enter a secret/token')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/settings/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, secret })
      })

      if (res.ok) {
        toast.success(`${PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.name || platform} webhook configured`)
        setSecrets(prev => ({ ...prev, [platform]: '' }))
        fetchWebhookSettings()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save webhook configuration')
      }
    } catch (error) {
      console.error('Failed to save webhook:', error)
      toast.error('Failed to save webhook configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteWebhook = async (platform: string) => {
    if (!confirm(`Are you sure you want to delete the ${PLATFORM_CONFIG[platform as keyof typeof PLATFORM_CONFIG]?.name || platform} webhook configuration?`)) {
      return
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/settings/webhooks/${platform.toLowerCase()}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Webhook configuration deleted')
        fetchWebhookSettings()
      } else {
        toast.error('Failed to delete webhook configuration')
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error)
      toast.error('Failed to delete webhook configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async (platform: string) => {
    try {
      setTesting(prev => ({ ...prev, [platform]: true }))
      const res = await fetch(`/api/settings/webhooks/${platform.toLowerCase()}/test`, {
        method: 'POST'
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Connection successful! Last hit: ${data.lastHit || 'Never'}`)
      } else {
        toast.error(data.message || 'Connection test failed')
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      toast.error('Connection test failed')
    } finally {
      setTesting(prev => ({ ...prev, [platform]: false }))
    }
  }

  const getActivityBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <Badge className="bg-green-100 text-green-800">✓ Success</Badge>
      case 'FAILED':
        return <Badge className="bg-red-100 text-red-800">✗ Failed</Badge>
      case 'DUPLICATE':
        return <Badge className="bg-yellow-100 text-yellow-800">⊘ Duplicate</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading || userLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">You don't have access to this page.</p>
          <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Webhook Settings</h1>
          <p className="text-muted-foreground">
            Configure webhook endpoints for e-commerce platform integrations
          </p>
        </div>

        {/* Webhook Platforms */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webhook Integrations
          </h2>

          {Object.entries(PLATFORM_CONFIG).map(([key, config]) => {
            const platform = platforms.find(p => p.platform === key)
            const isConfigured = platform?.configured || false
            const lastHit = platform?.lastHit ? new Date(platform.lastHit).toLocaleString() : 'Never'
            const webhookUrl = platform?.webhookUrl || ''

            return (
              <Card key={key} className={cn(isConfigured && 'ring-2 ring-green-500/50')}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-xl', config.bgColor)}>
                        {config.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{config.name}</CardTitle>
                        <CardDescription>{config.description}</CardDescription>
                      </div>
                    </div>
                    <Badge className={cn(isConfigured ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
                      {isConfigured ? '🟢 Configured' : '🔴 Not Configured'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Webhook URL */}
                  <div>
                    <Label htmlFor={`${key}-url`}>Webhook URL</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id={`${key}-url`}
                        value={webhookUrl}
                        readOnly
                        className="font-mono text-sm bg-muted"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyUrl(webhookUrl)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Secret/Token Input */}
                  {isConfigured ? (
                    <div>
                      <Label htmlFor={`${key}-secret`}>Secret / Token</Label>
                      <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                          <Input
                            id={`${key}-secret`}
                            type={showSecret[key] ? 'text' : 'password'}
                            value={showSecret[key] ? '••••••••••••••••' : '••••••••••••••••'}
                            readOnly
                            className="font-mono text-sm"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowSecret(prev => ({ ...prev, [key]: !prev[key] }))}
                        >
                          {showSecret[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleTestConnection(key)}
                          disabled={testing[key]}
                        >
                          {testing[key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteWebhook(key)}
                          disabled={saving}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor={`${key}-secret-new`}>Secret / Token</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          id={`${key}-secret-new`}
                          type="password"
                          placeholder={`Enter ${config.name} webhook secret...`}
                          value={secrets[key] || ''}
                          onChange={(e) => setSecrets(prev => ({ ...prev, [key]: e.target.value }))}
                          className="font-mono text-sm"
                        />
                        <Button
                          onClick={() => handleSaveSecret(key)}
                          disabled={saving || !secrets[key]?.trim()}
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & Connect'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Last received info */}
                  {isConfigured && (
                    <div className="text-sm text-muted-foreground">
                      Last received: <span className="font-medium">{lastHit}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Recent Webhook Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Activity</CardTitle>
            <CardDescription>Latest webhook events from all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No webhook activity yet
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      activity.status === 'SUCCESS' ? 'bg-green-500' :
                      activity.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{activity.platform}</span>
                        {getActivityBadge(activity.status)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {activity.eventType}
                        {activity.trackingNumber && ` — ${activity.trackingNumber}`}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="text-blue-600 text-xl">ℹ️</div>
              <div className="space-y-1 text-sm text-blue-800">
                <p className="font-medium">About Webhooks</p>
                <p>Webhooks allow external platforms to send order data directly to your system. When an order is created on the connected platform, it will automatically appear in your orders list.</p>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  <li>Copy the webhook URL and add it to your platform's webhook settings</li>
                  <li>Enter the secret/token provided by the platform</li>
                  <li>Test the connection to verify everything is working</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
