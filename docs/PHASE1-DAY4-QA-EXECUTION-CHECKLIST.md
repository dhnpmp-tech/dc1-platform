# Phase 1 Day 4 QA Execution Checklist (2026-03-26 08:00-12:00 UTC)

**QA Engineer:** Agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Execution Date:** 2026-03-26
**Execution Time:** 08:00-12:00 UTC (4 hours)
**Pre-Flight Status:** 🟢 **GO** (verified 2026-03-25 00:08 UTC)

---

## Pre-Execution Setup (07:00-08:00 UTC)

### Terminal Setup
- [ ] Open Terminal 1: VPS monitoring & health checks
- [ ] Open Terminal 2: Test script execution
- [ ] Open Terminal 3: Logs & troubleshooting

### Environment Configuration
- [ ] Verify SSH key access: `ssh root@76.13.179.86 "echo ready"`
- [ ] Load test API keys into environment (DCP_PROVIDER_KEY, DCP_RENTER_KEY)
- [ ] Verify Node.js version: `node --version` (expect v18+)
- [ ] Verify npm is available: `npm --version`
- [ ] Check git status: `git status` (expect clean)
- [ ] Load current pre-flight smoke test results

### Health Check Baseline
- [ ] Run pre-flight smoke test (should still show GO)
- [ ] Capture health baseline: api.dcp.sa response times
- [ ] Record model count and template count
- [ ] Verify provider count (expect 43+ registered)

---

## 12-Section Pre-Test Validation (08:00-12:00 UTC)

### Section 1: VPS Connectivity & SSH Access (08:00-08:10)
```bash
ssh root@76.13.179.86 "echo 'VPS accessible'; uptime"
```
**Checklist:**
- [ ] SSH access works
- [ ] VPS responding (uptime OK)
- [ ] No firewall blocks

**Pass Criteria:** SSH returns uptime successfully

---

### Section 2: Disk Space & Memory (08:10-08:15)
```bash
ssh root@76.13.179.86 << 'EOF'
df -h | grep root
free -h
uptime
EOF
```
**Checklist:**
- [ ] Disk usage < 70% (expect < 50%)
- [ ] Memory > 8GB free (expect 16GB total)
- [ ] Load average < 4.0

**Pass Criteria:** All three checks pass

---

### Section 3: PM2 Services Status (08:15-08:25)
```bash
ssh root@76.13.179.86 "pm2 list"
```
**Checklist:**
- [ ] dc1-provider-onboarding service online
- [ ] dc1-webhook service online (if deployed)
- [ ] No services in "errored" state
- [ ] Memory usage per service < 500MB

**Expected Output:**
```
│ 0  │ dc1-provider-onboarding │ online │ 0 │ ... │ 150M
│ 1  │ dc1-webhook            │ online │ 0 │ ... │ 100M
```

**Pass Criteria:** Both services "online"

---

### Section 4: Database Integrity (08:25-08:35)
```bash
# Test database connectivity
curl -s https://api.dcp.sa/api/health | grep -i database
```

**Checklist:**
- [ ] Database responding
- [ ] No connection errors
- [ ] Schema is intact (verify by checking model count)

**Pass Criteria:** Database health check passes

---

### Section 5: API Health & Endpoint Validation (08:35-08:45)
```bash
# Run full pre-flight smoke test again
node scripts/phase1-preflight-smoke.mjs
```

**Checklist:**
- [ ] API Health → HTTP 200
- [ ] Model Catalog → 11+ models
- [ ] Template Catalog → 15+ templates
- [ ] Provider Heartbeat → Deployed (HTTP 400 OK)
- [ ] Job Queue API → Deployed (HTTP 401 OK)

**Pass Criteria:** All 5 endpoints pass

---

### Section 6: Model Catalog Verification (08:45-09:00)
```bash
# Get model list
curl -s https://api.dcp.sa/api/models | head -200
```

**Checklist:**
- [ ] 11 models listed (check count)
- [ ] Each model has: id, name, vram, pricing
- [ ] Arabic models included (ALLaM, JAIS, Qwen, Falcon)
- [ ] No corrupted model records

**Expected Models:** ALLaM, JAIS, Qwen 2.5, Llama 3, Mistral, Nemotron, etc.

**Pass Criteria:** All 11 models present with complete metadata

---

### Section 7: Template Catalog Verification (09:00-09:15)
```bash
# Get template list
curl -s https://api.dcp.sa/api/templates | wc -l
```

