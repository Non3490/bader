'use client'

import { useState, useEffect } from 'react'
import { type UserRole } from '@/types/auth-types'

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string | null
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function fetchUser() {
      try {
        console.log('Fetching user...')
        const response = await fetch('/api/auth/me')
        console.log('Auth response status:', response.status)
        if (response.ok) {
          const data = await response.json()
          console.log('User data:', data)
          if (isMounted) setUser(data.user)
        } else {
          console.log('Not authenticated or error response')
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      } finally {
        if (isMounted) {
          console.log('Setting loading to false')
          setLoading(false)
        }
      }
    }
    fetchUser()
    return () => { isMounted = false }
  }, [])

  return { user, loading }
}
