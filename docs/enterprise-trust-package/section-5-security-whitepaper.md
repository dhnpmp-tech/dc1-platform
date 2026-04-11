# DCP Enterprise Trust Package — Section 5 Security Whitepaper

**Version**: 1.0  
**Date**: 2026-03-20 (UTC)  
**Owner**: Security Engineer  
**System**: DCP GPU Compute Marketplace

## 1. Executive Summary

DCP runs untrusted tenant workloads on provider GPUs using a defense-in-depth container model with default network isolation, least privilege, runtime resource controls, and pre-approval image security checks. For compliance-sensitive buyers in Saudi Arabia, DCP also provides PDPL rights endpoints (export/deletion), request audit logging, and explicit cross-border transfer disclosure.

This whitepaper documents the technical controls currently implemented, evidence anchors in the codebase, and the signed-image hardening commitment needed for enterprise procurement.

## 2. Security Scope

This section covers:

- Container isolation and workload sandboxing
- Seccomp and syscall reduction
- Network isolation and egress constraints
- Image approval, scanning, and digest integrity
- Signed image trust posture and roadmap
- PDPL data residency commitments and evidence

## 3. Threat Model Snapshot

Primary risks addressed by these controls:

- Tenant breakout from job container to provider host
- Data exfiltration from compute containers
- Privilege escalation via Linux capabilities or dangerous syscalls
- Supply-chain risk from unapproved or vulnerable container images
- Tampering with workload execution payloads
- Non-compliance with Saudi PDPL obligations for data rights and transfer disclosure

## 4. Implemented Technical Controls

### 4.1 Container Isolation (Runtime)

DCP enforces hardened Docker runtime flags for tenant jobs:

- `--network none` by default (no outbound internet)
- `--read-only` root filesystem
- `--cap-drop ALL` plus minimal `SYS_PTRACE` exception for GPU/runtime diagnostics
- `--security-opt no-new-privileges:true`
- `--pids-limit`, CPU limits, memory limits, and swap lock (`memory-swap == memory`)
- bounded `tmpfs` for writable scratch only (`/tmp`, `/var/tmp`, noexec,nosuid)

**Evidence anchors**

- `infra/docker/run-job.sh`
- `backend/src/services/docker-manager.ts`
- `backend/installers/dcp_daemon.py`
- `backend/tests/security/container-isolation.test.js`

### 4.2 Seccomp Enforcement

DCP writes and applies a restricted seccomp profile that blocks high-risk syscalls (e.g., `ptrace`, `mount`, `kexec_load`, kernel module operations, keyring/perf primitives).

- Daemon generates `/tmp/dc1-gpu-seccomp.json` and applies via `--security-opt seccomp=...`
- Mission Control container manager adds seccomp when configured profile exists

**Evidence anchors**

- `backend/installers/dcp_daemon.py` (`_ensure_seccomp_profile`)
- `backend/src/services/docker-manager.ts` (`buildSecurityOpts`)
- `backend/tests/security/container-isolation.test.js` (static and live tests)

### 4.3 Network Isolation

- Default execution mode is isolated (`none`) for compute jobs
- Egress is denied unless explicitly enabled for approved network scenarios
- vLLM serving path uses `bridge` intentionally to expose inference port and is still constrained with capability and seccomp controls

**Evidence anchors**

- `infra/docker/run-job.sh`
- `backend/src/services/docker-manager.ts` (`HostConfig.NetworkMode = 'none'`)
- `backend/installers/dcp_daemon.py` (job mode `none`, vLLM mode `bridge`)

### 4.4 Image Scanning and Integrity

DCP implements a controlled image approval pipeline:

- trusted registry allowlist check
- digest resolution and pin verification
- Trivy critical vulnerability scan gate
- persistence of scan evidence and approved digests
- runtime allowlist rejection for non-approved images

**Evidence anchors**

