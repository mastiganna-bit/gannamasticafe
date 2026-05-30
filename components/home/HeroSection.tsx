'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Leaf } from 'lucide-react'

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center bg-cream-100 pt-16 overflow-hidden">
      {/* Premium Textured Linen Background Cover */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-40 mix-blend-multiply">
        <Image
          src="/images/hero-bg.jpg"
          alt="Organic Linen Texture"
          fill
          className="object-cover"
          priority
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center py-16">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="space-y-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 bg-sage/10 text-sage px-3 py-1.5 rounded-full text-xs font-sans font-medium"
            >
              <Leaf size={12} />
              Zero Touch · Zero Ice · 100% Natural
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="font-serif text-4xl xs:text-5xl md:text-6xl lg:text-7xl text-cocoa leading-[1.1] font-light"
            >
              Real Taste.
              <br />
              <span className="text-sage font-medium">Real Health.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="font-sans text-sm xs:text-base text-cocoa-muted max-w-sm leading-relaxed"
            >
              Where fast food becomes healthy and fresh. Ditch the factory-made chemicals—enjoy fresh, everyday goodness!
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-row items-center gap-3 sm:gap-4"
            >
              <Link href="/menu" className="btn-primary flex items-center gap-1.5 xs:gap-2 px-4 xs:px-6 py-2.5 xs:py-3 text-xs xs:text-sm">
                Order Now
                <ArrowRight size={14} className="xs:w-4 xs:h-4" />
              </Link>
              <Link href="/#story" className="btn-outline px-4 xs:px-6 py-2.5 xs:py-3 text-xs xs:text-sm">
                Our Story
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="font-sans text-[10px] xs:text-xs text-cocoa-muted flex items-center gap-1.5"
            >
              <span className="w-2 h-2 bg-sage rounded-full animate-pulse-soft inline-block" />
              Now taking orders online — 77888-77818
            </motion.p>
          </motion.div>

          {/* Right: Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-full aspect-[4/3] md:h-[480px] lg:h-[520px] rounded-2xl overflow-hidden shadow-card"
          >
            <img
              src="/images/hero-juice.jpg"
              alt="Real Taste and Real Health at Gannamasti Cafe"
              className="w-full h-full object-cover object-center"
            />
            {/* Warm overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-cocoa/30 via-cocoa/5 to-transparent" />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
