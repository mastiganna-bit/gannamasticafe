import Link from 'next/link'
import Image from 'next/image'
import { Phone, MapPin, Clock } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-cocoa text-cream-100" id="contact">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-18 h-18 relative shrink-0">
                <Image src="/images/logo.png" alt="Gannamasti Cafe" fill className="object-contain brightness-200" />
              </div>
              <span className="font-serif text-xl text-cream-100 tracking-wide">Gannamasti Cafe</span>
            </div>
            <p className="font-sans text-sm text-cream-200 opacity-70 leading-relaxed">
              Where fast food becomes healthy & fresh.<br />
              Wholesome ingredients prepared fresh everyday.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display text-lg text-cream-100 mb-4">Contact Us</h4>
            <ul className="space-y-3.5">
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-sage-light shrink-0" />
                <a href="tel:+917788877818" className="font-sans text-sm text-cream-200 opacity-80 hover:opacity-100 hover:text-sage-light transition-all">
                  +91 77888 77818
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={16} className="text-sage-light shrink-0 mt-1" />
                <a
                  href="https://maps.app.goo.gl/8fXXQev6bnw8qXdf8"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-sm text-cream-200 opacity-80 hover:opacity-100 hover:text-sage-light transition-all leading-relaxed"
                >
                  Opp. Tara Hotel,<br />
                  Shivaji Colony Chowk,<br />
                  Jhajjar Rd, Kath Mandi,<br />
                  Rohtak, Haryana 124001
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Clock size={16} className="text-sage-light shrink-0" />
                <span className="font-sans text-sm text-cream-200 opacity-80">
                  Open Daily · 10 AM - 10 PM
                </span>
              </li>
            </ul>
          </div>

          {/* Find Us Map Embed */}
          <div>
            <h4 className="font-display text-lg text-cream-100 mb-4">Find Us</h4>
            <div className="w-full h-28 rounded-xl overflow-hidden border border-white/10 shadow-md relative group">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3493.5240848786775!2d76.58098048394419!3d28.88277051243236!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390d85bbe9690b6d%3A0xd44a95a3bdee3647!2sGanna%20Masti%20Cafe!5e0!3m2!1sen!2sin!4v1780137117150!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="opacity-75 group-hover:opacity-100 transition-opacity duration-300"
              />
            </div>
            <a
              href="https://maps.app.goo.gl/8fXXQev6bnw8qXdf8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 font-sans text-xs text-sage-light hover:underline"
            >
              Open in Google Maps →
            </a>
          </div>

          {/* Quick Links */}
          <div className="lg:pl-6">
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
