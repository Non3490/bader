'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, HelpCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

export default function DriverLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/driver-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, phone: phone ? `+241${phone.replace(/\s/g, '')}` : undefined }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Code PIN incorrect')
        return
      }

      toast.success('Connexion réussie')
      router.push('/driver/dashboard')
      router.refresh()
    } catch (err) {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111] p-6 max-w-[375px] mx-auto font-sora">
      {/* Decorative Elements */}
      <div className="fixed -bottom-24 -left-24 w-64 h-64 bg-[#f07020] rounded-full blur-[120px] opacity-10 pointer-events-none" />
      <div className="fixed -top-24 -right-24 w-64 h-64 bg-[#f07020] rounded-full blur-[120px] opacity-5 pointer-events-none" />

      <div className="w-full flex flex-col items-center space-y-12">
        {/* Branding Section */}
        <div className="text-center">
          <div className="flex flex-col items-center">
            {/* Logo */}
            <h1 className="text-4xl font-extrabold tracking-tighter flex items-baseline">
              <span className="text-[#f07020]">E-</span>
              <span className="text-white">Gabon</span>
            </h1>
            <span className="text-[#f07020] text-sm font-semibold tracking-widest uppercase mt-[-4px]">
              prime
            </span>
          </div>

          {/* Context Label */}
          <div className="mt-8">
            <p className="text-white/90 text-lg font-semibold tracking-tight">
              Portail Livreur
            </p>
            <div className="h-1 w-8 bg-[#f07020] mx-auto mt-2 rounded-full" />
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-6">
          {/* Phone Number Input */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest ml-1">
              Numéro de téléphone
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center space-x-2 pointer-events-none">
                <span className="text-white/40 font-semibold">+241</span>
                <div className="w-[1px] h-4 bg-white/10" />
              </div>
              <input
                type="tel"
                placeholder="06 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-14 pl-20 pr-4 bg-[#222222] border border-[#333333] text-white rounded-xl text-md font-medium placeholder-white/20 focus:border-[#f07020] focus:outline-none transition-all duration-300"
                required
              />
            </div>
          </div>

          {/* PIN Input */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-widest ml-1">
              Code PIN
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                className="w-full h-14 px-4 pr-12 bg-[#222222] border border-[#333333] text-white rounded-xl text-md font-medium placeholder-white/20 focus:border-[#f07020] focus:outline-none transition-all duration-300"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-white/30 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-[20px] h-[20px]" />
                ) : (
                  <Eye className="w-[20px] h-[20px]" />
                )}
              </button>
            </div>
          </div>

          {/* CTA Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 bg-[#f07020] hover:bg-[#d96500] active:scale-[0.98] text-white font-extrabold text-base rounded-xl transition-all duration-200 shadow-[0_4px_20px_rgba(240,112,32,0.25)] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{isLoading ? 'Connexion...' : 'Se connecter'}</span>
              {!isLoading && <ArrowRight className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="w-full pt-8 flex flex-col items-center space-y-6">
          <Link
            href="/help"
            className="text-white/40 text-sm font-medium hover:text-white transition-colors flex items-center space-x-2"
          >
            <HelpCircle className="w-[18px] h-[18px]" />
            <span>Besoin d'aide?</span>
          </Link>

          {/* Editorial Accent */}
          <div className="w-full px-8 opacity-20">
            <div className="h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
          </div>

          <p className="text-[10px] text-white/20 text-center tracking-widest uppercase">
            Propulsé par E-Gabon Logistics Engine
          </p>
        </div>
      </div>
    </div>
  )
}
