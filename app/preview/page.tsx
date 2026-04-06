'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function PreviewPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] overflow-x-hidden">
      <style jsx>{`
        @keyframes aurora-1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          33% { transform: translate(30px, -50px) scale(1.1); opacity: 0.4; }
          66% { transform: translate(-20px, 20px) scale(0.9); opacity: 0.25; }
        }
        @keyframes aurora-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.2; }
          33% { transform: translate(-40px, 30px) scale(1.2); opacity: 0.3; }
          66% { transform: translate(20px, -40px) scale(0.8); opacity: 0.15; }
        }
        @keyframes aurora-3 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
          33% { transform: translate(50px, 20px) scale(0.9); opacity: 0.25; }
          66% { transform: translate(-30px, -30px) scale(1.1); opacity: 0.2; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ping-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .aurora-blob-1 {
          animation: aurora-1 8s ease-in-out infinite;
        }
        .aurora-blob-2 {
          animation: aurora-2 10s ease-in-out infinite;
        }
        .aurora-blob-3 {
          animation: aurora-3 12s ease-in-out infinite;
        }
        .marquee-track {
          animation: marquee 30s linear infinite;
        }
        .ping-dot {
          animation: ping-dot 2s ease-in-out infinite;
        }
        .pulse-ring {
          animation: pulse-ring 2s ease-out infinite;
        }
      `}</style>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Aurora background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="aurora-blob-1 absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
            }}
          />
          <div
            className="aurora-blob-2 absolute top-1/3 right-1/4 w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
            }}
          />
          <div
            className="aurora-blob-3 absolute bottom-1/4 left-1/3 w-[700px] h-[700px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(6,95,70,0.12) 0%, transparent 70%)',
            }}
          />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-32 w-full">
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-16 items-center">
            {/* Left */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] ring-1 ring-white/[0.08] text-sm text-[#a1a1aa]">
                <span className="relative flex h-2 w-2">
                  <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500" />
                  <span className="ping-dot relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                GPU Inference Marketplace
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
                <span className="bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                  Infinite Compute.
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
                  Real Power.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-[#a1a1aa] max-w-lg leading-relaxed">
                OpenAI-compatible API. Arabic models. Saudi data residency. Per-token billing.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-semibold text-sm transition-all active:scale-[0.98]"
                >
                  Start First Workload
                </Link>
                <Link
                  href="/provider/register"
                  className="inline-flex items-center px-6 py-3 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.1] hover:ring-white/[0.2] text-[#fafafa] font-semibold text-sm transition-all active:scale-[0.98]"
                >
                  Earn as Provider
                </Link>
              </div>

              <Link
                href="/enterprise"
                className="inline-flex items-center text-sm text-[#a1a1aa] hover:text-emerald-400 transition-colors group"
              >
                Talk to Enterprise
                <svg
                  className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {/* Right — Terminal Card */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <span className="ml-3 text-xs text-[#71717a] font-mono">api.dcp.sa</span>
              </div>

              {/* Terminal body */}
              <div className="p-6 font-mono text-sm space-y-4">
                <div>
                  <span className="text-[#71717a]">$</span>{' '}
                  <span className="text-emerald-400">curl</span>{' '}
                  <span className="text-[#a1a1aa]">-X POST https://api.dcp.sa/v1/chat/completions \</span>
                </div>
                <div className="pl-4 text-[#a1a1aa]">
                  -H &quot;Authorization: Bearer dcp_sk_...&quot; \
                </div>
                <div className="pl-4 text-[#a1a1aa]">
                  -d &apos;&#123;&quot;model&quot;: &quot;allam-7b&quot;, &quot;messages&quot;: [...]&#125;&apos;
                </div>

                <div className="border-t border-white/[0.06] pt-4 mt-4">
                  <span className="text-[#71717a]">// Response</span>
                  <div className="mt-2 text-[#fafafa]">
                    &#123;
                  </div>
                  <div className="pl-4 text-[#a1a1aa]">
                    &quot;choices&quot;: [&#123;
                  </div>
                  <div className="pl-8">
                    <span className="text-[#a1a1aa]">&quot;message&quot;: &#123; &quot;content&quot;: &quot;</span>
                    <span className="text-emerald-400" dir="rtl">مرحبًا! كيف يمكنني مساعدتك اليوم؟</span>
                    <span className="text-[#a1a1aa]">&quot; &#125;</span>
                  </div>
                  <div className="pl-4 text-[#a1a1aa]">&#125;]</div>
                  <div className="text-[#fafafa]">&#125;</div>
                </div>
              </div>

              {/* Status bar */}
              <div className="flex items-center gap-4 px-6 py-3 border-t border-white/[0.06] text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Online
                </span>
                <span className="text-[#71717a]">PDPL Compliant</span>
                <span className="text-[#71717a]">RTX 4090 · Riyadh</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LIVE TELEMETRY STRIP ===== */}
      <section className="border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-[#fafafa]">3x</div>
              <div className="text-xs text-[#71717a] mt-1">Cheaper than AWS</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#fafafa]">PDPL</div>
              <div className="text-xs text-[#71717a] mt-1">Saudi data residency</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-[#fafafa]">138</div>
              <div className="text-xs text-[#71717a] mt-1">Tokens/sec (RTX 4090)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold font-mono text-emerald-400">$0.048</div>
              <div className="text-xs text-[#71717a] mt-1">Per kWh energy cost</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST & SETTLEMENT ===== */}
      <section className="py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Built on structural advantages, not promo claims
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Smart Contract Settlement</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                EIP-712 escrow on Base. Funds release only when compute is verified. No middleman holding your money.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Container-Level Execution Isolation</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Every workload runs in its own sandboxed container. GPU memory wiped between sessions. Zero data leakage.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Arabic-First Model Support</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                ALLaM, JAIS, Falcon — optimized for Arabic. Native RTL handling, cultural context, Saudi dialects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INSTANT API ACCESS ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Three lines of Python. That&apos;s it.
            </h2>
            <p className="text-[#a1a1aa]">
              Use the OpenAI SDK you already know. Just change the base URL.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden">
              {/* Code header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <span className="ml-3 text-xs text-[#71717a] font-mono">inference.py</span>
              </div>

              <div className="p-6 font-mono text-sm leading-7">
                <div>
                  <span className="text-[#71717a]">from</span>{' '}
                  <span className="text-emerald-400">openai</span>{' '}
                  <span className="text-[#71717a]">import</span>{' '}
                  <span className="text-[#fafafa]">OpenAI</span>
                </div>
                <div className="mt-4">
                  <span className="text-[#fafafa]">client</span>{' '}
                  <span className="text-[#71717a]">=</span>{' '}
                  <span className="text-emerald-400">OpenAI</span>
                  <span className="text-[#a1a1aa]">(</span>
                </div>
                <div className="pl-4">
                  <span className="text-[#a1a1aa]">base_url=</span>
                  <span className="text-emerald-400">&quot;https://api.dcp.sa/v1&quot;</span>
                  <span className="text-[#a1a1aa]">,</span>
                </div>
                <div className="pl-4">
                  <span className="text-[#a1a1aa]">api_key=</span>
                  <span className="text-emerald-400">&quot;dcp_sk_...&quot;</span>
                </div>
                <div>
                  <span className="text-[#a1a1aa]">)</span>
                </div>
                <div className="mt-4">
                  <span className="text-[#fafafa]">response</span>{' '}
                  <span className="text-[#71717a]">=</span>{' '}
                  <span className="text-[#fafafa]">client</span>
                  <span className="text-[#a1a1aa]">.chat.completions.create(</span>
                </div>
                <div className="pl-4">
                  <span className="text-[#a1a1aa]">model=</span>
                  <span className="text-emerald-400">&quot;allam-7b&quot;</span>
                  <span className="text-[#a1a1aa]">,</span>
                </div>
                <div className="pl-4">
                  <span className="text-[#a1a1aa]">messages=[&#123;&quot;role&quot;: &quot;user&quot;, &quot;content&quot;: &quot;</span>
                  <span className="text-emerald-400" dir="rtl">مرحبا</span>
                  <span className="text-[#a1a1aa]">&quot;&#125;]</span>
                </div>
                <div>
                  <span className="text-[#a1a1aa]">)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link
                href="/dashboard/api-keys"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-semibold text-sm transition-all active:scale-[0.98]"
              >
                Get API Key
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center px-6 py-3 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.1] hover:ring-white/[0.2] text-[#fafafa] font-semibold text-sm transition-all active:scale-[0.98]"
              >
                View Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES (3 cards) ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Pay-As-You-Go */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Pay-As-You-Go</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Per-second billing in SAR. No commitments, no minimums, no surprises. Pay only for the GPU seconds you consume.
              </p>
            </div>

            {/* PDPL Compliance */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">PDPL Compliance</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Saudi data residency built-in. Your data never leaves the Kingdom. Full compliance with Saudi Personal Data Protection Law.
              </p>
            </div>

            {/* OpenAI-Compatible API */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-8 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">OpenAI-Compatible API</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Drop-in replacement for existing code. Change one line — the base URL — and your app runs on DCP infrastructure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How it works</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { step: '1', title: 'Register', desc: 'Create your account and get API credentials in under a minute.' },
              { step: '2', title: 'Deploy Model', desc: 'Choose from our catalog or bring your own container image.' },
              { step: '3', title: 'Call API', desc: 'Use the OpenAI-compatible endpoint. Same SDK, same patterns.' },
              { step: '4', title: 'Track & Pay', desc: 'Real-time usage dashboard. Per-second billing in SAR.' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROVIDER SETUP ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Start earning with your GPU
            </h2>
            <p className="text-[#a1a1aa] max-w-xl mx-auto">
              Install the DCP daemon, connect your GPU, and start earning SAR from global AI workloads.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left — Steps */}
            <div className="space-y-8">
              {[
                {
                  step: '1',
                  title: 'Register as a provider',
                  desc: 'Sign up at dcp.sa and complete the provider onboarding form.',
                },
                {
                  step: '2',
                  title: 'Install the daemon',
                  desc: null,
                  code: 'curl -fsSL https://get.dcp.sa | bash',
                },
                {
                  step: '3',
                  title: 'Daemon auto-configures',
                  desc: 'Detects your GPU, VRAM, CUDA version, and available bandwidth automatically.',
                },
                {
                  step: '4',
                  title: 'Start earning',
                  desc: 'Jobs are routed to your machine. Earnings settle via smart contract.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-emerald-400 font-bold text-sm">{item.step}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{item.title}</h4>
                    {item.desc && (
                      <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.desc}</p>
                    )}
                    {item.code && (
                      <code className="inline-block mt-2 px-4 py-2 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06] text-sm font-mono text-emerald-400">
                        {item.code}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Right — Terminal */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.1]" />
                <span className="ml-3 text-xs text-[#71717a] font-mono">terminal</span>
              </div>
              <div className="p-6 font-mono text-sm space-y-3">
                <div>
                  <span className="text-[#71717a]">$</span>{' '}
                  <span className="text-[#fafafa]">curl -fsSL https://get.dcp.sa | bash</span>
                </div>
                <div className="text-[#a1a1aa]">Installing DCP daemon v2.1.0...</div>
                <div className="text-[#a1a1aa]">Detecting hardware...</div>
                <div className="mt-2">
                  <span className="text-emerald-400">✓</span>{' '}
                  <span className="text-[#fafafa]">GPU detected: NVIDIA RTX 4090 (24GB VRAM)</span>
                </div>
                <div>
                  <span className="text-emerald-400">✓</span>{' '}
                  <span className="text-[#fafafa]">CUDA 12.4 verified</span>
                </div>
                <div>
                  <span className="text-emerald-400">✓</span>{' '}
                  <span className="text-[#fafafa]">Daemon connected to api.dcp.sa</span>
                </div>
                <div>
                  <span className="text-emerald-400">✓</span>{' '}
                  <span className="text-[#fafafa]">Heartbeat active — waiting for jobs</span>
                </div>
                <div className="mt-2 text-emerald-400">
                  Ready. Your GPU is now part of the DCP network.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== WORKLOAD TYPES ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              What you can run
            </h2>
            <p className="text-[#a1a1aa]">
              From real-time inference to batch training — all on decentralized GPUs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'LLM Inference',
                models: 'ALLaM, Falcon, Llama 3, JAIS',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                ),
              },
              {
                title: 'Image Generation',
                models: 'SDXL, ControlNet, DreamBooth',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                ),
              },
              {
                title: 'Fine-Tuning',
                models: 'LoRA, QLoRA, PyTorch',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                ),
              },
              {
                title: 'Arabic AI Models',
                models: 'ALLaM 7B, Falcon H1, JAIS 13B',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                ),
              },
              {
                title: 'Custom Containers',
                models: 'Docker, CUDA',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V19.5m0 2.25l-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
                  </svg>
                ),
              },
              {
                title: 'Batch Processing',
                models: 'CUDA, Batch, HPC',
                icon: (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                  </svg>
                ),
              },
            ].map((workload) => (
              <div
                key={workload.title}
                className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-6 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  {workload.icon}
                </div>
                <h3 className="font-semibold mb-1">{workload.title}</h3>
                <p className="text-sm text-[#71717a] font-mono">{workload.models}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MODEL MARQUEE ===== */}
      <section className="py-16 border-t border-white/[0.06] overflow-hidden">
        <div className="text-center mb-10">
          <p className="text-sm text-[#71717a] uppercase tracking-widest">Supported Models & Frameworks</p>
        </div>
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#09090b] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#09090b] to-transparent z-10" />
          <div className="flex marquee-track" style={{ width: 'max-content' }}>
            {[...Array(2)].map((_, setIdx) => (
              <div key={setIdx} className="flex items-center gap-16 px-8">
                {[
                  'Meta',
                  'Falcon',
                  'Mistral',
                  'Qwen',
                  'Stability AI',
                  'Microsoft',
                  'Hugging Face',
                  'ALLaM',
                ].map((name) => (
                  <span
                    key={`${setIdx}-${name}`}
                    className="text-lg font-semibold text-[#71717a]/50 whitespace-nowrap select-none"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ENERGY ADVANTAGE ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Electricity at{' '}
              <span className="text-emerald-400 font-mono">$0.048</span>/kWh.
            </h2>
            <p className="text-[#a1a1aa] max-w-2xl mx-auto">
              Saudi Arabia has some of the lowest energy costs in the world. That&apos;s not a discount — it&apos;s a structural advantage that makes DCP 3-6x cheaper than US or European providers.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left — Bar chart */}
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-8">
              <h3 className="text-sm text-[#71717a] uppercase tracking-widest mb-8">
                Electricity cost per kWh
              </h3>
              <div className="space-y-6">
                {[
                  { country: 'Saudi Arabia', cost: '$0.048', pct: 15, highlight: true },
                  { country: 'United States', cost: '$0.12', pct: 37.5, highlight: false },
                  { country: 'Germany', cost: '$0.28', pct: 87.5, highlight: false },
                  { country: 'United Kingdom', cost: '$0.32', pct: 100, highlight: false },
                ].map((item) => (
                  <div key={item.country}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className={item.highlight ? 'text-emerald-400 font-semibold' : 'text-[#a1a1aa]'}>
                        {item.country}
                      </span>
                      <span className={`font-mono ${item.highlight ? 'text-emerald-400 font-semibold' : 'text-[#a1a1aa]'}`}>
                        {item.cost}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.04]">
                      <div
                        className={`h-2 rounded-full transition-all ${item.highlight ? 'bg-emerald-500' : 'bg-white/[0.1]'}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  title: 'Arabic-first models',
                  desc: 'ALLaM, JAIS, Falcon optimized for Arabic NLP',
                },
                {
                  title: 'Data residency',
                  desc: 'Your data stays in Saudi Arabia. Full PDPL compliance.',
                },
                {
                  title: 'OpenAI compatible',
                  desc: 'Same SDK, same patterns. Change one line of code.',
                },
                {
                  title: 'Smart contract',
                  desc: 'EIP-712 escrow. Trustless settlement on Base.',
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="bg-white/[0.02] ring-1 ring-white/[0.06] hover:ring-white/[0.12] rounded-2xl p-6 transition-all"
                >
                  <h4 className="font-semibold text-sm mb-2">{card.title}</h4>
                  <p className="text-xs text-[#71717a] leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== BILLING TRANSPARENCY ===== */}
      <section className="py-28 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How billing works</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: '1',
                title: 'Submit job',
                desc: 'Send an inference request or deploy a workload. Your balance is checked upfront.',
              },
              {
                step: '2',
                title: 'GPU runs, metered per-second',
                desc: 'Compute time is tracked at per-second granularity. You see costs in real time.',
              },
              {
                step: '3',
                title: 'Pay only for what you used',
                desc: 'Settlement happens automatically. Unused escrow is returned to your balance.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-400 font-bold text-lg">{item.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.02] ring-1 ring-white/[0.06] text-sm text-[#71717a]">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Failed jobs get an automatic refund — you never pay for errors.
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA SECTION ===== */}
      <section className="py-32 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8">
            Ready to compute?
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#09090b] font-semibold text-base transition-all active:scale-[0.98]"
            >
              Start Renting GPUs
            </Link>
            <Link
              href="/provider/register"
              className="inline-flex items-center px-8 py-4 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.1] hover:ring-white/[0.2] text-[#fafafa] font-semibold text-base transition-all active:scale-[0.98]"
            >
              Earn with Your GPU
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-[#71717a]">
            DCP — Decentralized Compute Platform
          </span>
          <span className="text-sm text-[#71717a]">
            Saudi Arabia 🇸🇦
          </span>
        </div>
      </footer>
    </div>
  )
}