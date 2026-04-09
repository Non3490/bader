'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUser } from '@/hooks/use-user'
import { Image, Upload, X, Plus, Package, DollarSign, Truck, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Warehouse {
  id: string
  name: string
  city: string
}

interface QuantityPricingTier {
  min: number
  max: number
  price: number
}

export default function NewProductPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>('')

  const [form, setForm] = useState({
    sku: '',
    name: '',
    shortDescription: '',
    longDescription: '',
    supplierName: '',
    supplierPhone: '',
    cargoName: '',
    cargoPhone: '',
    category: '',
    costPrice: '',
    sellPrice: '',
    initialStock: '0',
    alertLevel: '5',
    warehouseId: '',
  })

  const [pricingTiers, setPricingTiers] = useState<QuantityPricingTier[]>([
    { min: 1, max: 9999, price: 0 }
  ])

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login')
    }
  }, [user, userLoading, router])

  useEffect(() => {
    if (!user) return

    async function fetchWarehouses() {
      try {
        const res = await fetch('/api/warehouses')
        if (res.ok) {
          const data = await res.json()
          setWarehouses(data.warehouses || [])
        }
      } catch (error) {
        console.error('Failed to fetch warehouses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [user])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await res.json()
      setImageUrl(data.url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('Image upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP images are allowed')
      return
    }

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Failed to upload image')
      }

      const data = await res.json()
      setImageUrl(data.url)
      toast.success('Image uploaded successfully')
    } catch (error) {
      console.error('Image upload error:', error)
      toast.error('Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleRemoveImage = () => {
    setImageUrl('')
  }

  const addPricingTier = () => {
    const lastTier = pricingTiers[pricingTiers.length - 1]
    setPricingTiers([
      ...pricingTiers,
      { min: lastTier.max + 1, max: 9999, price: 0 }
    ])
  }

  const updatePricingTier = (index: number, field: keyof QuantityPricingTier, value: number) => {
    const newTiers = [...pricingTiers]
    newTiers[index][field] = value
    setPricingTiers(newTiers)
  }

  const removePricingTier = (index: number) => {
    if (pricingTiers.length === 1) return
    setPricingTiers(pricingTiers.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          costPrice: parseFloat(form.costPrice) || 0,
          sellPrice: parseFloat(form.sellPrice),
          initialStock: parseInt(form.initialStock),
          alertLevel: parseInt(form.alertLevel),
          warehouseId: form.warehouseId || undefined,
          quantityPricing: pricingTiers.length > 1 ? pricingTiers : undefined,
          imageUrl: imageUrl || undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create product')
      }

      toast.success('Product created successfully')
      router.push('/products')
    } catch (error) {
      console.error('Create product error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create product')
    } finally {
      setSubmitting(false)
    }
  }

  if (userLoading || loading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Product</h1>
          <p className="text-muted-foreground">
            Create a new product with inventory details
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Product Image
              </CardTitle>
              <CardDescription>
                Upload a product image (JPEG, PNG, WebP, max 5MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!imageUrl ? (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
                    uploadingImage ? "opacity-50" : "hover:border-primary cursor-pointer"
                  )}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    {uploadingImage ? 'Uploading...' : 'Drag and drop or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Maximum file size: 5MB
                  </p>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imageUrl}
                    alt="Product preview"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">
                    SKU <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sku"
                    placeholder="e.g., PRD-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., Electronics, Clothing"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., Wireless Bluetooth Headphones"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortDescription">
                  Short Description <span className="text-muted-foreground text-xs">(max 150 chars)</span>
                </Label>
                <Input
                  id="shortDescription"
                  placeholder="Brief product description for listings"
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value.slice(0, 150) })}
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {form.shortDescription.length}/150
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="longDescription">Long Description</Label>
                <Textarea
                  id="longDescription"
                  placeholder="Detailed product description with features, specifications, etc."
                  value={form.longDescription}
                  onChange={(e) => setForm({ ...form, longDescription: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costPrice">Cost Price (XAF)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellPrice">
                    Selling Price (XAF) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sellPrice"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={form.sellPrice}
                    onChange={(e) => setForm({ ...form, sellPrice: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Quantity-Based Pricing (Optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPricingTier}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Tier
                  </Button>
                </div>
                {pricingTiers.map((tier, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Min Qty</Label>
                      <Input
                        type="number"
                        value={tier.min}
                        onChange={(e) => updatePricingTier(index, 'min', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Qty</Label>
                      <Input
                        type="number"
                        value={tier.max}
                        onChange={(e) => updatePricingTier(index, 'max', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price (XAF)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={tier.price}
                        onChange={(e) => updatePricingTier(index, 'price', parseFloat(e.target.value))}
                      />
                    </div>
                    {pricingTiers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePricingTier(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Supplier & Cargo Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Supplier & Cargo Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supplierName">Supplier Name</Label>
                  <Input
                    id="supplierName"
                    placeholder="e.g., ABC Electronics"
                    value={form.supplierName}
                    onChange={(e) => setForm({ ...form, supplierName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierPhone">
                    <Phone className="h-3 w-3 inline mr-1" />
                    Supplier Phone
                  </Label>
                  <Input
                    id="supplierPhone"
                    placeholder="+241..."
                    value={form.supplierPhone}
                    onChange={(e) => setForm({ ...form, supplierPhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cargoName">Cargo Company</Label>
                  <Input
                    id="cargoName"
                    placeholder="e.g., DHL Express"
                    value={form.cargoName}
                    onChange={(e) => setForm({ ...form, cargoName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargoPhone">
                    <Phone className="h-3 w-3 inline mr-1" />
                    Cargo Phone
                  </Label>
                  <Input
                    id="cargoPhone"
                    placeholder="+241..."
                    value={form.cargoPhone}
                    onChange={(e) => setForm({ ...form, cargoPhone: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Initial Inventory
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initialStock">Initial Stock Quantity</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    min="0"
                    value={form.initialStock}
                    onChange={(e) => setForm({ ...form, initialStock: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alertLevel">Low Stock Alert Threshold</Label>
                  <Input
                    id="alertLevel"
                    type="number"
                    min="0"
                    placeholder="5"
                    value={form.alertLevel}
                    onChange={(e) => setForm({ ...form, alertLevel: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse (Optional)</Label>
                <Select
                  value={form.warehouseId}
                  onValueChange={(value) => setForm({ ...form, warehouseId: value })}
                >
                  <SelectTrigger id="warehouse">
                    <SelectValue placeholder="Select warehouse (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No warehouse</SelectItem>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} ({wh.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Product'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
