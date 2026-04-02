# PDPL Baseline v1

## Scope

This baseline tracks operational controls and recurring evidence required for PDPL-oriented due diligence on DCP systems.

## IAM Quarterly Evidence Control

Control objective: prove recurring operation of least-privilege reviews and production key-rotation attestations.

### Control Inputs

- Runbook: `docs/compliance/iam-quarterly-evidence-runbook.md`
- Generator: `scripts/compliance/generate-iam-quarterly-evidence.mjs`
- Freshness verifier: `scripts/compliance/verify-iam-evidence-freshness.mjs`

### Current Evidence Artifacts

- Privileged access review: `artifacts/compliance/iam/2026-04-02-privileged-access-review.json`
- Key rotation attestation: `artifacts/compliance/iam/2026-04-02-key-rotation-attestation.json`
- Summary: `artifacts/compliance/iam/2026-04-02-iam-evidence-summary.md`
- Latest verifier output: `artifacts/compliance/iam/latest-verification.txt`

### Control Rule

- Evidence freshness policy: latest privileged-access review and key-rotation attestation must each be no older than 90 days.
- Enforced by: `npm run compliance:iam:verify` (non-zero exit on stale/missing evidence).
