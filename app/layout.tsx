import type { Metadata } from 'next'
import './globals.css'
import { LanguageWrapper } from './lib/i18n'
import CookieConsent from './components/ui/CookieConsent'

export const metadata: Metadata = {
  title: 'DCP — GPU Compute Marketplace',
  description: 'Power, Digitalized. Connect GPU providers and renters on the transparent, reliable GPU compute marketplace.',
  icons: {
    icon: '/logo.svg',
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
        <LanguageWrapper>
          {children}
          <CookieConsent />
        </LanguageWrapper>
      </body>
    </html>
  )
}
