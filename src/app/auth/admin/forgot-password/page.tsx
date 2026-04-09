'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
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

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-[#f07020]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-[#f07020]" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Mot de passe oublié ?</h1>
          <p className="text-sm text-gray-400 mb-8">
            Contactez un Super Admin pour réinitialiser votre mot de passe.
          </p>

          <Link href="/auth/admin/login">
            <Button className="w-full h-11 bg-[#f07020] hover:bg-[#d96000] text-white font-semibold rounded-lg">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la connexion
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          E-Gabon Prime Admin &copy; 2026
        </p>
      </div>
    </div>
  )
}
