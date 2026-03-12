import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        dc1: {
          void: '#07070E',
          'surface-l1': '#090E1A',
          'surface-l2': '#0F1B2E',
          'surface-l3': '#1E293B',
          amber: '#F5A524',
          'amber-hover': '#E6961B',
          'amber-light': '#F5A524',
          'text-primary': '#F0F0F0',
          'text-secondary': '#8E96A4',
          'text-muted': '#64748B',
          'section-blue': '#0F2A4A',
          'border': '#1E293B',
          'border-light': '#334155',
        },
        status: {
          success: '#22C55E',
          'success-bg': 'rgba(34, 197, 94, 0.1)',
          error: '#EF4444',
          'error-bg': 'rgba(239, 68, 68, 0.1)',
          warning: '#F5A524',
          'warning-bg': 'rgba(245, 165, 36, 0.1)',
          info: '#38BDF8',
          'info-bg': 'rgba(56, 189, 248, 0.1)',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        plex: ['IBM Plex Sans Arabic', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'xs': '0.25rem',
        'sm-space': '0.5rem',
        'md-space': '1rem',
        'lg-space': '1.5rem',
        'xl-space': '2rem',
        '2xl-space': '3rem',
        '3xl-space': '4rem',
      },
      borderRadius: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.05)',
        'md': '0 4px 6px rgba(0,0,0,0.1)',
        'lg': '0 10px 15px rgba(0,0,0,0.1)',
        'xl': '0 20px 25px rgba(0,0,0,0.15)',
        'amber': '0 0 20px rgba(245, 165, 36, 0.15)',
        'amber-lg': '0 0 40px rgba(245, 165, 36, 0.2)',
      },
      screens: {
        'xs': '0px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms cubic-bezier(0.45, 0, 0.55, 1) forwards',
        'slide-up': 'slideUp 300ms cubic-bezier(0.65, 0, 0.35, 1) forwards',
        'slide-in-right': 'slideInRight 300ms cubic-bezier(0.65, 0, 0.35, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
