# Provider Host Hardening Checklist

This checklist is the minimum security baseline for GPU provider hosts running `dc1_daemon.py`.

## P0 (must pass before production jobs)

- [ ] Use a dedicated non-root OS user for daemon execution (`dcp-provider`).
- [ ] Disable password SSH auth and root SSH login (`PasswordAuthentication no`, `PermitRootLogin no`).
- [ ] Enforce key-based SSH + MFA for admin/operator access where available.
- [ ] Enable host firewall (allow only SSH and daemon-required outbound ports).
- [ ] Keep OS and NVIDIA driver patched (security updates applied at least weekly).
- [ ] Install and enforce endpoint malware protection/EDR on Windows hosts.
- [ ] Install and enforce `unattended-upgrades` or equivalent on Linux hosts.
- [ ] Restrict Docker daemon access to a dedicated group; no broad sudo on provider account.
- [ ] Enable Docker `no-new-privileges` / dropped capabilities for workload containers.
- [ ] Enforce image allowlist + vulnerability scan gate (critical vulns block execution).
- [ ] Rotate provider API keys immediately after suspected compromise.
- [ ] Store API keys in OS credential store or environment-injected secret, never plaintext files.
- [ ] Enable disk encryption for host volumes containing model data and cached job artifacts.
- [ ] Configure log retention + secure log shipping for daemon and container events.

## P1 (strongly recommended)

- [ ] Segregate management network from compute network where possible.
- [ ] Enable audit logging for SSH logins, sudo usage, and Docker commands.
- [ ] Block outbound traffic to RFC1918/internal ranges except explicitly required endpoints.
- [ ] Use immutable base images for provider OS with periodic rebuilds.
- [ ] Set filesystem quotas for cache/workspace paths to limit abuse and DoS.

## Validation cadence

- Run this checklist at onboarding, after every daemon upgrade, and monthly thereafter.
- Record exceptions with owner, risk rationale, and remediation due date.
