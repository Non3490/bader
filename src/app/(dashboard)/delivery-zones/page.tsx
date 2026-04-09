'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { TopBar, KpiStrip, PageShell } from '@/components/layout'
import { Search, MapPin, Plus, Edit, Trash2, Users, Package, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

const PolygonMap = dynamic(
  () => import('@/components/maps/PolygonMap').then((mod) => mod.PolygonMap),
  { ssr: false }
)

interface LatLng {
  lat: number
  lng: number
}

interface DeliveryZone {
  id: string
  name: string
  driver: { id: string; name: string; phone: string | null } | null
  driverId: string | null
  polygon: LatLng[]
  orderCount: number
  createdAt: string
  updatedAt: string
}

interface DeliveryMan {
  id: string
  name: string
  phone: string | null
}

const ZONE_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
  'bg-orange-100 text-orange-600',
  'bg-yellow-100 text-yellow-600',
  'bg-pink-100 text-pink-600',
]

export default function DeliveryZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [deliveryMen, setDeliveryMen] = useState<DeliveryMan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('Toutes')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    driverId: null as string | null,
    polygon: [] as LatLng[],
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [zonesRes, driversRes] = await Promise.all([
        fetch('/api/admin/delivery-zones').then((r) => r.json()),
        fetch('/api/users?role=DELIVERY').then((r) => r.json()),
      ])
      setZones(zonesRes.zones ?? [])
      setDeliveryMen(driversRes.users ?? [])
    } catch {
      toast.error('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (zone: DeliveryZone | null = null) => {
    if (zone) {
      setEditingZone(zone)
      setFormData({ name: zone.name, driverId: zone.driverId, polygon: zone.polygon })
    } else {
      setEditingZone(null)
      setFormData({ name: '', driverId: null, polygon: [] })
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Le nom de la zone est requis')
      return
    }
    if (formData.polygon.length < 3) {
      toast.error('Veuillez dessiner un polygone avec au moins 3 points')
      return
    }

    setSaving(true)
    try {
      const isUpdate = !!editingZone?.id
      const res = await fetch('/api/admin/delivery-zones', {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isUpdate
            ? { id: editingZone.id, name: formData.name, driverId: formData.driverId, polygon: formData.polygon }
            : { name: formData.name, driverId: formData.driverId, polygon: formData.polygon }
        ),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la sauvegarde')
      }

      toast.success(editingZone ? 'Zone mise à jour' : 'Zone créée')
      setDialogOpen(false)
      await loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (zone: DeliveryZone) => {
    if (zone.orderCount > 0) {
      toast.error(`Impossible de supprimer une zone avec ${zone.orderCount} commandes assignées`)
      return
    }
    if (!confirm(`Supprimer la zone "${zone.name}" ?`)) return

    setDeleting((d) => ({ ...d, [zone.id]: true }))
    try {
      const res = await fetch(`/api/admin/delivery-zones/${zone.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur lors de la suppression')
      }
      toast.success('Zone supprimée')
      await loadData()
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression')
    } finally {
      setDeleting((d) => ({ ...d, [zone.id]: false }))
    }
  }

  const filteredZones = zones.filter((zone) => {
    const matchSearch =
      zone.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchSearch
  })

  const kpiItems = [
    { label: 'Zones Actives', value: String(zones.length), subtitle: `SUR ${zones.length}`, color: 'success' as const },
    { label: 'Livreurs Assignés', value: String(zones.filter((z) => z.driver).length), subtitle: 'DANS LES ZONES', color: 'info' as const },
    { label: 'Commandes Totales', value: String(zones.reduce((s, z) => s + z.orderCount, 0)), subtitle: 'COLIS', color: 'orange' as const },
    { label: 'Sans Livreur', value: String(zones.filter((z) => !z.driver).length), subtitle: 'ZONES', color: 'dark' as const },
  ]

  if (loading) {
    return (
      <PageShell role="admin" activePage="delivery-zones">
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell role="admin" activePage="delivery-zones">
      <div className="min-h-screen bg-background">
        <TopBar
          title="Zones de Livraison"
          actions={
            <button
              onClick={() => handleOpenDialog()}
              className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg font-bold text-[13px] shadow-[0_4px_12px_rgba(240,112,32,0.2)] hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Zone
            </button>
          }
        />

        <div className="p-8 pt-[70px] pb-12 space-y-8">
          {/* KPI Strip */}
          <KpiStrip items={kpiItems} />

          {/* Filter Bar */}
          <div className="bg-[#f8f8f8] p-4 rounded-xl flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par zone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Zones Grid */}
          {filteredZones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <MapPin className="w-12 h-12 mb-4 opacity-40" />
              <p className="text-sm font-medium">Aucune zone trouvée</p>
              <p className="text-xs mt-1">Créez votre première zone en cliquant sur "Nouvelle Zone"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredZones.map((zone, index) => {
                const color = ZONE_COLORS[index % ZONE_COLORS.length]
                return (
                  <div
                    key={zone.id}
                    className="bg-white rounded-xl shadow-sm border border-[#e5e5e5] p-6 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                          <MapPin className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-sora text-base font-bold text-gray-900">{zone.name}</h4>
                          <p className="text-xs text-gray-400">{zone.polygon.length} points GPS</p>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-green-100 text-green-600">
                        Actif
                      </span>
                    </div>

                    {/* Driver */}
                    <div className="mb-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Livreur Assigné</p>
                      {zone.driver ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-lg">
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-[10px] font-bold">
                            {zone.driver.name[0]}
                          </div>
                          <span className="text-xs font-semibold text-gray-800">{zone.driver.name}</span>
                          {zone.driver.phone && (
                            <span className="text-[10px] text-gray-400">{zone.driver.phone}</span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Aucun livreur assigné</p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-orange-500" />
                        <div>
                          <p className="text-[10px] text-gray-400">Livreurs</p>
                          <p className="text-sm font-bold text-gray-900">{zone.driver ? 1 : 0}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-500" />
                        <div>
                          <p className="text-[10px] text-gray-400">Commandes</p>
                          <p className="text-sm font-bold text-gray-900">{zone.orderCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="p-3 bg-[#f8f8f8] rounded-lg mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Dernière mise à jour</span>
                        <span className="font-semibold text-gray-700">
                          {new Date(zone.updatedAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenDialog(zone)}
                        className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleOpenDialog(zone)}
                        className="px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-xs hover:bg-[#f8f8f8] transition-colors"
                        title="Éditer"
                      >
                        <Edit className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(zone)}
                        disabled={deleting[zone.id] || zone.orderCount > 0}
                        className="px-3 py-2 bg-white border border-[#e5e5e5] rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={zone.orderCount > 0 ? `${zone.orderCount} commandes — suppression impossible` : 'Supprimer'}
                      >
                        {deleting[zone.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Modifier la Zone' : 'Nouvelle Zone de Livraison'}</DialogTitle>
            <DialogDescription>
              {editingZone
                ? 'Mettez à jour les limites GPS et le livreur assigné.'
                : 'Dessinez un polygone sur la carte pour définir la zone de livraison.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Nom de la zone</Label>
              <Input
                id="zone-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ex: Libreville Nord"
              />
            </div>

            <div className="space-y-2">
              <Label>Livreur assigné</Label>
              <Select
                value={formData.driverId || 'none'}
                onValueChange={(v) => setFormData({ ...formData, driverId: v === 'none' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un livreur (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun livreur</SelectItem>
                  {deliveryMen.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.name}
                      {driver.phone && ` (${driver.phone})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Polygone GPS{' '}
                <span className="text-gray-400 font-normal">({formData.polygon.length} points)</span>
              </Label>
              <PolygonMap
                initialPolygon={formData.polygon}
                onChange={(polygon) => setFormData({ ...formData, polygon })}
                height="400px"
                existingZones={zones
                  .filter((z) => z.id !== editingZone?.id)
                  .map((z) => ({
                    id: z.id,
                    name: z.name,
                    polygon: z.polygon,
                    driverName: z.driver?.name,
                  }))}
              />
              <p className="text-xs text-gray-400">
                Cliquez sur "Dessiner un polygone" puis ajoutez des points. Cliquez sur "Terminer" quand vous avez fini.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || formData.polygon.length < 3}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : editingZone ? (
                'Mettre à jour'
              ) : (
                'Créer la zone'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
