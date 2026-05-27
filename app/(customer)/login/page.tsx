'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Chrome } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [showTesterLogin, setShowTesterLogin] = useState(false)
  const [testerEmail, setTesterEmail] = useState('')
  const [testerPassword, setTesterPassword] = useState('')
  const [isTesterLoading, setIsTesterLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleTesterLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsTesterLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: testerEmail,
      password: testerPassword,
    })
    setIsTesterLoading(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Successfully logged in as Tester')
      router.push('/account')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-linen rounded-2xl p-8 md:p-10 max-w-sm w-full shadow-card text-center"
      >
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-cocoa font-light mb-2">Welcome back</h1>
          <p className="font-sans text-sm text-cocoa-muted">Sign in to track your orders and manage your account</p>
        </div>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-linen bg-cream rounded-xl py-3.5 px-4 font-sans text-sm font-medium text-cocoa hover:bg-cream-200 hover:border-sage/20 transition-all shadow-2xs hover:shadow-sm mb-4"
        >
          <Chrome size={18} className="text-cocoa" />
          Continue with Google
        </button>

        <p className="font-sans text-[10px] text-cocoa-muted/70 leading-relaxed">
          By signing in, you agree to our terms of service and privacy policy. Secured with Google Authentication.
        </p>

        {/* Reviewer / Tester Login Bypass */}
        <div className="mt-8 pt-4 border-t border-linen/50">
          <button
            onClick={() => setShowTesterLogin(!showTesterLogin)}
            className="font-sans text-[10px] text-cocoa-muted/50 hover:text-cocoa transition-colors"
          >
            {showTesterLogin ? "Hide reviewer sign in" : "Payment Reviewer / Auditor Login"}
          </button>

          {showTesterLogin && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              onSubmit={handleTesterLogin}
              className="mt-4 space-y-3 text-left"
            >
              <div>
                <label className="font-sans text-[9px] font-medium text-cocoa-muted mb-1 block">
                  Auditor Email
                </label>
                <input
                  type="email"
                  value={testerEmail}
                  onChange={(e) => setTesterEmail(e.target.value)}
                  placeholder="reviewer@gannamasticafe.in"
                  className="input-field py-2 text-xs"
                  required
                />
              </div>
              <div>
                <label className="font-sans text-[9px] font-medium text-cocoa-muted mb-1 block">
                  Auditor Password
                </label>
                <input
                  type="password"
                  value={testerPassword}
                  onChange={(e) => setTesterPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field py-2 text-xs"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isTesterLoading}
                className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
              >
                {isTesterLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                ) : (
                  "Sign In with Test Credentials"
                )}
              </button>
            </motion.form>
          )}
        </div>
      </motion.div>
    </div>
  )
}
