'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCircle, AlertCircle, Loader2, Trash2, RefreshCw, Sheet, Download, Upload, Clock, XCircle } from 'lucide-react'
import { toast } from 'sonner'

// Helper function to format time ago
function formatTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return 'Never synced'
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const ECOMMERCE_PLATFORMS = [
  { key: 'SHOPIFY', label: 'Shopify', color: 'bg-green-100 text-green-800' },
  { key: 'YOUCAN', label: 'YouCan', color: 'bg-blue-100 text-blue-800' },
  { key: 'DROPIFY', label: 'Dropify', color: 'bg-purple-100 text-purple-800' }
]

interface Integration {
  id: string
  platform: string
  isActive: boolean
}

interface GoogleSheet {
  id: string
  spreadsheetId: string
  sheetName: string
  createdAt: string
  lastSyncedAt?: string | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
}

export default function SellerIntegrationsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [googleSheets, setGoogleSheets] = useState<GoogleSheet[]>([])
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  // Google Sheets state
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [addingSheet, setAddingSheet] = useState(false)
  const [testingSheet, setTestingSheet] = useState<Record<string, boolean>>({})
  const [syncingSheet, setSyncingSheet] = useState<Record<string, boolean>>({})
  const [sheetInfo, setSheetInfo] = useState<Record<string, { rows: number; columns: number; headers: string[] }>>({})

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      window.location.href = '/login'
      return
    }
    if (user.role !== 'SELLER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      window.location.href = '/unauthorized'
      return
    }
  }, [user, userLoading])

  const loadData = async () => {
    if (!user) return
    const [integrationsRes, sheetsRes] = await Promise.all([
      fetch('/api/integrations').then(r => r.json()).catch(() => ({ integrations: [] })),
      fetch('/api/google-sheets').then(r => r.json()).catch(() => ({ sheets: [] }))
    ])
    setIntegrations(integrationsRes.integrations ?? [])
    setGoogleSheets(sheetsRes.sheets ?? [])
  }

  useEffect(() => {
    loadData()
  }, [user])

  const getIntegration = (platform: string) => integrations.find(i => i.platform === platform)

  const handleSave = async (platform: string) => {
    const secret = secrets[platform]?.trim()
    if (!secret) return toast.error('Secret cannot be empty')
    setSaving(s => ({ ...s, [platform]: true }))
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, secret })
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(`${platform} integration saved`)
      setSecrets(s => ({ ...s, [platform]: '' }))
      await loadData()
    } catch { toast.error('Failed to save') } finally {
      setSaving(s => ({ ...s, [platform]: false }))
    }
  }

  const handleDelete = async (id: string, platform: string) => {
    setDeleting(s => ({ ...s, [platform]: true }))
    try {
      await fetch(`/api/integrations?id=${id}`, { method: 'DELETE' })
      toast.success('Integration removed')
      setIntegrations(prev => prev.filter(i => i.id !== id))
    } catch { toast.error('Failed to remove') } finally {
      setDeleting(s => ({ ...s, [platform]: false }))
    }
  }

  // Google Sheets handlers
  const handleAddGoogleSheet = async () => {
    if (!spreadsheetId.trim()) return toast.error('Spreadsheet ID is required')
    setAddingSheet(true)
    try {
      const res = await fetch('/api/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId: spreadsheetId.trim(), sheetName: sheetName.trim() || 'Orders' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to connect')
      toast.success('Google Sheets connected successfully')
      setSpreadsheetId('')
      setSheetName('')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Google Sheets')
    } finally {
      setAddingSheet(false)
    }
  }

  const handleTestSheet = async (id: string, spreadsheetId: string, sheetName: string) => {
    setTestingSheet(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'test', spreadsheetId, sheetName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Test failed')
      setSheetInfo(s => ({ ...s, [id]: { rows: data.rowCount, columns: data.columnCount, headers: data.headers } }))
      toast.success(`Sheet has ${data.rowCount} rows`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Test failed')
    } finally {
      setTestingSheet(s => ({ ...s, [id]: false }))
    }
  }

  const handleSyncSheet = async (id: string, sheet: GoogleSheet, operation: string) => {
    setSyncingSheet(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch('/api/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, spreadsheetId: sheet.spreadsheetId, sheetName: sheet.sheetName, sheetId: id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      // Update the sheet info with new sync status
      if (data.lastSyncedAt) {
        setGoogleSheets(prev => prev.map(s =>
          s.id === id
            ? { ...s, lastSyncedAt: data.lastSyncedAt, lastSyncStatus: 'SUCCESS', lastSyncError: null }
            : s
        ))
      }

      toast.success(`Sync completed: ${data.results?.created || 0} created, ${data.results?.updated || 0} updated`)
    } catch (error) {
      // Update with error status
      setGoogleSheets(prev => prev.map(s =>
        s.id === id
          ? { ...s, lastSyncStatus: 'ERROR', lastSyncError: error instanceof Error ? error.message : 'Unknown error' }
          : s
      ))
      toast.error(error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncingSheet(s => ({ ...s, [id]: false }))
    }
  }

  const handleDeleteSheet = async (id: string) => {
    if (!confirm('Are you sure you want to remove this Google Sheet integration?')) return
    try {
      await fetch(`/api/google-sheets/${id}`, { method: 'DELETE' })
      toast.success('Google Sheets integration removed')
      await loadData()
    } catch { toast.error('Failed to remove') }
  }

  if (userLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your platforms for seamless order management</p>
        </div>

        <Tabs defaultValue="ecommerce" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ecommerce">E-commerce Platforms</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="ecommerce" className="space-y-4 mt-4">
            {ECOMMERCE_PLATFORMS.map(platform => {
              const existing = getIntegration(platform.key)
              return (
                <Card key={platform.key}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{platform.label}</CardTitle>
                        <Badge className={existing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          {existing ? <><CheckCircle className="h-3 w-3 mr-1 inline" />Connected</> : <><AlertCircle className="h-3 w-3 mr-1 inline" />Not connected</>}
                        </Badge>
                      </div>
                      {existing && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleting[platform.key]}
                          onClick={() => handleDelete(existing.id, platform.key)}
                        >
                          {deleting[platform.key] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      Orders from {platform.label} will be automatically imported when a webhook is received.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label>{existing ? 'Update Secret Key' : 'Set Secret Key'}</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder={existing ? '••••••• (enter new value to update)' : 'Paste your webhook secret...'}
                          value={secrets[platform.key] ?? ''}
                          onChange={e => setSecrets(s => ({ ...s, [platform.key]: e.target.value }))}
                        />
                        <Button
                          disabled={saving[platform.key] || !secrets[platform.key]?.trim()}
                          onClick={() => handleSave(platform.key)}
                        >
                          {saving[platform.key] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4 mt-4">
            {/* Add new Google Sheet */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sheet className="h-5 w-5 text-green-600" />
                  Connect Google Sheet
                </CardTitle>
                <CardDescription>
                  Enable 2-way sync between your Google Sheets and platform. Orders and stock can be synchronized.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="spreadsheetId">Spreadsheet ID</Label>
                  <Input
                    id="spreadsheetId"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjGMUUqptb..."
                    value={spreadsheetId}
                    onChange={e => setSpreadsheetId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Found in your Google Sheet URL: /d/&lt;SPREADSHEET_ID&gt;/edit
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sheetName">Sheet Name (optional)</Label>
                  <Input
                    id="sheetName"
                    placeholder="Orders"
                    value={sheetName}
                    onChange={e => setSheetName(e.target.value)}
                  />
                </div>
                <Button
                  disabled={addingSheet || !spreadsheetId.trim()}
                  onClick={handleAddGoogleSheet}
                  className="w-full"
                >
                  {addingSheet ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : 'Connect Sheet'}
                </Button>
              </CardContent>
            </Card>

            {/* Connected Google Sheets */}
            {googleSheets.map(sheet => {
              const info = sheetInfo[sheet.id]
              return (
                <Card key={sheet.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Sheet className="h-5 w-5 text-green-600" />
                          {sheet.sheetName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          ID: {sheet.spreadsheetId.slice(0, 15)}...
                          {info && <span className="ml-2 text-xs">({info.rows} rows)</span>}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline" size="sm"
                          disabled={testingSheet[sheet.id]}
                          onClick={() => handleTestSheet(sheet.id, sheet.spreadsheetId, sheet.sheetName)}
                        >
                          {testingSheet[sheet.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSheet(sheet.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline" size="sm"
                        disabled={syncingSheet[sheet.id]}
                        onClick={() => handleSyncSheet(sheet.id, sheet, 'pull_orders')}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {syncingSheet[sheet.id] ? 'Importing...' : 'Import Orders'}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={syncingSheet[sheet.id]}
                        onClick={() => handleSyncSheet(sheet.id, sheet, 'pull_stock')}
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        {syncingSheet[sheet.id] ? 'Importing...' : 'Import Stock'}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={syncingSheet[sheet.id]}
                        onClick={() => handleSyncSheet(sheet.id, sheet, 'push_all_orders')}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {syncingSheet[sheet.id] ? 'Exporting...' : 'Export All Orders'}
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        disabled={syncingSheet[sheet.id]}
                        onClick={() => handleSyncSheet(sheet.id, sheet, 'push_stock')}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        {syncingSheet[sheet.id] ? 'Exporting...' : 'Export Stock'}
                      </Button>
                    </div>

                    {/* Last Synced Indicator */}
                    {sheet.lastSyncStatus && (
                      <div className={`mt-3 p-2 rounded text-xs flex items-center gap-2 ${
                        sheet.lastSyncStatus === 'SUCCESS'
                          ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : sheet.lastSyncStatus === 'ERROR'
                          ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                          : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                      }`}>
                        {sheet.lastSyncStatus === 'SUCCESS' && <CheckCircle className="h-3 w-3" />}
                        {sheet.lastSyncStatus === 'ERROR' && <XCircle className="h-3 w-3" />}
                        {sheet.lastSyncStatus === 'IN_PROGRESS' && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span className="flex-1">
                          {sheet.lastSyncStatus === 'SUCCESS' && 'Last synced:'}
                          {sheet.lastSyncStatus === 'ERROR' && 'Sync failed:'}
                          {sheet.lastSyncStatus === 'IN_PROGRESS' && 'Syncing...'}{' '}
                          {formatTimeAgo(sheet.lastSyncedAt)}
                        </span>
                        {sheet.lastSyncStatus === 'SUCCESS' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1 text-xs"
                            onClick={() => handleSyncSheet(sheet.id, sheet, 'pull_orders')}
                            disabled={syncingSheet[sheet.id]}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}

                    {info && info.headers.length > 0 && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <span className="font-medium">Headers:</span> {info.headers.slice(0, 5).join(', ')}{info.headers.length > 5 && '...'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
            {googleSheets.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No Google Sheets connected yet. Add one above to enable 2-way sync.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
