# Phase 1 Cost Collection Templates

**Period:** 2026-03-25 to 2026-03-28 (Days 2-5)
**Due Times:** 08:45 UTC each day (collection, before analysis at 09:00 UTC)
**Budget Analyst:** 92fb1d3f-7366-4003-b59f-3fe6c94afc59
**Status:** 🟢 **TEMPLATES READY FOR TEAM USE**

---

## Template A: QA Engineer Cost Collection (DCP-641 Testing)

**Submission Time:** 2026-03-25 08:45 UTC (and daily thereafter)
**To:** Budget Analyst (DCP-685)
**Format:** Copy table below, fill in actual values

### Testing Infrastructure Costs

| Cost Category | Expected | Actual | Notes |
|---|---|---|---|
| **Load Testing (if active)** | TBD | ____ SAR | e.g., Locust, Apache JMeter, k6 cloud |
| **Monitoring/Observability** | $20-50 | ____ SAR | e.g., Datadog, New Relic, CloudWatch |
| **CI/CD Pipeline Runs** | Baseline | ____ SAR | GitHub Actions, CircleCI overages (if any) |
| **Database Testing Clusters** | Baseline | ____ SAR | Test instances, snapshots, backups |
| **API Testing Tools** | Baseline | ____ SAR | Postman, Insomnia, ReadyAPI |
| **Security Testing** | 0-100 | ____ SAR | Burp Suite, OWASP ZAP, vulnerability scans |
| **Other** | TBD | ____ SAR | Please specify: _________________ |
| **SUBTOTAL** | **$20-100** | **____ SAR** | |

### Testing Execution Notes
- [ ] Load testing active? (Y/N)
- [ ] Security testing run? (Y/N)
- [ ] Any infrastructure failures? (Y/N)
- [ ] Emergency scaling needed? (Y/N)
- **Notes:** ___________________________________________________________

### Approval
- **QA Engineer:** ________________________ **Date/Time:** ____________
- **Budget Analyst Review:** ✅ / ❌

---

## Template B: ML Infra Engineer Cost Collection (Model Serving)

**Submission Time:** 2026-03-25 08:45 UTC (and daily thereafter)
**To:** Budget Analyst (DCP-685)
**Format:** Copy table below, fill in actual values

### Compute & Model Serving Costs

| Cost Category | Expected | Actual | Notes |
|---|---|---|---|
| **VPS CPU/Memory Overages** | 0 | ____ SAR | 76.13.179.86 resource usage above baseline |
| **vLLM Model Serving** | Baseline | ____ SAR | GPU utilization, model loading overhead |
| **Arabic Model Prefetch** | 0-50 | ____ SAR | Model download/cache costs (if any) |
| **Model Inference API Calls** | TBD | ____ SAR | Cost per model serving transaction |
| **Database Query Overages** | 0 | ____ SAR | Analytics queries, logging, monitoring |
| **Caching Layer (Redis)** | Baseline | ____ SAR | Cache hits/misses, memory usage |
| **Backup/Snapshot** | 0 | ____ SAR | Model checkpoints, database backups |
| **Other** | TBD | ____ SAR | Please specify: _________________ |
| **SUBTOTAL** | **$50-100** | **____ SAR** | |

### Model Serving Status
- **Models active:** _____________ (e.g., ALLaM 7B, Mistral, SDXL)
- **Concurrent inference jobs:** ____ (current load)
- **Average cold-start latency:** ____ ms (vs 33-51% faster SLA target)
- **GPU utilization:** ____% (target: 70-80%)
- **Cache hit rate:** ____%
- **Any model failures?** (Y/N) — If yes: ___________________________

### Approval
- **ML Infra Engineer:** ________________________ **Date/Time:** ____________
- **Budget Analyst Review:** ✅ / ❌

---

## Template C: UX Researcher Cost Collection (Recruitment)

**Submission Time:** 2026-03-25 08:45 UTC (and daily thereafter)
**To:** Budget Analyst (DCP-685)
**Format:** Copy table below, fill in actual values

### UX Testing Recruitment Spend

**Scenario Selected:** ☐ A (Recruiter) | ☐ B (MVP Self) | ☐ C (Deferred)

#### Scenario A: Professional Recruiter

| Cost Category | Budget | Actual | Notes |
|---|---|---|---|
| **Recruiter Fees** | 400-500 | ____ SAR | Recruitment agency commission |
| **Platform/Tool Fees** | 50-100 | ____ SAR | UserTesting, Respondent.io, Peech, etc. |
| **Participant Incentives** | 50-100 | ____ SAR | Gift cards, payment to recruiter |
| **SUBTOTAL** | **500-700** | **____ SAR** | |

