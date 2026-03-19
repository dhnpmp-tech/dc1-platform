import LegalPage from '@/app/components/layout/LegalPage'

export default function ApiDocsPage() {
  return (
    <LegalPage title="API Reference" lastUpdated="March 14, 2026">
      <h2>Base URL</h2>
      <p>All API endpoints are available at <strong>https://dcp.sa/api/dc1</strong> (proxied) or directly at <strong>http://76.13.179.86:8083/api</strong>.</p>

      <h2>Authentication</h2>
      <p>Most endpoints require an API key. Providers pass their key as a <strong>?key=</strong> query parameter. Admin endpoints require an <strong>x-admin-token</strong> header.</p>

      <h2>Error Responses</h2>
      <p>All endpoints return JSON error objects on failure:</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "error": "Description of what went wrong"
}

Common HTTP Status Codes:
  200  Success
  201  Created (registration)
  400  Bad Request (missing required fields)
  401  Unauthorized (invalid or missing API key)
  404  Not Found (resource does not exist)
  409  Conflict (duplicate email on registration)
  500  Internal Server Error`}
      </pre>

      <h2>Provider Endpoints</h2>

      <h3>POST /api/providers/register</h3>
      <p>Register a new GPU provider. Returns provider credentials and installer URLs.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`# Request
curl -X POST https://dcp.sa/api/dc1/providers/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My GPU Rig",
    "email": "provider@example.com",
    "gpu_model": "RTX 4090",
    "os": "linux",
    "phone": "+966500000000"
  }'

# Response (201)
{
  "provider_id": 42,
  "api_key": "dc1-provider-abc123...",
  "installer_url": "https://dcp.sa/api/dc1/providers/download/setup?key=..."
}

# Error (409) — duplicate email
{ "error": "Email already registered" }`}
      </pre>

      <h3>GET /api/providers/me?key=KEY</h3>
      <p>Fetch provider dashboard data including status, earnings, GPU metrics, and active job info.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl "https://dcp.sa/api/dc1/providers/me?key=dc1-provider-abc123"

# Response includes: id, name, email, status, gpu_model,
# gpu_status (live metrics), earnings, jobs, settings`}
      </pre>

      <h3>POST /api/providers/heartbeat</h3>
      <p>Daemon heartbeat with GPU stats. Sent automatically by the DC1 daemon every 30 seconds.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST https://dcp.sa/api/dc1/providers/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{
    "key": "dc1-provider-abc123",
    "gpu_status": {
      "gpu_name": "NVIDIA GeForce RTX 4090",
      "gpu_util": 45,
      "gpu_temp": 62,
      "gpu_vram_used": 8192,
      "gpu_vram_total": 24576,
      "gpu_driver": "550.54.14",
      "gpu_compute": "8.9"
    }
  }'`}
      </pre>

      <h3>POST /api/providers/pause</h3>
      <p>Pause the provider. Provider will stop receiving new jobs.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST https://dcp.sa/api/dc1/providers/pause \\
  -H "Content-Type: application/json" \\
  -d '{ "key": "dc1-provider-abc123" }'`}
      </pre>

      <h3>POST /api/providers/resume</h3>
      <p>Resume a paused provider.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST https://dcp.sa/api/dc1/providers/resume \\
  -H "Content-Type: application/json" \\
  -d '{ "key": "dc1-provider-abc123" }'`}
      </pre>

      <h3>GET /api/providers/download/daemon?key=KEY</h3>
      <p>Download the DC1 daemon Python script with the API key pre-injected.</p>

      <h3>GET /api/providers/download/setup?key=KEY&amp;os=windows</h3>
      <p>Download platform-specific installer script (Linux shell or Windows PowerShell).</p>

      <h2>Renter Endpoints</h2>

      <h3>POST /api/renters/register</h3>
      <p>Register a new renter account.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST https://dcp.sa/api/dc1/renters/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Company",
    "email": "renter@example.com",
    "organization": "Acme Inc"
  }'

# Response (201)
{
  "renter_id": 5,
  "api_key": "dc1-renter-xyz789..."
}`}
      </pre>

      <h3>GET /api/renters/me?key=KEY</h3>
      <p>Fetch renter dashboard data including balance, usage stats, and recent jobs.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl "https://dcp.sa/api/dc1/renters/me?key=dc1-renter-xyz789"`}
      </pre>

      <h3>GET /api/renters/available-providers</h3>
      <p>List all online GPU providers available for job submission. No authentication required.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl "https://dcp.sa/api/dc1/renters/available-providers"

# Response
{
  "providers": [
    {
      "id": 26,
      "name": "Yazan GPU",
      "gpu_model": "RTX 3090",
      "vram_mib": 24576,
      "status": "online",
      "reliability_score": 95
    }
  ],
  "total": 1
}`}
      </pre>

      <h3>POST /api/jobs/submit</h3>
      <p>Submit a compute job to a specific provider.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl -X POST https://dcp.sa/api/dc1/jobs/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "renter_key": "dc1-renter-xyz789",
    "provider_id": 26,
    "job_type": "llm",
    "prompt": "Explain quantum computing in simple terms",
    "model": "llama3"
  }'

# Response (201)
{
  "job_id": 100,
  "status": "queued",
  "provider_id": 26
}`}
      </pre>

      <h3>GET /api/jobs/:JOB_ID/output?key=KEY</h3>
      <p>Poll for job output. Returns status, result text/image, execution time, and billing breakdown.</p>
      <pre className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-sm overflow-x-auto">
{`curl "https://dcp.sa/api/dc1/jobs/100/output?key=dc1-renter-xyz789"

# Response (completed job)
{
  "job_id": 100,
  "status": "completed",
  "result": "Quantum computing uses quantum bits...",
  "execution_time_sec": 12.5,
  "cost_halala": 4,
  "provider_name": "Yazan GPU"
}`}
      </pre>

      <h2>Billing</h2>
      <p>LLM inference: <strong>15 halala/minute</strong>. Image generation: <strong>20 halala/minute</strong>. Revenue split: 75% provider, 25% DC1. All amounts in halala (1/100 SAR).</p>

      <h2>Rate Limits</h2>
      <p>API endpoints are currently not rate-limited during beta. This will change as the platform scales.</p>

      <h2>SDKs &amp; Libraries</h2>
      <p>Official SDKs are planned for Python and JavaScript. For now, use the REST API directly with any HTTP client.</p>
    </LegalPage>
  )
}
