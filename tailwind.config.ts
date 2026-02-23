import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dc-black': '#1a1a1a',
        'dc-gold': '#FFD700',
        'dc-cyan': '#00A8E1',
      },
    },
  },
  plugins: [],
}
export default config
