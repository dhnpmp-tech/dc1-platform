import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DC1 Platform - GPU Compute Marketplace',
  description: 'Power, Digitalized. Connect GPU providers and renters on the transparent, reliable GPU compute marketplace.',
  icons: {
    icon: 'https://dc1st.com/assets/dc1-logo-Z67caTEl.webp',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Tajawal:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-inter bg-dc1-void text-dc1-text-primary antialiased">
        {children}
      </body>
    </html>
  )
}
