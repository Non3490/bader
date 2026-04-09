'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Login failed')
        return
      }

      // Redirect based on user role
      let redirectTo = redirect || '/'
      if (!redirect) {
        switch (data.user?.role) {
          case 'SUPER_ADMIN':
          case 'ADMIN':
            redirectTo = '/admin'
            break
          case 'SELLER':
            redirectTo = '/seller'
            break
          case 'CALL_CENTER':
            redirectTo = '/call-center'
            break
          case 'DELIVERY':
            redirectTo = '/delivery'
            break
          default:
            redirectTo = '/seller'
        }
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex font-sora">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] relative bg-[#111111] flex-col justify-between p-10 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-[#f06a00]/10 blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-[#f06a00]/5 blur-[100px]" />

        {/* Logo */}
        <div>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[#f06a00] font-extrabold text-3xl italic">E-</span>
            <span className="text-white font-extrabold text-3xl tracking-tight">Gabon</span>
          </div>
          <div className="text-[#f06a00] font-bold text-[10px] uppercase tracking-[0.3em] ml-[2px] mt-1">Prime</div>
        </div>

        {/* Center content */}
        <div className="space-y-6">
          <h2 className="text-white text-[28px] font-bold leading-tight tracking-tight">
            Plateforme COD<br />
            <span className="text-[#f06a00]">tout-en-un</span> pour le Gabon
          </h2>
          <p className="text-white/40 text-[14px] leading-relaxed max-w-[340px]">
            Gerez vos commandes, livraisons, centre d&apos;appel et finances depuis un seul tableau de bord.
          </p>
          <div className="flex gap-6 pt-2">
            <div>
              <div className="text-[28px] font-bold text-[#f06a00]">236+</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Commandes</div>
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#f06a00]">5</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Vendeurs</div>
            </div>
            <div>
              <div className="text-[28px] font-bold text-[#f06a00]">4</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/30">Villes</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2">
          <div className="h-[5px] w-[5px] rounded-full bg-[#16a34a] animate-pulse" />
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-white/25">System Live & Running</span>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="relative flex flex-1 items-center justify-center bg-[#fafafa] p-6">
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
             style={{ backgroundImage: 'radial-gradient(#111 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[400px] relative z-10"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="inline-flex flex-col leading-none">
              <div className="flex items-baseline gap-0.5">
                <span className="text-[#f06a00] font-extrabold text-2xl italic">E-</span>
                <span className="text-[#111111] font-extrabold text-2xl tracking-tight">Gabon</span>
              </div>
              <span className="ml-[2px] mt-1 text-[8px] font-bold uppercase tracking-[0.25em] text-[#f06a00]">Prime</span>
            </div>
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-[26px] font-bold tracking-tight text-[#111111]">
              Bienvenue
            </h1>
            <p className="text-[14px] text-[#888]">
              Connectez-vous pour acceder a votre tableau de bord
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700">
                    <AlertDescription className="font-medium text-[13px]">{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-bold text-[#555] uppercase tracking-wider">
                Email
              </Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb] group-focus-within:text-[#f06a00] transition-colors">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="nom@exemple.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={loading}
                  className="pl-11 h-12 bg-white border-[#e5e5e5] focus-visible:ring-[#f06a00]/20 focus-visible:border-[#f06a00] rounded-xl text-[14px]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-bold text-[#555] uppercase tracking-wider">
                Mot de passe
              </Label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb] group-focus-within:text-[#f06a00] transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={loading}
                  className="pl-11 pr-12 h-12 bg-white border-[#e5e5e5] focus-visible:ring-[#f06a00]/20 focus-visible:border-[#f06a00] rounded-xl text-[14px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-[#bbb] hover:text-[#555] hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[#16a34a]" />
              <span className="text-[9px] text-[#aaa] font-bold uppercase tracking-wider">
                Connexion securisee
              </span>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-[#f06a00] hover:bg-[#d96000] text-white rounded-xl text-[14px] font-bold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-70 disabled:hover:scale-100 shadow-lg shadow-[#f06a00]/20 border-none"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  Se connecter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-[10px] text-[#ccc] uppercase tracking-[0.15em] font-bold mt-10">
            E-Gabon Prime &copy; 2026
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f8] font-sora">
        <div className="mb-6 inline-flex flex-col leading-none">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[30px] font-extrabold italic text-[#f06a00]">E-</span>
            <span className="text-[30px] font-extrabold tracking-tight text-[#111111]">Gabon</span>
          </div>
          <span className="ml-[2px] mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-[#f06a00]">Prime</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-[#f06a00]" />
          <span className="text-[11px] font-semibold text-[#555555]">Preparing sign in...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
