'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Users, 
  Plus, 
  X, 
  UserX, 
  UserCheck, 
  Trash2, 
  RefreshCcw, 
  Mail, 
  Shield, 
  Calendar,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

const emptyForm = { name: '', email: '', password: '', role: 'CALL_CENTER' }

export default function SellerTeamPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!userLoading && !user) router.push('/login')
    if (!userLoading && user && !['SELLER', 'ADMIN'].includes(user.role)) router.push('/unauthorized')
  }, [user, userLoading, router])

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/team')
      if (res.ok) setMembers((await res.json()).members)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchData()
  }, [user])

  const handleAdd = async () => {
    if (!form.name || !form.email || !form.password) { toast.error('All fields required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Team member added successfully')
      setForm(emptyForm)
      setShowForm(false)
      fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })
      if (!res.ok) throw new Error('Failed')
      toast.success(isActive ? 'Member deactivated' : 'Member activated')
      fetchData()
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member? This action cannot be undone.')) return
    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      toast.success('Member removed')
      fetchData()
    } catch {
      toast.error('Failed to remove member')
    }
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
  }

  if (userLoading || !user) return null

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8 p-4 md:p-6">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-primary/90 p-8 text-white shadow-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3">
                <Users className="h-10 w-10 bg-white/20 p-2 rounded-xl" />
                Team Management
              </h1>
              <p className="text-primary-foreground/80 font-medium">
                Manage your call center and delivery staff from one place
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="secondary" 
                size="icon" 
                onClick={fetchData}
                className="rounded-full bg-white/10 hover:bg-white/20 border-white/20 text-white backdrop-blur-sm transition-all active:scale-95"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                onClick={() => setShowForm(!showForm)}
                className="bg-white text-primary hover:bg-white/90 font-bold px-6 rounded-full shadow-lg transition-all active:scale-95"
              >
                {showForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                {showForm ? 'Cancel' : 'Add New Member'}
              </Button>
            </div>
          </div>
          {/* Decorative background circles */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-md bg-white dark:bg-zinc-900 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent group-hover:from-blue-500/10 transition-colors" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Staff</p>
                  <h3 className="text-2xl font-bold mt-1">{members.length}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md bg-white dark:bg-zinc-900 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent group-hover:from-green-500/10 transition-colors" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Now</p>
                  <h3 className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {members.filter(m => m.isActive).length}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                  <UserCheck className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md bg-white dark:bg-zinc-900 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent group-hover:from-orange-500/10 transition-colors" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">On Leave/Inactive</p>
                  <h3 className="text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">
                    {members.filter(m => !m.isActive).length}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <UserX className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Member Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-none shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
                <CardHeader className="bg-zinc-50 dark:bg-zinc-900/50 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Create Staff Account</CardTitle>
                      <CardDescription>Enter details to invite a new member to your team.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Full Name</Label>
                      <div className="relative group">
                        <Users className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input 
                          value={form.name} 
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                          placeholder="John Doe" 
                          className="pl-10 h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-all focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Email Address</Label>
                      <div className="relative group">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input 
                          type="email" 
                          value={form.email} 
                          onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                          placeholder="john@example.com" 
                          className="pl-10 h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-all focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Access Password</Label>
                      <Input 
                        type="password" 
                        value={form.password} 
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))} 
                        placeholder="••••••••" 
                        className="h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-all focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold">Assigned Role</Label>
                      <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                        <SelectTrigger className="h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-all focus:ring-2 focus:ring-primary/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CALL_CENTER">Call Center Representative</SelectItem>
                          <SelectItem value="DELIVERY">Delivery Personnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="ghost" onClick={() => setShowForm(false)} className="rounded-lg h-11 px-8">
                      Discard
                    </Button>
                    <Button 
                      onClick={handleAdd} 
                      disabled={submitting} 
                      className="rounded-lg h-11 px-10 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 min-w-[140px]"
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </div>
                      ) : 'Create Member'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team Members List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              All Members
              <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider">
                {members.length}
              </Badge>
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <Card className="border-dashed border-2 bg-transparent">
              <CardContent className="py-20 text-center flex flex-col items-center gap-4">
                <div className="h-20 w-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-2">
                  <Users className="h-10 w-10 text-muted-foreground opacity-30" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold">Your team is empty</p>
                  <p className="text-muted-foreground max-w-sm">
                    Start by adding call center staff or delivery agents to help manage your business operations.
                  </p>
                </div>
                <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4 rounded-full px-8">
                  <Plus className="h-4 w-4 mr-2" /> Add first member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.map(member => (
                <motion.div
                  key={member.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-none shadow-md ${!member.isActive ? 'opacity-75 grayscale-[0.5]' : ''}`}>
                    <div className={`absolute top-0 left-0 w-1 h-full ${member.isActive ? 'bg-primary' : 'bg-zinc-400'}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12 rounded-xl shadow-inner ring-2 ring-background ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-800">
                            <AvatarFallback className={`${member.isActive ? 'bg-primary/10 text-primary' : 'bg-zinc-100 text-zinc-500'} font-bold text-lg`}>
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-base truncate max-w-[150px]">{member.name}</h3>
                              {member.isActive ? (
                                <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-none text-[10px] font-bold h-5 uppercase tracking-tight">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-none text-[10px] font-bold h-5 uppercase tracking-tight">
                                  <AlertCircle className="h-3 w-3 mr-1" /> Inactive
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 mr-1.5 shrink-0" />
                              <span className="truncate">{member.email}</span>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                              <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                <Shield className="h-3 w-3 mr-1 text-primary" /> {member.role.replace('_', ' ')}
                              </div>
                              <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                <Calendar className="h-3 w-3 mr-1" /> Joined {new Date(member.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1">
                              <DropdownMenuItem 
                                onClick={() => toggleActive(member.id, member.isActive)}
                                className="flex items-center gap-2 cursor-pointer focus:bg-primary/5 focus:text-primary"
                              >
                                {member.isActive ? (
                                  <>
                                    <UserX className="h-4 w-4 text-orange-500" />
                                    <span>Deactivate Account</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 text-emerald-500" />
                                    <span>Activate Account</span>
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDelete(member.id)}
                                className="flex items-center gap-2 text-destructive cursor-pointer focus:bg-destructive/5 focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Remove Member</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
