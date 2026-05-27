'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ShoppingBag, Menu, X, User, ArrowRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '@/components/cart/CartProvider'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [user, setUser] = useState<null | { email: string }>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const { totalItems, setIsCartOpen } = useCart()
  const supabase = createClient()

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const fetchAdminStatus = async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()
      setIsAdmin(!!data?.is_admin)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ email: data.user.email || '' })
        fetchAdminStatus(data.user.id)
      } else {
        setIsAdmin(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email || '' })
        fetchAdminStatus(session.user.id)
      } else {
        setUser(null)
        setIsAdmin(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll')
    } else {
      document.body.classList.remove('no-scroll')
    }
    return () => document.body.classList.remove('no-scroll')
  }, [isMenuOpen])

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 transform-gpu',
          isScrolled
            ? 'bg-cream/90 backdrop-blur-sm border-b border-linen shadow-sm'
            : 'bg-transparent'
        )}
        style={{ willChange: 'transform, background-color, backdrop-filter' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-16 h-16 relative shrink-0">
                <Image
                  src="/images/logo.png"
                  alt="Gannamasti Cafe"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-serif text-2xl text-cocoa group-hover:text-sage transition-colors tracking-wide">
                Gannamasti
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {[
                { label: 'Menu', href: '/menu' },
                { label: 'About', href: '/#story' },
                { label: 'Contact', href: '/#contact' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-sans text-sm font-medium text-cocoa-muted hover:text-sage transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Admin Panel button - Desktop */}
              {user && isAdmin && (
                <Link
                  href="/admin"
                  className="hidden md:flex items-center gap-1.5 font-sans text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 py-1.5 px-3 rounded-full transition-all tracking-wide shadow-sm"
                >
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse-soft" />
                  Admin Panel
                </Link>
              )}

              {/* Cart */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 rounded-lg hover:bg-cream-200 transition-colors"
                aria-label="Open cart"
              >
                <ShoppingBag size={20} className="text-cocoa" />
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-sage text-cream text-xs font-bold rounded-full flex items-center justify-center"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </button>

              {/* User - Desktop */}
              {user ? (
                <Link
                  href="/account"
                  className="hidden md:flex p-2 rounded-lg hover:bg-cream-200 transition-colors"
                  aria-label="My account"
                >
                  <User size={20} className="text-cocoa" />
                </Link>
              ) : (
                <Link href="/login" className="btn-primary hidden md:flex text-xs px-4 py-2">
                  Sign In
                </Link>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-cream-200 transition-colors"
                aria-label="Open mobile menu"
              >
                <Menu size={20} className="text-cocoa" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Drawer (Opaque & Luxury Redesigned) */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Dark blur backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-cocoa/40 backdrop-blur-sm z-[100] md:hidden"
            />

            {/* Sliding Drawer Sheet with 100% Solid Opaque Cream Background */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 h-full w-[290px] xs:w-[330px] bg-[#FAF7F2] z-[110] md:hidden shadow-modal flex flex-col p-6 border-l border-linen"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-linen mb-6">
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2.5">
                  <div className="w-14 h-14 relative shrink-0">
                    <Image src="/images/logo.png" alt="Gannamasti Cafe" fill className="object-contain" />
                  </div>
                  <span className="font-serif text-2xl font-medium text-cocoa tracking-wide">Gannamasti</span>
                </Link>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-cream-200 border border-linen/30 transition-colors flex items-center justify-center shrink-0"
                  aria-label="Close mobile menu"
                >
                  <X size={16} className="text-cocoa" />
                </button>
              </div>

              {/* Luxury Navigation Links Directory */}
              <nav className="flex flex-col flex-1">
                {[
                  { label: 'Menu', href: '/menu' },
                  { label: 'About', href: '/#story' },
                  { label: 'Contact', href: '/#contact' },
                  ...(user && isAdmin ? [{ label: 'Admin Panel', href: '/admin' }] : []),
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "group flex items-center justify-between font-serif text-lg py-4 border-b border-linen/40 transition-all duration-300",
                      link.label.includes('Admin')
                        ? "text-emerald-700 hover:text-emerald-800"
                        : "text-cocoa hover:text-sage"
                    )}
                  >
                    <span className="tracking-wide flex items-center gap-2">
                      {link.label.includes('Admin') && <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse-soft" />}
                      {link.label}
                    </span>
                    <ArrowRight size={16} className={cn(
                      "transition-transform shrink-0",
                      link.label.includes('Admin')
                        ? "text-emerald-300 group-hover:text-emerald-700 group-hover:translate-x-1.5"
                        : "text-linen/80 group-hover:text-sage group-hover:translate-x-1.5"
                    )} />
                  </Link>
                ))}
              </nav>

              {/* Bottom Profile Account & Premium Brand Signature */}
              <div className="pt-6 border-t border-linen flex flex-col gap-6">
                {user ? (
                  <Link
                    href="/account"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-cream-200 border border-linen shadow-2xs hover:border-sage/20 transition-all duration-300"
                  >
                    <div className="w-9 h-9 rounded-full bg-sage/10 flex items-center justify-center text-sage shrink-0">
                      <User size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-sm font-medium text-cocoa truncate">My Account</p>
                      <p className="font-sans text-[10px] text-cocoa-muted truncate">{user.email}</p>
                    </div>
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="btn-primary text-center py-3 text-xs font-semibold tracking-wider uppercase"
                  >
                    Sign In
                  </Link>
                )}

                {/* Designer Signature Info */}
                <div className="text-center font-sans space-y-1 pt-2">
                  <p className="text-[10px] text-cocoa-muted tracking-widest uppercase">Order Online</p>
                  <p className="text-sm font-serif text-sage font-medium">77888-77818</p>
                  <p className="text-[9px] text-cocoa-muted/70 pt-3">© {new Date().getFullYear()} Gannamasti Cafe</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
