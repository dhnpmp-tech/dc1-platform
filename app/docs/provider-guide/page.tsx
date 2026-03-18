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
