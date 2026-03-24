# DCP — PDPL Compliance Summary

**For:** Enterprise Prospects (Government, Legal, Financial Services)
**Prepared by:** DCP Security Team
**Date:** 2026-03-24
**Classification:** Sales-Ready · Shareable

---

## DCP is Designed for PDPL Compliance

DCP (Decentralized Compute Platform) is a GPU inference marketplace built for Saudi Arabia, operating fully within the Kingdom under Saudi Arabia's **Personal Data Protection Law (PDPL)** (Royal Decree M/19, 2021, enforced by SDAIA from September 2023).

---

## 3 Key Facts

### 1. Your Data Never Leaves Saudi Arabia

All computation, storage, and inference happens on Saudi-hosted infrastructure.

- **Production servers:** Riyadh-based VPS
- **Database:** SQLite on KSA infrastructure — no cross-border replication
- **Inference jobs:** Execute on provider GPUs inside the Kingdom
- **Payment processing:** Moyasar, a Saudi-licensed payment gateway

> This satisfies **PDPL Article 19** (cross-border transfer prohibition) by design — not by exception.

No other GPU cloud (AWS, Azure, GCP, RunPod, Vast.ai) can make this claim for Saudi workloads.

---

### 2. We Collect Only What Is Necessary

DCP collects the minimum data required to operate the service:

**Renters:** Email, API key, job metadata, billing records
**Providers:** Name, email, GPU specifications, wallet address, performance telemetry

We do **not** collect: national ID, physical address, phone number, biometric data, or browsing profiles.
We do **not** use third-party analytics, tracking pixels, or advertising networks.

> This satisfies **PDPL Article 6** (data minimisation and purpose limitation).

---

### 3. Your Rights Are Technically Enforced

Data subject rights under PDPL Article 14 are implemented as live API endpoints:

| Right | How to Exercise | Response Time |
|-------|----------------|---------------|
| **Right to Access** | `GET /api/renters/me/data-export` | Instant (JSON or CSV) |
| **Right to Erasure** | `DELETE /api/renters/me` | Immediate soft-delete + anonymisation |
| **Right to Portability** | `GET /api/renters/me/jobs/export?format=csv` | Instant CSV download |
| **Right to Correction** | Self-service via account dashboard | Immediate |
| **Manual request** | support@dcp.sa | 30 days (PDPL standard) |

All data subject requests are logged in our audit trail (`pdpl_request_log`).

---

## Security Controls Summary

| Control | Implementation |
|---------|---------------|
| **Encryption in transit** | TLS 1.3 (Let's Encrypt, valid through June 2026) |
| **Encryption at rest** | SQLite on VPS with OS-level access controls |
| **Authentication** | Scoped API keys with expiry and rotation |
| **Rate limiting** | Per-endpoint rate limits; brute-force protection |
| **Incident response** | 72-hour SDAIA breach notification procedure documented |
| **Audit logging** | All PDPL requests logged with timestamps |

---

## Relevant PDPL Articles

| Article | Requirement | DCP Status |
|---------|-------------|------------|
| Art. 5 | Lawful basis for processing | ✅ Contract-based processing |
| Art. 6 | Data minimisation | ✅ Minimal PII collected |
| Art. 11 | Accuracy | ✅ Self-service correction available |
| Art. 14 | Data subject rights | ✅ Access, erasure, portability endpoints live |
| Art. 19 | Cross-border transfer prohibition | ✅ All data remains in KSA |
| Art. 21 | Security measures | ✅ TLS, access control, audit trail, incident procedure |

---

## For Enterprise Contracts

DCP can provide:

- **Data Processing Agreement (DPA)** for organisations whose users submit personal data as part of inference workloads
- **Compliance attestation letter** for procurement teams
- **Architecture review** to verify data residency for specific use cases

Contact: **support@dcp.sa** | **setup@oida.ae**

---

## Why PDPL Compliance Matters for Your Use Case

### Government & Public Sector
Saudi government entities are required by law to process citizen data within the Kingdom. DCP's in-kingdom infrastructure eliminates legal risk and procurement friction for AI workloads involving government documents, policy analysis, or citizen-facing services.

### Legal & Law Firms
Client-privileged documents processed through DCP never leave Saudi jurisdiction. Combined with our Arabic language model portfolio (ALLaM, JAIS, Qwen-Arabic), DCP enables PDPL-compliant Arabic legal document analysis at a fraction of hyperscaler cost.

### Financial Services (Banks, Fintech, Insurance)
SAMA (Saudi Central Bank) guidance requires customer financial data to remain in-kingdom. DCP's infrastructure is compliant by design. Arabic-language models enable KYC automation, contract analysis, and customer service — all within PDPL boundaries.

---

## Competitive Advantage

| Provider | Data Residency | Arabic Models | PDPL-by-Design |
|----------|---------------|---------------|----------------|
| **DCP** | ✅ KSA only | ✅ ALLaM, JAIS, Qwen, Falcon H1 | ✅ Yes |
| AWS Bedrock | ❌ Region-selectable (not KSA-only) | ❌ No dedicated Arabic models | ❌ No |
| Azure OpenAI | ❌ No KSA region | ❌ No Arabic-specific models | ❌ No |
| RunPod | ❌ US/EU datacenters | ❌ No Arabic models | ❌ No |
| Vast.ai | ❌ Global distributed | ❌ No Arabic models | ❌ No |

---

*DCP Security Team · security@dcp.sa · Last updated: 2026-03-24*
*Full compliance checklist: `docs/compliance/pdpl-checklist.md`*
