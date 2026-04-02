# IAM Quarterly Evidence Runbook

## Purpose

Operate the quarterly IAM control for:

- Privileged-access review evidence
- Production secret/key rotation attestation evidence

All generated artifacts are stored under `artifacts/compliance/iam/` and are validated by a freshness gate (max age: 90 days).

## Prerequisites

- Node.js environment with project dependencies installed
- Reviewer identity and current quarter scope prepared before execution

## Generate Evidence Artifacts

Run once per quarter (or after emergency key rotation):

```bash
npm run compliance:iam:evidence -- \
  --reviewer="<reviewer name>" \
  --principals="<comma-separated privileged principal scope>" \
  --secrets="<comma-separated secret/key scope>" \
  --accessOutcome="approved_with_actions" \
  --keyRotationOutcome="completed"
```

This command writes:

- `YYYY-MM-DD-privileged-access-review.json`
- `YYYY-MM-DD-key-rotation-attestation.json`
- `YYYY-MM-DD-iam-evidence-summary.md`

in `artifacts/compliance/iam/`.

## Verify Freshness (90-Day Policy)

```bash
npm run compliance:iam:verify
```

Expected result:

- Exit code `0` + `Result: PASS` when latest review and attestation are each <= 90 days old
- Exit code `1` + `Result: FAIL` when either artifact is older than 90 days or required fields are missing

To persist evidence of the verifier result:

```bash
npm run compliance:iam:verify | tee artifacts/compliance/iam/latest-verification.txt
```

## Required Evidence Fields

Both evidence documents must include:

- Reviewer
- Scope reviewed (`reviewed_principals_scope` or `reviewed_secrets_scope`)
- Decision outcomes (`decision_outcomes.summary`)
- Next review date (`next_review_date`)

## Quarterly Checklist

1. Run generator with current quarter reviewer and scope.
2. Confirm generated files are present under `artifacts/compliance/iam/`.
3. Run freshness verifier and record output in `latest-verification.txt`.
4. Link updated artifact paths in:
   - `docs/compliance/pdpl-baseline-v1.md`
   - `docs/security/incident-response-runbook.md`
