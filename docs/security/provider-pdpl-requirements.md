# Provider PDPL Requirements — DCP Platform

**Document:** Technical requirements for PDPL compliance (not legal advice)
**Audience:** Provider onboarding, legal review, provider recruitment team
**Date:** 2026-03-24 | DCP-800

---

## Overview

DCP is a Saudi-based GPU compute marketplace. As a provider on DCP, you run jobs submitted by renters on your hardware. Some of those jobs may process personal data belonging to Saudi individuals. Under Saudi PDPL (Personal Data Protection Law, Regulation No. M/19, 1443H), both DCP and providers have obligations.

This document summarises the **technical requirements** a provider must meet to help DCP maintain PDPL compliance. This is not legal advice — providers should consult their own legal counsel for full compliance guidance.

---

## What Data Providers Receive

When a renter submits a job, the provider receives:

| Data | Source | PDPL Sensitivity |
|------|--------|-----------------|
| Job specification (`task_spec`) | Renter | Potentially HIGH — may contain personal data depending on renter's workload |
| Model name and parameters | DCP platform | LOW — non-personal technical config |
| Container image reference | DCP platform | LOW |
| Resource limits (VRAM, CPU) | DCP platform | LOW |
| Renter ID (opaque UUID) | DCP platform | LOW — pseudonymous identifier |

DCP does **not** share renter names, email addresses, or contact details with providers. The renter-provider relationship is pseudonymised by design.

**Critical note:** Providers do not know what personal data renters put into job inputs. A renter might submit a document processing job containing names, national IDs, or medical records. By accepting jobs, providers agree to handle such data responsibly.

---

## Provider PDPL Obligations

### 1. Data Processor Role

When a provider runs a job on behalf of a renter, the provider acts as a **data processor** under PDPL. The renter is the data controller. DCP is the platform intermediary.

This means:
- Providers must process job data **only for the purpose of executing the job** — not for training models, analytics, or any secondary use
- Providers must not retain job inputs or outputs beyond what is operationally required to complete the job
- Providers must not share job data with any third party

### 2. Data Residency

- Provider hardware must be located such that the **data does not cross borders** without the renter's explicit consent
- **Saudi providers (recommended):** Hardware in Saudi Arabia — fully PDPL-compliant by default
- **Non-Saudi providers:** Providers outside Saudi Arabia may only serve workloads where the renter has given explicit consent to cross-border processing. DCP will mark such jobs accordingly.

### 3. Minimum Technical Requirements

Providers must meet the following technical controls before going active:

#### 3.1 Isolated Job Execution
- Each job MUST run in an isolated container (Docker)
- No persistent volumes that carry data between different renters' jobs
- Containers must be destroyed (not paused) after job completion
- No host-network mode — containers must use bridge networking

#### 3.2 Data Deletion After Job Completion
- All job input data (task_spec, uploaded files) must be deleted from provider storage within **24 hours** of job completion
- Log files from job execution must not contain renter personal data in plaintext
- If a job fails, any partially processed data must also be deleted within 24 hours

#### 3.3 Access Controls
- Provider API key must not be shared between multiple physical machines
- SSH access to the provider machine must be restricted (key-based auth; password login disabled)
- If multiple operators share a provider machine, each job's filesystem must be isolated

#### 3.4 No Secondary Processing
- Providers must not:
  - Use job inputs/outputs to train or fine-tune any model
  - Log job content for analytics
  - Copy job data to any external storage (S3, cloud drives, etc.)
  - Allow third parties to access job containers during execution

#### 3.5 Incident Reporting
- If a provider suspects a data breach (unauthorised access to job data), they must notify DCP **within 72 hours** at: security@dcp.sa
- Include: date of incident, data affected, corrective actions taken

---

## Provider Data Processing Agreement (DPA) Summary

By registering as a DCP provider, providers agree to the following data processing terms. A full legal DPA will be provided separately.

### What DCP collects from providers

| Data | Purpose | Retention |
|------|---------|-----------|
| Email address | Account identification, notifications | Until account deletion |
| Name | Account display, payments | Until account deletion |
| Phone number | Account recovery, fraud prevention | Until account deletion |
| Organisation | Provider directory | Until account deletion |
| GPU specifications (model, VRAM, CUDA version) | Job matching, benchmarking | Until hardware is deregistered |
| IP address | Security, rate limiting, registration audit | 30 days in logs |
| Location (region/country) | Marketplace display, data residency matching | Until account deletion |
| Wallet address | Earnings payout (when escrow is live) | Until account deletion |
| Heartbeat telemetry (GPU load, uptime, container counts) | Reliability scoring, renter trust signals | 30 days rolling |

### How DCP uses provider data

- **Matching:** GPU specs and location are used to match providers with renter jobs
- **Reliability scoring:** Heartbeat data generates uptime and reliability scores shown to renters
- **Billing:** Job completion triggers payout calculations using provider ID
- **Security:** IP address and registration metadata are used to detect fraudulent registrations
- **Notifications:** Job assignment, completion, and earnings notifications sent by email

### Provider data rights

Providers may exercise the following rights by emailing privacy@dcp.sa:

| Right | How to Exercise | Response Time |
|-------|----------------|---------------|
| Access/export all stored data | Email privacy@dcp.sa with subject "PDPL Data Export Request" | 10 business days |
| Correct inaccurate data | Update via dashboard or email privacy@dcp.sa | 5 business days |
| Delete account and all personal data | Use DELETE endpoint in dashboard, or email privacy@dcp.sa | 30-day grace period, then permanent deletion |
| Object to specific processing | Email privacy@dcp.sa with specific objection | 10 business days |

---

## Provider Onboarding PDPL Checklist

Before a provider goes active, the following must be confirmed:

- [ ] **Hardware location documented** — Country and city where GPUs are physically located
- [ ] **Isolation confirmed** — Docker engine installed, containers isolated from host and from each other
- [ ] **Data deletion process** — Operator understands that job data must be deleted within 24 hours of completion
- [ ] **API key secured** — Key stored securely; not shared; not committed to version control
- [ ] **No secondary use** — Operator has read and agrees to the no-secondary-processing requirement
- [ ] **Incident contact saved** — security@dcp.sa is known to the operator
- [ ] **DPA accepted** — Provider has accepted DCP's Data Processing Agreement at registration

---

## Saudi Provider Advantage

Saudi-hosted providers are DCP's **highest-trust tier** for enterprise and government renters:

- No cross-border transfer consent required
- Eligible for PDPL-compliant tier badge in provider directory
- Government and legal sector renters (who require in-kingdom processing) will preferentially route to Saudi providers
- Energy cost advantage: Saudi electricity rates (SAR 0.18/kWh) vs EU/US (SAR 0.55-0.74/kWh) — see FOUNDER-STRATEGIC-BRIEF.md for full economics

---

*Questions: security@dcp.sa | DCP-800 | 2026-03-24*
