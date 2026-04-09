'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { DashboardLayout } from '@/components/layout'
import { Loader2 } from 'lucide-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f8]">
        <Loader2 className="h-6 w-6 animate-spin text-[#f07020]" />
      </div>
    )
  }

  if (!user) return null

  return <DashboardLayout user={user}>{children}</DashboardLayout>
}
