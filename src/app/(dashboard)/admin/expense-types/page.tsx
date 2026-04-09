'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'

interface ExpenseType {
  id: string
  name: string
  category: string
  description: string | null
  isActive: boolean
  createdAt: string
}

const CATEGORIES = [
  { value: 'CALL_CENTER', label: 'Call Center' },
  { value: 'SOURCING', label: 'Sourcing' },
  { value: 'AD_SPEND', label: 'Ad Spend' },
  { value: 'OTHER', label: 'Other' }
]

export default function ExpenseTypesPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([])

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ExpenseType | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    category: 'CALL_CENTER',
    description: ''
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (userLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') { router.push('/unauthorized'); return }
    loadExpenseTypes()
  }, [user, userLoading, router])

  const loadExpenseTypes = async () => {
    try {
      const res = await fetch('/api/expense-types')
      const data = await res.json()
      setExpenseTypes(data.expenseTypes ?? [])
    } catch (error) {
      toast.error('Failed to load expense types')
    }
  }

  const handleOpenDialog = (type: ExpenseType | null = null) => {
    if (type) {
      setEditingType(type)
      setFormData({
        name: type.name,
        category: type.category,
        description: type.description || ''
      })
    } else {
      setEditingType(null)
      setFormData({
        name: '',
        category: 'CALL_CENTER',
        description: ''
      })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/expense-types', {
        method: editingType ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingType?.id,
          name: formData.name.trim(),
          category: formData.category,
          description: formData.description.trim()
        })
      })

      if (!res.ok) throw new Error('Failed to save expense type')

      toast.success(editingType ? 'Expense type updated' : 'Expense type created')
      setDialogOpen(false)
      await loadExpenseTypes()
    } catch (error) {
      toast.error('Failed to save expense type')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/expense-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      })

      if (!res.ok) throw new Error('Failed to update status')

      toast.success(isActive ? 'Expense type activated' : 'Expense type deactivated')
      await loadExpenseTypes()
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense type?')) return

    setDeleting({ ...deleting, [id]: true })
    try {
      const res = await fetch(`/api/expense-types/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')

      toast.success('Expense type deleted')
      await loadExpenseTypes()
    } catch (error) {
      toast.error('Failed to delete')
    } finally {
      setDeleting(d => ({ ...d, [id]: false }))
    }
  }

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category)
    return cat ? <Badge className={cat.color}>{cat.label}</Badge> : <Badge variant="secondary">{category}</Badge>
  }

  if (userLoading || !user) return null

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Expense Types</h1>
            <p className="text-muted-foreground">Define allowed expense types for call center agents</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingType ? 'Edit Expense Type' : 'Create Expense Type'}</DialogTitle>
                <DialogDescription>
                  {editingType ? 'Update expense type details' : 'Create a new expense type'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Type Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Internet, Call Minutes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what this expense type covers..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editingType ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {expenseTypes.map(type => (
            <Card key={type.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <Package className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {getCategoryBadge(type.category)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDialog(type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(type.id, !type.isActive)}
                      disabled={deleting[type.id]}
                    >
                      {type.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleting[type.id]}
                      onClick={() => handleDelete(type.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting[type.id] ? '...' : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {type.description && (
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                )}
                <div className="mt-4 text-xs text-muted-foreground">
                  Created: {new Date(type.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {expenseTypes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No expense types configured yet. Click "Add Expense Type" to create your first type.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
