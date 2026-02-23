'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: '🏠' },
  { label: 'Connections', href: '/connections', icon: '🔗' },
  { label: 'Token Usage', href: '/tokens', icon: '🪙' },
  { label: 'Jobs', href: '/jobs', icon: '⚡' },
  { label: 'Security', href: '/security', icon: '🛡️' },
  { label: 'Agents', href: '/agents', icon: '🤖' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#161b22] border-r border-[#30363d] p-4 flex flex-col gap-1">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-[#00d4ff]">DC1 Mission Control</h1>
          <span className="text-xs text-gray-500">Gate 0 — Live</span>
        </div>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-[#00d4ff]/10 text-[#00d4ff]'
                  : 'text-gray-400 hover:text-white hover:bg-[#21262d]'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </aside>
      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
