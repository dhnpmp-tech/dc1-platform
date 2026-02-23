import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DC1 Platform - GPU Rental Network',
  description: 'Provider, Renter, and Admin Dashboards for DC1 GPU Marketplace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
