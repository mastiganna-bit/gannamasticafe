import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gannamasti Cafe | Real Taste. Real Health.',
  description:
    'Where fast food becomes healthy and fresh. Ditch the factory-made chemicals—enjoy fresh, everyday goodness!',
  keywords: 'gannamasti cafe, sugarcane juice, organic cafe, pizza, burger, milkshake, order online, rohtak',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Gannamasti Cafe',
  },
  openGraph: {
    title: 'Gannamasti Cafe',
    description: 'Where fast food becomes healthy and fresh. Wholesome ingredients prepared fresh everyday.',
    url: 'https://gannamasticafe.in',
    siteName: 'Gannamasti Cafe',
    locale: 'en_IN',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSerif.variable} ${dmSans.variable}`}>
      <body className="bg-cream font-sans text-cocoa antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#FAF7F2',
              color: '#4A3728',
              border: '1px solid #E8E0D5',
              borderRadius: '12px',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 8px 32px rgba(74,55,40,0.12)',
            },
            success: {
              iconTheme: { primary: '#3D6B4F', secondary: '#FAF7F2' },
            },
            error: {
              iconTheme: { primary: '#C17B2F', secondary: '#FAF7F2' },
            },
          }}
        />
      </body>
    </html>
  )
}
