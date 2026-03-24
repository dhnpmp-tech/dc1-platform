# Phase 1 Day 2 (2026-03-25) — Cost Data Collection Checklist

**Prepared by:** Budget Analyst
**Execution date:** 2026-03-25 (tomorrow)
**Collection window:** 08:55-09:15 UTC
**Calculation window:** 09:15-09:30 UTC
**Update deadline:** 09:30 UTC

---

## Data Sources & Collection Points

### ✅ Source 1: DCP-676 (UX Recruiter Contingency Spend)

**What we need:** Actual amount spent on self-recruitment (if Option B activated)

**Where to get it:**
- Check DCP-676 issue for update on recruiter decision
- If Option B (self-recruit) was chosen, look for actual spend reported
- Format: Single USD amount (e.g., "$245.50")

**Contingency estimates:**
- **Best case:** $0-200 (minimal activation)
- **Mid case:** $200-400 (moderate spend)
- **Worst case:** $400-600 (full budget used)

**Escalation threshold:** > $500 → Flag to CEO (DCP-734)

**Data location:**
- Issue comment or document on DCP-676
- Alternative: Check AWS billing for any DCP credits issued

---

### ✅ Source 2: DCP-641 (Phase 1 Testing Infrastructure Costs)

**What we need:** Cost of testing infrastructure (AWS EC2, monitoring, load testing)

**Where to get it:**
- ML Infra Engineer should report testing infrastructure spin-up costs
- AWS CloudWatch billing report for 2026-03-25 (will be partial)
- May be $0 if using existing infrastructure

**Possible costs:**
- Load testing (k6, LoadImpact): $10-50
- Extra EC2 instances for test runners: $20-100
- Monitoring/logging upgrades: $5-20
- Typical range: $0-100 (Day 2 is partial day)

**Escalation threshold:** > $100 → Investigate with ML Infra

**Data location:**
- DCP-641 issue update
- AWS Cost Explorer (2026-03-25 partial day costs)
- DevOps team report

---

### ✅ Source 3: DCP-642 (Docker Container Build Costs)

**What we need:** Cost of building and publishing NVIDIA container images

**Where to get it:**
- ML Infra confirmed: **Pre-built, $0 cost**
- No new builds expected for Phase 1
- Assume: $0

**Verification:**
- Confirm with ML Infra that `dc1/llm-worker:latest` is ready to pull
- No DockerHub/ECR publish costs expected

**Data location:**
- DCP-642 issue (likely marked DONE with $0)
- Docker registry logs (confirm pull happened, no builds)

---

## Daily P&L Calculation Template

```markdown
## Day 2 P&L (2026-03-25)

| Component | Amount |
|-----------|--------|
| **Revenue** | $0 (testing phase, no renters) |
| Base Operations Cost | -$87 (daily fixed) |
| Contingency: DCP-676 | -$[amount] |
| Contingency: DCP-641 | -$[amount] |
| Contingency: DCP-642 | -$[amount] |
| **Total Cost** | -$[total] |
| **Daily P&L** | -$[P&L] |
| **Cumulative (Days 1-2)** | -$[cumulative] |

### Cost Summary
- Base operations: $87
- Contingencies: $[total contingency]
- **Total: $[total cost]**

### Go/No-Go Assessment
- Signal: [GREEN / YELLOW / RED]
- Reason: [Brief reason based on contingency spend]
- Next: [Continue if GREEN, monitor if YELLOW, escalate if RED]
```

---

## Collection Order & Timeline

### 08:50 UTC — Send Final Reminders
```bash
# Send these to data sources:
"Hi, ready to collect Day 2 cost data in 10 minutes.
Please have your spend amounts ready by 09:00 UTC.
Looking for: (1) Contingency B spend, (2) Testing infra cost, (3) Docker build cost.
Format: Single USD amount each. Thanks!"
```

