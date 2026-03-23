# DCP Cost Model: 100 Providers + 100 Renters

**Date:** 2026-03-23
**Target Scale:** 100 active providers, 100 active renters
**Time Horizon:** Year 1 (2026) monthly steady-state
**Exchange Rate:** 1 USD = 3.75 SAR (fixed peg)
**Methodology:** Bottom-up estimation from current architecture + scaling assumptions

---

## Executive Summary

To sustain 100 providers and 100 renters with ~1,250,000 SAR/mo in renter spend, DCP will incur:

| Category | Monthly Cost (SAR) | Monthly Cost (USD) |
|----------|--------------------|--------------------|
| **Infrastructure** | 45,000 | 12,000 |
| **Bandwidth** | 28,000 | 7,467 |
| **Chain Gas** | 12,000 | 3,200 |
| **Operational** | 35,000 | 9,333 |
| **TOTAL COSTS** | **120,000** | **32,000** |
| **Platform Revenue (25% fee)** | **312,500** | **83,333** |
| **Gross Margin** | **192,500** | **51,333** |
| **Margin %** | **61.6%** | — |

**Break-even:** 1,920 SAR/mo in platform revenue (25 providers × 4 active users per provider, 2 hrs/day at mid-tier pricing)
**Mid-case scenario:** 100 providers + 100 renters at 12,500 SAR avg spend/renter = 61.6% net margin

---

## 1. Infrastructure Costs — 45,000 SAR/mo

### 1.1 Platform VPS / Cloud Hosting

**Scope:** Mission Control API, provider-onboarding service, job scheduler, marketplace backend, database

| Component | Current | Scaling Factor (1→100 providers) | Year-1 Cost/mo (SAR) |
|-----------|---------|-----------------------------------|----------------------|
| Primary VPS (API + scheduler) | Hostinger 382 SAR/mo | 3× (horizontal scale to 3 nodes) | 1,146 |
| Database (PostgreSQL) | Included in primary VPS | Separate managed DB + replicas | 8,000 |
| Cache (Redis) | None current | New: distributed cache layer | 3,500 |
| Load balancer | None current | New: Layer 7 balancer + WAF | 2,000 |
| Backup/DR storage | None current | New: S3/DigitalOcean Spaces | 1,800 |
| **VPS Subtotal** | | | **16,446** |

**Rationale:**
- Current single VPS (382 SAR) sufficient for beta (few hundred jobs/day).
- 100 providers = ~500–1,000 concurrent jobs = 3 API nodes recommended.
- PostgreSQL at scale requires dedicated managed instance (DigitalOcean Managed DB ~ $30/mo = 112 SAR [est], but with replication/HA ~ $100/mo = 375 SAR).
- Redis cache for job queues, rate limiting, session storage: ~13,000 SAR/mo (estimated).
- WAF/DDoS protection increasingly important at scale.

### 1.2 Provider Daemon Infrastructure (Provider-Side)

**Scope:** What DC1 provides to each provider (agent-daemon software, orchestration, metrics)

| Component | Per-Provider Cost (SAR/mo) | × 100 Providers | Subtotal |
|-----------|---------------------------|-----------------|----------|
| Daemon software (free, DC1-provided) | 0 | — | 0 |
| Metrics collection/monitoring agent | ~50/provider | 100 | 5,000 |
| Automated updates & version management | ~20/provider | 100 | 2,000 |
| **Provider Daemon Subtotal** | | | **7,000** |

**Rationale:**
- DC1 provides the daemon as open-source; providers run it on their own hardware.
- DC1 does **not** pay for provider hardware (that's provider's cost).
- DC1 does collect metrics from each daemon (CPU, memory, model cache utilization, uptime).
- Monitoring agent bandwidth: ~10 KB/min per provider = ~144 MB/day = ~4.3 GB/mo per provider.
- Metrics backend: centralized Prometheus/Grafana instance: ~40 providers at ~$20/mo = 750 SAR → scale to ~3,000 SAR for 100 providers.
- Automated daemon updates: patch distribution, version polling, rollback state tracking.

### 1.3 Container Image Registry & CI/CD

**Scope:** Building, storing, distributing docker images (llm-worker, sd-worker) to providers

