'use client'

import { motion } from 'framer-motion'
import { Leaf, Clock, ShieldCheck, Sparkles } from 'lucide-react'

const features = [
  {
    icon: Leaf,
    title: 'Fresh Everyday',
    description: 'No factory-made food. We serve fresh, wholesome goodness prepared everyday.',
  },
  {
    icon: ShieldCheck,
    title: 'Oil-Free Burgers',
    description: 'Why eat food drenched in oil? Enjoy delicious, fresh, and lighter veggie burgers.',
  },
  {
    icon: Sparkles,
    title: 'Pure Milkshakes',
    description: 'Goodbye heavy cream, chemicals, and ice. Hello fresh and purely natural thick shakes!',
  },
  {
    icon: Clock,
    title: 'Zero Compromise',
    description: 'Zero artificial preservatives or colors. Where fast food becomes truly healthy and fresh.',
  },
]

export default function WhyUsSection() {
  return (
    <section className="bg-cream py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="premium-label">
            Why Gannamasti Cafe
          </span>
          <h2 className="section-heading">We Keep It Real</h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-cream-200 rounded-xl2 p-6 border border-linen hover:border-sage/20 transition-colors"
            >
              <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center mb-4">
                <feature.icon size={20} className="text-sage" />
              </div>
              <h3 className="font-serif text-xl font-medium text-cocoa mb-2 tracking-normal">{feature.title}</h3>
              <p className="font-sans text-sm text-cocoa-muted leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
