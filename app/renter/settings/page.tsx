'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/app/components/layout/DashboardLayout'

const API_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api/dc1'
    : 'http://76.13.179.86:8083/api'

interface RenterInfo {
  id: number
  name: string
  email: string
  organization: string
  balance_halala: number
  total_spent_halala: number
  total_jobs: number
  created_at: string
}

// Nav icons
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 11l4-4m0 0l4 4m-4-4V5" />
  </svg>
)
const MarketplaceIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
)
const TemplatesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
  </svg>
)
const JobsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)
const BillingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m4 0h1M9 19h6a2 2 0 002-2V5a2 2 0 00-2-2H9a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
const PlaygroundIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)
const GearIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const navItems = [
  { label: 'Dashboard', href: '/renter', icon: <HomeIcon /> },
  { label: 'Marketplace', href: '/renter/marketplace', icon: <MarketplaceIcon /> },
  { label: 'Templates', href: '/renter/templates', icon: <TemplatesIcon /> },
  { label: 'Playground', href: '/renter/playground', icon: <PlaygroundIcon /> },
  { label: 'My Jobs', href: '/renter/jobs', icon: <JobsIcon /> },
  { label: 'Billing', href: '/renter/billing', icon: <BillingIcon /> },
  { label: 'Analytics', href: '/renter/analytics', icon: <ChartIcon /> },
  { label: 'Settings', href: '/renter/settings', icon: <GearIcon /> },
]

export default function RenterSettingsPage() {
  const router = useRouter()
  const [renter, setRenter] = useState<RenterInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)

  useEffect(() => {
    const key = localStorage.getItem('dc1_renter_key')
    if (!key) {
      router.push('/login')
      return
    }
    setApiKey(key)

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(key)}`)
        if (!res.ok) {
          localStorage.removeItem('dc1_renter_key')
          router.push('/login')
          return
        }
        const data = await res.json()
        setRenter(data.renter || null)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [router])

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRotateKey = async () => {
    setRotating(true)
    try {
      const res = await fetch(`${API_BASE}/renters/rotate-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-renter-key': apiKey,
        },
      })
      if (!res.ok) throw new Error('Failed to rotate key')
      const data = await res.json()
      const newKey = data.api_key
      localStorage.setItem('dc1_renter_key', newKey)
      setApiKey(newKey)
      setShowKey(true)
      setRotateConfirm(false)
    } catch (err) {
      console.error('Key rotation failed:', err)
      alert('Failed to rotate API key. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('dc1_renter_key')
    window.location.href = '/'
  }

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-dc1-amber border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (!renter) {
    return (
      <DashboardLayout navItems={navItems} role="renter" userName="Renter">
        <div className="card p-8 text-center">
          <p className="text-dc1-text-secondary">Failed to load account info</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout navItems={navItems} role="renter" userName={renter.name}>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-dc1-text-primary">Settings</h1>
          <p className="text-dc1-text-secondary text-sm mt-1">Manage your account and API access</p>
        </div>

        {/* Profile */}
        <div className="card p-6 space-y-4">
          <h2 className="section-heading">Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-dc1-text-muted block mb-1">Name</label>
              <div className="text-dc1-text-primary font-medium">{renter.name}</div>
            </div>
            <div>
              <label className="text-xs text-dc1-text-muted block mb-1">Email</label>
              <div className="text-dc1-text-primary">{renter.email}</div>
            </div>
            <div>
              <label className="text-xs text-dc1-text-muted block mb-1">Organization</label>
              <div className="text-dc1-text-primary">{renter.organization || '—'}</div>
            </div>
            <div>
              <label className="text-xs text-dc1-text-muted block mb-1">Member Since</label>
              <div className="text-dc1-text-primary">
                {renter.created_at ? new Date(renter.created_at).toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Account Stats */}
        <div className="card p-6 space-y-4">
          <h2 className="section-heading">Account Summary</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-dc1-surface-l2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-dc1-amber">{((renter.balance_halala || 0) / 100).toFixed(2)} SAR</div>
              <div className="text-xs text-dc1-text-muted">Balance</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-dc1-text-primary">{((renter.total_spent_halala || 0) / 100).toFixed(2)} SAR</div>
              <div className="text-xs text-dc1-text-muted">Total Spent</div>
            </div>
            <div className="bg-dc1-surface-l2 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-dc1-text-primary">{renter.total_jobs || 0}</div>
              <div className="text-xs text-dc1-text-muted">Jobs Run</div>
            </div>
          </div>
        </div>

        {/* API Key Management */}
        <div className="card p-6 space-y-4">
          <h2 className="section-heading">API Key</h2>
          <p className="text-dc1-text-muted text-sm">
            Your API key is used to authenticate requests to the DC1 Platform.
          </p>

          {/* Key display */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-dc1-surface-l2 border border-dc1-border rounded-lg px-4 py-3 font-mono text-sm text-dc1-text-primary overflow-hidden">
              {showKey ? apiKey : `${apiKey.slice(0, 12)}${'•'.repeat(20)}`}
            </div>
            <button
              onClick={() => setShowKey(!showKey)}
              className="btn btn-outline text-sm px-3"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={copyApiKey}
              className="btn btn-secondary text-sm px-3"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Rotate Key */}
          <div className="border-t border-dc1-border pt-4">
            {!rotateConfirm ? (
              <button
                onClick={() => setRotateConfirm(true)}
                className="text-sm text-status-warning hover:text-status-warning/80 font-medium transition"
              >
                Rotate API Key
              </button>
            ) : (
              <div className="bg-status-warning/5 border border-status-warning/20 rounded-lg p-4 space-y-3">
                <p className="text-sm text-dc1-text-primary">
                  Are you sure? This will invalidate your current key immediately. Any applications using the old key will stop working.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRotateKey}
                    disabled={rotating}
                    className="btn btn-primary text-sm disabled:opacity-50"
                  >
                    {rotating ? 'Rotating...' : 'Confirm Rotate'}
                  </button>
                  <button
                    onClick={() => setRotateConfirm(false)}
                    className="btn btn-outline text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