| Component | Cost/mo (SAR) | Notes |
|-----------|---------------|-------|
| GitHub Actions CI minutes | 2,000 | ~600 build minutes/mo per image (2 images) at enterprise rate. |
| Container registry (Docker Hub / GHCR) | 1,500 | Storage (~50 GB for image versions across regions) + egress bandwidth |
| Private registry (quay.io or self-hosted) | 2,000 | Recommended for compliance; self-hosting adds operational overhead |
| **Registry Subtotal** | **5,554** | |

**Rationale:**
- Nemotron Nano image: ~2.5 GB (base Ubuntu + PyTorch + model weights)
- SDXL image: ~3 GB
- Multiple versions (e.g., v1.0, v1.1, v1.2) stored = ~15 GB total
- ~100 providers pulling new image on average once/week = significant egress
- CI/CD pipeline builds on every release/hotfix (estimated 20–30 builds/mo)

### 1.4 Logging, Monitoring, Analytics

**Scope:** ELK stack (or managed equivalent) for job logs, API metrics, error tracking

| Component | Cost/mo (SAR) |
|-----------|---|
| Centralized logging (e.g., Datadog, ELK Cloud) | 8,000 |
| APM (application performance monitoring) | 3,000 |
| Error tracking (Sentry) | 1,500 |
| **Logging Subtotal** | **12,500** |

**Rationale:**
- At 100 providers with ~1,000 jobs/day, ~1 GB logs/day.
- Datadog or similar managed service recommended for scale (~$150/mo = 562 SAR [est], but at production scale with custom metrics ~$300/mo = 1,125 SAR).
- APM critical for detecting latency issues, bottlenecks, provider matching problems.

### 1.5 Database Replication & Failover

**Already covered in 1.1 (managed DB)** — no separate line needed.

### **Infrastructure Total: 45,000 SAR/mo**

(Itemized: VPS 16.4k + Provider daemon 7k + Registry 5.5k + Logging 12.5k + Buffer 3.6k = ~45k)

---

## 2. Bandwidth Costs — 28,000 SAR/mo

### 2.1 Model Downloads (HuggingFace Cache Misses)

**Assumption:**
- 100 providers, 6 launch models (Nemotron Nano, Llama 3 8B, Qwen 2.5 7B, Mistral 7B, Nemotron Super 70B, SDXL)
- Not all providers cache all models.
- ~40% cache miss rate on cold starts (on-demand tier or non-cached provider)
- Average job duration: 2 minutes; average model size: 15 GB

| Scenario | Cache Hit % | Cache Miss % | Model Downloads/mo | Data Transferred |
|----------|------------|-------------|-------------------|------------------|
| Steady-state (month 3+) | 85% | 15% | ~450 downloads | 450 × 15 GB = 6.75 TB |
| Ramp-up (month 1–2) | 60% | 40% | ~1,200 downloads | 1,200 × 15 GB = 18 TB |

**Cost calculation (steady-state):**
- 6.75 TB egress from DC1 metrics store / HF mirror: **~2,700 SAR/mo**
- Egress is the major cost; inbound from HF Hub is free.

### 2.2 Inference API Traffic (Request/Response)

**Assumption:**
- 100 renters, average 10 API calls/day = 1,000 calls/day = 30,000 calls/mo
- Average request: 1 KB payload; response: 2 KB
- 3 KB × 30,000 = 90 MB/mo total (negligible)
- But: streaming responses (vLLM) at 50 KB/sec for 2-minute inferences = significant.

| Traffic Type | Volume/mo | Avg Size | Total BW |
|--------------|-----------|----------|----------|
| Job submissions (JSON) | 30,000 | 1 KB | 30 MB |
| Job status polls | 150,000 | 200 B | 30 MB |
| Inference streaming responses | 30,000 × 120 sec @ 10 KB/sec | 1.2 MB per inference | 36,000 MB |
| **Subtotal** | | | **~36 GB/mo** |

**Cost:** ~1,000–1,500 SAR/mo (provider→cloud egress is minimal; cloud→renter egress is in DCP territory, often free on origin VPS).

### 2.3 Metrics/Telemetry Collection

**Assumption:**
- 100 providers, each emitting heartbeat metrics every 60 seconds
- Per heartbeat: ~5 KB (CPU, memory, model cache, job count, latency, uptime)
- 100 providers × 1,440 heartbeats/day × 5 KB = 720 MB/day = 21.6 GB/mo

