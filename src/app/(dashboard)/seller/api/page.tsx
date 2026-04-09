'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Key,
  Copy,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Lock,
  Bolt,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ApiKeyData {
  id: string
  key: string
  lastUsedAt: string | null
  createdAt: string
}

export default function SellerApiPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [apiKey, setApiKey] = useState<ApiKeyData | null>(null)
  const [fullKey, setFullKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
  }, [user, userLoading, router])

  const fetchKey = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/api-key')
      if (res.ok) {
        const data = await res.json()
        setApiKey(data.apiKey)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchKey()
  }, [user])

  const generateKey = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/api-key', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setFullKey(data.apiKey.key)
      setApiKey(data.apiKey)
      setShowKey(true)
      toast.success('API key generated — copy it now, it will not be shown again!')
    } catch {
      toast.error('Failed to generate key')
    } finally {
      setGenerating(false)
    }
  }

  const revokeKey = async () => {
    if (!confirm('Revoke your API key? This cannot be undone.')) return
    try {
      const res = await fetch('/api/api-key', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setApiKey(null)
      setFullKey(null)
      toast.success('API key revoked')
    } catch {
      toast.error('Failed to revoke')
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  if (userLoading || !user) return null

  return (
    <>
      <div className="relative space-y-8 max-w-4xl mx-auto py-8">
        {/* Background Decorative Element */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="absolute top-1/2 -left-24 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl -z-10" />

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/50 pb-8">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-2">
              <ShieldCheck className="h-3 w-3" />
              <span>Developer Settings</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
              API Access
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg">
              Securely integrate Gabon COD platform into your custom workflows and third-party tools.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 shadow-sm" asChild>
              <a href="/docs">
                <Terminal className="h-4 w-4" />
                API Docs
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Key Management */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-xl shadow-primary/5 overflow-hidden transition-all duration-300 hover:shadow-primary/10">
              <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Authentication Key
                  </CardTitle>
                  {apiKey && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2">
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-base">
                  Manage your personal access token for programmatic access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full border-4 border-primary/20 animate-pulse" />
                      <div className="absolute top-0 h-12 w-12 rounded-full border-t-4 border-primary animate-spin" />
                    </div>
                    <p className="text-sm text-muted-foreground animate-pulse">Loading secure credentials...</p>
                  </div>
                ) : apiKey ? (
                  <>
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                        Token Value
                      </label>
                      <div className="group relative flex items-center gap-2">
                        <div className="relative flex-1 group/input transition-all">
                          <Input
                            readOnly
                            type={showKey && fullKey ? 'text' : 'password'}
                            value={showKey && fullKey ? fullKey : apiKey.key}
                            className={cn(
                              "font-mono text-sm h-12 pr-12 transition-all border-border/60 bg-muted/30 focus-visible:ring-primary/30",
                              fullKey && "border-primary/50 ring-2 ring-primary/10"
                            )}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button 
                              onClick={() => setShowKey(!showKey)}
                              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors"
                              title={showKey ? "Hide Key" : "Show Key"}
                            >
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <Button 
                          variant="default" 
                          size="icon" 
                          className="h-12 w-12 shrink-0 shadow-lg shadow-primary/20"
                          onClick={() => copyKey(fullKey || apiKey.key)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4 px-4 bg-muted/30 rounded-xl border border-border/40">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-background flex items-center justify-center border border-border/50 shadow-sm">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none">Status Metrics</p>
                          <div className="flex gap-4 text-xs text-foreground font-medium">
                            <span className="flex items-center gap-1.5">Created {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                            {apiKey.lastUsedAt && (
                              <span className="flex items-center gap-1.5 text-primary">
                                <span className="h-1 w-1 rounded-full bg-primary" />
                                Last used {new Date(apiKey.lastUsedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {fullKey && (
                      <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 transition-all animate-in fade-in slide-in-from-top-2">
                        <div className="mt-0.5"><ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-500" /></div>
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">Security Warning</p>
                          <p className="text-xs text-amber-800 dark:text-amber-500 leading-relaxed">
                            This key will only be displayed once. Please store it in a secure password manager. 
                            If you lose it, you must regenerate it.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <Button 
                        variant="outline" 
                        onClick={generateKey} 
                        disabled={generating} 
                        className="flex-1 h-11 border-border/60 hover:bg-primary/5 hover:text-primary transition-all group"
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2 transition-transform duration-500", generating && "animate-spin", "group-hover:rotate-180")} />
                        {generating ? 'Regenerating...' : 'Regenerate Token'}
                      </Button>
                      <Button 
                        variant="ghost" 
                        onClick={revokeKey}
                        className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Revoke Access
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 space-y-6">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/5 flex items-center justify-center border border-dashed border-primary/30">
                      <Lock className="h-10 w-10 text-primary/40" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-bold text-xl">No API Key Found</h3>
                      <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                        Generate your first API key to start building with the Gabon COD Platform.
                      </p>
                    </div>
                    <Button 
                      onClick={generateKey} 
                      disabled={generating}
                      size="lg"
                      className="px-8 shadow-lg shadow-primary/20 h-12"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {generating ? 'Generating Security Token...' : 'Generate New API Key'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-border/40 hover:border-primary/30 transition-colors cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 group-hover:scale-110 transition-transform">
                      <Terminal className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Quick Start Guide</p>
                      <p className="text-xs text-muted-foreground">Learn how to use your new key</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border-border/40 hover:border-emerald-500/30 transition-colors cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
                      <Bolt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Webhooks</p>
                      <p className="text-xs text-muted-foreground">Real-time event notifications</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Usage & Examples Column */}
          <div className="space-y-6">
            <Card className="border-border/50 shadow-lg sticky top-8">
              <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  Integration Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Authorization Header</p>
                    <button onClick={() => copyKey('X-Api-Key')} className="text-[10px] text-primary hover:underline">Copy Key</button>
                  </div>
                  <div className="relative group">
                    <div className="bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-[11px] leading-relaxed border border-slate-800 shadow-inner">
                      <span className="text-slate-500"># Pass as header</span><br/>
                      <span className="text-indigo-400">X-Api-Key</span>: <span className="text-emerald-400">your_api_key_here</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Base Endpoint</p>
                    <button 
                      onClick={() => copyKey(typeof window !== 'undefined' ? `${window.location.origin}/api/v1` : '')} 
                      className="text-[10px] text-primary hover:underline"
                    >
                      Copy URL
                    </button>
                  </div>
                  <div className="bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-[11px] leading-relaxed border border-slate-800 shadow-inner break-all">
                    {typeof window !== 'undefined' ? window.location.origin : 'https://api.gaboncoc.com'}/api/v1
                  </div>
                </div>

                <div className="pt-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs text-primary group justify-between hover:bg-primary/5 h-10 px-4 rounded-lg border border-primary/20" asChild>
                    <a href="/docs">
                      <span>View full documentation</span>
                      <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </a>
                  </Button>
                </div>
                
                <div className="rounded-xl border border-dashed border-border p-4 bg-muted/10">
                  <p className="text-[11px] text-muted-foreground leading-relaxed text-center italic">
                    "Our API follows REST conventions and returns JSON-encoded responses with standard HTTP status codes."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
