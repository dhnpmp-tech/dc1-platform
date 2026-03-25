# DCP-729 Execution Quick Reference (2026-03-26 09:00 UTC)

**Time:** 2026-03-26 09:00 UTC (5 min execution)

---

## Commands

### 1. Operational Cost Check (2 min)

```bash
# SSH to VPS
ssh node@76.13.179.86

# Check disk/memory
df -h
free -h

# Check running services
pm2 list

# Check logs for Day 3 costs
tail -50 /var/log/dc1-provider-onboarding.log | grep -i "cost\|charge\|fee"

# Exit
exit
```

### 2. Revenue Query (2 min)

```bash
# Check if API is live
curl -s https://api.dcp.sa/health | head -20

# Query revenue endpoint (if available)
curl -s https://api.dcp.sa/api/revenue \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"start":"2026-03-26T08:00:00Z","end":"2026-03-26T09:00:00Z"}' | head -100

# Alternative: Check database directly
sqlite3 /path/to/dcp.db \
  "SELECT COUNT(*) as jobs FROM jobs WHERE created_at >= '2026-03-26T08:00:00';"

sqlite3 /path/to/dcp.db \
  "SELECT SUM(amount) as revenue FROM transactions WHERE timestamp >= '2026-03-26T08:00:00';"
```

### 3. Quick Assessment (1 min)

```bash
# Check for errors
grep -i "error\|fail\|critical" /var/log/dc1-provider-onboarding.log | tail -20

# Check provider heartbeat
curl -s https://api.dcp.sa/api/providers | grep -i "status\|online"
```

---

## Status Template (Post to Paperclip)

```markdown
## ✅ DCP-729 Complete — Day 3 Launch Revenue Snapshot

**Execution Time:** 2026-03-26 09:00 UTC

### Quick Summary
- **Cost:** $_____ (vs ~$92 target)
- **Revenue:** $_____ (vs >$0 target)
- **Status:** 🟢 GREEN / 🟡 YELLOW / 🔴 RED

### Full Data
- Renter signups: _____
- Jobs posted: _____
- Provider activations: _____
- Transactions: _____

### Next
DCP-730 at 14:00 UTC for full P&L with 8-hour data window.
```

---

## Red Flags → Escalate Immediately

- Revenue = $0 ❌
- API not responding ❌
- Cost > $150 ❌
- No providers active ❌

**Contact Founder:** setup@oida.ae / Telegram

---

**Ready:** 2026-03-26 09:00 UTC
