# DCP Container Security Policy

## Purpose

This policy defines mandatory runtime controls for all tenant job containers in DCP.

## Scope

- `infra/docker/run-job.sh`
- `infra/security/scan-image.sh`
- `infra/security/scan-template-images.sh`
- `backend/src/services/docker-manager.ts`
- `backend/src/routes/admin.js`
- `backend/docker/Dockerfile.base`
- `backend/docker/Dockerfile.general-worker`
- `backend/docker/Dockerfile.llm-worker`
- `backend/docker/Dockerfile.sd-worker`

## Mandatory Controls

### 1) Approved Image Allowlist Only

- Job containers MUST use an explicitly approved image.
- Runtime allowlist is controlled by `DCP_ALLOWED_DOCKER_IMAGES` (launcher path) and `DC1_ALLOWED_DOCKER_IMAGES` (Mission Control path).
- Any image outside the allowlist MUST be rejected before launch.
- Implicit pull of unknown images is prohibited.

### 2) Trusted Registry Validation

- Admin image approvals MUST be restricted to trusted registries only.
- Allowed registries are controlled by `DCP_IMAGE_REGISTRY_ALLOWLIST` (default: `docker.io,ghcr.io`) plus optional `DCP_PRIVATE_REGISTRY`.
- Image approval requests from untrusted registries MUST be rejected.

### 3) Image Scanning and Approval Gate

- Every approval request MUST run `trivy image --severity CRITICAL`.
- Images with any CRITICAL findings MUST be blocked.
- Scan results MUST be persisted in `image_scans` with evidence (`scan_report_json`).
- Built template images must pass `infra/security/scan-template-images.sh` in CI before release.

### 4) Digest Pinning

- Approved images MUST store resolved `sha256` digest in `approved_container_images`.
- Runtime can enforce digest pinning via:
  - `--pinned-digest sha256:<...>` in `run-job.sh`
  - `DCP_REQUIRE_PINNED_IMAGE_DIGEST=true` (fail-closed when digest not provided)
- `docker-manager.ts` enforces digest-pinned refs when `DCP_REQUIRE_PINNED_IMAGE_DIGEST=true`.

### 5) Resource Guardrails

Every job container MUST enforce CPU, memory, and PID limits:

- `--cpus`
- `--memory`
- `--memory-swap` equal to memory (no swap headroom)
- `--pids-limit`

These controls are required to prevent runaway workloads and host instability.

### 6) Network Isolation by Default

- Default runtime network mode is `none`.
- Egress is denied unless explicitly required.
- Bridge mode is only allowed with explicit operator intent (`--allow-egress`) and an approved network from `DCP_ALLOWED_EGRESS_NETWORKS`.

### 7) Seccomp Enforcement

- A restricted seccomp profile MUST be present and passed via `--security-opt seccomp=<path>`.
- `run-job.sh` fails fast if seccomp profile is missing.
- `docker-manager.ts` appends seccomp policy when profile path exists.

### 8) Privilege Minimization

- Containers MUST run with:
  - `--cap-drop ALL`
  - `--cap-add SYS_PTRACE` (only retained capability for GPU diagnostics/runtime compatibility)
  - `--security-opt no-new-privileges:true`
  - `--read-only` root filesystem where workload type permits
  - writable scratch only via bounded tmpfs mounts

### 9) Non-Root Container User

- Worker images MUST default to non-root runtime users.
- `backend/docker/Dockerfile.base` defines `dcp` user (`uid:gid 10001:10001`), and worker images return to this user for runtime.

## Input Validation and Injection Prevention

`run-job.sh` enforces:

- Safe `job_id` character set.
- Numeric validation for `--cpus` and `--pids-limit`.
- Safe-character validation for `--job-cmd` to block shell metacharacter injection.
- Egress/network inputs are validated against strict allowlists.

## Operational Requirements

- Keep `DCP_ALLOWED_DOCKER_IMAGES`, `DC1_ALLOWED_DOCKER_IMAGES`, and `DCP_ALLOWED_EGRESS_NETWORKS` tightly scoped.
- Review allowlists on every image release.
- Run `infra/security/scan-template-images.sh` on every template image build.
- Treat `image_scans` records as required audit evidence for approvals.
- Rate-limit image approval and scan APIs to prevent abuse.
- Enforce endpoint-specific anti-abuse throttles across new public and high-cost APIs:
  - `GET /api/providers/public`: 60 requests/minute per IP
  - `GET /api/containers/registry`: 30 requests/minute per IP
  - `POST /api/vllm/complete`: 10 requests/minute per renter key
  - `POST /api/vllm/complete/stream`: 5 requests/minute per renter key
  - `POST /api/jobs/:job_id/retry`: 3 retries/minute per renter key per job
  - `DELETE /api/renters/me` and `DELETE /api/providers/me`: 1 request per 24 hours per account key
- All rate-limit rejections MUST return `429` with `Retry-After` header and JSON error body.
- Audit and alert on rejected launch attempts.
- Do not allow ad-hoc image names from user payloads without policy review.

## Verification Checklist

1. `docker inspect <container>` confirms `NetworkMode=none` unless approved egress.
2. `docker inspect <container>` confirms `ReadonlyRootfs=true`.
3. `docker inspect <container>` confirms `CapDrop` includes `ALL`.
4. `docker inspect <container>` confirms `CapAdd` contains only `SYS_PTRACE`.
5. `docker inspect <container>` confirms `SecurityOpt` includes `no-new-privileges:true` and `seccomp=...`.
6. `docker inspect <container>` (or image inspect) confirms expected pinned digest when required.
7. `image_scans.critical_count = 0` before image is marked approved.
8. `docker inspect <container>` confirms non-zero `Memory`, `MemorySwap`, `NanoCpus`, and `PidsLimit`.
9. `docker inspect <container>` confirms image is in approved allowlist.
