# Provider Setup Guide — Start Earning in 5 Minutes

**Time required:** 5 minutes
**Difficulty:** Easy (no coding)
**Prerequisite:** GPU with 8+ GB VRAM

---

## Overview

This guide walks you through registering your GPU and starting to earn SAR. You'll:
1. Register on DCP (2 min)
2. Download the daemon (1 min)
3. Start the daemon (2 min)
4. Get your first job (automatic)

---

## Step 1: Register Your GPU (2 minutes)

### 1a. Go to Provider Registration
Visit: https://dcp.sa/provider/register

### 1b. Enter Your Information
- **Email:** Your contact email (for earnings withdrawals)
- **Full Name:** Your name or business name
- **Phone:** For important notifications
- **Wallet Address:** Your bank account for payouts (required)
- **GPU Type:** Select from dropdown (RTX 3060, RTX 4090, A40, H100, etc.)
- **VRAM:** How much VRAM your GPU has (8 GB, 16 GB, 24 GB, etc.)

### 1c. Agree & Register
- ✓ Agree to Terms of Service
- ✓ Agree to Privacy Policy
- Click **"Register"**

### What You'll Get
- **Provider ID:** Unique identifier for your node (copy this)
- **Auth Token:** Secret key to authenticate your daemon (save this safely!)
- **Dashboard Link:** https://dcp.sa/provider/dashboard

---

## Step 2: Install the Daemon (1 minute)

### 2a. System Requirements
Before proceeding, ensure you have:
- ✅ Ubuntu 20.04 LTS (or later)
- ✅ NVIDIA GPU (RTX 3000 series or newer)
- ✅ NVIDIA Container Toolkit installed
- ✅ Docker 20.10+ installed
- ✅ 100+ Mbps internet connection

**Not sure if you have these?** Run this command:
```bash
nvidia-smi                    # Check if NVIDIA drivers are installed
docker --version              # Check if Docker is installed
nvidia-docker run --rm nvidia/cuda:12.0.0 nvidia-smi   # Check if Container Toolkit is ready
```

### 2b. Download the Daemon
```bash
# Download the latest daemon
curl -O https://dcp.sa/releases/dcp-daemon-v3.0.tar.gz

# Extract
tar -xzf dcp-daemon-v3.0.tar.gz
cd dcp-daemon
```

### 2c. Configure
```bash
# Create a config file with your credentials
cat > config.env << EOF
PROVIDER_ID=YOUR_PROVIDER_ID_HERE
AUTH_TOKEN=YOUR_AUTH_TOKEN_HERE
GPU_TYPE=RTX_4090    # Change to your GPU type
CACHE_DIR=/opt/dcp/model-cache
EOF
```

**Where to find these:**
- Provider ID: Your email (DCP sends this)
- Auth Token: Email from DCP (save this!)

### 2d. Install
```bash
# Run the installer
bash install.sh

# This will:
# - Create /opt/dcp directory
# - Download model cache (2-3 GB, can take a few minutes)
# - Set up daemon as system service
# - Configure auto-restart on reboot
```

**What if the installer fails?**
- Check internet connection: `ping 8.8.8.8`
- Check disk space: `df -h` (need 50 GB minimum)
- Check NVIDIA drivers: `nvidia-smi`
- Email support@dcp.sa if still stuck

---

## Step 3: Start the Daemon (2 minutes)

### 3a. Start Now
```bash
pm2 start dcp-daemon --name="dcp-daemon"
```

### 3b. Verify It's Running
```bash
# Check status
pm2 status

# Check logs (should show "Ready to accept jobs")
pm2 logs dcp-daemon | tail -20
```

### 3c. Keep It Running
The daemon will automatically:
- Start when your machine reboots
- Restart if it crashes
- Update itself when new versions are available

To stop it (if needed):
```bash
pm2 stop dcp-daemon
pm2 restart dcp-daemon
```

---

## Step 4: Get Your First Job

### 4a. Wait for Jobs
Your daemon is now online and visible to renters. Jobs will start arriving automatically within a few hours.

### 4b. Monitor Earnings
Visit your dashboard: https://dcp.sa/provider/dashboard

