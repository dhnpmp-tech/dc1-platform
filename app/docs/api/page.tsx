import LegalPage from '@/app/components/layout/LegalPage'

export default function ApiDocsPage() {
  return (
    <LegalPage title="API Reference" lastUpdated="March 12, 2026">
      <h2>Base URL</h2>
      <p>All API endpoints are available at <strong>https://dc1st.com/api/dc1</strong> (proxied) or directly at <strong>http://76.13.179.86:8083/api</strong>.</p>

      <h2>Authentication</h2>
      <p>Most endpoints require an API key. Providers pass their key as a <strong>?key=</strong> query parameter. Admin endpoints require an <strong>x-admin-token</strong> header.</p>

      <h2>Provider Endpoints</h2>

      <p><strong>POST /api/providers/register</strong></p>
      <p>Register a new GPU provider. Body: name, email, gpu_model, os, phone (optional). Returns: provider_id, api_key, installer_url.</p>

      <p><strong>GET /api/providers/me?key=KEY</strong></p>
      <p>Fetch provider dashboard data including status, earnings, GPU metrics, and active job info.</p>

      <p><strong>POST /api/providers/heartbeat</strong></p>
      <p>Daemon heartbeat with GPU stats. Sent automatically by the DC1 daemon every 30 seconds.</p>

      <p><strong>POST /api/providers/pause</strong></p>
      <p>Pause the provider. Body: key. Provider will stop receiving new jobs.</p>

      <p><strong>POST /api/providers/resume</strong></p>
      <p>Resume a paused provider. Body: key.</p>

      <p><strong>GET /api/providers/download/daemon?key=KEY</strong></p>
      <p>Download the DC1 daemon Python script with the API key pre-injected.</p>

      <p><strong>GET /api/providers/download/setup?key=KEY&amp;os=windows</strong></p>
      <p>Download platform-specific installer script (Linux shell or Windows PowerShell).</p>

      <h2>Renter Endpoints</h2>

      <p><strong>POST /api/renters/register</strong></p>
      <p>Register a new renter. Body: name, email, organization (optional). Returns: renter_id, api_key.</p>

      <p><strong>GET /api/renters/me?key=KEY</strong></p>
      <p>Fetch renter dashboard data including balance, usage stats, and recent jobs.</p>

      <p><strong>GET /api/renters/available-providers</strong></p>
      <p>List all online GPU providers available for job submission.</p>

      <p><strong>POST /api/jobs/submit</strong></p>
      <p>Submit a compute job. Body: renter_key, provider_id, job_type (llm or image_gen), prompt, model.</p>

      <p><strong>GET /api/jobs/JOB_ID/output?key=KEY</strong></p>
      <p>Poll for job output. Returns status, result text/image, execution time, and billing breakdown.</p>

      <h2>Billing</h2>
      <p>LLM inference: 15 halala/minute. Image generation: 20 halala/minute. Revenue split: 75% provider, 25% DC1. All amounts in halala (1/100 SAR).</p>

      <h2>Rate Limits</h2>
      <p>API endpoints are currently not rate-limited during beta. This will change as the platform scales.</p>
    </LegalPage>
  )
}
