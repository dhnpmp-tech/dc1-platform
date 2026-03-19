'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LanguageToggle } from '../../lib/i18n'

const publicNav = [
  { label: 'Compute', href: '/renter/register' },
  { label: 'Supply', href: '/provider/register' },
  { label: 'Docs', href: '/docs' },
]

export default function Header() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 bg-dc1-void/95 backdrop-blur-md border-b border-dc1-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img
              src="https://dc1st.com/assets/dc1-logo-Z67caTEl.webp"
              alt="DC1"
              className="h-9 w-auto"
            />
            <span className="text-lg font-bold text-dc1-text-primary hidden sm:block">
              DC1
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {publicNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  isActive(item.href)
                    ? 'text-dc1-amber bg-dc1-amber/10'
                    : 'text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side: Language toggle + Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageToggle />
            <Link href="/login" className="btn btn-secondary btn-sm">
              Console Login
            </Link>
            <Link href="/provider/register" className="btn btn-primary btn-sm">
              Get Early Access
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-dc1-border py-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {publicNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-md text-sm font-medium ${
                    isActive(item.href)
                      ? 'text-dc1-amber bg-dc1-amber/10'
                      : 'text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-dc1-border px-4">
              <LanguageToggle className="self-start" />
              <Link href="/login" className="btn btn-secondary text-center">Console Login</Link>
              <Link href="/provider/register" className="btn btn-primary text-center">Get Early Access</Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
