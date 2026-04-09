'use client'

import { useEffect, useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Pen, X, Check } from 'lucide-react'

interface SignatureCaptureProps {
  orderId: string
  existingSignature?: string | null
  onSave?: (signatureUrl: string) => void
  readOnly?: boolean
}

export function SignatureCapture({
  orderId,
  existingSignature,
  onSave,
  readOnly = false
}: SignatureCaptureProps) {
  const sigCanvas = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [signature, setSignature] = useState<string | null>(existingSignature || null)

  const handleClear = () => {
    sigCanvas.current?.clear()
    setIsEmpty(true)
    setSignature(null)
  }

  const handleSave = async () => {
    if (isEmpty || !sigCanvas.current) return

    setIsSaving(true)
    try {
      const dataUrl = sigCanvas.current.toDataURL('image/png')

      const res = await fetch(`/api/delivery/${orderId}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: dataUrl })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save signature')
      }

      const json = await res.json()
      setSignature(json.url)
      setIsEmpty(false)
      onSave?.(json.url)
      toast.success('Signature saved successfully')
    } catch (error) {
      console.error('Signature save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save signature')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    setSignature(existingSignature || null)
  }, [existingSignature])

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Customer Signature</p>

      {signature ? (
        <div className="border rounded-lg overflow-hidden bg-muted/30">
          <img
            src={signature}
            alt="Customer signature"
            className="w-full h-auto max-h-48 object-contain bg-white"
          />
        </div>
      ) : (
        <>
          <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: 400,
                height: 200,
                className: 'w-full touch-none cursor-crosshair'
              }}
              onEnd={() => setIsEmpty(false)}
            />
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              disabled={isEmpty || isSaving}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isEmpty || isSaving || readOnly}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Save Signature
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Please sign above to confirm delivery
          </p>
        </>
      )}
    </div>
  )
}
