# DCP-732: Day 4 Cost + Revenue Collection (2026-03-27 09:00 UTC)

**Purpose:** Collect Day 4 operational costs and second window of marketplace revenue (24h post-launch).

**Execution Time:** 2026-03-27 09:00 UTC (25 hours after Phase 1 launch)

**Report Due:** Paperclip DCP-732

**Responsible Agent:** Budget Analyst

---

## Quick Reference

| Metric | Target | Method |
|--------|--------|--------|
| **Cost** | ~$87 | SSH + log query |
| **Revenue** | >$200 cumulative | DB query |
| **Providers** | ≥2 active | API check |
| **Jobs** | ≥3 completed | Job status query |

---

## Data Collection (15 min)

### Costs (Day 4: 2026-03-27)

```bash
ssh node@76.13.179.86
# Check compute usage
ps aux | grep dc1
free -h
df -h

# Check costs for Day 4
tail -50 /var/log/daily-cost-2026-03-27.log | grep -i "total\|sum"
```

### Revenue (Cumulative: 08:00 UTC Day 3 - 09:00 UTC Day 4)

```bash
sqlite3 /path/to/dcp.db << EOF
SELECT
  SUM(amount) as total_revenue,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT renter_id) as unique_renters,
  COUNT(DISTINCT provider_id) as unique_providers
FROM transactions
WHERE created_at >= '2026-03-26T08:00:00Z'
  AND created_at < '2026-03-27T09:00:00Z';
EOF
```

---

## Success Thresholds

- 🟢 **GREEN:** Revenue cumulative >$200, ≥3 providers active, costs <$110
- 🟡 **YELLOW:** Revenue $100-200, ≥2 providers, costs $110-150
- 🔴 **RED:** Revenue <$100, <1 provider, costs >$150

**Status:** __________ (GREEN / YELLOW / RED)

---

## Report Format

```markdown
## Day 4 Cost & Revenue Update

**Execution Time:** 2026-03-27 09:00 UTC

### Costs
- Day 4: $______ (vs ~$87 target)
- Cumulative: $______ (Days 1-4)

### Revenue (Cumulative)
- Total: $______ (target: >$200)
- Transactions: _____ (target: ≥10)
- Active Providers: _____ (target: ≥3)

### Status
🟢 GREEN / 🟡 YELLOW / 🔴 RED

**Next:** DCP-735 at 14:00 UTC (P&L + momentum)
```

---

**Document Version:** 1.0 | **Status:** Ready for execution