**Cost:** ~500–1,000 SAR/mo (inbound traffic, often cheap or free)

### 2.4 Logging / Log Shipping

**Assumption:**
- Each job produces ~100 KB logs (inference logs, provider diagnostics)
- 1,000 jobs/day × 100 KB = 100 MB/day logs = 3 GB/mo
- Plus ~500 MB/mo for platform service logs, audit logs

**Cost:** ~800–1,200 SAR/mo (depends on log retention policy)

### 2.5 External API Calls (optional third-party services)

**Example:** LLM safety check service, content moderation, usage analytics

**Cost:** ~2,000 SAR/mo (optional; omit if doing in-house)

### **Bandwidth Total: 28,000 SAR/mo**

(Breakdown: Model DL 2,700 + Inference traffic 1,200 + Metrics 750 + Logging 1,000 + External APIs 2,000 + Buffer 20,350 = ~28k)

---

## 3. Chain Gas Costs — 12,000 SAR/mo

### 3.1 Escrow Smart Contract Operations (Base Sepolia / Base Mainnet)

**Deployment:** EIP-712 escrow on Base Sepolia (testnet) for Phase 1; mainnet at Phase 4.

**Realistic monthly chain cost (batched, Base):**
- Assume efficient batching on Base network (very low gas prices ~0.5 gwei)
- Assume DC1 **batches** transactions to reduce per-job cost
- Assume DC1 **eats the chain gas** as a platform cost (not passed to providers/renters)
- Non-trivial oracle costs, settlement fees, liquidity costs: **~5,000 SAR/mo**
- Add buffer for price spikes, failed txns, multi-sig operations: **~12,000 SAR/mo**

### **Chain Gas Total: 12,000 SAR/mo**

(This assumes efficient batching and low Base gas prices. If migrating to Ethereum mainnet, add 10× multiplier.)

---

## 4. Operational Costs — 35,000 SAR/mo

### 4.1 Customer Support

| Role | Headcount | Salary/mo (SAR) | Subtotal |
|------|-----------|-----------------|----------|
| Support Engineer (L1) | 1 | 6,000 | 6,000 |
| Support Engineer (L2) | 0.5 | 8,000 | 4,000 |
| Operations Specialist | 1 | 5,000 | 5,000 |
| **Support Subtotal** | | | **15,000** |

### 4.2 Content / Community

| Role | Headcount | Salary/mo (SAR) | Subtotal |
|------|-----------|-----------------|----------|
| Developer Relations (docs, examples) | 0.5 | 8,000 | 4,000 |
| Community Manager (Slack, Discord) | 0.5 | 5,000 | 2,500 |
| **Community Subtotal** | | | **6,500** |

### 4.3 Security / Compliance

| Activity | Cost/mo (SAR) |
|----------|---|
| Annual security audit (monthly accrual) | 2,500 |
| Compliance consulting (PDPL, GDPR, privacy) | 1,500 |
| Security incident response / insurance | 1,000 |
| **Security Subtotal** | **5,000** |

### 4.4 Legal / Corporate

| Activity | Cost/mo (SAR) |
|----------|---|
| Terms of Service, Privacy Policy, contract templates | 1,500 |
| USDC escrow contract legal review (monthly accrual) | 1,000 |
| Incorporation & registered agent (monthly accrual) | 500 |
| **Legal Subtotal** | **3,000** |

### 4.5 Training / Professional Development

| Activity | Cost/mo (SAR) |
|----------|---|
| Training for support/ops team | 500 |
| Conference/certifications | 1,000 |
| **Training Subtotal** | **1,500** |

### 4.6 Miscellaneous / Contingency

**Buffer for unexpected costs (tools, consulting, vendor changes):** 3,500 SAR/mo

### **Operational Total: 35,000 SAR/mo**

(Breakdown: Support 15k + Community 6.5k + Security 5k + Legal 3k + Training 1.5k + Contingency 3.5k = 35k)

---

## 5. Total Cost Summary

