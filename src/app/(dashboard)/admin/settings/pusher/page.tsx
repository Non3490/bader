'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUser } from '@/hooks/use-user'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  Bolt,
  Shield
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PusherSettings {
  appId: string
  key: string
  secret: string
  cluster: string
  channel?: string
}

const CLUSTERS = [
  { value: 'eu', label: 'Europe (EU)' },
  { value: 'us', label: 'United States (US)' },
  { value: 'ap1', label: 'Asia Pacific (AP1)' },
  { value: 'ap2', label: 'Asia Pacific (AP2)' },
  { value: 'ap3', label: 'Asia Pacific (AP3)' },
  { value: 'sa1', label: 'South America (SA1)' },
]

export default function PusherSettingsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [settings, setSettings] = useState<PusherSettings>({
    appId: '',
    key: '',
    secret: '',
    cluster: 'eu',
    channel: '',
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (user) {
      fetchSettings()
    }
  }, [user])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/pusher')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Failed to fetch Pusher settings:', error)
    }
  }

  const saveSettings = async () => {
    if (!settings.appId || !settings.key || !settings.secret) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/settings/pusher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast.success('Pusher settings saved successfully')
        setTestResult(null)
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const testConnection = async () => {
    if (!settings.appId || !settings.key || !settings.secret) {
      toast.error('Please fill in all required fields first')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/settings/pusher/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      const data = await response.json()
      setTestResult({
        success: data.success || false,
        message: data.message || 'Connection failed',
      })

      if (data.success) {
        toast.success('Pusher connection successful!')
      } else {
        toast.error('Pusher connection failed')
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test connection',
      })
      toast.error('Failed to test connection')
    } finally {
      setTesting(false)
    }
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pusher Configuration</h1>
              <p className="text-gray-600 dark:text-slate-400">Real-time updates and notifications</p>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Bolt className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Why Pusher?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Pusher enables real-time updates across the platform, allowing instant synchronization
                  of order status, queue updates, and activity feeds between all connected users.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle>Pusher Credentials</CardTitle>
            <CardDescription>
              Enter your Pusher app credentials. Get them from{' '}
              <a href="https://dashboard.pusher.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                pusher.com
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* App ID */}
            <div className="space-y-2">
              <Label htmlFor="appId">
                App ID <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="appId"
                value={settings.appId}
                onChange={(e) => setSettings({ ...settings, appId: e.target.value })}
                placeholder="e.g., 1234567"
              />
            </div>

            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="key">
                Key <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="key"
                value={settings.key}
                onChange={(e) => setSettings({ ...settings, key: e.target.value })}
                placeholder="e.g., 123abc456def"
              />
            </div>

            {/* Secret */}
            <div className="space-y-2">
              <Label htmlFor="secret">
                Secret <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="secret"
                  type={showSecret ? 'text' : 'password'}
                  value={settings.secret}
                  onChange={(e) => setSettings({ ...settings, secret: e.target.value })}
                  placeholder="e.g., 123abc456def789"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <Shield className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Cluster */}
            <div className="space-y-2">
              <Label htmlFor="cluster">
                Cluster <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={settings.cluster}
                onValueChange={(value) => setSettings({ ...settings, cluster: value })}
              >
                <SelectTrigger id="cluster">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLUSTERS.map((cluster) => (
                    <SelectItem key={cluster.value} value={cluster.value}>
                      {cluster.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Channel (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="channel">Default Channel (Optional)</Label>
              <Input
                id="channel"
                value={settings.channel || ''}
                onChange={(e) => setSettings({ ...settings, channel: e.target.value })}
                placeholder="e.g., gabon-cod-updates"
              />
              <p className="text-xs text-gray-500">
                Leave empty to use the default channel configuration
              </p>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={cn(
                "flex items-center gap-3 p-4 rounded-xl",
                testResult.success
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
              )}>
                {testResult.success ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" />
                )}
                <span className={cn(
                  "font-medium",
                  testResult.success ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                )}>
                  {testResult.message}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
              <Button
                onClick={testConnection}
                disabled={testing || loading}
                variant="outline"
                className="flex-1 sm:flex-none"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Bolt className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
              <Button
                onClick={saveSettings}
                disabled={loading || testing}
                className="flex-1 sm:flex-none"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Note */}
        <Card className="mt-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Security Notice</h3>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Your Pusher credentials are stored securely in the database. Never share these credentials
                  with unauthorized individuals. Rotate them periodically for enhanced security.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
