# Sprint 27 Day 1 — Template Deployment Execution Checklist (2026-03-28 08:00-16:00 UTC)

**QA Engineer:** Agent 891b2856-c2eb-4162-9ce4-9f903abd315f
**Execution Date:** 2026-03-28
**Execution Window:** 08:00-16:00 UTC (8 hours)
**Phase 1 Prerequisite:** Phase 1 must complete by 12:00 UTC
**Sprint 27 Kickoff:** 13:00 UTC (30 min after Phase 1 ends)

---

## Pre-Execution Setup (07:00-08:00 UTC)

### Environment Preparation
- [ ] Verify SSH access to provider test pool: `ssh root@76.13.179.86 "echo ready"`
- [ ] Load test credentials (PROVIDER_KEY, RENTER_KEY)
- [ ] Verify Node.js v18+ and npm available
- [ ] Set up 3 monitoring terminals:
  - Terminal 1: VPS health monitoring
  - Terminal 2: Template deployment test execution
  - Terminal 3: Logs & troubleshooting
- [ ] Verify git branch: `git status` (should be clean)
- [ ] Confirm Phase 1 launch successful (check /DCP/issues/DCP-685 for go/no-go)

### Health Check Baseline (post-Phase 1)
- [ ] Run pre-flight smoke test: `node scripts/phase1-preflight-smoke.mjs`
- [ ] Expected: 5/5 endpoints PASS
- [ ] Verify 43+ providers registered
- [ ] Confirm marketplace UI accessible (dcp.sa)
- [ ] Record baseline response times for later comparison

---

## Template Deployment Test Execution (08:00-16:00 UTC)

### Test Flow (per template)

Each template follows this sequence:

1. **Pre-Deployment Validation (5 min)**
   - Verify template JSON syntax: `jq . docker-templates/{template}.json`
   - Check Docker image availability (pull test)
   - Verify resource requirements (VRAM, CPU, disk)
   - Confirm configuration parameters valid

2. **Deployment Trigger (2 min)**
   - Click "Deploy" in marketplace UI for template
   - Verify provider assignment (test pool)
   - Record deployment start time

3. **Deployment Monitoring (3-5 min)**
   - Monitor container logs in real-time
   - Watch for docker pull completion
   - Confirm container startup completes
   - Wait for health endpoint availability

4. **Health Verification (2 min)**
   - Query health endpoint: `curl http://{provider}:{port}/health`
   - Expect HTTP 200 within 30 seconds of startup
   - Record response time

5. **Template-Specific Smoke Test (2-3 min)**
   - Run template-specific test request
   - Verify expected response format
   - Record execution time

6. **Resource Monitoring (3-5 min)**
   - Monitor CPU, memory, disk usage
   - Verify no memory leaks during 2-minute soak
   - Check for resource exhaustion

7. **Graceful Shutdown (1 min)**
   - Terminate container
   - Verify cleanup (logs, volumes)
   - Deallocate resources

**Per-Template Time Estimate:** 18-22 minutes (including setup/cleanup)

---

## Templates & Tier Allocation

### Tier A: Critical Models (6 templates, ~2 hours total)
Completion target: **10:00 UTC**
Test window: 08:00-10:00 UTC (120 min ÷ 6 = 20 min per template)

| # | Template | VRAM | CPU | Status | Time | Result |
|---|----------|------|-----|--------|------|--------|
| 1 | arabic-embeddings (BGE-M3) | 4GB | 2 | ☐ | | |
| 2 | arabic-reranker (BGE) | 4GB | 2 | ☐ | | |
| 3 | nemotron-nano (4B) | 8GB | 4 | ☐ | | |
| 4 | qwen25-7b (7B) | 16GB | 4 | ☐ | | |
| 5 | llama3-8b (8B) | 16GB | 4 | ☐ | | |
| 6 | mistral-7b (7B) | 16GB | 4 | ☐ | | |

### Tier B: High-Priority Utilities (8 templates, ~3 hours total)
Completion target: **13:30 UTC**
Test window: 10:15-13:30 UTC (195 min ÷ 8 = 24 min per template)

| # | Template | VRAM | CPU | Status | Time | Result |
|---|----------|------|-----|--------|------|--------|
| 7 | sdxl (Image gen) | 24GB | 6 | ☐ | | |
| 8 | stable-diffusion (SD 1.5) | 8GB | 2 | ☐ | | |
| 9 | vllm-serve (Framework) | 12GB | 4 | ☐ | | |
| 10 | jupyter-gpu (Interactive) | 8GB | 4 | ☐ | | |
| 11 | pytorch-multi-gpu (Training) | 16GB | 8 | ☐ | | |
| 12 | pytorch-single-gpu (Training) | 16GB | 4 | ☐ | | |
| 13 | pytorch-training (Training) | 16GB | 4 | ☐ | | |
| 14 | lora-finetune (Fine-tuning) | 12GB | 4 | ☐ | | |

### Tier C: Extended Catalog (6 templates, ~2 hours total)
Completion target: **15:30 UTC**
Test window: 13:45-15:30 UTC (105 min ÷ 6 = 17.5 min per template)