#### Scenario B: MVP Self-Recruitment (Phase B + C)

| Cost Category | Budget | Actual | Notes |
|---|---|---|---|
| **Phase B: Personal Network** | 100-200 | ____ SAR | LinkedIn premium ads, email platform costs |
| **Phase C: Community Outreach** | 100-200 | ____ SAR | Twitter/X ads, HN sponsorship, Discord boost |
| **Cold Email Service** | 50-100 | ____ SAR | Lemlist, Outreach, Hunter.io credits |
| **Participant Incentives** | 50-100 | ____ SAR | Gift cards for confirmed participants |
| **SUBTOTAL** | **300-600** | **____ SAR** | |

#### Scenario C: Deferred (No Spend)

| Cost Category | Budget | Actual | Notes |
|---|---|---|---|
| **UX Testing** | 0 | ____ SAR | Deferred to post-Phase 1 |
| **SUBTOTAL** | **0** | **____ SAR** | |

### Recruitment Status

**Scenario A (Recruiter):**
- [ ] Recruiter engaged?
- [ ] Outreach started?
- [ ] Confirmations received: ____ (target: 18)
- [ ] Sessions scheduled: ____ (target: 6)

**Scenario B (MVP Self-Recruitment):**
- [ ] Phase B (personal network) active?
- [ ] Phase C (community) active?
- [ ] Confirmations received: ____ (target: 4-5)
- [ ] Sessions scheduled: ____ (target: 3-4)

**Scenario C (Deferred):**
- [ ] Confirmed deferred until post-Phase 1

### Approval
- **UX Researcher:** ________________________ **Date/Time:** ____________
- **Budget Analyst Review:** ✅ / ❌

---

## Submission Protocol

### Daily Workflow (Each Day 2-5)

1. **08:45 UTC:** Teams submit cost data using templates above
2. **09:00 UTC:** Budget Analyst executes cost collection task (DCP-726/729/732/737)
   - Compile data from all three teams
   - Update PHASE1-DAILY-COST-TRACKING-LIVE.md
   - Check for cost overruns (>10% daily variance)
3. **14:00 UTC:** Budget Analyst executes P&L analysis (DCP-727/730/735)
   - Calculate daily P&L
   - Validate revenue targets
   - Update financial ledger
4. **18:00 UTC:** Budget Analyst executes escalation review (DCP-728/731/736)
   - Flag if any thresholds exceeded
   - Recommend actions
   - Post summary to DCP-685

### Communication Channel

**Where to submit:**
- Comment on DCP-685 (parent issue)
- Tag: @Budget-Analyst
- Use template exactly as shown above

**Template Format:**
```
## Day X Cost Submission (Date/Time)

### [QA / ML Infra / UX] Costs

[Insert completed table]

### Notes
[Any relevant context]

### Approval
- Submitted by: [Name]
- Time: [UTC]
```

### Important Deadlines

- **08:45 UTC:** Data submission window opens
- **09:00 UTC:** Data collection deadline — must submit by this time
- **14:00 UTC:** P&L analysis deadline
- **18:00 UTC:** Escalation review deadline

**If you miss the deadline,** post ASAP with a note explaining the delay.

---

## Cost Overrun Triggers

**Alert if any of these occur:**

1. **Daily total > 207.6 SAR** (>10% variance on 188.73 SAR baseline)
2. **Contingency spend > scenario budget:**
   - Scenario A: >600 SAR
   - Scenario B: >600 SAR
   - Scenario C: >0 SAR
3. **Unplanned costs appear** (security fixes, emergency scaling, etc.)
4. **Infrastructure failure** (VPS down, database corruption, data loss)

**If triggered:**
- [ ] Post to DCP-685 with flag 🚨 and dollar amount
- [ ] Notify relevant team lead
- [ ] Decide: absorb cost vs scale back activity vs activate additional contingency
- [ ] Document decision in ledger notes

---

## Example Submissions

### Example A: QA Cost Submission (Day 2)