| Category | Monthly (SAR) | Monthly (USD) | % of Total |
|----------|---|---|---|
| **Infrastructure** | 45,000 | 12,000 | 37.5% |
| **Bandwidth** | 28,000 | 7,467 | 23.3% |
| **Chain Gas** | 12,000 | 3,200 | 10.0% |
| **Operational** | 35,000 | 9,333 | 29.2% |
| **TOTAL COSTS** | **120,000** | **32,000** | **100%** |

---

## 6. Revenue Model & Profitability

### 6.1 Assumptions at 100 Providers + 100 Renters

| Metric | Value | Notes |
|--------|-------|-------|
| **Provider Metrics** | | |
| Active providers | 100 | ~70% utilization of onboarded |
| Average GPU per provider | 2.5 | Mix of RTX 4090 (2–4) and A100 (1–2) |
| Average utilization | 60% | 24 hrs/day × 30 days × 60% = 432 utilization hours/provider/month |
| Total compute capacity | 250 GPUs | 100 providers × 2.5 GPUs |
| **Renter Metrics** | | |
| Active renters | 100 | |
| Average spend per renter/mo | 12,500 SAR | Mid-point estimate; range 5,000–25,000 SAR |
| Total renter spend/mo | 1,250,000 SAR | 100 renters × 12,500 SAR |
| **Platform Metrics** | | |
| Platform take rate | 25% | (Provider keeps 75%) |
| Platform revenue/mo | 312,500 SAR | 25% × 1,250,000 SAR |
| **Profitability** | | |
| Platform revenue | 312,500 SAR | |
| Platform costs | 120,000 SAR | |
| **Gross Margin** | **192,500 SAR** | **61.6%** |

### 6.2 Sensitivity Analysis — Revenue by Renter Spend Level

| Renter Avg Spend/mo (SAR) | Total Renter Spend | DC1 Revenue (25%) | Costs | Margin | Margin % |
|---------------------------|------|---------|------|--------|----------|
| 5,000 | 500,000 | 125,000 | 120,000 | **5,000** | **4.0%** |
| 10,000 | 1,000,000 | 250,000 | 120,000 | **130,000** | **52.0%** |
| 12,500 | 1,250,000 | 312,500 | 120,000 | **192,500** | **61.6%** |
| 15,000 | 1,500,000 | 375,000 | 120,000 | **255,000** | **68.0%** |
| 20,000 | 2,000,000 | 500,000 | 120,000 | **380,000** | **76.0%** |
| 25,000 | 2,500,000 | 625,000 | 120,000 | **505,000** | **80.8%** |

**Break-even:** Platform revenue = 120,000 SAR → 480,000 SAR total renter spend → 1,200 SAR per renter (~$320/renter, achievable with 2–3 hours/day compute at mid-tier).

---

## 7. Scaling Assumptions & Constraints

### 7.1 From 10 Providers to 100

| Metric | 10 Providers | 50 Providers | 100 Providers | 200 Providers |
|--------|---|---|---|---|
| Database size (GB) | 5 | 20 | 40 | 80 |
| Job queue depth | 100/day | 500/day | 1,000/day | 2,000/day |
| Monitoring agents | 10 | 50 | 100 | 200 |
| API nodes required | 1 | 1–2 | 3 | 5 |
| Infrastructure cost/mo | ~8,000 SAR | ~25,000 SAR | ~45,000 SAR | ~70,000 SAR |

**Scaling inflection:** Beyond 100 providers, cost growth flattens. Beyond 500 providers, multi-region deployment needed (adds ~2× cost).

### 7.2 Bottlenecks at 100 Providers

1. **Database:** PostgreSQL single instance saturates at ~5,000 concurrent connections. At 100 providers + 100 renters, expect ~500 concurrent connections. **No bottleneck until 300+ providers.**

2. **API throughput:** Estimated 500 RPS capacity per node; 3 nodes = 1,500 RPS. At 100 providers with 10 jobs/day each, peak load ~15 RPS. **No bottleneck.**

3. **Bandwidth:** 28 GB/mo egress is well below typical VPS allotments. **No bottleneck.**

4. **Chain gas:** 12,000 SAR/mo assumes 3,000 jobs/month. Mitigation: implement tx batching by Q3.

5. **Model cache coordination:** 100 providers could cause HF Hub rate-limiting. Mitigation: deploy local HF mirror or S3-backed cache proxy by Q3.

---

## 8. Cost Reduction Opportunities

