# DCP Template Container Sandboxing Specification

**Author:** Security Engineer (DCP-708)
**Date:** 2026-03-24
**Status:** Approved for implementation
**Scope:** All 20 one-click templates in `docker-templates/*.json`

---

## 1. Overview

When a renter clicks "Deploy" on a template, the DC1 platform instructs a provider to pull a Docker image and run a container on their GPU. The provider's host machine is trusted infrastructure — the renter's container must not be able to escape its boundaries, access other renters' data, or compromise the provider host.

This spec defines exactly what a renter container **can** access, what is **isolated**, and the controls the DC1 daemon must enforce at container launch time.

---

## 2. What a Renter Container Can Access

| Resource | Accessible | Conditions |
|----------|-----------|------------|
| Assigned GPU(s) | ✅ Yes | Via `--gpus` flag, scoped to assigned device(s) only |
| `/opt/dcp/model-cache` | ✅ Read-only | Mounted for approved templates (vllm-serve, inference, RAG) |
| `/opt/dcp/model-cache` | ✅ Read-write | LLM container in arabic-rag-complete only (to cache new weights) |
| Outbound internet (HTTPS) | ✅ Yes | Model download from HuggingFace Hub, pip install |
| Container-internal tmpfs | ✅ Yes | For scratch/temp work within the container |
| Container stdout/stderr | ✅ Yes | Streamed to DCP job logs |
| DC1 result channel | ✅ Yes | `DC1_RESULT_JSON:` prefix on stdout captured by daemon |
| Provider host filesystem | ❌ No | No bind mounts except explicit `model_cache` path |
| Other renters' containers | ❌ No | Docker bridge network isolation |
| Provider host network | ❌ No | Default bridge network, not `--network host` |
| Docker socket | ❌ No | Never mounted |
| Host GPU that isn't assigned | ❌ No | Explicit device scoping via `--device` or `--gpus device=N` |
| Container restart capability | ❌ No | `--restart no`, `--rm` after completion |
| Privileged mode | ❌ No | No `--privileged` flag, ever |
| Host PID/IPC/network namespace | ❌ No | Default Docker isolation (separate namespaces) |

---

## 3. Mandatory Docker Run Flags

The DC1 daemon **MUST** apply the following flags to every container launched for a renter job, regardless of template:

### 3.1 Security Options

```bash
--security-opt no-new-privileges:true
--security-opt seccomp=unconfined
```

**Rationale:**
- `no-new-privileges`: Prevents `setuid`/`setgid` binaries inside the container from elevating privileges. ML containers do not need privilege escalation; this has zero legitimate-use cost.
- `seccomp=unconfined`: Required for GPU containers — CUDA makes a broad set of syscalls (including `perf_event_open`) that the Docker default seccomp profile blocks. Until a DCP-custom seccomp profile is authored (see Section 7), unconfined is the operational choice. The `no-new-privileges` flag provides compensating control.

### 3.2 Capability Drops

```bash
--cap-drop ALL
--cap-add SYS_PTRACE
```

**Rationale:**
- `--cap-drop ALL`: Remove all Linux capabilities from the container. ML inference and training require none of the capabilities Docker grants by default.
- `--cap-add SYS_PTRACE`: Required by PyTorch's NCCL (multi-GPU collective comms) and some CUDA profiling tools. Added back explicitly rather than relying on defaults.

**Capabilities NOT re-added (and why):**

| Capability | Why not needed |
|-----------|----------------|
| `NET_ADMIN` | Containers don't manage network interfaces |
| `NET_RAW` | No raw socket access needed |
| `SYS_ADMIN` | Broad; includes mount, perf, BPF — dangerous |
| `SYS_MODULE` | Containers don't load kernel modules |
| `CHOWN`, `DAC_OVERRIDE` | Containers should run as a fixed UID |
| `SETUID`, `SETGID` | `no-new-privileges` covers this |

### 3.3 GPU Scoping

```bash
--gpus device=<assigned_gpu_id>
```

Never `--gpus all`. The daemon assigns one or more GPU IDs at job dispatch time and passes them explicitly. A renter container must not be able to observe or compute on GPUs assigned to other jobs.

### 3.4 Network Mode

```bash
--network bridge
```

Default Docker bridge networking. Do **not** use `--network host`.

