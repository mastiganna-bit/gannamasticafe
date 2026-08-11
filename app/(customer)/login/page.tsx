'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, LocateFixed, LockKeyhole, Phone, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'forgot'
type Step = 'details' | 'otp'

const normalizePhone = (value: string) => `+91${value.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(-10)}`

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<Step>('details')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [challengeId, setChallengeId] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [fullName, setFullName] = useState('')
  const [house, setHouse] = useState('')
  const [area, setArea] = useState('')
  const [landmark, setLandmark] = useState('')
  const [city, setCity] = useState('Rohtak')
  const [postalCode, setPostalCode] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'forgot') setMode('forgot')
  }, [])

  const redirectAfterLogin = async () => {
    const next = new URLSearchParams(window.location.search).get('next')
    if (next?.startsWith('/')) router.replace(next)
    else {
      const { data } = await createClient().from('profiles').select('is_admin,role').single()
      router.replace(data?.is_admin || data?.role === 'admin' ? '/admin' : data?.role === 'driver' ? '/delivery' : '/account')
    }
    router.refresh()
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setStep('details')
    setOtp('')
    setChallengeId('')
  }

  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ phone: normalizePhone(phone), password })
      if (error) throw new Error('Incorrect mobile number or password.')
      toast.success('Welcome back!')
      await redirectAfterLogin()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to log in.')
    } finally {
      setBusy(false)
    }
  }

  const locate = () => {
    if (!navigator.geolocation) return toast.error('Location is not supported on this device.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude)
        setLongitude(coords.longitude)
        toast.success('Delivery location detected.')
        setBusy(false)
      },
      () => {
        toast.error('Location permission was not granted. Please try again.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }
    )
  }

  const sendOtp = async (event: FormEvent) => {
    event.preventDefault()
    if (phone.replace(/\D/g, '').length !== 10) return toast.error('Enter a valid 10-digit mobile number.')
    if (mode === 'signup') {
      if (password !== confirmPassword) return toast.error('Passwords do not match.')
    }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), purpose: mode === 'signup' ? 'signup' : 'password_reset' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send verification code.')
      setChallengeId(result.challengeId)
      setStep('otp')
      toast.success('Verification code sent.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send verification code.')
    } finally {
      setBusy(false)
    }
  }

  const verifyAndContinue = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/reset-password'
      const payload = mode === 'signup'
        ? {
            challengeId,
            otp,
            phone: normalizePhone(phone),
            password,
            fullName,
            address: {
              label: 'Home', recipientName: fullName, phone: normalizePhone(phone), house, area, landmark,
              city, postalCode, latitude, longitude, isDefault: true,
            },
          }
        : { challengeId, otp, phone: normalizePhone(phone), password }
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Verification failed.')

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ phone: normalizePhone(phone), password })
      if (error) throw new Error('Password saved. Please use it to log in.')
      toast.success(mode === 'signup' ? 'Account created successfully!' : 'Password reset successfully!')
      await redirectAfterLogin()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Verification failed.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-linen bg-white px-4 py-3 text-sm text-cocoa outline-none transition focus:border-sage focus:ring-2 focus:ring-sage/15'

  return (
    <main className="min-h-[calc(100vh-80px)] bg-cream px-4 py-10">
      <div className="mx-auto max-w-lg rounded-3xl border border-linen bg-white p-6 shadow-card sm:p-8">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sage/10 text-sage">
            {mode === 'signup' ? <UserRound /> : mode === 'forgot' ? <LockKeyhole /> : <Phone />}
          </div>
          <h1 className="font-display text-3xl text-cocoa">
            {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p className="mt-2 text-sm text-cocoa-muted">
            {step === 'otp' ? `Enter the code sent to +91 ${phone}` : mode === 'login' ? 'Login with your mobile number and password.' : 'Your details are saved securely for faster ordering.'}
          </p>
        </div>

        {step === 'otp' ? (
          <form onSubmit={verifyAndContinue} className="space-y-4">
            <label className="block text-sm font-semibold text-cocoa">6-digit verification code
              <input className={`${inputClass} mt-2 text-center text-xl tracking-[0.35em]`} inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))} required />
            </label>
            <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={busy || otp.length < 4}>
              {busy && <Loader2 size={16} className="animate-spin" />} Verify and continue
            </button>
            <button type="button" className="w-full text-sm font-medium text-sage" onClick={() => setStep('details')}>Change details</button>
          </form>
        ) : mode === 'login' ? (
          <form onSubmit={login} className="space-y-4">
            <label className="block text-sm font-semibold text-cocoa">Mobile number
              <div className="mt-2 flex"><span className="rounded-l-xl border border-r-0 border-linen bg-cream-200 px-3 py-3 text-sm">+91</span><input className={`${inputClass} rounded-l-none`} inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required /></div>
            </label>
            <PasswordField value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} inputClass={inputClass} />
            <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />} Log in
            </button>
            <button type="button" className="w-full text-sm font-medium text-sage" onClick={() => switchMode('forgot')}>Forgot password?</button>
          </form>
        ) : (
          <form onSubmit={sendOtp} className="space-y-4">
            {mode === 'signup' && <>
              <label className="block text-sm font-semibold text-cocoa">Full name<input className={`${inputClass} mt-2`} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></label>
            </>}
            <label className="block text-sm font-semibold text-cocoa">Mobile number
              <div className="mt-2 flex"><span className="rounded-l-xl border border-r-0 border-linen bg-cream-200 px-3 py-3 text-sm">+91</span><input className={`${inputClass} rounded-l-none`} inputMode="numeric" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} required /></div>
            </label>
            <PasswordField value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} inputClass={inputClass} label={mode === 'forgot' ? 'New password' : 'Password'} />
            {mode === 'signup' && <>
              <PasswordField value={confirmPassword} onChange={setConfirmPassword} show={showPassword} onToggle={() => setShowPassword(!showPassword)} inputClass={inputClass} label="Confirm password" />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-cocoa">House / shop<input className={`${inputClass} mt-2`} value={house} onChange={(e) => setHouse(e.target.value)} required /></label>
                <label className="block text-sm font-semibold text-cocoa">Area<input className={`${inputClass} mt-2`} value={area} onChange={(e) => setArea(e.target.value)} required /></label>
              </div>
              <label className="block text-sm font-semibold text-cocoa">Landmark <span className="font-normal text-cocoa-muted">(optional)</span><input className={`${inputClass} mt-2`} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-cocoa">City<input className={`${inputClass} mt-2`} value={city} onChange={(e) => setCity(e.target.value)} required /></label>
                <label className="block text-sm font-semibold text-cocoa">PIN code<input className={`${inputClass} mt-2`} inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
              </div>
              <button type="button" onClick={locate} className="flex w-full items-center justify-center gap-2 rounded-xl border border-sage/30 bg-sage/5 px-4 py-3 text-sm font-semibold text-sage" disabled={busy}>
                <LocateFixed size={17} /> {latitude === null ? 'Detect delivery location' : 'Location detected — update'}
              </button>
              <p className="text-xs leading-relaxed text-cocoa-muted">Location is optional while creating your account. Delivery availability is checked securely against the cafe’s service area at checkout; pickup remains available without GPS.</p>
            </>}
            <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={busy}>
              {busy && <Loader2 size={16} className="animate-spin" />} Send verification code
            </button>
          </form>
        )}

        <div className="mt-7 border-t border-linen pt-5 text-center text-sm text-cocoa-muted">
          {mode === 'login' ? <>New to Gannamasti? <button className="font-semibold text-sage" onClick={() => switchMode('signup')}>Create account</button></> : <>Already have an account? <button className="font-semibold text-sage" onClick={() => switchMode('login')}>Log in</button></>}
        </div>
        <p className="mt-4 text-center text-[11px] text-cocoa-muted">By continuing, you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </div>
    </main>
  )
}

function PasswordField({ value, onChange, show, onToggle, inputClass, label = 'Password' }: { value: string; onChange: (value: string) => void; show: boolean; onToggle: () => void; inputClass: string; label?: string }) {
  return <label className="block text-sm font-semibold text-cocoa">{label}
    <div className="relative mt-2"><input className={`${inputClass} pr-11`} type={show ? 'text' : 'password'} autoComplete={label === 'Password' ? 'current-password' : 'new-password'} value={value} onChange={(e) => onChange(e.target.value)} minLength={8} required /><button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-muted" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
    {label !== 'Confirm password' && <span className="mt-1 block text-[11px] font-normal text-cocoa-muted">At least 8 characters with a letter and number.</span>}
  </label>
}
