'use client'

import Link from 'next/link'

export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-lg font-bold tracking-tight">DCP</span>
            <div className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
              <a href="#" className="hover:text-white transition-colors">Renter</a>
              <a href="#" className="hover:text-white transition-colors">Provider</a>
              <a href="#" className="hover:text-white transition-colors">Pricing</a>
              <a href="#" className="hover:text-white transition-colors">Docs</a>
              <a href="#" className="hover:text-white transition-colors">Enterprise</a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm text-zinc-400 hover:text-white transition-colors px-3 py-1.5">Console</button>
            <button className="text-sm bg-emerald-500 text-black font-medium px-4 py-1.5 rounded-lg hover:bg-emerald-400 transition-colors active:scale-[0.98]">
              Start Renting
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Aurora background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full blur-[120px]"
            style={{
              background: 'radial-gradient(circle, rgba(16,185,129,0.08), transparent 70%)',
              animation: 'aurora 8s ease-in-out infinite',
            }}
          />
          <div
            className="absolute -bottom-[20%] right-[10%] w-[50%] h-[60%] rounded-full blur-[100px]"
            style={{
              background: 'radial-gradient(circle, rgba(59,130,246,0.05), transparent 70%)',
              animation: 'aurora 12s ease-in-out infinite reverse',
            }}
          />
          <div
            className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full blur-[80px]"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.04), transparent 70%)',
              animation: 'aurora 10s ease-in-out infinite 2s',
            }}
          />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
              backgroundSize: '72px 72px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 w-full relative">
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-16 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full ring-1 ring-white/[0.08] bg-white/[0.03] backdrop-blur-sm text-zinc-500 text-xs font-medium tracking-wider uppercase mb-10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                GPU Inference Marketplace
              </div>

              <h1 className="text-[3.25rem] sm:text-[4.5rem] lg:text-[5.5rem] font-bold tracking-[-0.035em] leading-[0.88] mb-8">
                <span className="block bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
                  Infinite
                </span>
                <span className="block bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent">
                  Compute.
                </span>
                <span className="block mt-1 bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
                  Real Power.
                </span>
              </h1>

              <p className="text-lg text-zinc-400 max-w-[48ch] leading-relaxed mb-10">
                OpenAI-compatible API. Arabic models. Saudi data residency. Per-token billing.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <Link
                  href="/renter/register"
                  className="inline-flex items-center justify-center px-7 py-3 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-all duration-200 active:scale-[0.98] shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]"
                >
                  Start First Workload
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                </Link>
                <Link
                  href="/provider/register"
                  className="inline-flex items-center justify-center px-7 py-3 rounded-xl ring-1 ring-white/[0.1] text-zinc-300 font-medium text-sm hover:ring-white/[0.2] hover:bg-white/[0.03] transition-all duration-200 active:scale-[0.98]"
                >
                  Earn as Provider
                </Link>
              </div>
              <p className="text-xs text-zinc-600">
                Need a custom deployment?{' '}
                <a href="/support" className="text-emerald-500 hover:text-emerald-400 font-medium">Talk to Enterprise</a>
              </p>
            </div>

            {/* Right: Live terminal */}
            <div className="hidden lg:block">
              <div className="relative group">
                {/* Glow behind card */}
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/20 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-sm" />
                <div className="relative rounded-2xl ring-1 ring-white/[0.08] bg-[#0f0f12]/90 backdrop-blur-sm p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                  {/* Terminal header */}
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-white/[0.06]">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                      <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                      <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono ml-2">api.dcp.sa — inference</span>
                  </div>
                  {/* Code */}
                  <div className="text-[12px] leading-[1.9] font-mono space-y-1">
                    <p><span className="text-zinc-600">$</span> <span className="text-emerald-400">curl</span> <span className="text-zinc-400">api.dcp.sa/v1/chat/completions</span></p>
                    <p className="text-zinc-600 pl-4">{'// '}model: gemma-4-26b, region: saudi</p>
                    <div className="mt-3 rounded-lg bg-black/30 p-3">
                      <p className="text-emerald-300">{'"مرحباً! كيف يمكنني مساعدتك اليوم؟"'}</p>
                      <p className="text-zinc-600 mt-1">{'// '}142 tokens · 0.003 SAR · 73 tok/s</p>
                    </div>
                  </div>
                  {/* Status bar */}
                  <div className="mt-5 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">Online</span>
                      </div>
                      <span className="text-[10px] text-zinc-600 font-mono">PDPL Compliant</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 font-mono">RTX 4090 · Riyadh</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="mt-20 pt-10 border-t border-white/[0.04]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
              <div>
                <p className="text-2xl font-bold font-mono text-white">3x</p>
                <p className="text-xs text-zinc-500 mt-1">Cheaper than AWS</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white">PDPL</p>
                <p className="text-xs text-zinc-500 mt-1">Saudi data residency</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-white">138</p>
                <p className="text-xs text-zinc-500 mt-1">Tokens/sec (RTX 4090)</p>
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-emerald-400">$0.048</p>
                <p className="text-xs text-zinc-500 mt-1">Per kWh energy cost</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.04] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-xs font-medium tracking-wider uppercase text-emerald-500 mb-3">How it works</p>
          <h2 className="text-3xl font-bold tracking-tight mb-12 text-white">Three steps. No ops.</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Deploy a model', desc: 'Pick from Gemma, Qwen, Llama, ALLaM, or bring your own. One-click deploy to Saudi GPUs.' },
              { step: '02', title: 'Call the API', desc: 'OpenAI-compatible endpoint. Drop-in replacement — just change the base URL.' },
              { step: '03', title: 'Pay per token', desc: 'SAR billing, per-second metering. No commitments, no minimum spend.' },
            ].map((item) => (
              <div key={item.step} className="group relative">
                <div className="rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] p-8 h-full hover:ring-white/[0.12] hover:bg-white/[0.03] transition-all duration-300">
                  <span className="text-emerald-500/60 font-mono text-sm">{item.step}</span>
                  <h3 className="text-lg font-semibold mt-3 mb-2 text-white">{item.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Energy advantage */}
      <section className="border-t border-white/[0.04] py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-medium tracking-wider uppercase text-emerald-500 mb-3">Saudi energy advantage</p>
              <h2 className="text-3xl font-bold tracking-tight mb-4 text-white">Electricity at $0.048/kWh.</h2>
              <p className="text-zinc-400 leading-relaxed mb-6">
                Saudi Arabia has some of the cheapest electricity in the world — 3 to 6 times less than Europe.
                DCP turns this into a structural cost advantage for AI inference.
              </p>
              <div className="space-y-3">
                {[
                  { region: 'Saudi Arabia (DCP)', price: '$0.048', bar: '12%' },
                  { region: 'United States', price: '$0.12', bar: '30%' },
                  { region: 'Germany', price: '$0.28', bar: '70%' },
                  { region: 'United Kingdom', price: '$0.32', bar: '80%' },
                ].map((row) => (
                  <div key={row.region} className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500 w-36 shrink-0">{row.region}</span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.region.includes('DCP') ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                        style={{ width: row.bar }}
                      />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 w-14 text-right">{row.price}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Arabic-first models', value: 'ALLaM, JAIS, Falcon', icon: '🇸🇦' },
                { label: 'Data residency', value: 'PDPL compliant', icon: '🔒' },
                { label: 'OpenAI compatible', value: 'Drop-in replacement', icon: '🔌' },
                { label: 'Smart contract', value: 'Trustless escrow', icon: '📝' },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl ring-1 ring-white/[0.06] bg-white/[0.02] p-6 hover:ring-white/[0.12] transition-all duration-300">
                  <span className="text-2xl">{card.icon}</span>
                  <p className="text-sm font-medium text-white mt-3">{card.label}</p>
                  <p className="text-xs text-zinc-500 mt-1">{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/[0.04] py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4 text-white">Ready to compute?</h2>
          <p className="text-zinc-400 mb-8">Start running AI inference on Saudi GPUs in under 5 minutes.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/renter/register" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
              Start Renting GPUs
            </Link>
            <Link href="/provider/register" className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl ring-1 ring-white/[0.1] text-zinc-300 font-medium text-sm hover:ring-white/[0.2] transition-all active:scale-[0.98]">
              Earn with Your GPU
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-12">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs text-zinc-600">DCP — Decentralized Compute Platform</span>
          <span className="text-xs text-zinc-600">Saudi Arabia</span>
        </div>
      </footer>

      <style jsx>{`
        @keyframes aurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(5%, -3%) scale(1.05); }
          66% { transform: translate(-3%, 5%) scale(0.95); }
        }
      `}</style>
    </div>
  )
}
