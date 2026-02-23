import type { Metadata } from 'next'

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
      <head>
        <style>{`
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          
          body {
            background: #1a1a1a;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.5;
          }
          
          html, body {
            width: 100%;
            height: 100%;
          }
        `}</style>
      </head>
      <body style={{ background: '#1a1a1a', color: 'white' }}>
        {children}
      </body>
    </html>
  )
}