```
## Day 2 Cost Submission (2026-03-25 08:47 UTC)

### QA Engineer Costs

| Cost Category | Expected | Actual | Notes |
|---|---|---|---|
| Load Testing | TBD | 35 SAR | Locust cloud run (2 hours) |
| Monitoring | $20-50 | 25 SAR | Datadog logs, metrics |
| CI/CD | Baseline | 0 SAR | No overages |
| Database | Baseline | 0 SAR | Test cluster running smoothly |
| API Testing | Baseline | 0 SAR | Manual Postman runs |
| Security Testing | 0-100 | 50 SAR | OWASP ZAP scan |
| Other | TBD | 0 SAR | N/A |
| SUBTOTAL | $20-100 | **110 SAR** | |

### Testing Notes
- [x] Load testing active
- [ ] Security testing run
- [x] Any infrastructure failures?
- [ ] Emergency scaling needed?
- **Notes:** Load testing revealed 15% latency spike at 50 concurrent users. Investigating connection pooling.

### Approval
- **QA Engineer:** Sarah Chen **Date/Time:** 2026-03-25 08:47 UTC
- **Budget Analyst Review:** ✅
```

### Example B: ML Infra Cost Submission (Day 2)

```
## Day 2 Cost Submission (2026-03-25 08:52 UTC)

### ML Infra Engineer Costs

| Cost Category | Expected | Actual | Notes |
|---|---|---|---|
| VPS CPU/Memory | 0 | 0 SAR | Within baseline |
| vLLM Model Serving | Baseline | 15 SAR | Model loading overhead observed |
| Arabic Model Prefetch | 0-50 | 40 SAR | ALLaM 7B + Mistral prefetch |
| Model Inference API | TBD | 25 SAR | 150 inference requests at 0.167 SAR each |
| Database Overages | 0 | 0 SAR | No overages |
| Caching Layer | Baseline | 8 SAR | Redis spike during peak hours |
| Backup/Snapshot | 0 | 0 SAR | N/A |
| SUBTOTAL | $50-100 | **88 SAR** | |

### Model Serving Status
- **Models active:** ALLaM 7B, Mistral 7B, SDXL
- **Concurrent inference jobs:** 5-8 (light load)
- **Average cold-start latency:** 2.3 seconds (target: 1.5s SLA)
- **GPU utilization:** 45% (target: 70-80%)
- **Cache hit rate:** 62%
- **Any model failures?** (Y/N) — No

### Approval
- **ML Infra Engineer:** Amir Patel **Date/Time:** 2026-03-25 08:52 UTC
- **Budget Analyst Review:** ✅
```

### Example C: UX Researcher Cost Submission (Day 2, Scenario B)

```
## Day 2 Cost Submission (2026-03-25 08:58 UTC)

### UX Testing Recruitment Spend (Scenario B - MVP Self)

| Cost Category | Budget | Actual | Notes |
|---|---|---|---|
| Phase B: Personal Network | 100-200 | 45 SAR | LinkedIn premium ads, outreach |
| Phase C: Community | 100-200 | 0 SAR | Not yet active (starts Day 3) |
| Cold Email Service | 50-100 | 30 SAR | Lemlist credits for outreach |
| Participant Incentives | 50-100 | 0 SAR | TBD based on confirmations |
| SUBTOTAL | **300-600** | **75 SAR** | |

### Recruitment Status (Scenario B)
- [x] Phase B (personal network) active?
- [ ] Phase C (community) active? (starts tomorrow)
- [ ] Confirmations received: **2** (target: 4-5)
- [ ] Sessions scheduled: **1** (target: 3-4)

**Notes:** Phase B outreach yielded 2 confirmations so far (good response rate). Waiting for more responses from overnight cold email campaign. Phase C community outreach starts tomorrow morning.

### Approval
- **UX Researcher:** Maya Chen **Date/Time:** 2026-03-25 08:58 UTC
- **Budget Analyst Review:** ✅
```

---

## Q&A for Teams

**Q: What if I don't have exact data by 08:45 UTC?**
A: Submit your best estimate with a note "estimate based on [source]". We'll update with actuals later if needed.

**Q: What if I had zero costs that day?**
A: Still submit the template with 0 SAR values. This confirms no unexpected spending.

**Q: What if I go over budget?**
A: Submit the actual amount. The Budget Analyst will flag it and decide on action.

**Q: Can I submit late?**
A: Yes, but submit ASAP. Late data delays P&L analysis and decision-making.

---

**Prepared by:** Budget Analyst (92fb1d3f-7366-4003-b25f-3fe6c94afc59)
**Ready for:** Team distribution (2026-03-25 08:45 UTC)
**Status:** 🟢 **TEMPLATES READY**
