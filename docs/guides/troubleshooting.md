# Troubleshooting & FAQ

**Quick Navigation:**
- [Renter Issues](#renter-issues)
- [Provider Issues](#provider-issues)
- [General Issues](#general-issues)
- [FAQ](#faq)

---

## Renter Issues

### "Job failed: Provider offline"

**What happened?**
The provider you were assigned to went offline mid-job.

**Resolution:**
- ✅ You get full refund automatically
- ✅ Resubmit your job (will assign to different provider)
- This happens <0.5% of the time

**To minimize:**
- Use providers with 99%+ uptime (visible in job submission)
- Submit less time-sensitive jobs during off-hours (more provider options)

---

### "Job took too long, timed out"

**What happened?**
Job ran longer than 5 minutes and was auto-cancelled.

**Why?**
- Provider was slow or overloaded
- Model cache needed to download (first job only)
- Job was legitimately complex

**Resolution:**
- ✅ You get full refund automatically
- ✅ Try a faster model (Nemotron Nano, Mistral 7B)
- ✅ Try again later (less provider load)

---

### "API key not working: 401 Unauthorized"

**What happened?**
Your API key is invalid or revoked.

**Resolution:**
1. Verify you're using the correct key (copy from dashboard again)
2. Check key has not expired (check Dashboard → Settings)
3. Create a new key:
   - Dashboard → Settings → API Keys
   - Click "+" to create new key
   - Delete old key (optional)

**Common mistake:**
```bash
# ❌ WRONG (forgot "-H" flag)
curl https://api.dcp.sa/api/dc1/jobs/submit sk_renter_abc...

# ✅ CORRECT
curl https://api.dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: sk_renter_abc..."
```

---

### "Insufficient balance"

**What happened?**
You tried to submit a job but don't have enough credit.

**Resolution:**
- Go to Dashboard → Billing
- Add payment method (credit card)
- Add credit (minimum 10 SAR)
- Retry job

**To check balance:**
```bash
curl https://api.dcp.sa/api/dc1/renters/balance \
  -H "x-renter-key: YOUR_KEY"
```

---

### "Model not found"

**What happened?**
You specified a model name that doesn't exist.

**Resolution:**
Use one of the available models:
```
✅ mistralai/Mistral-7B-Instruct-v0.3
✅ meta-llama/Llama-3-8b-chat
✅ Qwen/Qwen-2.5-7B-Instruct
✅ nvidia/Nemotron-3-Mini
✅ stabilityai/stable-diffusion-xl-base-1.0
```

**Full list:**
- Dashboard → Playground (dropdown shows all models)
- API: `curl https://api.dcp.sa/api/dc1/renters/available-models`

---

### "Job submission quota exceeded"

**What happened?**
You've submitted too many jobs too fast.

**Why?**
Rate limiting protects the platform from abuse.

**Resolution:**
- Standard tier: 1,000 requests/hour
- Wait a few minutes and retry
- Need higher limits? Email enterprise@dcp.sa

**To check limits:**
```bash
curl https://api.dcp.sa/api/dc1/renters/rate-limit \
  -H "x-renter-key: YOUR_KEY"
```

---

### "Cannot export job history"

**What happened?**
Export button isn't working or file didn't download.

**Resolution:**
1. Try browser's "Download" folder (file might be there)
2. Try different browser (Chrome, Firefox, Safari)
3. Try API export:
   ```bash
   curl https://api.dcp.sa/api/dc1/renters/jobs/export \
     -H "x-renter-key: YOUR_KEY" > jobs.csv
   ```
4. Email support@dcp.sa with your email address (we can send export)

---

## Provider Issues

### "Daemon won't start: 'Port 8000 already in use'"

**What happened?**
Another process is using port 8000.

**Resolution:**
```bash
# Find what's using port 8000
lsof -i :8000

# Kill the process (replace PID with actual number)
kill -9 <PID>

# Start daemon again
pm2 start dcp-daemon
```

**If that doesn't work:**
```bash
# Run daemon on different port
pm2 start dcp-daemon -- --port 8001

# Update config.env to use port 8001
```

---

### "Daemon offline but I didn't stop it"

**What happened?**
Daemon crashed or disconnected unexpectedly.

**Resolution:**
```bash
# Check daemon status
pm2 status

# Check logs (last 50 lines)
pm2 logs dcp-daemon | tail -50

# Restart
pm2 restart dcp-daemon

# Enable auto-restart (if not already)
pm2 save
pm2 startup
```

**Common causes:**
- Out of disk space: `df -h /opt/dcp`
- GPU overheating: `nvidia-smi` (check temp column)
- VRAM full: Restart to clear

---

### "GPU running hot (>85°C)"

**What happened?**
GPU temperature is too high.

**Why?**
- Continuous heavy load
- Poor cooling/ventilation
- Dust buildup on fans

**Resolution:**
1. Reduce load:
   ```bash
   # Limit to 1 job at a time
   pm2 set dcp-daemon max_concurrent_jobs 1
   ```

2. Improve cooling:
   - Clean GPU fans
   - Improve case ventilation
   - Add external fan

3. Monitor continuously:
   ```bash
   watch -n 1 nvidia-smi
   ```

4. Take breaks:
   - Pause daemon 1-2 hours to cool down
   - Resume when temp drops below 70°C

---

### "Not getting any jobs (daemon is online)"

**What happened?**
Daemon is online but no jobs are being assigned.

**Why?**
- Daemon is new (takes 24 hours to warm up)
- Uptime is low (<95%)
- Latency is high (>1000ms)
- GPU is slow compared to others

**Resolution:**
1. Check reputation score (Dashboard):
   - Uptime: Target 99%+
   - Latency: Target <500ms
   - Job completion: Target 99%+

2. Keep daemon online 24/7:
   ```bash
   pm2 save && pm2 startup
   ```

3. Monitor latency:
   ```bash
   pm2 logs dcp-daemon | grep "latency"
   ```

4. Wait: First 24 hours are slow. After that, jobs ramp up.

---

### "Getting errors: CUDA error, out of memory"

**What happened?**
GPU ran out of VRAM during job execution.

**Why?**
- Job was too large for your GPU
- Multiple jobs running simultaneously (should not happen)
- Model cache not cleaned up

**Resolution:**
1. Clear GPU memory:
   ```bash
   pm2 stop dcp-daemon
   nvidia-smi  # GPU memory should drop to 0
   pm2 start dcp-daemon
   ```

2. Clear model cache (if full):
   ```bash
   df -h /opt/dcp/model-cache
   # If >90% full:
   rm -rf /opt/dcp/model-cache/*
   ```

3. Monitor VRAM:
   ```bash
   watch -n 1 nvidia-smi
   ```

4. Downgrade to smaller models:
   - Use Nemotron Nano instead of Nemotron Super
   - Limit to models <20 GB (check specs)

---

### "Can't withdraw earnings: 'Invalid bank account'"

**What happened?**
Your withdrawal failed because bank account info is invalid.

**Resolution:**
1. Go to Dashboard → Settings → Bank Account
2. Double-check:
   - IBAN is correct (Saudi account numbers)
   - No spaces or special characters
   - Matches your registered name exactly
3. Update and retry
4. If still failing, email support@dcp.sa with account details (we'll verify)

---

### "Earnings not showing up in my bank"

**What happened?**
You initiated a withdrawal but money hasn't arrived.

**Timeline:**
- Requested: Immediate (DCP side)
- Processing: 24 hours (DCP confirms)
- Bank transfer: 1-3 business days
- In your account: 3-5 business days total

**What to do:**
- Check with your bank (they have the reference number)
- Wait 5 business days before escalating
- Email support@dcp.sa if >5 days

---

### "Reputation score dropped suddenly"

**What happened?**
Your score went from 95 to 60.

**Why?**
- A job failed (lowered completion rate)
- Went offline for a period (lowered uptime)
- Job was slow (lowered latency score)

**Resolution:**
- Keep daemon online (uptime = 40% of score)
- Keep latency low (30% of score)
- Keep jobs running (20% of score)
- Focus on getting back to 99%+ uptime

**Monitor:**
- Dashboard → Your Score (see breakdown)
- pm2 logs dcp-daemon (check for errors)

---

## General Issues

### "Timeout connecting to api.dcp.sa"

**What happened?**
Network cannot reach DCP API.

**Why?**
- Internet connection down
- DCP service down (check https://status.dcp.sa)
- Firewall blocking (corporate network)
- DNS not resolving

**Resolution:**
1. Check internet: `ping 8.8.8.8`
2. Check DNS: `nslookup api.dcp.sa`
3. Check DCP status: https://status.dcp.sa
4. Try different network (mobile hotspot to test)
5. Check firewall rules (allow port 443)

---

### "Certificate error: api.dcp.sa certificate is not valid"

**What happened?**
HTTPS certificate validation failed.

**Why:**
- System date/time is wrong
- Very rare: certificate issue on our end

**Resolution:**
1. Check system time: `date`
2. If wrong, fix it: `timedatectl set-ntp true`
3. If still failing, email security@dcp.sa

---

### "Strange characters in job output (UTF-8 encoding issue)"

**What happened?**
Arabic or special characters are showing as gibberish.

**Resolution:**
```bash
# Make sure you're requesting UTF-8
curl https://api.dcp.sa/api/dc1/jobs/JOB_ID/output \
  -H "x-renter-key: YOUR_KEY" \
  -H "Accept-Charset: utf-8"

# If using Python
response.encoding = 'utf-8'
```

---

### "Getting error: 'invalid_signature' on smart contract"

**What happened?**
Smart contract rejected your payment signature.

**Why:**
- Your wallet address doesn't match registered address
- Signature was corrupted in transit
- Contract state mismatch

**Resolution:**
1. Verify wallet address (Dashboard → Settings)
2. Try again (usually works on retry)
3. Email support@dcp.sa if persists

---

## FAQ

### General

**Q: What's the minimum/maximum job size?**
A: Tokens: 1-8000. Files: Up to 100 MB. Duration: Up to 6 hours max.

**Q: Can I cancel a job?**
A: Only if pending. Once running, you can't cancel (but can wait for timeout).

**Q: What's the latency?**
A: P50: 100-300ms. P95: 500-1000ms. Depends on model and provider.

**Q: How often is data backed up?**
A: Real-time. Database replicates every transaction immediately.

**Q: Do you monitor for illegal content?**
A: Yes. Automated detection + manual review. See COMPLIANCE.md.

---

### Renter-Specific

**Q: Can I run jobs in parallel?**
A: Yes. Submit multiple jobs simultaneously. All run independently.

**Q: Can I retry a failed job automatically?**
A: Yes. Set `auto_retry: 3` in API call. Max 3 retries.

**Q: Is billing per second or per minute?**
A: Per second. You only pay for what you use (rounded to nearest second).

**Q: Can I get a volume discount?**
A: Yes. 100+ SAR spend = 10% off. 1000+ = 20% off.

**Q: Can I prepay instead of pay-as-you-go?**
A: Yes. Add credit to your account anytime (Dashboard → Billing).

---

### Provider-Specific

**Q: What's the minimum uptime to earn?**
A: No minimum. But <95% = deprioritized. 99%+ = featured on leaderboard.

**Q: Can I run multiple daemon instances on one machine?**
A: No. Register each GPU separately (one daemon per machine).

**Q: What happens if a job submits bad output?**
A: Renter can dispute. Smart contract refunds them. You keep your payout.

**Q: Can I block specific renters or models?**
A: Not yet. Phase 2 feature. Currently: take all jobs.

**Q: What's the payout frequency?**
A: Daily (you can withdraw daily). Takes 1-2 days to reach your bank.

---

### Billing

**Q: Can I get an invoice?**
A: Yes. Dashboard → Billing → Invoices (renter) or Dashboard → Earnings → Statements (provider).

**Q: Do you accept USD instead of SAR?**
A: Yes. USD converted at daily rate + 2% fee.

**Q: What payment methods do you accept?**
A: Credit cards (Visa, Mastercard) via Moyasar. No crypto payments yet.

**Q: Can I get a refund?**
A: Renter: Yes, for failed jobs (automatic). Provider: No (earnings are final).

---

### Account

**Q: How do I reset my password?**
A: Login page → "Forgot password" → Email confirmation link.

**Q: Can I have multiple accounts?**
A: Yes, but limit 3 accounts per person (abuse prevention).

**Q: Can I delete my account?**
A: Yes. Dashboard → Settings → Account → Delete Account. Data deleted in 30 days.

**Q: How do I change my email?**
A: Dashboard → Settings → Email. Verify new email before change.

---

### Security

**Q: Are my passwords stored securely?**
A: Yes. Hashed with bcrypt, never stored plaintext.

**Q: Are my API keys encrypted?**
A: Yes. Encrypted at rest, transmitted over HTTPS only.

**Q: What if I think my account is compromised?**
A: Change password immediately. Revoke all API keys. Email security@dcp.sa.

**Q: Do you store credit card information?**
A: No. Processed by Moyasar (PCI-DSS certified). We never see card numbers.

---

### Legal

**Q: What's your privacy policy?**
A: https://dcp.sa/legal/privacy (PDPL compliant)

**Q: What are the terms of service?**
A: https://dcp.sa/legal/terms (binding agreement)

**Q: What are the security practices?**
A: https://dcp.sa/legal/security (incident response, encryption)

**Q: Am I liable if something goes wrong?**
A: See Terms of Service, Section 10 (liability limits). Generally: capped at amount you paid in last 12 months.

---

## Still Need Help?

**Support Channels:**
- **Dashboard help:** In-app chat (bottom right)
- **Email:** support@dcp.sa (24-48 hour response)
- **Security issues:** security@dcp.sa (24 hour response)
- **Legal/compliance:** legal@dcp.sa (7 day response)
- **Status page:** https://status.dcp.sa (real-time incidents)

**Response Times:**
- Critical (system down): <1 hour
- Urgent (data loss, security): 4 hours
- High (account locked): 24 hours
- Normal (questions, features): 48 hours

---

**Last updated:** March 23, 2026
