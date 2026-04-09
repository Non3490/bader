'use client'

import { useEffect, useState } from 'react'
import { TopBar, KpiStrip, PageShell } from '@/components/layout'
import { Search, Plus, Truck, CheckCircle, AlertCircle, Loader2, Edit, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface Driver {
  id: string
  name: string
  phone: string
  vehicleType: string | null
  licensePlate: string | null
  zone: string | null
  status: string
  isActive: boolean
  activeDeliveries: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'bg-green-100 text-green-600',
  OFFLINE: 'bg-gray-100 text-gray-500',
  ON_DELIVERY: 'bg-blue-100 text-blue-600',
  BREAK: 'bg-yellow-100 text-yellow-600',
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    name: '', phone: '', pin: '', vehicleType: '', licensePlate: '', zone: '',
  })

  const loadDrivers = async () => {
    try {
      const res = await fetch('/api/admin/drivers?includeInactive=false')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDrivers(data.drivers ?? [])
    } catch {
      toast.error('Impossible de charger les livreurs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDrivers() }, [])

  const openCreate = () => {
    setEditingDriver(null)
    setFormData({ name: '', phone: '', pin: '', vehicleType: '', licensePlate: '', zone: '' })
    setDialogOpen(true)
  }

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver)
    setFormData({ name: driver.name, phone: driver.phone, pin: '', vehicleType: driver.vehicleType || '', licensePlate: driver.licensePlate || '', zone: driver.zone || '' })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Nom et téléphone sont requis')
      return
    }
    if (!editingDriver && !formData.pin.trim()) {
      toast.error('Le PIN est requis pour un nouveau livreur')
      return
    }
    setSaving(true)
    try {
      const isUpdate = !!editingDriver
      const url = isUpdate ? `/api/admin/drivers/${editingDriver.id}` : '/api/admin/drivers'
      const res = await fetch(url, {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          ...(formData.pin && { pin: formData.pin }),
          vehicleType: formData.vehicleType || null,
          licensePlate: formData.licensePlate || null,
          zone: formData.zone || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur')
      }
      toast.success(isUpdate ? 'Livreur mis à jour' : 'Livreur créé')
      setDialogOpen(false)
      await loadDrivers()
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (driver: Driver) => {
    if (driver.activeDeliveries > 0) {
      toast.error(`Impossible de désactiver un livreur avec ${driver.activeDeliveries} livraisons actives`)
      return
    }
    if (!confirm(`Désactiver le livreur "${driver.name}" ?`)) return
    setDeleting((d) => ({ ...d, [driver.id]: true }))
    try {
      const res = await fetch(`/api/admin/drivers/${driver.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Livreur désactivé')
      await loadDrivers()
    } catch {
      toast.error('Erreur lors de la désactivation')
    } finally {
      setDeleting((d) => ({ ...d, [driver.id]: false }))
    }
  }

  const filtered = drivers.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.phone.includes(searchQuery) ||
    (d.zone || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = drivers.filter((d) => d.status !== 'OFFLINE').length
  const kpiItems = [
    { label: 'Total Livreurs', value: String(drivers.length), subtitle: 'ACTIFS', color: 'info' as const },
    { label: 'En Ligne', value: String(activeCount), subtitle: 'DISPONIBLES', color: 'success' as const },
    { label: 'Hors Ligne', value: String(drivers.filter((d) => d.status === 'OFFLINE').length), subtitle: 'OFFLINE', color: 'dark' as const },
    { label: 'En Livraison', value: String(drivers.filter((d) => d.activeDeliveries > 0).length), subtitle: 'ACTIFS', color: 'orange' as const },
  ]

  if (loading) {
    return (
      <PageShell role="admin" activePage="drivers">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell role="admin" activePage="drivers">
      <div className="min-h-screen bg-background">
        <TopBar
          title="Livreurs"
          actions={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg font-bold text-[13px] shadow-[0_4px_12px_rgba(240,112,32,0.2)] hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau Livreur
            </button>
          }
        />

        <div className="p-8 pt-[70px] pb-12 space-y-8">
          <KpiStrip items={kpiItems} />

          <div className="bg-[#f8f8f8] p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, téléphone, zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Truck className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">Aucun livreur trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((driver) => (
                <div key={driver.id} className="bg-white rounded-xl border border-[#e5e5e5] p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-base">
                        {driver.name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900">{driver.name}</h4>
                        <p className="text-xs text-gray-400">{driver.phone}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${STATUS_COLORS[driver.status] || 'bg-gray-100 text-gray-500'}`}>
                      {driver.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4 p-3 bg-[#f8f8f8] rounded-lg text-xs">
                    {driver.vehicleType && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Véhicule</span>
                        <span className="font-semibold text-gray-700">{driver.vehicleType}</span>
                      </div>
                    )}
                    {driver.licensePlate && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Plaque</span>
                        <span className="font-semibold text-gray-700">{driver.licensePlate}</span>
                      </div>
                    )}
                    {driver.zone && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Zone</span>
                        <span className="font-semibold text-gray-700">{driver.zone}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Livraisons actives</span>
                      <span className={`font-bold ${driver.activeDeliveries > 0 ? 'text-blue-600' : 'text-gray-700'}`}>
                        {driver.activeDeliveries}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(driver)}
                      className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(driver)}
                      disabled={deleting[driver.id] || driver.activeDeliveries > 0}
                      title={driver.activeDeliveries > 0 ? 'Livraisons actives — désactivation impossible' : 'Désactiver'}
                      className="px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {deleting[driver.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Modifier le Livreur' : 'Nouveau Livreur'}</DialogTitle>
            <DialogDescription>
              {editingDriver ? 'Mettez à jour les informations du livreur.' : 'Remplissez les informations pour créer un nouveau livreur.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nom complet *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Jean Mvogo" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+241 XX XX XX XX" />
            </div>
            <div className="space-y-1.5">
              <Label>PIN {editingDriver ? '(laisser vide pour ne pas changer)' : '*'}</Label>
              <Input value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value })} placeholder="4-6 chiffres" type="password" maxLength={6} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type de véhicule</Label>
                <Input value={formData.vehicleType} onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })} placeholder="Moto, Voiture..." />
              </div>
              <div className="space-y-1.5">
                <Label>Plaque</Label>
                <Input value={formData.licensePlate} onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })} placeholder="AB-123-CD" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} placeholder="Libreville Nord..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sauvegarde...</> : editingDriver ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
