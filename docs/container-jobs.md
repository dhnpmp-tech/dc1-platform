# Container Jobs — Renter Guide

This guide explains how to submit and manage container jobs on DCP. All compute jobs run in isolated Docker containers on provider GPU machines.

---

## Available job types

| Type | Docker image | Best for |
|------|-------------|---------|
| `llm_inference` | `dcp/vllm-serve:latest` | LLM chat completions, text generation |
| `image_generation` | `dcp/sd-worker:latest` | Stable Diffusion image synthesis |
| `training` | `dcp/training:latest` | Fine-tuning, LoRA, custom training runs |
| `pytorch` | `dcp/pytorch-cuda:latest` | Custom PyTorch scripts, embeddings, research |

The platform selects the image automatically from your `job_type` field. You cannot specify a custom image — all images are pinned and audited by DCP.

---

## Setting VRAM requirements

Specify `min_vram_gb` in your job submission to ensure the job is routed to a provider with enough GPU memory:

```bash
curl -X POST https://dcp.sa/api/dc1/jobs/submit \
  -H "x-renter-key: YOUR_RENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "llm_inference",
    "model": "mistral-7b",
    "min_vram_gb": 16,
    "params": {
      "prompt": "Explain quantum computing in simple terms.",
      "max_tokens": 512
    }
  }'
```

VRAM guidance by model:

| Model class | Recommended `min_vram_gb` |
|-------------|--------------------------|
| 7B models (Mistral, Phi-3) | 14–16 |
| 8B models (Llama 3 8B) | 16 |
| 13B models (JAIS, CodeLlama 13B) | 24 |
| 34B quantized | 48 |
| 70B quantized | 80 |

Jobs with `min_vram_gb` that no online provider satisfies will queue until a matching provider comes online.

---

## Reading live logs

Poll for streaming output while a job is running:

```bash
# Get the job_id from the submit response
JOB_ID="JOB-abc123"

# Fetch current output (call repeatedly to tail logs)
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID/output" \
  -H "x-renter-key: YOUR_RENTER_KEY"
```

Response fields:

| Field | Description |
|-------|-------------|
| `status` | `pending`, `running`, `completed`, `failed` |
| `output` | Accumulated stdout/result text |
| `error` | Error message if status is `failed` |
| `started_at` | ISO 8601 timestamp when container started |
| `completed_at` | ISO 8601 timestamp when container exited |

Poll every 5–10 seconds while `status` is `running`. The container auto-cleans up on exit.

---

## Downloading execution history

Fetch a paginated list of all your past jobs:

```bash
curl "https://dcp.sa/api/dc1/renters/me?key=YOUR_RENTER_KEY"
```

The `jobs` array in the response includes every job with `status`, `cost_halala`, `provider_id`, and timestamps.

To fetch a single job record:

```bash
curl "https://dcp.sa/api/dc1/jobs/$JOB_ID/output" \
  -H "x-renter-key: YOUR_RENTER_KEY"
```

---

## Container registry — available images

All DCP worker images are built from the Dockerfiles in `backend/docker-templates/` and published to the DCP private registry. You cannot pull these images directly — they are fetched by the provider daemon during job execution.

| Image tag | Base | CUDA | Description |
|-----------|------|------|-------------|
| `dcp/vllm-serve:latest` | Ubuntu 22.04 | 12.x | vLLM server, OpenAI-compatible endpoint |
| `dcp/sd-worker:latest` | Ubuntu 22.04 | 12.x | Stable Diffusion + Diffusers pipeline |
| `dcp/training:latest` | Ubuntu 22.04 | 12.x | PyTorch + HuggingFace Trainer, LoRA support |
| `dcp/pytorch-cuda:latest` | Ubuntu 22.04 | 12.x | Bare PyTorch environment for custom scripts |

Images are read-only inside the container. All job output writes go to the `/opt/dcp/output` mount which is returned to DCP on job completion.

---

## Job isolation guarantees

Every container runs with:

- **No network access** (`--network none`) — containers cannot call external APIs
- **Read-only filesystem** — no persistent writes to the provider machine
- **Ephemeral workspace** — `/dc1/job` is a tmpfs cleared on exit
- **GPU scoped** — only the assigned GPU(s) are visible inside the container
- **Process limit** — max 256 processes per container

These guarantees protect both renters (job isolation) and providers (no malicious code execution).

---

## Pricing

Jobs are billed by the minute from container start to container exit:

| Job type | Rate |
|----------|------|
| LLM inference | 0.15 SAR/min |
| Image generation | 0.20 SAR/min |
| Training | 0.25 SAR/min |

Billing is deducted from your renter balance in halala (100 halala = 1 SAR). Top up your balance before submitting long-running jobs:

```bash
curl -X POST https://dcp.sa/api/dc1/renters/topup \
  -H "x-renter-key: YOUR_RENTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount_sar": 100}'
```

---

## Troubleshooting

**Job stays `pending` for more than 2 minutes:**
- No online provider has enough VRAM. Lower `min_vram_gb` or wait for more providers to come online.
- Check available providers: `GET /api/renters/available-providers?key=YOUR_RENTER_KEY`

**Job fails with `cuda out of memory`:**
- Increase `min_vram_gb` to ensure the job routes to a provider with more VRAM.

**Output is empty after `completed`:**
- The job script may have written to stderr instead of stdout. Check the `error` field.

**Billing deducted but no result:**
- If a job fails due to provider-side error, the charge is refunded automatically within 1 hour. Check your balance with `GET /api/renters/me`.
