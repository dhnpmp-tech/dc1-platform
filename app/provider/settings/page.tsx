'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/layout/DashboardLayout'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 5v14a1 1 0 001 1h12a1 1 0 001-1V5m-9 9h4" />
  </svg>
)
const LightningIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const CurrencyIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/provider', icon: <HomeIcon /> },
  { label: 'Jobs', href: '/provider/jobs', icon: <LightningIcon /> },
  { label: 'Earnings', href: '/provider/earnings', icon: <CurrencyIcon /> },
  { label: 'Settings', href: '/provider/settings', icon: <GearIcon /> },
]

interface ProviderInfo {
  id: number
  name: string
  email: string
  gpu_model: string
  status: string
  api_key: string
  created_at: string
}

export default function ProviderSettingsPage() {
  const router = useRouter()
  const [provider, setProvider] = useState<ProviderInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const apiKey = localStorage.getItem('dc1_provider_key')
    if (!apiKey) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey)}`)
        if (!res.ok) {
          localStorage.removeItem('dc1_provider_key')
          router.push('/login')
          return
        }
        const data = await res.json()
        setProvider({
          ...data.provider,
          api_key: apiKey,
        })
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [router])

  const copyApiKey = () => {
    if (!provider) return
    navigator.clipboard.writeText(provider.api_key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = () => {
    localStorage.removeItem('dc1_provider_key')
    localStorage.removeItem('dc1_user_data')
    window.location.href = '/'
  }

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="provider" userName="Provider">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems} role="provider" userName={provider?.name || 'Provider'}>
      <div className="space-y-8 max-w-2xl">
        <h1 className="text-3xl font-bold text-dc1-text-primary">Settings</h1>

        {/* Account Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-dc1-text-primary">Account Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-dc1-border/30">
              <span className="text-sm text-dc1-text-secondary">Name</span>
              <span className="text-sm text-dc1-text-primary font-medium">{provider?.name || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dc1-border/30">
              <span className="text-sm text-dc1-text-secondary">Email</span>
              <span className="text-sm text-dc1-text-primary">{provider?.email || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dc1-border/30">
              <span className="text-sm text-dc1-text-secondary">GPU Model</span>
              <span className="text-sm text-dc1-text-primary">{provider?.gpu_model || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dc1-border/30">
              <span className="text-sm text-dc1-text-secondary">Status</span>
              <span className={`text-sm font-medium ${provider?.status === 'online' ? 'text-status-success' : 'text-dc1-text-secondary'}`}>
                {provider?.status || '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-dc1-border/30">
              <span className="text-sm text-dc1-text-secondary">Provider ID</span>
              <span className="text-sm text-dc1-text-primary font-mono">{provider?.id || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-dc1-text-secondary">Member Since</span>
              <span className="text-sm text-dc1-text-primary">
                {provider?.created_at ? new Date(provider.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* API Key */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-dc1-text-primary">API Key</h2>
          <p className="text-sm text-dc1-text-secondary">
            Your API key is used to authenticate your daemon with the DC1 platform.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-dc1-amber bg-dc1-surface-l3 border border-dc1-border rounded-lg p-3 break-all">
              {showKey ? provider?.api_key : '••••••••••••••••••••••••••••••••'}
            </code>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowKey(!showKey)}
                className="btn btn-secondary btn-sm"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copyApiKey}
                className="btn btn-secondary btn-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card p-6 border-status-error/20 space-y-4">
          <h2 className="text-lg font-semibold text-status-error">Account Actions</h2>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg border border-status-error/30 text-status-error text-sm font-medium hover:bg-status-error/10 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
