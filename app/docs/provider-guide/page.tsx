import LegalPage from '@/app/components/layout/LegalPage'

export default function ProviderGuidePage() {
  return (
    <LegalPage title="Provider Guide" lastUpdated="March 12, 2026">
      <h2>Overview</h2>
      <p>As a DC1 provider, you share your GPU hardware to earn revenue from compute jobs. This guide walks you through the entire process from registration to earning.</p>

      <h2>Step 1: Register</h2>
      <p>Visit <a href="/provider/register">dcp.sa/provider/register</a> and fill in your details: name, email, GPU model, and operating system. After registration, you will receive a unique API key — save this key securely, it is your authentication credential.</p>

      <h2>Step 2: Install the Daemon</h2>
      <p>After registration, you will see platform-specific install commands:</p>
      <p><strong>Linux / macOS:</strong></p>
      <p>Run the curl command shown on screen to download and start the DC1 daemon. The daemon is a Python script that connects your GPU to the DC1 network.</p>
      <p><strong>Windows:</strong></p>
      <p>Run the PowerShell command shown on screen. This downloads and executes the setup script which installs the daemon as a background service.</p>

      <h2>Step 3: Daemon Connection</h2>
      <p>Once running, the daemon sends a heartbeat every 30 seconds with your GPU status (model, VRAM, temperature, utilization). The registration page will show your status change from &quot;waiting&quot; to &quot;online&quot; in real-time.</p>

      <h2>Step 4: Receiving Jobs</h2>
      <p>When a renter submits a job that matches your GPU, the daemon automatically picks it up, runs the computation, and reports the result back. You don&apos;t need to do anything — the daemon handles everything.</p>

      <h2>Supported Job Types</h2>
      <ul>
        <li><strong>LLM Inference</strong> — Running large language models (billed at 15 halala/min)</li>
        <li><strong>Image Generation</strong> — Stable Diffusion and similar models (billed at 20 halala/min)</li>
      </ul>

      <h2>Earnings</h2>
      <p>You receive 75% of compute revenue. Earnings are tracked in real-time on your provider dashboard at <a href="/provider">dcp.sa/provider</a>. The dashboard shows today&apos;s earnings, weekly earnings, total earnings, and completed jobs.</p>

      <h2>Managing Your Provider</h2>
      <ul>
        <li><strong>Pause</strong> — Temporarily stop receiving jobs (your GPU stays registered)</li>
        <li><strong>Resume</strong> — Start receiving jobs again after a pause</li>
        <li><strong>Settings</strong> — Configure run mode (always-on or scheduled), GPU usage caps, VRAM reserve, and temperature limits</li>
      </ul>

      <h2>Requirements</h2>
      <ul>
        <li>NVIDIA GPU with CUDA support</li>
        <li>Python 3.8 or later</li>
        <li>Stable internet connection</li>
        <li>At least 4GB VRAM (8GB+ recommended for image generation)</li>
      </ul>

      <h2>Troubleshooting</h2>
      <p>If your daemon shows as offline, check that the Python process is running and that your firewall allows outbound HTTPS connections. For further help, visit <a href="/support">dcp.sa/support</a>.</p>
    </LegalPage>
  )
}