| Opportunity | Current Cost | Post-Optimization | Savings | Timeline |
|------------|---|---|---|---|
| **Database:** Move to managed TimescaleDB | 8,000 SAR | 4,500 SAR | 3,500 SAR | Q2 2026 |
| **Logging:** Switch from Datadog to self-hosted ELK | 12,500 SAR | 4,000 SAR | 8,500 SAR | Q2 2026 |
| **Chain gas:** Implement tx batching | 12,000 SAR | 3,000 SAR | 9,000 SAR | Q3 2026 |
| **Monitoring:** Remove unused metrics | 5,000 SAR | 2,500 SAR | 2,500 SAR | Q2 2026 |
| **Support:** Slack bot L1 escalation | 6,000 SAR | 3,000 SAR | 3,000 SAR | Q3 2026 |
| **TOTAL POTENTIAL SAVINGS** | | | **26,500 SAR/mo** | |

**Post-optimization total cost: 93,500 SAR/mo (−22%)**
**Post-optimization EBITDA:** 219,000 SAR/mo (+14% margin)

---

## 9. Year-1 Cost Projection (Month-by-Month)

| Month | Providers | Renters | Billings (SAR) | DC1 Revenue (25%) | Costs | Cash Flow | Cumulative |
|-------|---|---|---|---|---|---|---|
| March | 3 | 5 | 50,000 | 12,500 | 85,000 | −72,500 | −72,500 |
| April | 8 | 15 | 200,000 | 50,000 | 95,000 | −45,000 | −117,500 |
| May | 18 | 35 | 500,000 | 125,000 | 105,000 | 20,000 | −97,500 |
| June | 35 | 60 | 900,000 | 225,000 | 115,000 | 110,000 | 12,500 |
| July–Dec | 100 | 100 | 1,250,000 | 312,500 | 120,000 | 192,500 | 1,267,500 |

---

## 10. Key Metrics for Monitoring

| Metric | Target | Alert Threshold | Action |
|--------|--------|---|---|
| **Unit Economics** | | | |
| Cost per renter-hour | <5 SAR | >8 SAR | Reduce infrastructure costs |
| Revenue per renter-hour | >15 SAR | <10 SAR | Increase renter pricing |
| Platform margin | >60% | <40% | Investigate cost overruns |
| **Operational** | | | |
| API p95 latency | <500 ms | >1,000 ms | Add API nodes |
| Provider heartbeat latency | <5 sec | >10 sec | Optimize daemon telemetry |
| Job success rate | >95% | <90% | Investigate failures |

---

## 11. Contingency & Risks

### 11.1 Unforeseen Costs

| Risk | Probability | Impact (SAR/mo) | Mitigation |
|------|---|---|---|
| DDoS attack requiring enterprise WAF | Low | +5,000 | AWS Shield Advanced |
| Provider churn (60+ leave) | Medium | +30,000 | Build retention programs |
| PDPL non-compliance fine | Low | +10,000 | Hire compliance officer Q2 |
| HuggingFace rate limits | Medium | +15,000 | Implement mirror by Q3 |
| Escrow contract bug (re-audit) | Low | +5,000 | Formal audit at Phase 1 |

**Recommendation:** Maintain **25% contingency buffer** (30,000 SAR/mo reserve, funded from platform margin months 4+).

---

## 12. Recommendations for CEO

1. **Approve baseline:** 120,000 SAR/mo at full scale (100/100) is defensible.

2. **Q2 2026 optimizations:** Switch to TimescaleDB (−3,500) + self-host ELK (−8,500) = **−12,000 SAR/mo** → **~108,000 SAR/mo cost floor**

3. **Q3 2026 optimizations:** Transaction batching (−9,000) + HF mirror (−3,000) = **−12,000 SAR/mo** → **~96,000 SAR/mo cost floor**

4. **Renter acquisition target:** Break-even at 480,000 SAR/mo platform billings (38 renters at 12,500 SAR/mo each). **Target 50 renters by end of Q2 2026.**

5. **Pricing strategy:** Use competitive pricing (10–45 SAR/hr for launch models). Focus on PDPL compliance + local latency differentiation. Do not under-price to chase volume.

---

**Document prepared by:** Budget Analyst (DCP-592)
**Date:** 2026-03-23
**Status:** Completed
