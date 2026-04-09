'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  forcePasswordChange?: boolean
}

interface AdminSessionContextType {
  session: AdminUser | null
  loading: boolean
  error: string | null
  refreshSession: () => Promise<void>
}

const AdminSessionContext = createContext<AdminSessionContextType>({
  session: null,
  loading: true,
  error: null,
  refreshSession: async () => {}
})

export function useAdminSession() {
  return useContext(AdminSessionContext)
}

interface AdminSessionProviderProps {
  children: ReactNode
}

export function AdminSessionProvider({ children }: AdminSessionProviderProps) {
  const [session, setSession] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchSession = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin-auth/me')

      if (!response.ok) {
        if (response.status === 401) {
          setSession(null)
          return
        }
        throw new Error('Failed to fetch session')
      }

      const data = await response.json()
      setSession(data.admin)
    } catch (err) {
      console.error('Failed to fetch admin session:', err)
      setError('Failed to fetch session')
      setSession(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()

    // Refresh session every 5 minutes
    const interval = setInterval(fetchSession, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  const refreshSession = async () => {
    await fetchSession()
  }

  return (
    <AdminSessionContext.Provider value={{ session, loading, error, refreshSession }}>
      {children}
    </AdminSessionContext.Provider>
  )
}
