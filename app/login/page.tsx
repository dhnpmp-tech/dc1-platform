'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import { useLanguage } from '../lib/i18n'

const API_BASE = '/api/dc1'

type Role = 'provider' | 'renter' | 'admin'
type LoginMethod = 'email' | 'apikey'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [role, setRole] = useState<Role>('renter')
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (loginMethod === 'email') {
        // Email-based login
        if (!email.trim()) {
          setError(t('login.enter_email'))
          setIsLoading(false)
          return
        }

        if (role === 'admin') {
          setError(t('login.admin_needs_key'))
          setIsLoading(false)
          return
        }

        const endpoint = role === 'renter' ? 'renters/login-email' : 'providers/login-email'
        const res = await fetch(`${API_BASE}/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
          redirect: 'follow',
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          let errorMsg = 'Login failed'
          try {
            if (text && !text.startsWith('<!')) {
              const data = JSON.parse(text)
              errorMsg = data.error || 'Login failed'
            }
          } catch {}
          throw new Error(errorMsg)
        }

        const data = await res.json()
        if (!data.success || !data.api_key) throw new Error('Login failed')

        if (role === 'renter') {
          localStorage.setItem('dc1_renter_key', data.api_key)
          localStorage.setItem('dc1_user_data', JSON.stringify({
            role: 'renter',
            userName: data.renter?.name,
            email: data.renter?.email,
          }))
          router.push('/renter')
        } else {
          localStorage.setItem('dc1_provider_key', data.api_key)
          localStorage.setItem('dc1_user_data', JSON.stringify({
            role: 'provider',
            userName: data.provider?.name,
            email: data.provider?.email,
          }))
          router.push('/provider')
        }

      } else {
        // API key-based login (original flow)
        if (!apiKey.trim()) {
          setError(t('login.enter_key'))
          setIsLoading(false)
          return
        }

        if (role === 'renter') {
          const res = await fetch(`${API_BASE}/renters/me?key=${encodeURIComponent(apiKey.trim())}`)
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'Invalid API key')
          }
          const data = await res.json()
          if (!data.renter) throw new Error('Renter not found')

          localStorage.setItem('dc1_renter_key', apiKey.trim())
          localStorage.setItem('dc1_user_data', JSON.stringify({
            role: 'renter',
            userName: data.renter.name,
            email: data.renter.email,
          }))
          router.push('/renter')

        } else if (role === 'provider') {
          const res = await fetch(`${API_BASE}/providers/me?key=${encodeURIComponent(apiKey.trim())}`)
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'Invalid API key')
          }
          const data = await res.json()
          if (!data.provider) throw new Error('Provider not found')

          localStorage.setItem('dc1_provider_key', apiKey.trim())
          localStorage.setItem('dc1_user_data', JSON.stringify({
            role: 'provider',
            userName: data.provider.name,
            email: data.provider.email,
          }))
          router.push('/provider')

        } else if (role === 'admin') {
          const res = await fetch(`${API_BASE}/admin/dashboard`, {
            headers: { 'x-admin-token': apiKey.trim() },
          })
          if (!res.ok) throw new Error('Invalid admin key')

          localStorage.setItem('dc1_admin_token', apiKey.trim())
          localStorage.setItem('dc1_user_data', JSON.stringify({
            role: 'admin',
            userName: 'Admin',
          }))
          router.push('/admin')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-dc1-void">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="card border-dc1-border/50 shadow-lg">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img
                src="/logo.svg"
                alt="DCP"
                className="h-12 w-auto"
              />
            </div>

            <h1 className="text-2xl font-bold text-dc1-text-primary text-center mb-2">
              {t('auth.sign_in')}
            </h1>
            <p className="text-sm text-dc1-text-secondary text-center mb-6">
              {t('login.sign_in_desc')}
            </p>

            {/* Login Method Toggle */}
            <div className="mb-6">
              <div className="flex rounded-lg border border-dc1-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setLoginMethod('email'); setError('') }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    loginMethod === 'email'
                      ? 'bg-dc1-amber text-dc1-void'
                      : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                  }`}
                >
                  {t('login.email')}
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod('apikey'); setError('') }}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                    loginMethod === 'apikey'
                      ? 'bg-dc1-amber text-dc1-void'
                      : 'bg-dc1-surface-l2 text-dc1-text-secondary hover:text-dc1-text-primary'
                  }`}
                >
                  {t('login.api_key')}
                </button>
              </div>
            </div>

            {/* Role Selector */}
            <div className="mb-6">
              <label className="label">{t('login.account_type')}</label>
              <div className="flex gap-3">
                {(loginMethod === 'email' ? ['renter', 'provider'] as const : ['renter', 'provider', 'admin'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="radio"
                      value={r}
                      checked={role === r}
                      onChange={(e) => setRole(e.target.value as Role)}
                      className="w-4 h-4 accent-dc1-amber"
                    />
                    <span className="text-sm text-dc1-text-primary capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-md text-status-error text-sm">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {loginMethod === 'email' ? (
                <div>
                  <label htmlFor="email" className="label">
                    {t('login.email_address')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    disabled={isLoading}
                    required
                    autoFocus
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="apiKey" className="label">
                    {t('login.api_key')}
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    placeholder={role === 'renter' ? 'dc1-renter-...' : role === 'provider' ? 'dc1-provider-...' : 'admin key'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input font-mono"
                    disabled={isLoading}
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? t('login.signing_in') : t('auth.sign_in')}
              </button>
            </form>

            {/* Help text */}
            <div className="mt-6 pt-6 border-t border-dc1-border/30">
              <p className="text-xs text-dc1-text-secondary text-center mb-3">
                {loginMethod === 'email' ? t('login.email_hint') : t('login.apikey_hint')}
              </p>
            </div>

            {/* Register links */}
            <div className="mt-4 space-y-2 text-center text-sm">
              <p className="text-dc1-text-secondary">
                {t('login.new_to_dc1')}{' '}
                <a href="/provider/register" className="text-dc1-amber hover:text-dc1-amber/80 font-medium">
                  {t('login.become_provider')}
                </a>
              </p>
              <p className="text-dc1-text-secondary">
                {t('login.want_to_rent')}{' '}
                <a href="/renter/register" className="text-dc1-amber hover:text-dc1-amber/80 font-medium">
                  {t('login.register_as_renter')}
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
