'use client'

import { motion } from 'framer-motion'
import MenuCard from '@/components/menu/MenuCard'
import Link from 'next/link'
import { MenuItem } from '@/lib/types'
import { ArrowRight } from 'lucide-react'

export default function FeaturedSection({ items }: { items: MenuItem[] }) {
  return (
    <section className="bg-cream-200 py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4"
        >
          <div>
            <span className="premium-label">
              Fan Favourites
            </span>
            <h2 className="section-heading">Our Bestsellers</h2>
          </div>
          <Link href="/menu" className="btn-outline flex items-center gap-2 self-start text-sm">
            Full Menu <ArrowRight size={14} />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  )
}