For the `arabic-rag-complete` multi-container template, containers are placed on a **named compose network** (e.g., `dc1-job-<job_id>`) that is isolated from all other job networks. The orchestrator container is the only one with an exposed port.

### 3.5 Resource Limits

```bash
--memory <template.max_ram_gb>g
--memory-swap <template.max_ram_gb>g
--cpus <assigned_cpu_count>
--ulimit nofile=65536:65536
--ulimit nproc=4096:4096
--pids-limit 512
```

**Rationale:** Prevents a renter container from exhausting provider host memory/CPU, which would starve other provider services (DC1 daemon, OS). Swap is set equal to RAM to prevent swap exhaustion.

`--pids-limit 512` prevents fork bombs. ML workloads (dataloader workers, vLLM async workers) are well within this limit.

### 3.6 Time Limits

```bash
--stop-timeout 30
```

The DC1 daemon enforces job `duration_minutes` as a hard wall clock limit. At `T_start + duration_minutes`, the daemon sends `docker stop <container_id>` (30s grace) followed by `docker kill` if the container does not exit. This enforces cost cap adherence.

### 3.7 Container Lifecycle

```bash
--restart no
--rm
```

Containers do not restart automatically. After stop/kill, the container is removed. No data persists on the provider host after job completion (except model cache, which is provider-controlled).

---

## 4. Volume Mount Policy

### 4.1 Permitted Mounts

| Mount | Permission | When Applied |
|-------|-----------|--------------|
| `/opt/dcp/model-cache:/opt/dcp/model-cache:ro` | Read-only | vllm-serve, arabic-embeddings, arabic-reranker, inference templates |
| `/opt/dcp/model-cache:/opt/dcp/model-cache:rw` | Read-write | LLM container in arabic-rag-complete only |
| tmpfs at `/tmp` | Read-write (in-memory) | All containers (implicit) |

### 4.2 Prohibited Mounts

- **No host `/proc`, `/sys`, `/dev` mounts** — except `/dev/nvidia*` devices added implicitly by `--gpus` via the NVIDIA container runtime
- **No Docker socket mount**: `/var/run/docker.sock` is never mounted. Mounting the socket grants container-escape to full Docker daemon control.
- **No arbitrary host paths**: Only `/opt/dcp/model-cache` is permitted. The daemon validates that no template specifies a bind mount outside this path.
- **No write access to model cache** except where explicitly defined above.

### 4.3 `MODEL_CACHE_DIR` Environment Variable (lora-finetune)

The `lora-finetune` template accepts a `MODEL_CACHE_DIR` env var. The daemon must validate this value:
- Must match `/opt/dcp/model-cache` or a sub-path thereof
- Must not be an absolute path pointing outside the mount
- Validation: `path.resolve(MODEL_CACHE_DIR).startsWith('/opt/dcp/model-cache')` before container launch

If validation fails, job submission is rejected with `400: invalid MODEL_CACHE_DIR`.

---

## 5. Image Allowlist Enforcement

The `custom-container`, `lora-finetune`, `pytorch-*` templates pass an `image_override` parameter. The DC1 daemon **MUST** validate this value against the approved image allowlist before dispatching to a provider.

### 5.1 Approved Images

```
dc1/general-worker:latest
dc1/llm-worker:latest
dc1/sd-worker:latest
dc1/base-worker:latest
pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime
pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime
nvcr.io/nvidia/pytorch:24.01-py3
nvcr.io/nvidia/tensorflow:24.01-tf2-py3
tensorflow/tensorflow:2.15.0-gpu
```

### 5.2 Validation Logic

At `POST /api/jobs/submit`, before creating the job record:

```javascript
const ALLOWED_IMAGES = new Set([
  'dc1/general-worker:latest',
  'dc1/llm-worker:latest',
  'dc1/sd-worker:latest',
  'dc1/base-worker:latest',
  'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime',
  'pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime',
  'nvcr.io/nvidia/pytorch:24.01-py3',
  'nvcr.io/nvidia/tensorflow:24.01-tf2-py3',
  'tensorflow/tensorflow:2.15.0-gpu',
]);

if (containerSpec.image_override && !ALLOWED_IMAGES.has(containerSpec.image_override)) {
  return res.status(400).json({
    error: 'image_not_allowed',
    message: `Image '${containerSpec.image_override}' is not on the approved list.`,
    allowed: Array.from(ALLOWED_IMAGES),
  });
}
```

