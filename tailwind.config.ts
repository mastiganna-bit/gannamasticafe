import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Gannamasti Design System
        cream: {
          DEFAULT: '#FAF7F2',
          50: '#FEFDFB',
          100: '#FAF7F2',
          200: '#F0EAE0',
          300: '#E8E0D5',
        },
        sage: {
          DEFAULT: '#3D6B4F',
          light: '#7A9E7E',
          dark: '#2D5040',
        },
        cocoa: {
          DEFAULT: '#4A3728',
          light: '#6B5344',
          muted: '#9B8577',
        },
        amber: {
          cafe: '#C17B2F',
          light: '#D4944A',
          pale: '#F0D4A8',
        },
        linen: '#E8E0D5',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        display: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 2px 16px rgba(74, 55, 40, 0.08)',
        'card-hover': '0 8px 32px rgba(74, 55, 40, 0.14)',
        'modal': '0 24px 64px rgba(74, 55, 40, 0.18)',
      },
      borderRadius: {
        'xl2': '1rem',
        'xl3': '1.5rem',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
}

export default config
