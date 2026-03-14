'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Mission Control', href: '/monitor', icon: '📡' },
  { label: 'Connections', href: '/connections', icon: '🔗' },
  { label: 'Budget', href: '/budget', icon: '💰' },
  { label: 'Jobs', href: '/jobs', icon: '⚡' },
  { label: 'Security', href: '/security', icon: '🛡️' },
  { label: 'Intelligence', href: '/intelligence', icon: '🧠' },
  { label: 'Agents', href: '/agents', icon: '🤖' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-dc1-void text-dc1-text-primary flex">
      {/* Sidebar */}
      <aside className="w-56 bg-dc1-surface-l1 border-r border-dc1-border p-4 flex flex-col gap-1">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-dc1-amber">DC1 Mission Control</h1>
          <span className="text-xs text-dc1-text-muted">Internal Dashboard</span>
        </div>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/monitor' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-dc1-amber/10 text-dc1-amber'
                  : 'text-dc1-text-secondary hover:text-dc1-text-primary hover:bg-dc1-surface-l2'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Admin shortcuts */}
        <div className="mt-auto pt-4 border-t border-dc1-border">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-dc1-text-muted hover:text-dc1-text-primary hover:bg-dc1-surface-l2 transition-colors"
          >
            <span>🔧</span>
            Admin Panel
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-dc1-text-muted hover:text-dc1-text-primary hover:bg-dc1-surface-l2 transition-colors"
          >
            <span>🏠</span>
            Back to Home
          </Link>
        </div>
      </aside>
      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
