'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      console.log('Checking authentication...')
      try {
        const response = await fetch('/api/auth/me')
        const status = response.status
        console.log('Auth status:', status)

        if (status === 200) {
          const data = await response.json()
          console.log('User role:', data.user?.role)
          // Redirect to appropriate dashboard based on role
          switch (data.user?.role) {
            case 'SUPER_ADMIN':
            case 'ADMIN':
              router.push('/admin')
              break
            case 'SELLER':
              router.push('/seller')
              break
            case 'CALL_CENTER':
              router.push('/call-center')
              break
            case 'DELIVERY':
              // Delivery agents use PIN-based login at the driver portal
              router.push('/driver/login')
              break
            default:
              console.log('Unknown role, redirecting to login')
              router.push('/login')
          }
        } else {
          // Not authenticated - redirect to login
          console.log('Not authenticated, redirecting to login')
          router.push('/login')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f8] font-sora">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-[#f07020]/10 blur-2xl" />
        <div className="relative rounded-[24px] border border-[#f3d2bd] bg-white px-8 py-6 shadow-[0_20px_60px_rgba(240,112,32,0.08)]">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[30px] font-extrabold italic text-[#f07020]">E-</span>
            <span className="text-[30px] font-extrabold tracking-tight text-[#111111]">Gabon</span>
          </div>
          <div className="ml-[2px] mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-[#f07020]">Prime</div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-4 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-[#f07020]" />
        <span className="text-[11px] font-semibold text-[#555555]">Loading workspace...</span>
      </div>
    </div>
  )
}
