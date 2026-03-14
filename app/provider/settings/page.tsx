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
  const [rotating, setRotating] = useState(false)
  const [rotateConfirm, setRotateConfirm] = useState(false)
  const [prefs, setPrefs] = useState({
    run_mode: 'always-on',
    scheduled_start: '23:00',
    scheduled_end: '07:00',
    gpu_usage_cap_pct: 80,
    vram_reserve_gb: 1,
    temp_limit_c: 85,
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsSaved, setPrefsSaved] = useState(false)

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
        const p = data.provider
        setProvider({
          ...p,
          api_key: apiKey,
        })
        setPrefs({
          run_mode: p.run_mode || 'always-on',
          scheduled_start: p.scheduled_start || '23:00',
          scheduled_end: p.scheduled_end || '07:00',
          gpu_usage_cap_pct: p.gpu_usage_cap_pct != null ? p.gpu_usage_cap_pct : 80,
          vram_reserve_gb: p.vram_reserve_gb != null ? p.vram_reserve_gb : 1,
          temp_limit_c: p.temp_limit_c != null ? p.temp_limit_c : 85,
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

  const handleRotateKey = async () => {
    if (!provider) return
    setRotating(true)
    try {
      const res = await fetch(`${API_BASE}/providers/rotate-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-provider-key': provider.api_key,
        },
      })
      if (!res.ok) throw new Error('Failed to rotate key')
      const data = await res.json()
      const newKey = data.api_key
      localStorage.setItem('dc1_provider_key', newKey)
      setProvider({ ...provider, api_key: newKey })
      setShowKey(true)
      setRotateConfirm(false)
    } catch (err) {
      console.error('Key rotation failed:', err)
      alert('Failed to rotate API key. Please try again.')
    } finally {
      setRotating(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!provider) return
    setSavingPrefs(true)
    setPrefsSaved(false)
    try {
      const res = await fetch(`${API_BASE}/providers/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: provider.api_key, ...prefs }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to save preferences')
        return
      }
      setPrefsSaved(true)
      setTimeout(() => setPrefsSaved(false), 3000)
    } catch (err) {
      console.error('Save preferences failed:', err)
      alert('Failed to save preferences. Please try again.')
    } finally {
      setSavingPrefs(false)
    }
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
          <div className="mt-4 pt-4 border-t border-dc1-border/30">
            {!rotateConfirm ? (
              <button
                onClick={() => setRotateConfirm(true)}
                className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors"
              >
                Rotate API Key
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-status-error">
                  This will invalidate your current key. Your daemon will need to be reconfigured with the new key.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRotateKey}
                    disabled={rotating}
                    className="px-3 py-1.5 rounded text-sm font-medium bg-status-error/20 text-status-error hover:bg-status-error/30 transition disabled:opacity-50"
                  >
                    {rotating ? 'Rotating...' : 'Confirm Rotate'}
                  </button>
                  <button
                    onClick={() => setRotateConfirm(false)}
                    className="px-3 py-1.5 rounded text-sm text-dc1-text-secondary hover:text-dc1-text-primary transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GPU Preferences */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-dc1-text-primary">GPU Preferences</h2>
            {prefsSaved && <span className="text-sm text-status-success font-medium">Saved!</span>}
          </div>

          {/* Run Mode */}
          <div>
            <label className="text-sm text-dc1-text-secondary mb-2 block">Run Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {(['always-on', 'scheduled', 'manual'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setPrefs({ ...prefs, run_mode: mode })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    prefs.run_mode === mode
                      ? 'border-dc1-amber bg-dc1-amber/10 text-dc1-amber'
                      : 'border-dc1-border bg-dc1-surface-l2 text-dc1-text-secondary hover:border-dc1-amber/30'
                  }`}
                >
                  {mode === 'always-on' ? 'Always On' : mode === 'scheduled' ? 'Scheduled' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule (only if scheduled mode) */}
          {prefs.run_mode === 'scheduled' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-dc1-text-secondary mb-1 block">Start Time</label>
                <input
                  type="time"
                  value={prefs.scheduled_start}
                  onChange={e => setPrefs({ ...prefs, scheduled_start: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-sm text-dc1-text-secondary mb-1 block">End Time</label>
                <input
                  type="time"
                  value={prefs.scheduled_end}
                  onChange={e => setPrefs({ ...prefs, scheduled_end: e.target.value })}
                  className="input"
                />
              </div>
            </div>
          )}

          {/* GPU Usage Cap */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm text-dc1-text-secondary">GPU Usage Cap</label>
              <span className="text-sm font-semibold text-dc1-text-primary">{prefs.gpu_usage_cap_pct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={prefs.gpu_usage_cap_pct}
              onChange={e => setPrefs({ ...prefs, gpu_usage_cap_pct: Number(e.target.value) })}
              className="w-full accent-dc1-amber"
            />
            <div className="flex justify-between text-xs text-dc1-text-muted mt-1">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          {/* VRAM Reserve */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm text-dc1-text-secondary">VRAM Reserve</label>
              <span className="text-sm font-semibold text-dc1-text-primary">{prefs.vram_reserve_gb} GB</span>
            </div>
            <input
              type="range"
              min={0}
              max={16}
              step={0.5}
              value={prefs.vram_reserve_gb}
              onChange={e => setPrefs({ ...prefs, vram_reserve_gb: Number(e.target.value) })}
              className="w-full accent-dc1-amber"
            />
            <p className="text-xs text-dc1-text-muted mt-1">Amount of VRAM to keep free for your own use</p>
          </div>

          {/* Temperature Limit */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-sm text-dc1-text-secondary">Temperature Limit</label>
              <span className={`text-sm font-semibold ${prefs.temp_limit_c >= 90 ? 'text-status-error' : prefs.temp_limit_c >= 80 ? 'text-status-warning' : 'text-dc1-text-primary'}`}>
                {prefs.temp_limit_c}°C
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={100}
              step={1}
              value={prefs.temp_limit_c}
              onChange={e => setPrefs({ ...prefs, temp_limit_c: Number(e.target.value) })}
              className="w-full accent-dc1-amber"
            />
            <p className="text-xs text-dc1-text-muted mt-1">Daemon will throttle jobs if GPU exceeds this temperature</p>
          </div>

          <button
            onClick={handleSavePreferences}
            disabled={savingPrefs}
            className="btn btn-primary w-full disabled:opacity-50"
          >
            {savingPrefs ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>

        {/* Notification Preferences */}
        <div className="card p-6 space-y-5">
          <div>
            <h2 className="section-heading">Notification Preferences</h2>
            <p className="text-dc1-text-muted text-sm mt-1">Choose what alerts you want to receive</p>
          </div>

          {[
            { key: 'job_completed', label: 'Job Completed', desc: 'Get notified when a job finishes on your GPU' },
            { key: 'job_failed', label: 'Job Failed', desc: 'Alert when a job fails or errors out' },
            { key: 'earnings_milestone', label: 'Earnings Milestones', desc: 'Celebrate when you hit earning targets' },
            { key: 'daemon_offline', label: 'Daemon Offline', desc: 'Warning when your daemon loses connection' },
            { key: 'gpu_temp_warning', label: 'GPU Temperature Warning', desc: 'Alert when GPU exceeds safe temperature' },
            { key: 'withdrawal_processed', label: 'Withdrawal Processed', desc: 'Confirmation when a withdrawal completes' },
          ].map(item => (
            <label key={item.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={item.key !== 'earnings_milestone'}
                className="mt-1 w-4 h-4 rounded border-dc1-border bg-dc1-surface-l2 accent-dc1-amber"
              />
              <div>
                <span className="text-sm font-medium text-dc1-text-primary">{item.label}</span>
                <p className="text-xs text-dc1-text-muted">{item.desc}</p>
              </div>
            </label>
          ))}

          <p className="text-xs text-dc1-text-muted border-t border-dc1-border pt-3">
            Email notifications will be sent to your registered email address. More notification channels coming soon.
          </p>
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
