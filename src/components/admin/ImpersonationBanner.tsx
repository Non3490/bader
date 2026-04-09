'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface ImpersonatingUser {
  id: string
  name: string
  role: string
}

interface ImpersonationBannerProps {
  onEndImpersonation?: () => void
}

export function ImpersonationBanner({ onEndImpersonation }: ImpersonationBannerProps) {
  const [impersonating, setImpersonating] = useState<ImpersonatingUser | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check impersonation status
    const checkImpersonation = async () => {
      try {
        const response = await fetch('/api/admin-auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.admin?.impersonating) {
            setImpersonating(data.admin.impersonating)
            // Session expires after 30 minutes
            const expiry = new Date(Date.now() + 30 * 60 * 1000)
            setExpiresAt(expiry)
          }
        }
      } catch (error) {
        console.error('Failed to check impersonation status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkImpersonation()

    // Refresh every minute
    const interval = setInterval(checkImpersonation, 60000)

    return () => clearInterval(interval)
  }, [])

  const handleEndImpersonation = async () => {
    try {
      const response = await fetch('/api/admin-auth/end-impersonation', {
        method: 'POST'
      })

      if (response.ok) {
        setImpersonating(null)
        setExpiresAt(null)
        onEndImpersonation?.()
        // Reload to refresh the page with original session
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to end impersonation:', error)
    }
  }

  if (loading || !impersonating) {
    return null
  }

  const getTimeRemaining = () => {
    if (!expiresAt) return ''
    const now = new Date()
    const diff = expiresAt.getTime() - now.getTime()
    const minutes = Math.floor(diff / 60000)
    return `${minutes}m remaining`
  }

  return (
    <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <span className="font-semibold">Impersonation Mode Active</span>
          <span className="mx-2">|</span>
          <span>Viewing as <strong>{impersonating.name}</strong> ({impersonating.role})</span>
          <span className="mx-2">|</span>
          <span className="text-red-200">{getTimeRemaining()}</span>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleEndImpersonation}
        className="bg-white text-red-600 hover:bg-red-50 font-semibold"
      >
        End Session
      </Button>
    </div>
  )
}