**Checklist:**
- [ ] 15+ templates listed
- [ ] docker-templates/*.json accessible
- [ ] Each template has: name, docker_image, description
- [ ] vLLM, python-scientific-compute, pytorch templates present
- [ ] Arabic portfolio templates present (if applicable)

**Pass Criteria:** 15+ templates present and accessible

---

### Section 8: GPU Pricing Seeding (09:15-09:30)
```bash
# Verify pricing is seeded
curl -s https://api.dcp.sa/api/models | grep -A5 "RTX 4090"
```

**Checklist:**
- [ ] RTX 4090 pricing set (26,700 halala/hr expected)
- [ ] Other GPU models priced (RTX 4080, H100, etc.)
- [ ] Pricing > $0 for all models
- [ ] No null/zero pricing values

**Expected RTX 4090 Price:** 26,700 halala/hr (matches strategic brief)

**Pass Criteria:** All GPUs have valid pricing

---

### Section 9: Provider Heartbeat Connectivity (09:30-09:45)
```bash
# Test provider heartbeat (with auth)
curl -s -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DCP_PROVIDER_KEY" \
  -d '{"providerId":"test-provider","status":"online"}'
```

**Checklist:**
- [ ] Endpoint accepts POST requests
- [ ] Auth validation working (401 without key)
- [ ] Heartbeat recorded (check response)
- [ ] Provider count updated (or stays stable)

**Expected Behavior:** HTTP 200 or 400 (validation error is OK)

**Pass Criteria:** Endpoint responds and processes heartbeats

---

### Section 10: Job Queue Infrastructure (09:45-10:00)
```bash
# Test job creation endpoint
curl -s -X GET https://api.dcp.sa/api/jobs \
  -H "Authorization: Bearer $DCP_RENTER_KEY"
```

**Checklist:**
- [ ] Job queue endpoint responding
- [ ] Auth validation working (401 without key)
- [ ] Jobs table accessible (or returns empty list)
- [ ] No errors in response

**Pass Criteria:** Endpoint responds with valid HTTP status

---

### Section 11: Metering System Validation (10:00-10:30)
```bash
# Run metering smoke test
node scripts/vllm-metering-smoke.mjs
```

**Checklist:**
- [ ] Script runs without errors
- [ ] Token counting logic working
- [ ] Metering validation passes
- [ ] 26/26 metering checks pass (per fb619e7)

**Pass Criteria:** Metering smoke test succeeds with zero failures

---

### Section 12: Test Script Execution Readiness (10:30-11:00)
```bash
# Verify all test scripts are present and executable
ls -lh scripts/*smoke*.mjs scripts/*test*.mjs
```

**Checklist:**
- [ ] 8+ smoke test scripts present
- [ ] e2e-marketplace.test.js present (27K)
- [ ] All scripts are executable (chmod +x)
- [ ] No syntax errors in test files

**Expected Scripts:**
- phase1-preflight-smoke.mjs
- bootstrap-health-smoke-test.mjs
- e2e-smoke-full.mjs
- gpu-job-lifecycle-smoke.mjs
- metering-verification.mjs
- model-catalog-smoke.mjs
- phase1-e2e-smoke.mjs
- vllm-metering-smoke.mjs

**Pass Criteria:** All required test scripts present and executable

---

## Final Validation & Report Generation (11:00-12:00 UTC)

### Summary Report
- [ ] All 12 sections completed
- [ ] Document section completion time for each
- [ ] Note any issues or warnings
- [ ] Calculate total execution time

### Results Compilation
- [ ] Count PASS vs FAIL sections
- [ ] Document any failures (with details)
- [ ] Record error messages (if any)
- [ ] Note infrastructure observations

### Go/No-Go Decision (12:00-12:30 UTC)

**GO Criteria (All must be true):**
- [ ] 12/12 sections PASS
- [ ] No data corruption detected
- [ ] All endpoints responding
- [ ] Zero critical errors
- [ ] Test scripts ready for Day 5

**NO-GO Criteria (Any will trigger NO-GO):**
- [ ] < 12/12 sections pass
- [ ] Data corruption detected
- [ ] Critical endpoints down
- [ ] Database integrity issues
- [ ] VPS out of disk space

### Decision Logic
```
IF (all 12 sections PASS) THEN
  → Status: GO for Day 5 Integration Testing
  → Notify teams: Backend, Frontend, ML Infra, UX Research
  → Update DCP-773 with PASS result
  → Move forward to DCP-774 (Day 5 execution)
ELSE
  → Status: NO-GO, analysis required
  → Identify root cause
  → Escalate to founder/CTO
  → Delay Day 5 pending investigation
END
```

---

## Escalation & Support

### If Blocker Encountered
1. Document the issue in Section X failure notes
2. Check troubleshooting guide (see links below)
3. Contact: Backend Architect (if API issue)
4. Contact: DevOps (if VPS/infrastructure issue)
5. Contact: Founder (if critical/unknown)

### Troubleshooting Links
- **VPS Connectivity:** See SPRINT-26-DAY4-PRETEST-VALIDATION.md § 1.1-1.3
- **Database Issues:** See SPRINT-26-DAY4-PRETEST-VALIDATION.md § 4
- **API Errors:** See PHASE1-DAY4-RAPID-RESPONSE-PLAYBOOK.md
- **Test Failures:** See SPRINT-26-QA-DOCUMENTATION-INDEX.md

---

## Success Metrics

**Day 4 Pre-Test Success = All 12 Sections Pass**

If successful:
- ✅ Confidence in infrastructure: HIGH
- ✅ Readiness for Day 5 testing: CONFIRMED
- ✅ Risk level for Day 5: LOW
- ✅ Proceed to integration testing with GO signal

**Timeline to Day 5 Execution:**
- 12:30 UTC (2026-03-26): GO/NO-GO posted
- 00:00 UTC (2026-03-27): Day 5 integration testing begins

---

## Key Contacts

| Role | Task | Contact |
|------|------|---------|
| Backend Architect | API issues | [Backend Architect] |
| DevOps Engineer | VPS/infrastructure | DCP-524 assignee |
| Founder | Escalations | setup@oida.ae / Telegram |
| P2P Network Eng. | Provider connectivity | [P2P Engineer] |
| ML Infra Engineer | Metering/models | DCP-939 assignee |

---

## Notes

- **Pre-Flight Status:** 🟢 GO (verified 2026-03-25 00:08 UTC)
- **Infrastructure:** All systems live and responding
- **Zero Blockers:** Execution is ready to proceed
- **Backup Plan:** If any section fails, see PHASE1-DAY4-RAPID-RESPONSE-PLAYBOOK.md
- **Documentation:** Full execution guide in SPRINT-26-DAY4-PRETEST-VALIDATION.md

---

**Status: 🟢 READY FOR EXECUTION**

This checklist is your complete guide for Day 4 pre-test validation. Follow it section-by-section, record results, and post the Go/No-Go decision by 12:30 UTC.

Good luck! 🚀
