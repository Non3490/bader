'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminSession } from '@/hooks/use-admin-session'
import { useUser } from '@/hooks/use-user'
import type { Permission } from '@/lib/admin-auth'

interface PermissionGateProps {
  permission: Permission
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGate({ permission, fallback, children }: PermissionGateProps) {
  const router = useRouter()
  const { session, loading: adminLoading } = useAdminSession()
  const { user, loading: userLoading } = useUser()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const loading = adminLoading || userLoading

  useEffect(() => {
    // If no admin session but user is ADMIN/SUPER_ADMIN via regular auth, grant all permissions
    if (!loading && !session && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      setHasPermission(true)
      return
    }

    if (!loading && session) {
      // Check permission on the server
      const checkPermission = async () => {
        try {
          const response = await fetch('/api/admin/check-permission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permission })
          })

          if (response.ok) {
            const data = await response.json()
            setHasPermission(data.allowed)
          } else {
            setHasPermission(false)
          }
        } catch (error) {
          console.error('Failed to check permission:', error)
          setHasPermission(false)
        }
      }

      checkPermission()
    }

    if (!loading && !session && !user) {
      setHasPermission(false)
    }
  }, [session, loading, permission, user])

  if (loading || hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasPermission) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
}

// Simpler component that redirects instead of showing fallback
export function RequirePermission({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const router = useRouter()
  const { session, loading: adminLoading } = useAdminSession()
  const { user, loading: userLoading } = useUser()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  const loading = adminLoading || userLoading

  useEffect(() => {
    // If no admin session but user is ADMIN/SUPER_ADMIN via regular auth, grant all permissions
    if (!loading && !session && user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
      setHasPermission(true)
      return
    }

    if (!loading && session) {
      const checkPermission = async () => {
        try {
          const response = await fetch('/api/admin/check-permission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permission })
          })

          if (response.ok) {
            const data = await response.json()
            if (!data.allowed) {
              router.push('/admin/unauthorized')
            } else {
              setHasPermission(true)
            }
          } else {
            router.push('/admin/unauthorized')
          }
        } catch (error) {
          console.error('Failed to check permission:', error)
          router.push('/admin/unauthorized')
        }
      }

      checkPermission()
    }

    if (!loading && !session && !user) {
      router.push('/login')
    }
  }, [session, loading, permission, router, user])

  if (loading || hasPermission === null) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
