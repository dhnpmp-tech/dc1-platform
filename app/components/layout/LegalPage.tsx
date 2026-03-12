import Link from 'next/link'
import Footer from './Footer'

interface LegalPageProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-dc1-void">
      {/* Header */}
      <header className="bg-dc1-surface-l1 border-b border-dc1-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="https://dc1st.com/assets/dc1-logo-Z67caTEl.webp" alt="DC1" className="h-8 w-auto" />
            <span className="text-lg font-bold text-dc1-text-primary">DC1</span>
          </Link>
          <Link href="/login" className="text-sm text-dc1-amber hover:underline">Sign In</Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">{title}</h1>
        <p className="text-sm text-dc1-text-muted mb-8">Last updated: {lastUpdated}</p>
        <div className="prose prose-invert max-w-none [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-dc1-text-primary [&_h2]:mt-8 [&_h2]:mb-4 [&_p]:text-dc1-text-secondary [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-dc1-text-secondary [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_li]:mb-2 [&_a]:text-dc1-amber [&_a:hover]:underline [&_strong]:text-dc1-text-primary">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}
