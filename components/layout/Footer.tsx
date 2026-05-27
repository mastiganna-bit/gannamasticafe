import Link from 'next/link'
import Image from 'next/image'
import { Phone, MapPin, Clock } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-cocoa text-cream-100" id="contact">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 relative shrink-0">
                <Image src="/images/logo.png" alt="Gannamasti Cafe" fill className="object-contain brightness-200" />
              </div>
              <span className="font-serif text-2xl text-cream-100 tracking-wide">Gannamasti Cafe</span>
            </div>
            <p className="font-sans text-sm text-cream-200 opacity-70 leading-relaxed">
              Zero Touch, Zero Ice, 100% Natural.<br />
              Fresh sugarcane juice & premium cafe food.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg text-cream-100 mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-sage-light shrink-0" />
                <a href="tel:7788877818" className="font-sans text-sm text-cream-200 opacity-80 hover:opacity-100 transition-opacity">
                  77888-77818
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={16} className="text-sage-light shrink-0 mt-0.5" />
                <span className="font-sans text-sm text-cream-200 opacity-80">
                  Gannamasti Cafe<br />Visit us for fresh juice & more
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Clock size={16} className="text-sage-light shrink-0" />
                <span className="font-sans text-sm text-cream-200 opacity-80">
                  Open Daily
                </span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display text-lg text-cream-100 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { label: 'Full Menu', href: '/menu' },
                { label: 'My Orders', href: '/account' },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-sans text-sm text-cream-200 opacity-70 hover:opacity-100 hover:text-sage-light transition-all"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-sans text-xs text-cream-200 opacity-50">
            © {new Date().getFullYear()} Gannamasti Cafe. All rights reserved.
          </p>
          <p className="font-sans text-xs text-cream-200 opacity-50">
            gannamasticafe.in
          </p>
        </div>
      </div>
    </footer>
  )
}
