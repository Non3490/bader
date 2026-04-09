'use client'

import React, { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Key, 
  ShieldCheck, 
  Code2, 
  ChevronRight, 
  Terminal, 
  Globe, 
  Lock,
  ExternalLink,
  Search,
  BookOpen
} from "lucide-react"

const endpoints = [
  {
    group: "Authentication",
    id: "authentication-endpoints",
    icon: <ShieldCheck className="w-4 h-4" />,
    items: [
      { method: "POST", path: "/api/auth/login", desc: "Login and receive a session cookie", auth: false },
      { method: "POST", path: "/api/auth/logout", desc: "Logout and clear session", auth: true },
      { method: "GET", path: "/api/auth/me", desc: "Get current authenticated user", auth: true },
    ],
  },
  {
    group: "Orders",
    id: "orders",
    icon: <BookOpen className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/orders", desc: "List orders (scoped by role)", auth: true },
      { method: "POST", path: "/api/orders", desc: "Create a new order", auth: true },
      { method: "GET", path: "/api/orders/:id", desc: "Get order details", auth: true },
      { method: "PATCH", path: "/api/orders/:id", desc: "Update order status or fields", auth: true },
      { method: "DELETE", path: "/api/orders/:id", desc: "Delete order (Admin only)", auth: true },
      { method: "POST", path: "/api/orders/import", desc: "Bulk import orders from CSV", auth: true },
    ],
  },
  {
    group: "Products",
    id: "products",
    icon: <Code2 className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/products", desc: "List seller products", auth: true },
      { method: "POST", path: "/api/products", desc: "Create a product", auth: true },
    ],
  },
  {
    group: "Finance",
    id: "finance",
    icon: <Globe className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/finance/stats", desc: "Financial stats (revenue, costs, profit)", auth: true },
      { method: "GET", path: "/api/expenses", desc: "List expenses", auth: true },
      { method: "POST", path: "/api/expenses", desc: "Create an expense", auth: true },
      { method: "GET", path: "/api/invoices", desc: "List invoices", auth: true },
      { method: "POST", path: "/api/invoices", desc: "Generate invoice", auth: true },
      { method: "PATCH", path: "/api/invoices/:id", desc: "Update invoice status", auth: true },
    ],
  },
  {
    group: "Wallet",
    id: "wallet",
    icon: <Key className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/wallet", desc: "Get own wallet balance + history", auth: true },
      { method: "POST", path: "/api/wallet/withdraw", desc: "Request a withdrawal", auth: true },
      { method: "GET", path: "/api/wallet/all", desc: "All seller wallets (Admin only)", auth: true },
      { method: "GET", path: "/api/wallet/withdrawals", desc: "Pending withdrawals (Admin)", auth: true },
      { method: "PATCH", path: "/api/wallet/withdrawals", desc: "Process withdrawal (Admin)", auth: true },
    ],
  },
  {
    group: "Catalog",
    id: "catalog",
    icon: <Search className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/catalog", desc: "Browse product catalog", auth: true },
      { method: "POST", path: "/api/catalog", desc: "Create catalog product (Admin)", auth: true },
      { method: "PATCH", path: "/api/catalog/:id", desc: "Update catalog product (Admin)", auth: true },
      { method: "DELETE", path: "/api/catalog/:id", desc: "Delete catalog product (Admin)", auth: true },
      { method: "POST", path: "/api/catalog/favorites", desc: "Toggle catalog product favorite", auth: true },
    ],
  },
  {
    group: "Sourcing",
    id: "sourcing",
    icon: <Terminal className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/sourcing", desc: "List sourcing requests", auth: true },
      { method: "POST", path: "/api/sourcing", desc: "Submit sourcing request", auth: true },
      { method: "PATCH", path: "/api/sourcing/:id", desc: "Approve/reject request (Admin)", auth: true },
    ],
  },
  {
    group: "Team",
    id: "team",
    icon: <Lock className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/team", desc: "List your team sub-users", auth: true },
      { method: "POST", path: "/api/team", desc: "Add team member", auth: true },
      { method: "PATCH", path: "/api/team/:id", desc: "Toggle member active state", auth: true },
      { method: "DELETE", path: "/api/team/:id", desc: "Remove team member", auth: true },
    ],
  },
  {
    group: "API Keys",
    id: "api-keys",
    icon: <Key className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/api-key", desc: "Get own API key (masked)", auth: true },
      { method: "POST", path: "/api/api-key", desc: "Generate/regenerate API key", auth: true },
      { method: "DELETE", path: "/api/api-key", desc: "Revoke API key", auth: true },
    ],
  },
  {
    group: "Analytics",
    id: "analytics",
    icon: <Search className="w-4 h-4" />,
    items: [
      { method: "GET", path: "/api/analytics", desc: "Dashboard analytics (orders per day, city stats)", auth: true },
      { method: "GET", path: "/api/analytics/insights", desc: "Enhanced insights (30d summary, daily, city performance)", auth: true },
      { method: "GET", path: "/api/activity-logs", desc: "Platform activity logs (Admin only)", auth: true },
    ],
  },
  {
    group: "Webhooks",
    id: "webhooks",
    icon: <Globe className="w-4 h-4" />,
    items: [
      { method: "POST", path: "/api/webhooks/shopify", desc: "Receive Shopify order.create events", auth: false },
      { method: "POST", path: "/api/webhooks/youcan", desc: "Receive YouCan order.created events", auth: false },
      { method: "POST", path: "/api/webhooks/dropify", desc: "Receive Dropify order.created events", auth: false },
    ],
  },
]