You'll see:
- **Status:** Online ✓ (green means you're accepting jobs)
- **Jobs:** How many jobs you've completed
- **Earnings:** How much SAR you've earned
- **Uptime:** % of time daemon has been online (99%+ is excellent)

### 4c. Withdraw Earnings
Once you have earnings:
1. Go to Dashboard → Withdraw
2. Enter amount (Min 50 SAR, Max 100,000 SAR/day)
3. Earnings transfer to your bank within 1-2 business days

---

## Monitoring Your Node

### Real-Time Dashboard
https://dcp.sa/provider/dashboard shows:
- **Status:** Online/Offline (green/red)
- **GPU Utilization:** Current GPU load (%)
- **Last Job:** When your last job ran
- **Reputation Score:** Your rating (0-100, higher is better)
- **Uptime:** % of time online (target: 99%+)

### Keep Node Healthy
**Check once a day:**
```bash
# Verify daemon is running
pm2 status dcp-daemon

# Check disk space (should have >20 GB free)
df -h /opt/dcp

# Check GPU health
nvidia-smi
```

**If you see issues:**
- Daemon offline? → `pm2 restart dcp-daemon`
- Disk full? → Remove old model cache: `rm -rf /opt/dcp/model-cache/*`
- GPU errors? → Check NVIDIA drivers: `nvidia-smi`

---

## Earn More

### Maximize Your Earnings

**1. High Uptime (Target: 99%+)**
- High-uptime providers get more jobs
- Keep your machine on 24/7
- Make sure internet is stable (target: 99%+ uptime)

**2. Fast Response**
- First job = 2-15 minutes (cold start, models download)
- Subsequent jobs = <30 seconds (models cached)
- Target: p50 latency <200ms

**3. Add More GPUs**
- Have another GPU? Register it separately
- Earnings stack per GPU
- Helps balance load across devices

**4. Refer Other Providers**
- Share your referral link: https://dcp.sa/provider/register?ref=YOUR_PROVIDER_ID
- Earn 500 SAR per successful referral
- Unlimited referrals, unlimited earnings

---

## Troubleshooting

### Daemon Won't Start
```bash
# Check logs
pm2 logs dcp-daemon

# Common issues:
# - "Port 8000 already in use" → Kill process: lsof -i :8000 | kill
# - "Permission denied" → Run as sudo: sudo pm2 start dcp-daemon
# - "CUDA error" → NVIDIA drivers issue: nvidia-smi
```

**Contact:** support@dcp.sa

### Not Getting Jobs
1. Verify you're online: Visit dashboard, status should be green
2. Check uptime: If <95%, you might not be prioritized
3. Check latency: If >1000ms, renters won't use you
4. Wait: New providers take 24 hours to warm up

**Contact:** support@dcp.sa

### GPU Running Hot
```bash
# Monitor temperature
watch -n 1 nvidia-smi

# If >85°C:
# - Check cooling (fans running?)
# - Reduce daemon priority: pm2 set dcp-daemon max_memory 8G
# - Take a break (pause 1-2 hours)
```

**Contact:** support@dcp.sa (if persistent)

### Model Cache Issues
```bash
# Check cache size
du -sh /opt/dcp/model-cache

# Clear cache if needed (be careful—reduces speed)
rm -rf /opt/dcp/model-cache/*

# Reload cache
systemctl restart dcp-daemon
```

---

## Security Best Practices

### Protect Your Credentials
- ✅ Keep your **auth token** secret (don't share, don't commit to GitHub)
- ✅ Keep your **provider ID** safe (less critical but still private)
- ✅ Use strong password for DCP account (12+ characters)
- ✅ Enable 2FA on your email (for account recovery)

### Monitor Your Account
- Check dashboard daily (for suspicious activity)
- Review earnings weekly (watch for unusual patterns)
- Report abuse: abuse@dcp.sa

### System Security
- ✅ Keep OS updated: `sudo apt update && sudo apt upgrade`
- ✅ Keep Docker updated: `docker --version`
- ✅ Keep NVIDIA drivers updated: `nvidia-smi`
- ✅ Use firewall (port 8000 shouldn't be exposed to internet)

---

## FAQ

**Q: Do I need to pay anything upfront?**
A: No. Zero upfront cost. You only make money, you don't spend it.

**Q: What if my internet goes down?**
A: Your daemon goes offline. Renters stop using you. Get back online ASAP to get jobs again.

**Q: Can I run multiple daemons on one machine?**
A: No. One daemon per machine. To run multiple GPUs, register each GPU separately (one machine per GPU).

**Q: How often do I get jobs?**
A: Depends on your uptime, latency, and GPU model. Busy GPUs (RTX 4090) get jobs every few minutes. Slower GPUs might get 1-2 jobs/hour.

**Q: Do I need to do anything to accept jobs?**
A: No. Once daemon is running, it automatically accepts and completes jobs.

**Q: When do I get paid?**
A: Earnings appear in dashboard in real-time. You can withdraw anytime (Min 50 SAR, Max 100,000 SAR/day). Transfers take 1-2 business days.

**Q: What if a job fails?**
A: We refund the renter automatically. You keep your share (75%) because you attempted the work.

**Q: Can I pause the daemon?**
A: Yes: `pm2 stop dcp-daemon`. You stop getting jobs until you restart it.

**Q: What happens if my machine crashes?**
A: Daemon auto-restarts (if OS boots). Running jobs are failed and refunded to renters. You don't lose anything.

---

## Next Steps

1. **Register:** https://dcp.sa/provider/register
2. **Download & Install:** Follow Step 2 above
3. **Start Daemon:** Follow Step 3 above
4. **Monitor Dashboard:** https://dcp.sa/provider/dashboard
5. **Earn:** Jobs arrive automatically

**Questions?** Email support@dcp.sa
**Issues?** Check Troubleshooting section above
**Security concern?** Email security@dcp.sa

---

**Time from now to earning:** ~30 minutes (including model cache download)
