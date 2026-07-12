'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Chrome, Phone, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [showTesterLogin, setShowTesterLogin] = useState(false)
  const [testerEmail, setTesterEmail] = useState('')
  const [testerPassword, setTesterPassword] = useState('')
  const [isTesterLoading, setIsTesterLoading] = useState(false)

  // Phone Login State
  const [phoneNumber, setPhoneNumber] = useState('')
  const [countryCode, setCountryCode] = useState('91')
  const [otpCode, setOtpCode] = useState('')
  const [verificationId, setVerificationId] = useState('')
  const [fullName, setFullName] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [isPhoneLoading, setIsPhoneLoading] = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  const supabase = createClient()
  const router = useRouter()

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [resendTimer])

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account'
        }
      },
    })
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phoneNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number')
      return
    }
    setIsPhoneLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, mobileNumber: phoneNumber })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to send OTP')
      } else {
        setVerificationId(data.verificationId)
        setStep('otp')
        setResendTimer(60)
        toast.success('OTP sent successfully!')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred. Please try again.')
    } finally {
      setIsPhoneLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length < 4) {
      toast.error('Please enter the OTP code')
      return
    }
    setIsPhoneLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode,
          mobileNumber: phoneNumber,
          otpCode,
          verificationId,
          fullName
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Invalid OTP code')
      } else {
        toast.success('Successfully logged in!')
        window.location.href = '/account'
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred during verification.')
    } finally {
      setIsPhoneLoading(false)
    }
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
      window.location.href = '/account'
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 pt-16">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-linen rounded-2xl p-8 md:p-10 max-w-sm w-full shadow-card text-center"
      >
        <div className="mb-6">
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

        {/* Visual Divider */}
        <div className="relative flex py-3 items-center">
          <div className="flex-grow border-t border-linen/60"></div>
          <span className="flex-shrink mx-3 text-[10px] font-sans font-medium text-cocoa-muted/65 uppercase tracking-wider">or sign in with phone</span>
          <div className="flex-grow border-t border-linen/60"></div>
        </div>

        {/* Phone Login Form */}
        <div className="mb-6">
          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-3 text-left">
              <div>
                <label className="font-sans text-[10px] font-medium text-cocoa-muted mb-1 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="input-field py-2.5 text-xs w-full"
                  required
                />
              </div>
              <div>
                <label className="font-sans text-[10px] font-medium text-cocoa-muted mb-1 block">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="border border-linen bg-cream rounded-xl px-2.5 text-xs text-cocoa font-medium focus:outline-none focus:border-sage/40"
                  >
                    <option value="91">+91 (IN)</option>
                    <option value="1">+1 (US)</option>
                    <option value="44">+44 (UK)</option>
                    <option value="971">+971 (AE)</option>
                  </select>
                  <input
                    type="tel"
                    pattern="[0-9]{10}"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit number"
                    className="input-field py-2.5 text-xs flex-1"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isPhoneLoading || phoneNumber.length !== 10 || !fullName.trim()}
                className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
              >
                {isPhoneLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                ) : (
                  <>
                    <Phone size={13} className="text-cream" />
                    Send OTP Code
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3 text-left">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-sans text-[10px] font-medium text-cocoa-muted block">
                    Enter OTP sent to +{countryCode} {phoneNumber}
                  </label>
                  <button
                    type="button"
                    onClick={() => { setStep('phone'); setOtpCode(''); }}
                    className="font-sans text-[10px] text-sage hover:underline flex items-center gap-0.5"
                  >
                    <ChevronLeft size={10} />
                    Change
                  </button>
                </div>
                <input
                  type="text"
                  pattern="[0-9]*"
                  maxLength={8}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter code"
                  className="input-field py-2.5 text-center tracking-widest font-mono text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isPhoneLoading || otpCode.length < 4}
                className="btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1.5"
              >
                {isPhoneLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />
                ) : (
                  "Verify & Sign In"
                )}
              </button>
              <div className="text-center mt-2">
                {resendTimer > 0 ? (
                  <p className="font-sans text-[9px] text-cocoa-muted/70">
                    Resend code in {resendTimer}s
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="font-sans text-[10px] text-sage hover:underline"
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}
        </div>

        <p className="font-sans text-[10px] text-cocoa-muted/70 leading-relaxed mb-4">
          By signing in, you agree to our terms of service and privacy policy. Secured with Google & SMS Authentication.
        </p>

        {/* Reviewer / Tester Login Bypass */}
        <div className="mt-4 pt-4 border-t border-linen/50">
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

