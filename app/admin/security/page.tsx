'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'
import StatCard from '@/app/components/ui/StatCard'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

const HomeIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M9 21h6a2 2 0 002-2V9l-7-4-7 4v10a2 2 0 002 2z" /></svg>)
const ServerIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>)
const UsersIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>)
const BriefcaseIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>)
const ShieldIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>)
const CpuIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>)
const CurrencyIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>)
const WalletIcon = () => (<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>)

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: <HomeIcon /> },
  { label: 'Providers', href: '/admin/providers', icon: <ServerIcon /> },
  { label: 'Renters', href: '/admin/renters', icon: <UsersIcon /> },
  { label: 'Jobs', href: '/admin/jobs', icon: <BriefcaseIcon /> },
  { label: 'Finance', href: '/admin/finance', icon: <CurrencyIcon /> },
  { label: 'Withdrawals', href: '/admin/withdrawals', icon: <WalletIcon /> },
  { label: 'Security', href: '/admin/security', icon: <ShieldIcon /> },
  { label: 'Fleet Health', href: '/admin/fleet', icon: <CpuIcon /> },
]

interface SecurityEvent {
  id: number
  timestamp: string
  event_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  provider_id?: number
  provider_name?: string
  details: string
}

interface SecuritySummary {
  total_events: number
  high_severity: number
  medium_severity: number
  flagged_providers: number
}

export default function SecurityPage() {
  const router = useRouter()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [summary, setSummary] = useState<SecuritySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const token = typeof window !== 'undefined' ? localStorage.getItem('dc1_admin_token') : null

  useEffect(() => {
    if (!token) { router.push('/login'); return }
    fetchSecurityData()
    const interval = setInterval(fetchSecurityData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      const [eventsRes, summaryRes] = await Promise.all([
        fetch(`${API_BASE}/admin/security/events?limit=50`, { headers: { 'x-admin-token': token || '' } }),
        fetch(`${API_BASE}/admin/security/summary`, { headers: { 'x-admin-token': token || '' } })
      ])

      if (eventsRes.status === 401 || summaryRes.status === 401) {
        localStorage.removeItem('dc1_admin_token')
        router.push('/login')
        return
      }

      const eventsJson = await eventsRes.json()
      const summaryJson = await summaryRes.json()

      setEvents(Array.isArray(eventsJson) ? eventsJson : eventsJson.events || [])
      setSummary(summaryJson)
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'bg-red-600/20 text-red-400'
      case 'medium':
      case 'warning':
        return 'bg-yellow-600/20 text-yellow-400'
      case 'low':
      case 'info':
        return 'bg-green-600/20 text-green-400'
      default:
        return 'bg-gray-600/20 text-gray-400'
    }
  }

  const formatTime = (iso: string) => {
    if (!iso) return 'Unknown'
    const date = new Date(iso)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <DashboardLayout navItems={navItems} role="admin" userName="Admin">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-dc1-text-primary mb-2">Security & Audit Log</h1>
        <p className="text-dc1-text-secondary">
          Monitor security events and system activity
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Events" value={String(summary?.total_events ?? 0)} accent="info" />
        <StatCard label="High Severity" value={String(summary?.high_severity ?? 0)} accent="error" />
        <StatCard label="Medium Severity" value={String(summary?.medium_severity ?? 0)} accent="amber" />
        <StatCard label="Flagged Providers" value={String(summary?.flagged_providers ?? 0)} accent="default" />
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="text-dc1-text-secondary">Loading security events...</div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Severity</th>
                  <th>Provider</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: SecurityEvent) => (
                  <tr key={event.id}>
                    <td className="text-sm text-dc1-text-secondary">{formatTime(event.timestamp)}</td>
                    <td className="text-sm font-medium">{event.event_type}</td>
                    <td>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSeverityColor(event.severity)}`}>
                        {event.severity?.charAt(0).toUpperCase() + event.severity?.slice(1) || 'Unknown'}
                      </span>
                    </td>
                    <td className="text-sm">{event.provider_name || event.provider_id || '—'}</td>
                    <td className="text-sm text-dc1-text-secondary max-w-xs truncate">{event.details}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr><td colSpan={5} className="text-dc1-text-muted text-sm text-center">No security events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
