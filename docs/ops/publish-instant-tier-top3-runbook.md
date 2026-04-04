# Instant-Tier Top-3 Publish Runbook

Owner: Staff Engineer  
Related issues: [DCP-494](/DCP/issues/DCP-494), [DCP-549](/DCP/issues/DCP-549)

## Purpose

Build and publish digest-pinned instant-tier worker images for the three Arabic priority templates:

- `allam-7b-instruct`
- `falcon-h1-arabic-7b`
- `jais-13b-chat`

The workflow emits `artifacts/instant-tier-images.json`, and template deploys resolve to the canonical digest from that manifest instead of `:latest`.

## Canonical Command

```bash
gh workflow run docker-instant-tier.yml --ref main
```

## One-Run Verification

After the workflow completes, download the artifact and inspect the manifest:

```bash
gh run download <run-id> --name instant-tier-image-manifest --dir /tmp/dcp-instant-tier
cat /tmp/dcp-instant-tier/instant-tier-images.json
```

Each manifest record must include:

- `templates[0]` matching one of the three template IDs
- `published_refs.mutable`
- `published_refs.immutable`
- `published_refs.canonical`
- `digest`

## Expected Published Images

- `docker.io/dc1/instant-allam-7b-instruct`
- `docker.io/dc1/instant-falcon-h1-arabic-7b`
- `docker.io/dc1/instant-jais-13b-chat`

## Local Dry Run For Manifest Generation

Use this to verify manifest shape without pushing images:

```bash
IMAGE_REGISTRY=docker.io \
IMAGE_NAMESPACE=dc1 \
INSTANT_TIER_IMAGE_SPECS='[
  {"name":"instant-allam-7b-instruct","template_id":"allam-7b-instruct","model_id":"HUMAIN-AI/ALLaM-7B-Instruct","digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","sha_tag":"sha-local-allam"},
  {"name":"instant-falcon-h1-arabic-7b","template_id":"falcon-h1-arabic-7b","model_id":"tiiuae/Falcon-H1-7B-Instruct","digest":"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","sha_tag":"sha-local-falcon"},
  {"name":"instant-jais-13b-chat","template_id":"jais-13b-chat","model_id":"inceptionai/jais-13b-chat","digest":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","sha_tag":"sha-local-jais"}
]' \
node scripts/emit-instant-tier-manifest.mjs /tmp/instant-tier-images.json
```

## Done Criteria

- Workflow summary shows one digest row per top-3 image.
- Artifact `instant-tier-image-manifest` contains canonical refs for all three templates.
- `POST /api/templates/:id/deploy` resolves each top-3 template to the matching `@sha256:` image ref.
