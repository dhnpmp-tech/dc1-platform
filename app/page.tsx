'use client'

import Link from 'next/link'
import Header from './components/layout/Header'
import Footer from './components/layout/Footer'

const features = [
  {
    title: 'For GPU Providers',
    description: 'Monetize your idle GPU power. List your hardware, set your pricing, and earn automatically when renters submit jobs.',
    cta: 'Start Earning',
    href: '/provider/register',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
      </svg>
    ),
  },
  {
    title: 'For Renters',
    description: 'Access powerful GPUs on demand. Submit AI training jobs, run inference, and generate images at competitive prices.',
    cta: 'Rent GPUs',
    href: '/renter/register',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Transparent Pricing',
    description: 'Real-time pricing, clear job tracking, and guaranteed payouts. 75% goes directly to providers.',
    cta: 'View Marketplace',
    href: '/renter/marketplace',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const stats = [
  { value: '75/25', label: 'Provider / DC1 Split' },
  { value: '< 5s', label: 'Job Dispatch' },
  { value: '0%', label: 'Idle GPU Waste' },
  { value: '100%', label: 'Bare Metal Performance' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-dc1-amber/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-36 relative">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-dc1-amber rounded-full animate-pulse" />
              GPU Compute Marketplace
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">
              <span className="text-dc1-text-primary">Borderless</span>{' '}
              <span className="text-gradient-amber">GPU Compute</span>
            </h1>
            <p className="text-lg sm:text-xl text-dc1-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              The transparent, reliable GPU compute marketplace. Connect providers with renters for AI training, inference, and high-performance computing.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/provider/register" className="btn btn-primary btn-lg w-full sm:w-auto">
                Become a Provider
              </Link>
              <Link href="/renter/register" className="btn btn-secondary btn-lg w-full sm:w-auto">
                Rent GPUs
              </Link>
            </div>
            <p className="text-dc1-text-secondary text-sm mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-dc1-amber hover:text-dc1-amber/80 font-semibold underline underline-offset-2">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-dc1-border bg-dc1-surface-l1/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold text-dc1-amber">{stat.value}</p>
                <p className="text-sm text-dc1-text-secondary mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            Built for the GPU Economy
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Whether you have spare GPU capacity or need compute power, DC1 connects you with the right match.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="card-hover group">
              <div className="w-12 h-12 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-4 group-hover:bg-dc1-amber/20 transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{feature.title}</h3>
              <p className="text-sm text-dc1-text-secondary mb-4 leading-relaxed">{feature.description}</p>
              <Link
                href={feature.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-dc1-amber hover:text-dc1-amber-hover transition-colors"
              >
                {feature.cta}
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-dc1-text-primary text-center mb-16">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Register', desc: 'Sign up as a provider or renter in under 2 minutes' },
              { step: '02', title: 'Connect', desc: 'Providers install our daemon; renters browse the marketplace' },
              { step: '03', title: 'Compute', desc: 'Submit jobs and let DC1 match you with the best GPU' },
              { step: '04', title: 'Earn / Pay', desc: 'Transparent billing with 75/25 split for providers' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center text-dc1-amber font-bold text-sm mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
                <p className="text-sm text-dc1-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Provider Setup Demo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            Start Earning in 5 Minutes
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Install the DC1 daemon on any machine with an NVIDIA GPU and you&apos;re live.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Register your provider account',
                desc: 'Create your account and get your API key in under 60 seconds.',
              },
              {
                step: '2',
                title: 'Download and run the installer',
                desc: 'One command installs the daemon and registers your GPU.',
                code: '# Linux / macOS\ncurl -sSL https://dcp.sa/install.sh | bash',
              },
              {
                step: '3',
                title: 'Verify your hardware',
                desc: 'The daemon reports your GPU specs and passes the 38-point verification check.',
              },
              {
                step: '4',
                title: 'Go live and earn SAR',
                desc: 'Jobs are dispatched automatically. Earnings hit your wallet after each job.',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-dc1-amber flex items-center justify-center text-dc1-void font-bold text-sm">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-dc1-text-primary mb-1">{item.title}</h3>
                  <p className="text-sm text-dc1-text-secondary mb-2">{item.desc}</p>
                  {item.code && (
                    <pre className="bg-dc1-surface-l1 border border-dc1-border rounded-lg px-4 py-3 text-xs text-dc1-amber font-mono overflow-x-auto">
                      {item.code}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card border-dc1-amber/20">
            <p className="text-xs text-dc1-text-muted mb-3 font-mono uppercase tracking-wider">Windows (PowerShell)</p>
            <pre className="text-xs text-dc1-amber font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# Run as Administrator
Invoke-WebRequest \`
  -Uri "https://dcp.sa/install.ps1" \`
  -OutFile install.ps1
.\\install.ps1 \`
  --key YOUR_PROVIDER_KEY`}</pre>
            <div className="mt-4 pt-4 border-t border-dc1-border">
              <p className="text-xs text-dc1-text-muted mb-2">After install, your terminal shows:</p>
              <pre className="text-xs text-green-400 font-mono leading-relaxed">{`✓ GPU detected: RTX 4090 (24 GB)
✓ Daemon v3.3.0 running
✓ Connected to DC1 — ready for jobs`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Founding Rates Table */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-dc1-amber rounded-full animate-pulse" />
              Founding Provider Rates
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
              Discounted Rates for Early Providers
            </h2>
            <p className="text-dc1-text-secondary max-w-2xl mx-auto">
              Lock in founding rates before the marketplace launches publicly. You earn 75% of every job fee.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dc1-border">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-dc1-text-secondary">GPU Model</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-dc1-text-secondary">VRAM</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-dc1-text-secondary">Rate (SAR/hr)</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-dc1-text-secondary">Your Earnings (75%)</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { gpu: 'RTX 3080', vram: '10 GB', rate: 9, earn: 6.75 },
                  { gpu: 'RTX 3090', vram: '24 GB', rate: 15, earn: 11.25 },
                  { gpu: 'RTX 4090', vram: '24 GB', rate: 22, earn: 16.50 },
                  { gpu: 'A100', vram: '80 GB', rate: 75, earn: 56.25 },
                ].map((row, i) => (
                  <tr key={row.gpu} className={`border-b border-dc1-border/50 hover:bg-dc1-surface-l2/50 transition-colors ${i === 3 ? 'text-dc1-amber' : ''}`}>
                    <td className="py-4 px-6 text-sm font-semibold text-dc1-text-primary">{row.gpu}</td>
                    <td className="py-4 px-6 text-sm text-dc1-text-secondary">{row.vram}</td>
                    <td className="py-4 px-6 text-sm font-bold text-dc1-amber">{row.rate} SAR</td>
                    <td className="py-4 px-6 text-sm font-semibold text-dc1-text-primary">{row.earn.toFixed(2)} SAR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-dc1-text-muted text-center mt-6">
            Founding rates are locked for first 100 providers. Prices shown per compute-hour.
          </p>
        </div>
      </section>

      {/* What You Can Run */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-4">
            What You Can Run
          </h2>
          <p className="text-dc1-text-secondary max-w-2xl mx-auto">
            Any GPU workload — from large language models to custom Docker containers.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'LLM Inference',
              desc: 'Run llama3, mistral, deepseek, and other open-source models at full GPU speed.',
              tags: ['llama3', 'mistral', 'deepseek'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              ),
            },
            {
              title: 'Stable Diffusion',
              desc: 'Generate images and video with SD 1.5, SDXL, and ControlNet pipelines.',
              tags: ['SD 1.5', 'SDXL', 'ControlNet'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ),
            },
            {
              title: 'PyTorch Training',
              desc: 'Fine-tune models, run experiments, and train from scratch on bare-metal GPUs.',
              tags: ['PyTorch', 'CUDA', 'DeepSpeed'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
            },
            {
              title: 'Jupyter Notebooks',
              desc: 'Launch interactive GPU-backed notebooks for research and data science.',
              tags: ['Jupyter', 'Python', 'RAPIDS'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
            },
            {
              title: 'Custom Docker Containers',
              desc: 'Submit any Docker image with CUDA support — full GPU passthrough via NVIDIA Container Toolkit.',
              tags: ['Docker', 'CUDA', 'Custom'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              ),
            },
            {
              title: 'Any CUDA Workload',
              desc: 'Video encoding, scientific computing, rendering — if it runs on CUDA, it runs on DC1.',
              tags: ['CUDA', 'HPC', 'Render'],
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              ),
            },
          ].map((item) => (
            <div key={item.title} className="card-hover group">
              <div className="w-10 h-10 rounded-lg bg-dc1-amber/10 flex items-center justify-center text-dc1-amber mb-4 group-hover:bg-dc1-amber/20 transition-colors">
                {item.icon}
              </div>
              <h3 className="text-base font-semibold text-dc1-text-primary mb-2">{item.title}</h3>
              <p className="text-sm text-dc1-text-secondary mb-4 leading-relaxed">{item.desc}</p>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded text-xs font-mono bg-dc1-surface-l2 text-dc1-text-muted border border-dc1-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Programmatic Integration */}
      <section className="bg-dc1-surface-l1 border-y border-dc1-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-dc1-amber/10 border border-dc1-amber/20 text-dc1-amber text-sm font-medium mb-6">
                API-First
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-dc1-text-primary mb-6">
                Integrate in Minutes
              </h2>
              <p className="text-dc1-text-secondary mb-6 leading-relaxed">
                Submit jobs programmatically with a single HTTP call. Our REST API is fully documented via OpenAPI — integrate DC1 compute into any workflow, pipeline, or application.
              </p>
              <ul className="space-y-3 text-sm text-dc1-text-secondary">
                {[
                  'REST API with API key auth',
                  'Full OpenAPI 3.0 specification',
                  'Webhook support for job completion',
                  'Real-time job status polling',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-dc1-amber/10 border border-dc1-amber/30 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-dc1-amber" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card border-dc1-amber/20">
              <p className="text-xs text-dc1-text-muted mb-3 font-mono uppercase tracking-wider">Submit a job via curl</p>
              <pre className="text-xs text-dc1-amber font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`curl -X POST https://api.dcp.sa/api/jobs/submit \\
  -H "x-renter-key: YOUR_RENTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jobType": "llm_inference",
    "dockerImage": "dc1/llama3-8b:latest",
    "input": {
      "prompt": "Explain quantum computing",
      "max_tokens": 512
    }
  }'`}</pre>
              <div className="mt-4 pt-4 border-t border-dc1-border">
                <p className="text-xs text-dc1-text-muted mb-2">Response:</p>
                <pre className="text-xs text-green-400 font-mono leading-relaxed">{`{
  "jobId": "job_abc123",
  "status": "queued",
  "estimatedStart": "< 5s"
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="card border-dc1-amber/20 text-center py-12 px-8 glow-amber">
          <h2 className="text-2xl sm:text-3xl font-bold text-dc1-text-primary mb-4">
            Ready to Power Your Compute?
          </h2>
          <p className="text-dc1-text-secondary max-w-xl mx-auto mb-8">
            Join the DC1 marketplace today. Start earning from your GPUs or access affordable compute power.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/provider/register" className="btn btn-primary btn-lg">Register as Provider</Link>
            <Link href="/renter/register" className="btn btn-outline btn-lg">Register as Renter</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
