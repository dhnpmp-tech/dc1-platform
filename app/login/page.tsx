'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/app/components/layout/Header'
import Footer from '@/app/components/layout/Footer'

type Role = 'provider' | 'renter' | 'admin'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('provider')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      // Demo mode: any email/password combination works
      // In production, this would call an actual auth API
      if (!email.trim() || !password.trim()) {
        setError('Please enter both email and password')
        setIsLoading(false)
        return
      }

      // Simulate auth delay
      await new Promise(resolve => setTimeout(resolve, 500))

      // Store mock session data
      const sessionData = {
        email,
        role,
        token: `${role}_token_${Date.now()}`,
        userName: email.split('@')[0],
      }

      if (role === 'admin') {
        localStorage.setItem('dc1_admin_token', sessionData.token)
        localStorage.setItem('dc1_user_data', JSON.stringify(sessionData))
        router.push('/admin')
      } else if (role === 'provider') {
        localStorage.setItem('dc1_provider_token', sessionData.token)
        localStorage.setItem('dc1_user_data', JSON.stringify(sessionData))
        router.push('/provider')
      } else if (role === 'renter') {
        localStorage.setItem('dc1_renter_token', sessionData.token)
        localStorage.setItem('dc1_user_data', JSON.stringify(sessionData))
        router.push('/renter')
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.')
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
                src="https://dc1st.com/assets/dc1-logo-Z67caTEl.webp"
                alt="DC1"
                className="h-12 w-auto"
              />
            </div>

            <h1 className="text-2xl font-bold text-dc1-text-primary text-center mb-2">
              Sign In
            </h1>
            <p className="text-sm text-dc1-text-secondary text-center mb-6">
              Access your DC1 Dashboard
            </p>

            {/* Role Selector */}
            <div className="mb-6">
              <label className="label">Account Type</label>
              <div className="flex gap-3">
                {(['provider', 'renter', 'admin'] as const).map((r) => (
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
              <div>
                <label htmlFor="email" className="label">
                  Email Address
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
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full"
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            {/* Demo note */}
            <div className="mt-6 pt-6 border-t border-dc1-border/30">
              <p className="text-xs text-dc1-text-secondary text-center mb-3">
                Demo Mode: Use any email and password to login
              </p>
              <div className="space-y-2">
                <p className="text-xs text-dc1-text-secondary">
                  <span className="font-semibold text-dc1-amber">Provider:</span> any@email.com / password
                </p>
                <p className="text-xs text-dc1-text-secondary">
                  <span className="font-semibold text-dc1-amber">Renter:</span> any@email.com / password
                </p>
                <p className="text-xs text-dc1-text-secondary">
                  <span className="font-semibold text-dc1-amber">Admin:</span> any@email.com / password
                </p>
              </div>
            </div>

            {/* Register links */}
            <div className="mt-6 space-y-2 text-center text-sm">
              <p className="text-dc1-text-secondary">
                New to DC1?{' '}
                <a href="/provider/register" className="text-dc1-amber hover:text-dc1-amber/80 font-medium">
                  Become a Provider
                </a>
              </p>
              <p className="text-dc1-text-secondary">
                Want to rent?{' '}
                <a href="/renter/register" className="text-dc1-amber hover:text-dc1-amber/80 font-medium">
                  Start Renting
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
