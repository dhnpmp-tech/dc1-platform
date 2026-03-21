'use client'

import DashboardSidebar, { NavItem } from './DashboardSidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  navItems: NavItem[]
  role: 'provider' | 'renter' | 'admin'
  userName?: string
}

export default function DashboardLayout({ children, navItems, role, userName }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <DashboardSidebar navItems={navItems} role={role} userName={userName} />
      <main className="flex-1 lg:ml-0 mt-14 lg:mt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
