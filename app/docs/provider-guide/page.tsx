import LegalPage from '@/app/components/layout/LegalPage'

export default function ProviderGuidePage() {
  return (
    <LegalPage title="Provider Guide" lastUpdated="March 19, 2026">
      <h2>Overview</h2>
      <p>As a DC1 provider, you share your GPU hardware to earn revenue from compute jobs. This guide walks you through the entire process from registration to earning.</p>

      <h2>Step 1: Register</h2>
      <p>Visit <a href="/provider/register">dcp.sa/provider/register</a> and fill in your details: name, email, GPU model, and operating system. After registration, you will receive a unique API key — save this key securely, it is your authentication credential.</p>

      <h2>Step 2: Install the Daemon</h2>
      <p>After registration, you will see platform-specific install commands:</p>
      <p><strong>Important:</strong> You must run <strong>dc1_daemon.py v3.3.0 or later</strong>. Older daemon versions do not support HMAC-signed heartbeats and will be rejected by the API. Always download the daemon fresh from the registration page or via the SDK to ensure you have the current version.</p>
      <p><strong>Linux / macOS:</strong></p>
      <p>Run the curl command shown on screen to download and start the DC1 daemon. The daemon is a Python script that connects your GPU to the DC1 network.</p>
      <p><strong>Windows:</strong></p>
      <p>Run the PowerShell command shown on screen. This downloads and executes the setup script which installs the daemon as a background service.</p>

      <h2>Step 3: Daemon Connection</h2>
      <p>Once running, the daemon sends a heartbeat every 30 seconds with your GPU status (model, VRAM, temperature, utilization). Each heartbeat is HMAC-signed with your API key so DC1 can verify it came from your machine. The registration page will show your status change from &quot;waiting&quot; to &quot;online&quot; in real-time.</p>

      <h2>Step 4: Receiving Jobs</h2>
      <p>When a renter submits a job that matches your GPU, the daemon automatically picks it up, runs the computation, and reports the result back. You don&apos;t need to do anything — the daemon handles everything.</p>

      <h2>Supported Job Types</h2>
      <ul>
        <li><strong>LLM Inference</strong> — Running large language models (billed at 15 halala/min)</li>
        <li><strong>Image Generation</strong> — Stable Diffusion and similar models (billed at 20 halala/min)</li>
      </ul>

      <h2>Model VRAM Requirements</h2>
      <p>The vLLM Serve presets in DC1 currently support these models. Values below are practical estimates for FP16 inference (weights + runtime overhead), verified from Hugging Face model pages and model-sizer reports on March 19, 2026.</p>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Minimum VRAM (FP16)</th>
            <th>Recommended VRAM</th>
            <th>Fits 12 GB GPU?</th>
            <th>Fits 8 GB GPU?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>TinyLlama-1.1B</td>
            <td>2 GB</td>
            <td>3 GB</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Gemma-2B-it</td>
            <td>5 GB</td>
            <td>6 GB</td>
            <td>Yes</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Phi-3-mini-4k</td>
            <td>8 GB</td>
            <td>10 GB</td>
            <td>Yes</td>
            <td>Borderline (usually no)</td>
          </tr>
          <tr>
            <td>Mistral-7B</td>
            <td>14 GB</td>
            <td>16 GB</td>
            <td>No</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Llama-3-8B</td>
            <td>16 GB</td>
            <td>18 GB</td>
            <td>No</td>
            <td>No</td>
          </tr>
        </tbody>
      </table>
      <p><strong>Notes:</strong> 8 GB cards may run very small models only, and may fail under concurrent load. 12 GB cards are suitable for TinyLlama, Gemma, and most Phi-3 runs, but not for Mistral-7B/Llama-3-8B at FP16. Use quantization if you need larger models on lower VRAM hardware.</p>

      <h2>Earnings</h2>
      <p>You receive 75% of compute revenue. Earnings are tracked in real-time on your provider dashboard at <a href="/provider">dcp.sa/provider</a>. The dashboard shows today&apos;s earnings, weekly earnings, total earnings, and completed jobs.</p>

      <h2>Withdrawing Earnings</h2>
      <p>Once your claimable balance reaches the minimum threshold, you can request a payout. Minimum withdrawal is <strong>10 SAR</strong>. Processing takes 1–3 business days via bank transfer.</p>
      <p>Submit a withdrawal via the dashboard or directly via the API:</p>
      <pre><code>{`POST /api/providers/withdraw
Content-Type: application/json

{
  "api_key": "dc1-provider-<your-key>",
  "amount_sar": 50.00,
  "payout_method": "bank_transfer",
  "payout_details": {
    "iban": "SA0000000000000000000000",
    "account_name": "Khalid Al-Harbi"
  }
}`}</code></pre>
      <p>A successful request returns a <code>withdrawal_id</code> and status <code>pending</code>. Track past payouts at <code>GET /api/providers/withdrawal-history?key=&lt;your-key&gt;</code>.</p>

      <h2>dc1_provider Python SDK</h2>
      <p>For custom integrations, automated pipelines, or building on top of DC1, use the official Python SDK instead of calling the HTTP API directly.</p>
      <p><strong>Install:</strong></p>
      <pre><code>pip install dc1_provider</code></pre>
      <p><em>Note: the package is being published to PyPI. Until then, install from source:</em> <code>pip install ./sdk/python</code></p>
      <p><strong>Register a new provider account:</strong></p>
      <pre><code>{`from dc1_provider import DC1ProviderClient

client = DC1ProviderClient()  # no api_key needed for registration
result = client.register(
    name="Khalid GPU Farm",
    email="khalid@example.com",
    gpu_model="RTX 4090",
)
print("API key:", result["api_key"])  # save this`}</code></pre>
      <p><strong>Send a heartbeat and poll for jobs:</strong></p>
      <pre><code>{`from dc1_provider import DC1ProviderClient

client = DC1ProviderClient(api_key="dc1-provider-abc123")

# Advertise your hardware capacity
spec = client.build_resource_spec()  # auto-detects GPU via nvidia-smi
client.announce(spec)

# Poll for queued jobs
jobs = client.get_jobs(status="queued")
for job in jobs:
    print(f"Job {job.id}: {job.job_type} — {job.earnings_sar:.2f} SAR")`}</code></pre>
      <p><strong>Check your earnings:</strong></p>
      <pre><code>{`e = client.get_earnings()
print(f"Available: {e.available_sar:.2f} SAR")
print(f"Total earned: {e.total_earned_sar:.2f} SAR")`}</code></pre>
      <p>The SDK handles API key auth, retries, and response parsing. See <a href="/docs/api">API Reference</a> for the full endpoint list.</p>

      <h2>Managing Your Provider</h2>
      <ul>
        <li><strong>Pause</strong> — Temporarily stop receiving jobs (your GPU stays registered)</li>
        <li><strong>Resume</strong> — Start receiving jobs again after a pause</li>
        <li><strong>Settings</strong> — Configure run mode (always-on or scheduled), GPU usage caps, VRAM reserve, and temperature limits</li>
      </ul>

      <h2>Requirements</h2>

      <h3>Hardware</h3>
      <ul>
        <li><strong>NVIDIA GPU</strong> — Any NVIDIA GPU with CUDA compute capability 6.0+ (Pascal/GTX 10-series or newer)</li>
        <li><strong>VRAM</strong> — Minimum 4 GB. 8 GB+ required for image generation jobs. 16 GB+ recommended for LLM inference.</li>
        <li><strong>RAM</strong> — Minimum 8 GB system RAM. 16 GB+ recommended.</li>
        <li><strong>Disk</strong> — At least 30 GB free for Docker images and job working directories.</li>
        <li><strong>Internet</strong> — Stable broadband connection. Outbound HTTPS (port 443) must be open.</li>
      </ul>

      <h3>Software (Linux)</h3>
      <ul>
        <li><strong>OS</strong> — Ubuntu 20.04, 22.04, or 24.04 (recommended). Debian 11/12 and RHEL/Rocky 8/9 also supported.</li>
        <li><strong>NVIDIA Driver</strong> — Version 450.x or newer. Install via <code>sudo apt install nvidia-driver-545</code> or from <a href="https://www.nvidia.com/download/index.aspx">nvidia.com/download</a>. Verify with <code>nvidia-smi</code>.</li>
        <li><strong>Docker Engine</strong> — Version 20.10 or newer. The setup script installs Docker automatically if not present.</li>
        <li><strong>NVIDIA Container Toolkit</strong> — Enables GPU access inside Docker containers. The setup script installs and configures this automatically. Verify with <code>docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi</code>.</li>
        <li><strong>Python 3.8+</strong> — The daemon requires Python 3.8 or later with the <code>requests</code> and <code>psutil</code> packages.</li>
      </ul>

      <h3>Software (Windows)</h3>
      <ul>
        <li><strong>OS</strong> — Windows 10/11 (64-bit)</li>
        <li><strong>NVIDIA Driver</strong> — Version 450.x or newer</li>
        <li><strong>Python 3.8+</strong> — Available from <a href="https://python.org">python.org</a></li>
        <li><strong>Docker Desktop</strong> — Optional. Jobs run in bare-metal mode on Windows without Docker.</li>
      </ul>

      <h2>Job Execution Security</h2>
      <p>All compute jobs run inside isolated Docker containers with strict security controls:</p>
      <ul>
        <li><strong>Network isolation</strong> — Containers have no internet access (<code>--network none</code>). Job scripts cannot make outbound connections.</li>
        <li><strong>GPU passthrough</strong> — NVIDIA Container Toolkit provides direct GPU access inside the container via <code>--gpus all</code>. All GPU capabilities (CUDA, cuDNN, Tensor Cores) are available.</li>
        <li><strong>Read-only filesystem</strong> — The container root filesystem is immutable. Writable scratch space is provided via <code>/tmp</code> only.</li>
        <li><strong>Resource limits</strong> — CPU, RAM, and PID limits prevent runaway jobs from affecting your system.</li>
        <li><strong>Automatic cleanup</strong> — Containers are removed after each job. No state persists between jobs.</li>
      </ul>
      <p>If Docker or the NVIDIA Container Toolkit is unavailable, the daemon falls back to bare-metal execution mode automatically.</p>

      <h2>Troubleshooting</h2>
      <ul>
        <li><strong>Daemon offline</strong> — Check the Python process is running: <code>systemctl status dc1-provider</code> (Linux) or check Task Manager (Windows).</li>
        <li><strong>GPU not detected</strong> — Ensure NVIDIA drivers are installed and <code>nvidia-smi</code> works before running the setup script.</li>
        <li><strong>Docker GPU test fails</strong> — Run <code>docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi</code> manually to diagnose. Usually means NVIDIA Container Toolkit needs to be reinstalled.</li>
        <li><strong>Firewall issues</strong> — Allow outbound HTTPS to <code>api.dcp.sa</code> (port 443). The daemon does not require any inbound ports.</li>
      </ul>
      <p>For further help, visit <a href="/support">dcp.sa/support</a>.</p>
    </LegalPage>
  )
}
