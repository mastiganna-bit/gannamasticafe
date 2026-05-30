'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

export default function StorySection() {
  return (
    <section className="relative bg-cream-200 py-16 md:py-24 overflow-hidden" id="story">
      {/* Textured Linen Background Cover */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-25 mix-blend-multiply">
        <Image
          src="/images/hero-bg.jpg"
          alt="Organic Linen Texture"
          fill
          className="object-cover"
        />
      </div>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative h-72 md:h-96 rounded-2xl overflow-hidden"
          >
            <img
              src="/images/about/cafe-story.jpg"
              alt="Gannamasti Cafe Story"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-cocoa/30 to-transparent" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-5"
          >
            <span className="premium-label">
              Our Story
            </span>
            <h2 className="section-heading">Born from a Passion for Freshness</h2>
            <p className="font-sans text-sm text-cocoa-muted leading-relaxed">
              Gannamasti Cafe was born from a simple belief: fast food shouldn't mean a compromise on your health. 
              We don't serve factory-made food or items drenched in heavy oils. Everything on our menu is prepared freshly 
              every single day, using wholesome, honest ingredients.
            </p>
            <p className="font-sans text-sm text-cocoa-muted leading-relaxed">
              From our signature natural sugarcane juice to our oil-free veggie burgers and ice-free, chemical-free milkshakes, 
              we serve real taste and real nutrition with zero compromise.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-8 h-px bg-sage" />
              <span className="font-serif text-lg text-sage italic">
                "Taste the Difference"
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
