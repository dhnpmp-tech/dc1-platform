# Instant-Tier Top-3 Publish Runbook

This runbook covers the deterministic GitHub Actions path for publishing the instant-tier worker images and emitting the digest manifest artifact used by template deploys.

## Prerequisites

- GitHub Actions can run `.github/workflows/docker-instant-tier.yml` on `main`.
- Docker Hub credentials are configured as repository secrets:
  - `DOCKER_HUB_USERNAME`
  - `DOCKER_HUB_TOKEN`
- If the target Docker Hub namespace is not the same as the login username, set `DOCKER_HUB_NAMESPACE`.

Namespace resolution order in the workflow is:

1. `DOCKER_HUB_NAMESPACE`
2. `DOCKER_HUB_USERNAME`
3. `dc1`

## Publish

Trigger the workflow on `main`:

```bash
gh workflow run docker-instant-tier.yml --ref main
```

Or rerun the latest failed execution after credentials are fixed:

```bash
gh run rerun <run-id>
```

## Verify Outputs

After the run finishes green, collect:

- workflow run URL
- `instant-tier-image-manifest` artifact
- published digests for:
  - `base-worker`
  - `llm-worker`
  - `sd-worker`

Download the manifest artifact:

```bash
gh run download <run-id> --name instant-tier-image-manifest --dir /tmp/dcp-instant-tier-manifest
cat /tmp/dcp-instant-tier-manifest/instant-tier-images.json
```

## Post-Run Hand-Off

- Confirm the manifest contains digest-pinned canonical refs.
- Post the run URL and manifest evidence on [DCP-494](/DCP/issues/DCP-494).
- Close [DCP-549](/DCP/issues/DCP-549) once artifact evidence is attached.