### 5.3 Provider-Side Enforcement

The provider daemon must also validate `image_override` before running `docker pull`. Defense-in-depth: even if the backend validation is bypassed, the provider should refuse to pull non-allowlisted images.

---

## 6. Cost and Time Cap Enforcement

### 6.1 Pre-Job Balance Check

Before job dispatch, the backend verifies `renter.balance_halala >= quoted_cost_halala`. Jobs are rejected if the renter lacks funds. Balance is held (not debited) at submission time and settled at job completion.

### 6.2 Duration Cap

The `duration_minutes` parameter in each template defines the maximum allowed job run time. The daemon enforces this:

```
timeout_at = job.started_at + duration_minutes * 60 seconds
```

At `timeout_at`, the daemon sends `docker stop` → `docker kill`. The provider reports the job as `completed` with actual duration.

### 6.3 Cost Cap Enforcement

Maximum job cost = `duration_minutes / 60 * hourly_rate_halala`. The renter's balance is checked at submission. If a job runs short (provider completes early), the actual cost is calculated from actual duration and any over-charge is refunded.

---

## 7. Jupyter-Specific Controls (DCP-SEC-001)

The Jupyter template (`jupyter-gpu.json`) requires additional safeguards because it provides an interactive Python shell with GPU access.

### 7.1 Token Enforcement (Required Before Launch)

The backend **MUST** reject Jupyter job submissions where `NOTEBOOK_TOKEN` matches the default (`dc1jupyter`) or is empty:

```javascript
if (jobType === 'jupyter' || templateId === 'jupyter-gpu') {
  const token = envVars.NOTEBOOK_TOKEN || '';
  if (!token || token === 'dc1jupyter') {
    return res.status(400).json({
      error: 'weak_jupyter_token',
      message: 'NOTEBOOK_TOKEN must be set to a strong, unique value. The default token is not allowed.',
    });
  }
  if (token.length < 16) {
    return res.status(400).json({
      error: 'weak_jupyter_token',
      message: 'NOTEBOOK_TOKEN must be at least 16 characters.',
    });
  }
}
```

**Preferred alternative:** Generate a random UUID server-side and inject it as the token, returning it to the renter in the job response. This prevents renters from choosing weak tokens.

### 7.2 Jupyter Port Binding

The Jupyter server inside the container **must not** bind to `0.0.0.0:8888` if it is provider-accessible. The DC1 daemon should proxy Jupyter access through a secure tunnel (or restrict provider firewall rules) rather than exposing port 8888 on the provider's public IP.

This is an operational control — document in provider onboarding that provider firewalls must block inbound port 8888 from public internet.

---

## 8. Non-Root User Requirement

All DC1 base images must run as a non-root user:

```dockerfile
# Required in all dc1/* Dockerfiles
RUN useradd -m -u 1000 dc1user
USER dc1user
```

**Verification required (DCP-SEC-002):** ML Infra must confirm that `dc1/llm-worker`, `dc1/sd-worker`, `dc1/general-worker`, and `dc1/base-worker` all set `USER nonroot` or equivalent. If any image runs as UID 0, a container escape (e.g., via GPU driver CVE) could give root on the provider host.

If base images cannot be immediately changed to non-root, add `--user 1000:1000` to the daemon's `docker run` call as a compensating control.

---

## 9. Network Isolation Policy

### 9.1 Single-Container Templates

All single-container templates (vllm-serve, pytorch-*, jupyter-gpu, etc.) run with:
- Default Docker bridge network
- No `--network host`
- Outbound internet access allowed (for model downloads from HuggingFace Hub)
- Inbound connections from provider host only (for job result polling by daemon)

### 9.2 Multi-Container Templates (arabic-rag-complete)

The Arabic RAG pipeline uses Docker Compose with four services. Sandboxing requirements:

```yaml
networks:
  dc1-job:
    driver: bridge
    internal: false  # outbound internet needed for model download
```

- Each job gets its own named network: `dc1-job-<job_id>` to prevent cross-job communication
- Service ports (8001, 8002) must bind to `127.0.0.1` only: `127.0.0.1:8001:8001`
- Only the orchestrator port (9000) may be externally accessible (via provider proxy)
- Network is torn down on job completion: `docker compose down --remove-orphans`

### 9.3 Provider Host Network Considerations