- `backend/src/routes/admin.js` (`/containers/approve-image`, `/containers/scan-image`, `/containers/security-status`)
- `backend/src/lib/container-registry.js` (digest and format validation)
- `infra/security/scan-image.sh` and `infra/security/scan-template-images.sh`
- `backend/src/db.js` (`image_scans`, `approved_container_images` tables)

### 4.5 Signed Images (Current State and Commitment)

**Current state**

- DCP enforces image digest pinning (`@sha256:<digest>`) and can fail closed when `DCP_REQUIRE_PINNED_IMAGE_DIGEST=true`
- Admin approval stores resolved digest and exposes pinned references for runtime enforcement

**Enterprise commitment**

- Add mandatory signature verification (Sigstore Cosign or equivalent) for all production-approved images
- Require valid signature by trusted key/identity before `approved_container_images` activation
- Persist signature verification evidence with scan metadata for audit

**Interim compensating controls already active**

- trusted registries only
- digest pinning checks
- critical-vulnerability scan gate
- runtime allowlist enforcement

## 5. Saudi PDPL Data Residency and Privacy Commitments

### 5.1 Current Compliance Controls

- Data subject rights endpoints for both renters and providers:
  - export: `GET /api/renters/me/data-export`, `GET /api/providers/me/data-export`
  - erasure/anonymization: `DELETE /api/renters/me`, `DELETE /api/providers/me`
- PDPL request audit logging (`pdpl_request_log`)
- Data deletion safety model: soft delete + anonymization + scheduled deletion window
- Public privacy disclosure includes cross-border transfer notice and consent basis (PDPL Article 29)

**Evidence anchors**

- `backend/src/routes/renters.js`
- `backend/src/routes/providers.js`
- `backend/src/db.js` (`pdpl_request_log`)
- `app/privacy/page.tsx`
- `docs/reports/pdpl-gap-analysis.md`

### 5.2 Residency Commitment for Enterprise Customers

- DCP commits to Saudi-first processing posture for enterprise workloads that require in-Kingdom handling
- Until full in-Kingdom migration is complete, DCP discloses transfer locations, collects consent where required, and maintains audit trails for rights requests
- Security and legal teams will maintain a transfer register and residency-control evidence pack for procurement reviews

## 6. Verification and Audit Evidence

Current verification artifacts include:

- container isolation test suite (`backend/tests/security/container-isolation.test.js`)
- integration tests for network mode enforcement (`backend/tests/integration/job-execution.test.ts`)
- approved-image security status endpoint (`GET /api/admin/containers/security-status`)
- retained scan records in `image_scans` with critical vulnerability counts

Recommended enterprise audit cadence:

- Weekly: approved image inventory + vulnerability delta review
- Monthly: seccomp/egress configuration review and evidence export
- Quarterly: PDPL tabletop incident and data-rights response drill

## 7. Security Limitations and Planned Remediation

Open items tracked for enterprise-grade completion:

1. Signed image verification is not yet mandatory at runtime (digest pinning exists; signature enforcement pending).
2. PDPL cross-border controls still require tighter policy-to-implementation alignment and transfer-governance artifacts.
3. vLLM serving needs dedicated hardening profile documentation because it uses bridge networking by design.

## 8. Enterprise Procurement Response Mapping

- **Container Isolation**: Implemented and tested (network, FS, capability, resource controls).
- **Seccomp**: Implemented with explicit blocked syscall list and runtime attachment.
- **Network Isolation**: Default-deny model with explicit exceptions.
- **Image Scanning**: Trivy critical gate + approved image lifecycle controls.
- **Signed Images**: Digest integrity now; signature enforcement committed as next hardening milestone.
- **PDPL Residency**: Rights APIs and logging active; data transfer disclosure active; Saudi-residency control package in progress.

---

For technical due diligence requests, provide this section with:

- `docs/container-security-policy.md`
- `docs/container-security.md`
- `docs/reports/pdpl-gap-analysis.md`
- security test execution evidence from CI/artifact logs
