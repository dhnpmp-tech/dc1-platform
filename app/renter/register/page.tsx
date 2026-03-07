'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_DC1_API || 'http://76.13.179.86:8083';

interface RegistrationResult {
  renter_id: number;
  api_key: string;
  message: string;
}

export default function RenterRegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/renters/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          organization: organization.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  function copyApiKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function loginWithKey() {
    if (!result) return;
    sessionStorage.setItem('dc1_renter_key', result.api_key);
    window.location.href = '/renter';
  }

  // Success state — show API key
  if (result) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="max-w-lg w-full mx-4">
          <div className="bg-[#00A8E1]/10 border border-[#00A8E1]/30 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-[#00A8E1]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#00A8E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome to DC1!</h1>
            <p className="text-white/60 mb-6">{result.message}</p>

            {/* API Key Display */}
            <div className="bg-black/40 rounded-xl p-4 mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Your API Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[#FFD700] text-sm font-mono break-all select-all">
                  {result.api_key}
                </code>
                <button
                  onClick={copyApiKey}
                  className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-lg p-3 mb-6">
              <p className="text-[#FFD700] text-xs font-medium">
                Save this key now — it won't be shown again.
              </p>
              <p className="text-white/40 text-xs mt-1">
                You'll need it to log in and submit jobs.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={loginWithKey}
                className="flex-1 py-3 rounded-xl font-semibold text-[#1a1a1a] bg-[#FFD700] hover:bg-[#FFD700]/90 transition"
              >
                Go to Dashboard
              </button>
              <Link
                href="/jobs/submit"
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/20 text-center transition"
              >
                Submit a Job
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-[#FFD700]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#FFD700]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Rent GPU Compute</h1>
          <p className="text-white/40 mt-2">
            Register to access DC1's GPU marketplace. Run AI inference, training, and rendering on provider GPUs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Abdullah Al-Rashid"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/60 transition"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Email *</label>
            <input
              type="email"
              required
              placeholder="you@company.sa"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/60 transition"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Organization <span className="text-white/30">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. KAUST, Aramco, Startup Inc."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#FFD700]/60 transition"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-[#1a1a1a] bg-[#FFD700] hover:bg-[#FFD700]/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Registering...
              </span>
            ) : 'Create Account'}
          </button>

          {/* Login link */}
          <p className="text-center text-white/40 text-sm">
            Already have an API key?{' '}
            <Link href="/renter" className="text-[#00A8E1] hover:underline">
              Log in
            </Link>
          </p>
        </form>

        {/* Info */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-medium text-white/60 mb-2">What you get:</h3>
          <ul className="space-y-1.5 text-sm text-white/40">
            <li className="flex items-start gap-2">
              <span className="text-[#FFD700] mt-0.5">&#x2022;</span>
              Access to NVIDIA GPUs (RTX 3060 Ti to RTX 4090)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFD700] mt-0.5">&#x2022;</span>
              Pay-per-use billing in SAR (starting at 0.38 SAR/hr)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFD700] mt-0.5">&#x2022;</span>
              Run LLM inference, model training, and rendering jobs
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#FFD700] mt-0.5">&#x2022;</span>
              Real-time GPU monitoring and job tracking
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
