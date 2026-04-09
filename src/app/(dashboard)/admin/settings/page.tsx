'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { PermissionGate } from '@/components/admin/PermissionGate'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useUser } from '@/hooks/use-user'
import {
  Building2,
  DollarSign,
  Bell,
  Settings2,
  Save,
  TestTube,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface SettingsGroup {
  [key: string]: Array<{
    key: string
    value: string
    description: string
    type: 'text' | 'number' | 'boolean' | 'json' | 'image' | 'secret'
    category: string
  }>
}

export default function AdminSettingsPage() {
  const { user, loading: userLoading } = useUser()
  const { session } = useAdminSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Settings state
  const [businessSettings, setBusinessSettings] = useState<Record<string, string>>({})
  const [featureFlags, setFeatureFlags] = useState<SettingsGroup>({})
  const [paymentSettings, setPaymentSettings] = useState<Record<string, string>>({})
  const [notificationSettings, setNotificationSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAllSettings()
  }, [])

  const fetchAllSettings = async () => {
    setLoading(true)
    try {
      const [settingsRes, flagsRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/admin/feature-flags')
      ])

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const settingsMap: Record<string, string> = {}
        for (const [key, value] of Object.entries(settingsData.settings)) {
          settingsMap[key] = (value as any).value
        }
        setBusinessSettings(settingsMap)
      }

      if (flagsRes.ok) {
        const flagsData = await flagsRes.json()
        const flagsMap: SettingsGroup = {}
        for (const [category, items] of Object.entries(flagsData.settings)) {
          flagsMap[category] = (items as any[]).map((item: any) => ({
            key: item.key,
            value: item.value,
            description: item.description,
            type: item.type,
            category: item.category
          }))
        }
        setFeatureFlags(flagsMap)
      }

      // Fetch payment and notification settings if permitted
      const paymentRes = await fetch('/api/admin/payment-settings')
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json()
        const paymentMap: Record<string, string> = {}
        for (const [key, value] of Object.entries(paymentData.settings)) {
          paymentMap[key] = (value as any).value
        }
        setPaymentSettings(paymentMap)
      }

      const notifRes = await fetch('/api/admin/notification-settings')
      if (notifRes.ok) {
        const notifData = await notifRes.json()
        const notifMap: Record<string, string> = {}
        for (const [key, value] of Object.entries(notifData.settings)) {
          notifMap[key] = (value as any).value
        }
        setNotificationSettings(notifMap)
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (category: string, settings: Record<string, string>) => {
    setSaving(true)
    try {
      let endpoint = '/api/admin/settings'
      if (category === 'payment') endpoint = '/api/admin/payment-settings'
      if (category === 'notification') endpoint = '/api/admin/notification-settings'
      if (category === 'feature') endpoint = '/api/admin/feature-flags'

      const body = category === 'feature'
        ? { flags: settings }
        : { settings }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success('Settings saved successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save settings')
      }
    } catch (error) {
      toast.error('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (provider: string) => {
    setTesting(provider)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/payment-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      })

      const result = await response.json()
      setTestResult({
        success: result.success || false,
        message: result.message || (result.error || 'Unknown error')
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to test connection'
      })
    } finally {
      setTesting(null)
    }
  }

  const testNotification = async (channel: string, recipient: string) => {
    setTesting(channel)
    setTestResult(null)

    try {
      const response = await fetch('/api/admin/notification-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, recipient })
      })

      const result = await response.json()
      setTestResult({
        success: result.success || false,
        message: result.message || (result.error || 'Unknown error')
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Failed to send test notification'
      })
    } finally {
      setTesting(null)
    }
  }

  const renderSettingInput = (key: string, value: string, meta: any) => {
    switch (meta.type) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={value === 'true'}
              onCheckedChange={(checked) => {
                if (meta.category === 'Modules' || meta.category === 'System' || meta.category === 'Payment' || meta.category === 'Notification') {
                  const category = meta.category.toLowerCase()
                  if (category === 'payment') setPaymentSettings({ ...paymentSettings, [key]: checked ? 'true' : 'false' })
                  else if (category === 'notification') setNotificationSettings({ ...notificationSettings, [key]: checked ? 'true' : 'false' })
                }
              }}
            />
            <span className="text-sm text-muted-foreground">
              {value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => {
              if (key.startsWith('business.')) setBusinessSettings({ ...businessSettings, [key]: e.target.value })
              else if (key.startsWith('payment.')) setPaymentSettings({ ...paymentSettings, [key]: e.target.value })
              else if (key.startsWith('notification.')) setNotificationSettings({ ...notificationSettings, [key]: e.target.value })
            }}
          />
        )

      case 'secret':
        return (
          <div className="flex gap-2">
            <Input
              type="password"
              value={value === '••••••••' ? '' : value}
              onChange={(e) => {
                if (key.startsWith('payment.')) setPaymentSettings({ ...paymentSettings, [key]: e.target.value })
                else if (key.startsWith('notification.')) setNotificationSettings({ ...notificationSettings, [key]: e.target.value })
              }}
              placeholder={value === '••••••••' ? 'Enter new value to change' : ''}
            />
            {value === '••••••••' && <Badge variant="secondary">Stored</Badge>}
          </div>
        )

      default:
        return (
          <Input
            value={value}
            onChange={(e) => {
              if (key.startsWith('business.')) setBusinessSettings({ ...businessSettings, [key]: e.target.value })
              else if (key.startsWith('payment.')) setPaymentSettings({ ...paymentSettings, [key]: e.target.value })
              else if (key.startsWith('notification.')) setNotificationSettings({ ...notificationSettings, [key]: e.target.value })
            }}
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Settings</h1>
        <p className="text-muted-foreground">
          Configure business settings, feature flags, payment methods, and notifications
        </p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="business">
            <Building2 className="h-4 w-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="features">
            <Settings2 className="h-4 w-4 mr-2" />
            Features
          </TabsTrigger>
          <TabsTrigger value="payment">
            <DollarSign className="h-4 w-4 mr-2" />
            Payment
          </TabsTrigger>
          <TabsTrigger value="notification">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Business Settings */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Configure your business details, tax rates, and delivery settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(businessSettings).slice(0, 14).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    'business.name': 'Business Name',
                    'business.logo': 'Logo URL',
                    'business.email': 'Contact Email',
                    'business.phone': 'Contact Phone',
                    'business.address': 'Address',
                    'business.city': 'City',
                    'business.country': 'Country',
                    'tax.rate': 'Tax Rate (%)',
                    'tax.included': 'Tax Included in Prices',
                    'currency.code': 'Currency Code',
                    'currency.symbol': 'Currency Symbol',
                    'delivery.radius_km': 'Delivery Radius (km)',
                    'delivery.min_fee': 'Minimum Delivery Fee',
                    'delivery.base_fee': 'Base Delivery Fee'
                  }

                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>{labels[key] || key}</Label>
                      <Input
                        id={key}
                        value={value}
                        onChange={(e) => setBusinessSettings({ ...businessSettings, [key]: e.target.value })}
                        type={key.includes('rate') || key.includes('fee') || key.includes('radius') ? 'number' : 'text'}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <PermissionGate permission="*">
                  <Button onClick={() => saveSettings('business', businessSettings)} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Business Settings
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feature Flags */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable platform modules and features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(featureFlags).map(([category, items]) => (
                <div key={category} className="space-y-4">
                  <h3 className="font-semibold text-lg">{category}</h3>
                  <div className="grid gap-4">
                    {items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <Label htmlFor={item.key} className="font-medium">
                            {item.description || item.key}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">{item.key}</p>
                        </div>
                        <Switch
                          id={item.key}
                          checked={item.value === 'true'}
                          onCheckedChange={(checked) => {
                            const newFlags = { ...featureFlags }
                            newFlags[category] = items.map(i =>
                              i.key === item.key ? { ...i, value: checked ? 'true' : 'false' } : i
                            )
                            setFeatureFlags(newFlags)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <PermissionGate permission="*">
                  <Button onClick={() => {
                    const flatFlags: Record<string, string> = {}
                    for (const items of Object.values(featureFlags)) {
                      for (const item of items) {
                        flatFlags[item.key] = item.value
                      }
                    }
                    saveSettings('feature', flatFlags)
                  }} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Feature Flags
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment">
          <Card>
            <CardHeader>
              <CardTitle>Payment Configuration</CardTitle>
              <CardDescription>
                Configure payment gateways and methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                {/* Mobile Money */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Mobile Money</h3>
                  {Object.entries(paymentSettings).filter(([k]) => k.startsWith('payment.mobile_money')).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      'payment.mobile_money.enabled': 'Enabled',
                      'payment.mobile_money.provider': 'Provider',
                      'payment.mobile_money.api_key': 'API Key',
                      'payment.mobile_money.api_secret': 'API Secret',
                      'payment.mobile_money.merchant_id': 'Merchant ID'
                    }
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{labels[key] || key}</Label>
                        {renderSettingInput(key, value, { type: key.includes('enabled') ? 'boolean' : key.includes('secret') ? 'secret' : 'text', category: 'Payment' })}
                      </div>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('mobile_money')}
                    disabled={testing === 'mobile_money'}
                  >
                    {testing === 'mobile_money' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                    Test Connection
                  </Button>
                </div>

                {/* Card Payments */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Card Payments</h3>
                  {Object.entries(paymentSettings).filter(([k]) => k.startsWith('payment.card')).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      'payment.card.enabled': 'Enabled',
                      'payment.card.provider': 'Provider',
                      'payment.card.public_key': 'Public Key',
                      'payment.card.secret_key': 'Secret Key',
                      'payment.card.webhook_secret': 'Webhook Secret'
                    }
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{labels[key] || key}</Label>
                        {renderSettingInput(key, value, { type: key.includes('enabled') ? 'boolean' : key.includes('secret') || key.includes('key') ? 'secret' : 'text', category: 'Payment' })}
                      </div>
                    )
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testConnection('card')}
                    disabled={testing === 'card'}
                  >
                    {testing === 'card' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                    Test Connection
                  </Button>
                </div>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-end">
                <PermissionGate permission="*">
                  <Button onClick={() => saveSettings('payment', paymentSettings)} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Payment Settings
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notification">
          <Card>
            <CardHeader>
              <CardTitle>Notification Configuration</CardTitle>
              <CardDescription>
                Configure email, SMS, and WhatsApp notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                {/* Email */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">Email (SMTP)</h3>
                  {Object.entries(notificationSettings).filter(([k]) => k.startsWith('notification.email')).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      'notification.email.enabled': 'Enabled',
                      'notification.email.smtp_host': 'SMTP Host',
                      'notification.email.smtp_port': 'SMTP Port',
                      'notification.email.smtp_user': 'SMTP User',
                      'notification.email.smtp_password': 'SMTP Password',
                      'notification.email.from_email': 'From Email',
                      'notification.email.from_name': 'From Name'
                    }
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{labels[key] || key}</Label>
                        {renderSettingInput(key, value, { type: key.includes('enabled') ? 'boolean' : key.includes('password') ? 'secret' : key.includes('port') ? 'number' : 'text', category: 'Notification' })}
                      </div>
                    )
                  })}
                  <div className="flex gap-2">
                    <Input placeholder="your@email.com" id="test-email" />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const email = (document.getElementById('test-email') as HTMLInputElement)?.value
                        if (email) testNotification('email', email)
                      }}
                      disabled={testing === 'email'}
                    >
                      {testing === 'email' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                      Send Test
                    </Button>
                  </div>
                </div>

                {/* SMS */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h3 className="font-semibold">SMS (Twilio)</h3>
                  {Object.entries(notificationSettings).filter(([k]) => k.startsWith('notification.sms')).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      'notification.sms.enabled': 'Enabled',
                      'notification.sms.provider': 'Provider',
                      'notification.sms.account_sid': 'Account SID',
                      'notification.sms.auth_token': 'Auth Token',
                      'notification.sms.from_number': 'From Number'
                    }
                    return (
                      <div key={key} className="space-y-2">
                        <Label>{labels[key] || key}</Label>
                        {renderSettingInput(key, value, { type: key.includes('enabled') ? 'boolean' : key.includes('token') || key.includes('secret') ? 'secret' : 'text', category: 'Notification' })}
                      </div>
                    )
                  })}
                  <div className="flex gap-2">
                    <Input placeholder="+241XX XX XX XX" id="test-sms" />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const phone = (document.getElementById('test-sms') as HTMLInputElement)?.value
                        if (phone) testNotification('sms', phone)
                      }}
                      disabled={testing === 'sms'}
                    >
                      {testing === 'sms' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                      Send Test
                    </Button>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-end">
                <PermissionGate permission="notifications:configure">
                  <Button onClick={() => saveSettings('notification', notificationSettings)} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Notification Settings
                  </Button>
                </PermissionGate>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