### 08:55 UTC — Open Data Collection Spreadsheet
- Have phase1-cost-ledger.md open and ready to edit
- Have scripts/calculate-day3-pnl.mjs ready (for reference)
- Open all three source issue pages in browser tabs

### 09:00 UTC — Start Collection
**Spend 15 minutes collecting:**
1. Read DCP-676 comment/update → capture amount or "$0"
2. Read DCP-641 comment/update → capture amount or "$0"
3. Read DCP-642 comment/update → capture amount or "$0"
4. Cross-check with any billing dashboards if needed

### 09:15 UTC — Verify & Calculate
**Spend 15 minutes verifying:**
1. All three sources have provided data (or confirm $0)
2. Amounts are reasonable (no obvious errors)
3. Contingency total makes sense given decisions made
4. Calculate: Revenue ($0) - (Base $87 + Contingencies) = Daily P&L

### 09:30 UTC — Update Ledger
- Update `/home/node/dc1-platform/docs/phase1-cost-ledger.md` with Day 2 data
- Post results to DCP-726 issue comment
- If P&L < -$500 (high spend): Flag to DCP-734 for escalation

---

## Escalation Criteria

### 🟢 GREEN — Continue as normal
- Contingency spend: < $300
- All data sources responsive
- No infrastructure issues
- **Action:** Update ledger, proceed to DCP-727 (P&L calculation)

### 🟡 YELLOW — Monitor closely
- Contingency spend: $300-500
- One data source delayed but provided data
- Minor infrastructure blips resolved
- **Action:** Update ledger, flag to CEO as "monitor", proceed normally

### 🔴 RED — Escalate immediately
- Contingency spend: > $500
- Data sources not reporting despite reminders
- Critical infrastructure failure detected
- **Action:** STOP, notify CEO immediately (DCP-734), assess impact before proceeding to DCP-727

---

## Backup Plans

### If DCP-676 doesn't respond by 09:15 UTC:
- Check most recent DCP-676 issue comment
- If no update: Assume $0 contingency (no spend reported = no spend)
- Log in ledger: "DCP-676 not reported, assumed $0"
- Note: UX Researcher may be offline or in testing

### If DCP-641 doesn't respond by 09:15 UTC:
- Check AWS CloudWatch for 2026-03-25 partial costs
- If CloudWatch shows zero new charges: Assume $0
- Log: "DCP-641 not reported, AWS CloudWatch shows $0 new charges"

### If DCP-642 is missing:
- Already confirmed DONE and $0 by ML Infra
- Assume $0, log as pre-confirmed

### If any cost looks wrong:
- Double-check the source (is it really for Day 2? Or a typo?)
- If unsure: Flag in ledger comment "VERIFY: DCP-XXX reported $Y, please confirm"
- Don't delay; escalate to CEO for clarification

---

## Success Criteria

✅ **All three data sources reported (or confirmed $0)**
✅ **Daily P&L calculated and documented**
✅ **Ledger updated with Day 2 row**
✅ **Go/No-Go signal posted (GREEN/YELLOW/RED)**
✅ **Results available for DCP-727 (P&L calculation task at 14:00 UTC)**

---

## File Locations

- **Cost ledger:** `docs/phase1-cost-ledger.md`
- **Revenue script:** `scripts/calculate-day3-pnl.mjs` (for reference)
- **This checklist:** `docs/phase1-day2-collection-checklist.md`
- **Branch:** `budget-analyst/phase1-cost-monitoring`

---

## Notes

- **Revenue is $0 on Day 2** (testing phase, Phase 1 launch is 2026-03-26 09:00 UTC)
- **Baseline cost is fixed at $87/day** (this doesn't change)
- **Only contingencies vary** (depends on what gets activated/spent)
- **Speed matters**: Finish by 09:30 UTC to feed into DCP-727 (P&L calc at 14:00 UTC)

**Ready for execution: 2026-03-25 08:55 UTC**