| # | Template | VRAM | CPU | Status | Time | Result |
|---|----------|------|-----|--------|------|--------|
| 15 | qlora-finetune (Efficient) | 8GB | 4 | ☐ | | |
| 16 | ollama (Local LLM) | 8GB | 2 | ☐ | | |
| 17 | custom-container (User) | Variable | Variable | ☐ | | |
| 18 | python-scientific-compute (Sci-kit) | 4GB | 2 | ☐ | | |
| 19 | nemotron-super (Super) | 32GB | 8 | ☐ | | |
| 20 | arabic-rag-complete (RAG) | 16GB | 4 | ☐ | | |

---

## Success Criteria (per template)

- ✅ **Deployment Time:** ≤5 min (initial pull) or ≤1 min (cached)
- ✅ **Health Endpoint:** HTTP 200 within 30s of startup
- ✅ **Test Request:** Expected response format + correct data
- ✅ **Resource Usage:** No memory leaks, <5% CPU spike during idle
- ✅ **Shutdown:** Graceful termination, clean resource release

---

## Test Data & Expected Outputs

### Arabic Embeddings (BGE-M3)
```bash
curl -X POST http://{provider}:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text": "مرحبا بك في DCP", "model": "bge-m3"}'
# Expected: 1024-dim embedding vector
```

### Arabic Reranker (BGE)
```bash
curl -X POST http://{provider}:8001/rerank \
  -H "Content-Type: application/json" \
  -d '{"query": "كيفية التعلم الآلي", "documents": [...]}'
# Expected: ranked scores for each document
```

### Nemotron Nano / Qwen25 / Llama3 / Mistral
```bash
curl -X POST http://{provider}:8002/completion \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Once upon a time", "max_tokens": 50}'
# Expected: completion text
```

### SDXL / Stable Diffusion
```bash
curl -X POST http://{provider}:8003/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a beautiful sunset", "steps": 20}'
# Expected: image PNG/JPEG as base64 or file
```

### VLLMServe
```bash
curl -X POST http://{provider}:8004/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "llama-7b", "prompt": "test", "max_tokens": 10}'
# Expected: OpenAI-compatible response
```

---

## Timing & Milestones

| Time | Milestone | Owner | Status |
|------|-----------|-------|--------|
| 07:00-08:00 | Pre-exec setup & baseline health check | QA | ☐ |
| 08:00-10:00 | **Tier A templates (6)** | QA | ☐ |
| 10:00-10:15 | Review Tier A results + plan adjustments | QA | ☐ |
| 10:15-13:30 | **Tier B templates (8)** | QA | ☐ |
| 13:30-13:45 | Break + Tier B review | QA | ☐ |
| 13:45-15:30 | **Tier C templates (6)** | QA | ☐ |
| 15:30-16:00 | Final review + report generation | QA | ☐ |

---

## Blocker Decision Matrix

| Scenario | Decision | Action |
|----------|----------|--------|
| 5/6 Tier A PASS | CONDITIONAL GO | Continue Tier B, document blockers |
| <5/6 Tier A PASS | HOLD | Escalate to Backend, investigate root cause |
| All Tier A PASS, 6/8 Tier B PASS | GO | Continue Tier C |
| <6/8 Tier B PASS | HOLD | Escalate infrastructure issues |
| 18/20 templates PASS | GO for Day 2 | Proceed to model serving tests |
| <18/20 templates PASS | NO-GO | Return to fixes, delay Day 2 |

---

## Results Reporting

### Per-Template Report Format
```markdown
## Template: {name}
- Status: PASS / FAIL
- Deployment Time: {seconds}
- Health Endpoint: {HTTP status} (response time {ms})
- Test Request: {status} ({duration})
- Resource Usage: {CPU}% avg, {RAM} MB peak
- Issues: {if any}
```

### Day 1 Summary Report
- Total templates tested: 20/20
- Pass rate: {X}%
- Tier A status: {Y}/6 PASS
- Tier B status: {Z}/8 PASS
- Tier C status: {W}/6 PASS
- Critical blockers: {list}
- Recommendations for Day 2: {list}

---

## Troubleshooting & Escalation

### Common Issues

**"Docker image not found" error**
- Check image registry access (DockerHub, NVIDIA NGC)
- Verify provider has internet access for pulls
- → Escalate to ML Infra Engineer (DCP-752)

**"Health endpoint timeout"**
- Check container logs for startup errors
- Verify port mapping correct
- Increase timeout to 60s for large models
- → Escalate to Backend (DCP-751)

**"Memory exhaustion during test"**
- Reduce batch size for test request
- Increase provider available memory
- Check for memory leaks in model code
- → Escalate to ML Infra Engineer

**"Graceful shutdown fails"**
- Force SIGKILL after 10s timeout
- Check for orphaned processes
- Document issue for post-launch fix
- → Log in incident response guide

### Escalation Contacts
- **Backend Architect:** DCP-751 (API/endpoint issues)
- **ML Infra Engineer:** DCP-752 (model/resource issues)
- **DevOps:** DCP-753 (provider/infrastructure)
- **CEO:** For go/no-go decisions

---

## Sign-Off & Next Steps

**Day 1 Execution Complete:** {timestamp}
**Report Status:** DRAFT / FINAL
**QA Engineer Signature:** _____________
**Results Link:** /DCP/issues/DCP-943#document-day1-report

**Next Milestone:** Day 2 Model Serving Tests (2026-03-29 08:00 UTC)
