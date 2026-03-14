import LegalPage from '@/app/components/layout/LegalPage'

export default function RenterGuidePage() {
  return (
    <LegalPage title="Renter Quickstart Guide" lastUpdated="March 14, 2026">
      <h2>Overview</h2>
      <p>As a DC1 renter, you can access powerful GPU hardware on-demand for AI inference, image generation, and other compute-intensive tasks. This guide walks you through getting started.</p>

      <h2>Step 1: Create Your Account</h2>
      <p>Visit <a href="/renter/register">dcp.sa/renter/register</a> and provide your name, email, and optional organization name. After registration, you will receive an API key — save this key securely, it authenticates all your requests.</p>
      <p>New accounts receive a <strong>10 SAR starting balance</strong> so you can try the platform immediately.</p>

      <h2>Step 2: Browse Available GPUs</h2>
      <p>Visit the <a href="/renter/marketplace">GPU Marketplace</a> to see all online providers. Each listing shows the GPU model, VRAM capacity, and current status. You can filter by GPU model to find the hardware that fits your workload.</p>

      <h2>Step 3: Run Your First Job</h2>
      <p>The easiest way to get started is the <a href="/renter/playground">GPU Playground</a>:</p>
      <ul>
        <li><strong>LLM Inference</strong> — Choose from available models (TinyLlama 1.1B, Phi-2 2.7B), enter a prompt, and adjust parameters like max tokens and temperature.</li>
        <li><strong>Image Generation</strong> — Select a Stable Diffusion model, describe your image with a prompt, and configure dimensions, steps, and seed.</li>
      </ul>
      <p>Click &quot;Run Inference&quot; or &quot;Generate Image&quot; and the platform will dispatch your job to an available GPU provider. Results typically return within seconds to minutes depending on the task.</p>

      <h2>Step 4: View Results</h2>
      <p>Job results appear directly in the Playground. You can also view all past jobs with full details at <a href="/renter/jobs">My Jobs</a>. Each job shows its type, status, cost, duration, and output.</p>

      <h2>Billing &amp; Pricing</h2>
      <ul>
        <li><strong>LLM Inference</strong> — 15 halala per minute (0.15 SAR/min)</li>
        <li><strong>Image Generation</strong> — 20 halala per minute (0.20 SAR/min)</li>
        <li><strong>Minimum charge</strong> — Each job has a minimum 1-minute charge</li>
      </ul>
      <p>Add funds to your account anytime from the <a href="/renter/billing">Billing page</a> with preset amounts (5, 10, 25, 50 SAR) or a custom amount. Your balance and spending history are visible on your dashboard.</p>

      <h2>Using the API Programmatically</h2>
      <p>You can also submit jobs via the REST API for automation and integration:</p>
      <p><strong>Submit a job:</strong></p>
      <pre>{`POST /api/dc1/jobs/submit
Content-Type: application/json
x-renter-key: your-api-key

{
  "provider_id": 26,
  "job_type": "llm_inference",
  "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
  "prompt": "What is the capital of Saudi Arabia?",
  "max_tokens": 256
}`}</pre>
      <p><strong>Check job status:</strong></p>
      <pre>{`GET /api/dc1/jobs/{job_id}?key=your-api-key`}</pre>
      <p><strong>Get job output:</strong></p>
      <pre>{`GET /api/dc1/jobs/{job_id}/output?key=your-api-key`}</pre>
      <p>See the full <a href="/docs/api">API Reference</a> for all available endpoints.</p>

      <h2>Managing Your Account</h2>
      <ul>
        <li><strong>Dashboard</strong> — View balance, recent jobs, and available GPUs at <a href="/renter">/renter</a></li>
        <li><strong>Analytics</strong> — Track spending patterns and job success rates at <a href="/renter/analytics">/renter/analytics</a></li>
        <li><strong>Settings</strong> — Manage your profile, view/rotate your API key at <a href="/renter/settings">/renter/settings</a></li>
      </ul>

      <h2>Tips</h2>
      <ul>
        <li>Start with smaller models (TinyLlama) to test your workflow before scaling up</li>
        <li>Use the &quot;Use GPU&quot; button on the Marketplace to jump directly to the Playground with a specific provider selected</li>
        <li>Check the Job History tab in the Playground to review past results and costs</li>
        <li>If a job fails, check the error message — common causes include the provider going offline mid-job or requesting a model that exceeds the GPU&apos;s VRAM</li>
      </ul>

      <h2>Need Help?</h2>
      <p>Visit our <a href="/support">Support page</a> for FAQs and contact information, or email <a href="mailto:support@dc1st.com">support@dc1st.com</a> for direct assistance.</p>
    </LegalPage>
  )
}
