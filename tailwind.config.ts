import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dc-gold': '#FFD700',
        'dc-cyan': '#00D9FF',
        'dc-black': '#0a0a0a',
      },
    },
  },
  plugins: [],
}
export default config
