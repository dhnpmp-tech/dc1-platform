'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LanguageToggle, useLanguage } from '../../lib/i18n'

export interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: boolean
}

interface DashboardSidebarProps {
  navItems: NavItem[]
  role: 'provider' | 'renter' | 'admin'
  userName?: string
}

export default function DashboardSidebar({ navItems, role, userName }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t, isRTL } = useLanguage()

  const roleLabels = {
    provider: t('sidebar.provider_label'),
    renter: t('sidebar.renter_label'),
    admin: t('sidebar.admin_label'),
  }

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === `/${role}`
    return pathname.startsWith(href)
  }

  const sidebarContent = (
    <>
      {/* Logo & Role */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-dc1-border">
        <Link href="/" className="shrink-0">
          <img
            src="/logo.svg"
            alt="DCP."
            className="h-8 w-auto"
          />
        </Link>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs text-dc1-amber truncate">{roleLabels[role]}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 group ${
              isActive(item.href)
                ? 'bg-dc1-amber/10 text-dc1-amber border-l-2 rtl:border-l-0 rtl:border-r-2 border-dc1-amber -ml-px rtl:ml-0 rtl:-mr-px'
                : 'text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0 w-5 h-5 flex items-center justify-center relative">
              {item.icon}
              {item.badge && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-dc1-amber rounded-full" aria-label="alert" />
              )}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge && (
              <span className="ml-auto w-2 h-2 bg-dc1-amber rounded-full shrink-0" aria-hidden="true" />
            )}
          </Link>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-dc1-border px-4 py-4">
        {!collapsed && (
          <div className="mb-3">
            <LanguageToggle className="w-full justify-center" />
          </div>
        )}
        {!collapsed && userName && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-dc1-amber/20 flex items-center justify-center text-dc1-amber text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-dc1-text-primary truncate">{userName}</p>
              <p className="text-xs text-dc1-text-muted capitalize">{role}</p>
            </div>
          </div>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-dc1-text-muted hover:text-dc1-text-secondary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span>{t('common.sign_out')}</span>}
        </Link>
      </div>
    </>
  )

  // RTL-aware sidebar position and slide direction
  const sidebarPositionClass = isRTL ? 'right-0' : 'left-0'
  const sidebarSlideClass = isRTL
    ? mobileOpen ? 'translate-x-0' : 'translate-x-full'
    : mobileOpen ? 'translate-x-0' : '-translate-x-full'

  // RTL-aware collapse button position and chevron rotation
  const collapseButtonPositionClass = isRTL ? '-left-3' : '-right-3'
  const chevronRotateClass = isRTL
    ? collapsed ? '' : 'rotate-180'
    : collapsed ? 'rotate-180' : ''

  return (
    <>
      {/* Mobile topbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-dc1-void/95 backdrop-blur-md border-b border-dc1-border h-14 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/logo.svg" alt="DCP." className="h-7" />
        <span className="text-sm font-semibold text-dc1-amber">{roleLabels[role]}</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 ${sidebarPositionClass} z-50 h-screen bg-dc1-surface-l1
          ${isRTL ? 'border-l' : 'border-r'} border-dc1-border
          flex flex-col transition-all duration-300
          ${sidebarSlideClass}
          lg:translate-x-0 lg:static lg:z-auto
          ${collapsed ? 'w-16' : 'w-64'}
        `}
      >
        {sidebarContent}

        {/* Collapse toggle - desktop only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden lg:flex absolute ${collapseButtonPositionClass} top-20 w-6 h-6 bg-dc1-surface-l2 border border-dc1-border rounded-full items-center justify-center text-dc1-text-muted hover:text-dc1-text-primary hover:bg-dc1-surface-l3 transition-colors`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-3 h-3 transition-transform ${chevronRotateClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </aside>
    </>
  )
}
