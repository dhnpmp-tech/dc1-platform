import Link from 'next/link'
import Header from '../../components/layout/Header'
import Footer from '../../components/layout/Footer'

type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  auth: string
  description: string
  request?: string
  response: string
}

const sections: Array<{ id: string; title: string; endpoints: Endpoint[] }> = [
  {
    id: 'providers',
    title: 'Provider Endpoints',
    endpoints: [
      {
        method: 'POST',
        path: '/api/providers/register',
        auth: 'None',
        description: 'Register a provider and receive an API key.',
        request: `{
  "name": "Riyadh RTX Node",
  "email": "provider@example.com",
  "gpu_model": "RTX 4090",
  "os": "linux"
}`,
        response: `{
  "success": true,
  "provider_id": 42,
  "api_key": "dc1-provider-..."
}`,
      },
      {
        method: 'POST',
        path: '/api/providers/heartbeat',
        auth: 'Provider API key in body',
        description: 'Daemon heartbeat with GPU telemetry (30s interval).',
        request: `{
  "api_key": "dc1-provider-...",
  "gpu_status": { "gpu_name": "NVIDIA RTX 4090", "gpu_util_pct": 42 }
}`,
        response: `{
  "success": true,
  "status": "online",
  "update_available": false
}`,
      },
      {
        method: 'GET',
        path: '/api/providers/me?key=...',
        auth: 'Provider API key',
        description: 'Provider dashboard profile, earnings, recent jobs, and GPU status.',
        response: `{
  "provider": { "id": 42, "status": "online", "total_jobs": 19 },
  "recent_jobs": []
}`,
      },
      {
        method: 'GET',
        path: '/api/providers/download/daemon?key=...',
        auth: 'Provider API key',
        description: 'Downloads dc1_daemon.py with injected API key and backend URL.',
        response: '# Python file bytes',
      },
      {
        method: 'GET',
        path: '/api/providers/download/setup?key=...&os=windows',
        auth: 'Provider API key',
        description: 'Downloads OS-specific setup script (Windows/Linux/Mac).',
        response: '# PowerShell or shell script bytes',
      },
      {
        method: 'GET',
        path: '/api/providers/earnings?key=...',
        auth: 'Provider API key',
        description: 'Returns earnings, available balance, and escrow totals (halala + SAR).',
        response: `{
  "total_earned_halala": 12500,
  "available_halala": 9800,
  "available_sar": "98.00"
}`,
      },
    ],
  },
  {
    id: 'renters',
    title: 'Renter Endpoints',
    endpoints: [
      {
        method: 'POST',
        path: '/api/renters/register',
        auth: 'None',
        description: 'Register renter account and return renter API key.',
        request: `{
  "name": "Acme AI",
  "email": "renter@example.com",
  "organization": "Acme"
}`,
        response: `{
  "success": true,
  "renter_id": 7,
  "api_key": "dc1-renter-..."
}`,
      },
      {
        method: 'GET',
        path: '/api/renters/me?key=...',
        auth: 'Renter API key',
        description: 'Renter profile, balance, and recent jobs.',
        response: `{
  "renter": { "id": 7, "balance_halala": 5000 },
  "recent_jobs": []
}`,
      },
      {
        method: 'GET',
        path: '/api/renters/available-providers',
        auth: 'Public',
        description: 'List online providers for marketplace and job placement.',
        response: `{
  "providers": [{ "id": 42, "gpu_model": "RTX 4090", "is_live": true }],
  "total": 1
}`,
      },
      {
        method: 'POST',
        path: '/api/renters/topup',
        auth: 'Renter API key (header/query)',
        description: 'Sandbox top-up endpoint for non-production environments.',
        request: `{
  "amount_sar": 100
}`,
        response: `{
  "success": true,
  "topped_up_halala": 10000,
  "new_balance_halala": 15000
}`,
      },
    ],
  },
  {
    id: 'jobs',
    title: 'Job Endpoints',
    endpoints: [
      {
        method: 'POST',
        path: '/api/jobs/submit',
        auth: 'x-renter-key',
        description: 'Submit compute job with pre-pay billing hold in halala.',
        request: `{
  "provider_id": 42,
  "job_type": "llm_inference",
  "duration_minutes": 30,
  "params": { "prompt": "Explain transformers" }
}`,
        response: `{
  "success": true,
  "job": { "job_id": "job-...", "status": "pending", "cost_halala": 450 }
}`,
      },
      {
        method: 'GET',
        path: '/api/jobs/:job_id',
        auth: 'Provider/Renter/Admin',
        description: 'Fetch job state, queue position, and timing.',
        response: `{
  "job": { "job_id": "job-...", "status": "running" }
}`,
      },
      {
        method: 'GET',
        path: '/api/jobs/:job_id/output',
        auth: 'Provider/Renter/Admin',
        description: 'Poll output; returns 202 while running, 200 when completed.',
        response: `{
  "type": "text",
  "response": "Model output...",
  "billing": { "actual_cost_halala": 480 }
}`,
      },
      {
        method: 'POST',
        path: '/api/jobs/:job_id/result',
        auth: 'Provider/Admin',
        description: 'Daemon settles job result and billing.',
        request: `{
  "result": "done",
  "duration_seconds": 620
}`,
        response: `{
  "success": true,
  "billing": { "actual_cost_halala": 160, "provider_earned_halala": 120 }
}`,
      },
      {
        method: 'GET',
        path: '/api/jobs/history',
        auth: 'x-renter-key',
        description: 'Renter job history with cost in halala and SAR.',
        response: `{
  "balance_halala": 4520,
  "jobs": []
}`,
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payment Endpoints',
    endpoints: [
      {
        method: 'POST',
        path: '/api/payments/topup',
        auth: 'x-renter-key',
        description: 'Initiate Moyasar SAR top-up. Returns hosted checkout URL.',
        request: `{
  "amount_sar": 250,
  "source_type": "mada"
}`,
        response: `{
  "success": true,
  "payment_id": "pay_...",
  "checkout_url": "https://..."
}`,
      },
      {
        method: 'POST',
        path: '/api/payments/webhook',
        auth: 'Moyasar HMAC signature',
        description: 'Gateway webhook for payment status and balance crediting.',
        response: `{
  "received": true,
  "action": "balance_credited"
}`,
      },
      {
        method: 'GET',
        path: '/api/payments/history',
        auth: 'x-renter-key',
        description: 'Paginated renter payment history with totals.',
        response: `{
  "payments": [],
  "summary": { "total_paid_halala": 12000 }
}`,
      },
    ],
  },
  {
    id: 'admin',
    title: 'Admin Endpoints',
    endpoints: [
      {
        method: 'GET',
        path: '/api/admin/dashboard',
        auth: 'x-admin-token',
        description: 'Top-level operational and financial platform stats.',
        response: `{
  "stats": { "total_providers": 120, "online_now": 48 }
}`,
      },
      {
        method: 'GET',
        path: '/api/admin/providers',
        auth: 'x-admin-token',
        description: 'Provider list with filtering and pagination.',
        response: `{
  "total": 120,
  "providers": []
}`,
      },
      {
        method: 'GET',
        path: '/api/admin/jobs/:id',
        auth: 'x-admin-token',
        description: 'Detailed job view including billing split.',
        response: `{
  "job": { "job_id": "job-..." },
  "billing": { "cost_halala": 450 }
}`,
      },
      {
        method: 'GET',
        path: '/api/admin/daemon-health',
        auth: 'x-admin-token',
        description: 'Fleet event and crash health view over the selected window.',
        response: `{
  "summary": { "total_events": 83, "providers_online": 48 }
}`,
      },
    ],
  },
]

function methodClass(method: Endpoint['method']) {
  if (method === 'POST') return 'bg-blue-500/15 text-blue-200 border-blue-400/40'
  if (method === 'DELETE') return 'bg-red-500/15 text-red-200 border-red-400/40'
  return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
}

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-dc1-void">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.16em] text-dc1-amber">DCP API</p>
          <h1 className="mt-2 text-3xl font-bold text-dc1-text-primary sm:text-4xl">API Reference</h1>
          <p className="mt-3 text-dc1-text-secondary">
            Base URL: <code className="rounded bg-dc1-surface-l3 px-1 py-0.5">https://dcp.sa/api/dc1</code> (Vercel proxy) or{' '}
            <code className="rounded bg-dc1-surface-l3 px-1 py-0.5">http://76.13.179.86:8083/api</code>.
          </p>

          <div className="mt-6 grid gap-4 rounded-xl border border-dc1-border bg-dc1-surface-l2 p-4 text-sm text-dc1-text-secondary sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-dc1-text-primary">Authentication</h2>
              <ul className="mt-2 space-y-1">
                <li>Provider: <code>?key=</code> or <code>x-provider-key</code></li>
                <li>Renter: <code>?key=</code> or <code>x-renter-key</code></li>
                <li>Admin: <code>x-admin-token</code></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-dc1-text-primary">Currency</h2>
              <p className="mt-2">All billing uses halala internally. 100 halala = 1 SAR.</p>
            </div>
          </div>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-dc1-text-primary">Guides</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/docs/provider-guide"
                className="inline-flex items-center gap-2 rounded-lg border border-dc1-amber/30 bg-dc1-amber/5 px-4 py-2 text-sm text-dc1-amber transition hover:bg-dc1-amber/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Provider Quickstart
              </Link>
              <Link
                href="/docs/renter-guide"
                className="inline-flex items-center gap-2 rounded-lg border border-dc1-border bg-dc1-surface-l2 px-4 py-2 text-sm text-dc1-text-secondary transition hover:text-dc1-amber hover:border-dc1-amber/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Renter Quickstart
              </Link>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-semibold text-dc1-text-primary">Table of Contents</h2>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-dc1-text-secondary transition hover:text-dc1-amber">
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="space-y-4">
              <h2 className="text-2xl font-bold text-dc1-text-primary">{section.title}</h2>

              {section.endpoints.map((endpoint) => (
                <article
                  key={`${endpoint.method}-${endpoint.path}`}
                  className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-5"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded border px-2 py-1 text-xs font-semibold ${methodClass(endpoint.method)}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-sm text-dc1-text-primary">{endpoint.path}</code>
                  </div>

                  <p className="mt-3 text-sm text-dc1-text-secondary">{endpoint.description}</p>
                  <p className="mt-2 text-xs text-dc1-text-muted">Auth: {endpoint.auth}</p>

                  {endpoint.request && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Example Request</p>
                      <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 text-xs text-dc1-text-secondary">
                        {endpoint.request}
                      </pre>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-dc1-text-muted">Example Response</p>
                    <pre className="overflow-x-auto rounded-lg border border-dc1-border bg-dc1-surface-l2 p-3 text-xs text-dc1-text-secondary">
                      {endpoint.response}
                    </pre>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  )
}
