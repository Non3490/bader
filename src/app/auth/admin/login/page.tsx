'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, EyeOff, Mail, Lock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

// Zod validation schema
const loginSchema = z.object({
  email: z.string()
    .min(1, "Email requis")
    .email("Email invalide"),
  password: z.string()
    .min(8, "Minimum 8 caractères")
})

type LoginFormData = z.infer<typeof loginSchema>

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({})
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: ''
  })

  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin-auth/me')
        if (res.ok) {
          router.push('/admin/dashboard')
        }
      } catch {
        // Not authenticated, continue to login
      }
    }
    checkAuth()
  }, [router])

  const validateForm = () => {
    const result = loginSchema.safeParse(formData)
    if (!result.success) {
      const newErrors: Partial<Record<keyof LoginFormData, string>> = {}
      result.error.issues.forEach(issue => {
        if (issue.path[0]) {
          newErrors[issue.path[0] as keyof LoginFormData] = issue.message
        }
      })
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        // Handle specific error statuses
        if (response.status === 423) {
          toast.error("Compte verrouillé. Contactez un Super Admin.")
        } else if (response.status === 401 || response.status === 403) {
          toast.error(data.error || "Email ou mot de passe incorrect")
        } else {
          toast.error("Erreur de connexion au serveur")
        }
        return
      }

      // Success - redirect to admin dashboard
      toast.success("Connexion réussie")
      router.push('/admin/dashboard')
      router.refresh()
    } catch (err) {
      console.error('Admin login error:', err)
      toast.error("Erreur de connexion au serveur")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111] p-4 font-sora">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-[#f07020]/5 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-[#f07020]/3 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-baseline gap-0.5 mb-1">
            <span className="text-[#f07020] font-extrabold text-3xl italic">E-</span>
            <span className="text-white font-extrabold text-3xl tracking-tight">Gabon</span>
          </div>
          <div className="text-[#f07020] font-bold text-xs uppercase tracking-[0.3em]">Prime Admin</div>
        </div>

        {/* Login Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Administration</h1>
            <p className="text-sm text-gray-400">Connectez-vous pour accéder au panneau d'administration</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@egabon.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  disabled={loading}
                  className="pl-10 h-11 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-gray-600 focus:border-[#f07020] focus:ring-[#f07020]/20 rounded-lg"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  disabled={loading}
                  className="pl-10 pr-10 h-11 bg-[#0f0f0f] border-[#2a2a2a] text-white placeholder:text-gray-600 focus:border-[#f07020] focus:ring-[#f07020]/20 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-[#f07020] hover:bg-[#d96000] text-white font-semibold rounded-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </span>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="mt-6 text-center">
            <a
              href="/auth/admin/forgot-password"
              className="text-sm text-[#f07020] hover:text-[#ff8a40] transition-colors"
            >
              Mot de passe oublié ?
            </a>
          </div>

          {/* Security Badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
            <span>Connexion sécurisée</span>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          E-Gabon Prime Admin &copy; 2026
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#111111] font-sora">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-baseline gap-0.5">
            <span className="text-[#f07020] font-extrabold text-3xl italic">E-</span>
            <span className="text-white font-extrabold text-3xl tracking-tight">Gabon</span>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-[#f07020]" />
        </div>
      </div>
    }>
      <AdminLoginForm />
    </Suspense>
  )
}