Providers must configure their host firewall to:
- Block inbound connections to renter container ports from public internet
- Allow outbound HTTPS (443) from containers for model hub access
- Block outbound connections to provider LAN ranges from containers (prevent internal network traversal)

---

## 10. Template-by-Template Security Classification

| Template | Image | Network | Volumes | GPU | Risk Level |
|----------|-------|---------|---------|-----|-----------|
| vllm-serve | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| llama3-8b | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| mistral-7b | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| nemotron-nano | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| nemotron-super | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| qwen25-7b | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Low |
| arabic-embeddings | dc1/rag-worker | bridge | model-cache:ro | 1x assigned | Low |
| arabic-reranker | dc1/rag-worker | bridge | model-cache:ro | 1x assigned | Low |
| arabic-rag-complete | dc1/{llm,rag}-worker | compose/bridge | model-cache:ro+rw | 1x assigned | Medium |
| sdxl | dc1/sd-worker | bridge | model-cache:ro | 1x assigned | Low |
| stable-diffusion | dc1/sd-worker | bridge | model-cache:ro | 1x assigned | Low |
| ollama | dc1/general-worker | bridge | model-cache:ro | 1x assigned | Low |
| pytorch-single-gpu | dc1/general-worker | bridge | none | 1x assigned | Medium |
| pytorch-multi-gpu | dc1/general-worker | bridge | none | N x assigned | Medium |
| pytorch-training | dc1/general-worker | bridge | none | 1x assigned | Medium |
| jupyter-gpu | dc1/general-worker | bridge | none | 1x assigned | **High** (see §7) |
| lora-finetune | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Medium |
| qlora-finetune | dc1/llm-worker | bridge | model-cache:ro | 1x assigned | Medium |
| python-scientific-compute | dc1/general-worker | bridge | none | 1x assigned | Medium |
| custom-container | allowlisted | bridge | none | 1x assigned | **High** (image validation) |

---

## 11. Open Findings — Issues to File

| ID | Severity | Title | Owner |
|----|----------|-------|-------|
| DCP-SEC-001 | HIGH | Enforce strong Jupyter token — reject `dc1jupyter` default | Backend Engineer |
| DCP-SEC-002 | MEDIUM | Verify all dc1 base images run as non-root user | ML Infra |
| DCP-SEC-003 | MEDIUM | Verify `image_override` validated against allowlist in job submission | Backend Engineer |
| DCP-SEC-011 | MEDIUM | arabic-rag-complete: bind service ports to 127.0.0.1 | DevOps |
| DCP-SEC-012 | LOW | Author DCP-custom seccomp profile to replace `seccomp=unconfined` | Security Engineer |
| DCP-SEC-013 | LOW | Document provider firewall requirements for container port isolation | DevOps / DevRel |

---

## 12. Enforcement Checklist for Daemon Implementation

When the DC1 daemon constructs a `docker run` command for a renter job, it **MUST** include all of the following:

```bash
docker run \
  --rm \
  --restart no \
  --security-opt no-new-privileges:true \
  --security-opt seccomp=unconfined \
  --cap-drop ALL \
  --cap-add SYS_PTRACE \
  --gpus device=<assigned_gpu_ids> \
  --network bridge \
  --memory <max_ram>g \
  --memory-swap <max_ram>g \
  --cpus <allocated_cpus> \
  --ulimit nofile=65536:65536 \
  --ulimit nproc=4096:4096 \
  --pids-limit 512 \
  --stop-timeout 30 \
  [--mount src=/opt/dcp/model-cache,target=/opt/dcp/model-cache,readonly]  # if template requires model-cache
  <image> <entrypoint>
```

Any deviation from this list must be approved by the Security Engineer and documented with a rationale.

---

## 13. Accepted Risks

| Risk | Rationale | Mitigating Control |
|------|-----------|-------------------|
| `seccomp=unconfined` | Required for CUDA syscalls | `no-new-privileges` + `cap-drop ALL` |
| Outbound internet from containers | Required for HuggingFace model downloads | Provider firewall should block access to provider LAN |
| Model cache read access | Required for model serving; path is DCP-controlled | Mount as `:ro` where possible |
| No per-job network egress filtering | Operational complexity; post-MVP | Provider firewall blocks internal LAN traversal |

---

*Spec complete. DCP-708 deliverable.*