const methodStyles: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  POST: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  PATCH: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  DELETE: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  PUT: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { threshold: 0.5 }
    )

    document.querySelectorAll("section[id]").forEach((section) => {
      observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="flex min-h-screen bg-background selection:bg-primary/10">
      {/* Sticky Sidebar */}
      <aside className="hidden lg:flex w-72 border-r flex-col fixed inset-y-0 left-0 bg-muted/30 backdrop-blur-xl z-20">
        <div className="p-6 border-b flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold tracking-tight">API Reference</h2>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">v3.0.0 Stable</p>
          </div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Introduction</p>
              <div className="space-y-1">
                <button 
                  onClick={() => scrollTo("overview")}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all ${activeSection === "overview" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Overview
                </button>
                <button 
                  onClick={() => scrollTo("authentication")}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all ${activeSection === "authentication" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Authentication
                </button>
                <button 
                  onClick={() => scrollTo("responses")}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all ${activeSection === "responses" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  Response Format
                </button>
              </div>
            </div>
            <div>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endpoints</p>
              <div className="space-y-1">
                {endpoints.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => scrollTo(group.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all ${activeSection === group.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {group.icon}
                    {group.group}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-muted/50">
          <a href="/login" className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
            Back to Dashboard
            <ExternalLink className="w-3 h-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 relative">
        {/* Gradient Hero */}
        <header id="overview" className="relative h-64 flex items-center overflow-hidden border-b bg-zinc-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="container max-w-5xl px-8 relative">
            <Badge variant="outline" className="mb-4 bg-white/5 border-white/10 text-white/80 backdrop-blur-sm">Documentation</Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              Gabon COD Platform <span className="text-white/40">—</span> API Docs
            </h1>
            <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
              Build and integrate with the most powerful Cash-on-Delivery logistics platform in Gabon.
            </p>
          </div>
        </header>

        <div className="container max-w-5xl px-8 py-16 space-y-24 pb-32">
          {/* Authentication Section */}
          <section id="authentication" className="space-y-8 scroll-mt-10">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-primary" />
                Authentication
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Most endpoints require a valid session. Log in via the authentication endpoint to receive a session cookie, 
                or pass your API key in the header for machine-to-machine requests.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <Card className="shadow-sm border-muted-foreground/10">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Session-Based</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">Use the login endpoint to establish a browser-based session.</p>
                  <code className="block w-full bg-zinc-950 text-zinc-300 p-4 rounded-lg text-xs font-mono border border-zinc-800">
                    POST /api/auth/login
                  </code>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-muted-foreground/10 overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">API Key (Server-to-Server)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">Include your API key in the request headers.</p>
                  <div className="bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
                    <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">HTTP Header</span>
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                        <div className="w-2 h-2 rounded-full bg-zinc-800" />
                      </div>
                    </div>
                    <div className="p-4 font-mono text-xs text-zinc-300">
                      <span className="text-zinc-500">X-Api-Key:</span> <span className="text-emerald-400">gck_your_api_key_here</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground italic">
                    API keys are generated in the <span className="font-semibold">Seller → API Access</span> section of the dashboard.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator className="opacity-50" />

          {/* Response Format Section */}
          <section id="responses" className="space-y-8 scroll-mt-10">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold">Response Format</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                All API responses are returned as JSON objects. We use standard HTTP status codes to indicate the success or failure of an API request.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Success Codes</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">200 OK</Badge>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">201 Created</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Error Codes</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-rose-500 border-rose-500/20">400 Bad Request</Badge>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/20">401 Unauthorized</Badge>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/20">403 Forbidden</Badge>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/20">404 Not Found</Badge>
                    <Badge variant="outline" className="text-rose-500 border-rose-500/20">500 Server Error</Badge>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/50 border-b border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Error Response
                  </span>
                </div>
                <div className="p-6 font-mono text-sm">
                  <pre className="text-zinc-300">
                    {`{\n  "error": "Error message here"\n}`}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Endpoints Loop */}
          {endpoints.map((group) => (
            <section key={group.id} id={group.id} className="space-y-8 scroll-mt-10">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {group.icon}
                    </span>
                    {group.group}
                  </h2>
                  <p className="text-muted-foreground">Endpoints related to {group.group.toLowerCase()} management.</p>
                </div>
              </div>

              <div className="grid gap-4">
                {group.items.map((ep, i) => (
                  <Card key={i} className="group overflow-hidden border-muted-foreground/10 hover:border-primary/20 transition-all hover:shadow-md">
                    <div className="flex flex-col md:flex-row md:items-center p-0">
                      <div className="flex items-center gap-4 px-6 py-4 md:flex-1">
                        <Badge className={`w-20 justify-center font-bold tracking-tighter ${methodStyles[ep.method]}`}>
                          {ep.method}
                        </Badge>
                        <div className="space-y-1">
                          <code className="text-sm font-mono text-foreground font-semibold flex items-center gap-2">
                            {ep.path}
                            {ep.auth && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Requires Authentication" />}
                          </code>
                          <p className="text-sm text-muted-foreground">{ep.desc}</p>
                        </div>
                      </div>
                      <div className="px-6 py-3 md:py-4 bg-muted/30 md:bg-transparent border-t md:border-t-0 md:border-l flex items-center gap-3">
                        {!ep.auth && (
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                            Public
                          </Badge>
                        )}
                        <button className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Details <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}

          {/* Footer */}
          <footer className="pt-24 border-t space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-zinc-900 flex items-center justify-center text-white">G</div>
                <span className="font-semibold text-sm">Gabon COD Platform v3.0.0</span>
              </div>
              <nav className="flex items-center gap-8 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">Github</a>
                <a href="#" className="hover:text-foreground transition-colors">Changelog</a>
                <a href="#" className="hover:text-foreground transition-colors">Status</a>
                <a href="#" className="hover:text-foreground transition-colors">Support</a>
              </nav>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              © 2026 Gabon Logistics Solutions. All rights reserved. Built for speed, reliability, and local scale.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
