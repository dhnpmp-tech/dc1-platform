# Release Train Automation

`npm run release:train` evaluates a batch of candidate branches against `origin/main` without blocking on a single bad branch.

What it does:

- creates an isolated git worktree per candidate
- rebases the candidate onto the chosen base ref
- runs deterministic gate commands in order
- writes markdown/json evidence plus per-gate logs under `docs/reports/release-train/`
- continues through stale, conflicting, or failing branches so the full train result is visible in one run

## Quick Start

Run an ad hoc train:

```bash
npm run release:train -- \
  --branch origin/agent/backend-dev/dcp-510-provider-approval-queue \
  --branch origin/agent/backend-dev/dcp-472-restore-allam-capacity \
  --gate "npm --prefix backend run test:openrouter:compliance"
```

Run a manifest-driven train:

```json
{
  "base": "origin/main",
  "defaultGates": ["npm ci --include=dev", "npm run build"],
  "candidates": [
    {
      "branch": "origin/agent/backend-dev/dcp-510-provider-approval-queue",
      "issue": "DCP-516",
      "label": "OpenRouter eligibility fix",
      "notes": "Queued for release via DCP-520",
      "gates": [
        "npm --prefix backend ci --include=dev",
        "npm --prefix backend run test:openrouter:compliance",
        "npm --prefix backend run test:openrouter:failover-proof"
      ]
    }
  ]
}
```

```bash
npm run release:train -- --manifest docs/reports/release-train/candidates.json
```

## Status Semantics

- `passed`: rebased cleanly and every gate passed
- `stale`: branch tip is already reachable from the base ref, so release work is unnecessary
- `conflict`: rebase onto the base ref failed
- `failed_gate`: rebase succeeded but at least one configured gate failed
- `missing`: the candidate ref did not resolve locally or on origin
