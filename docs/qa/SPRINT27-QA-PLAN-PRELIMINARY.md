# Sprint 27 QA Plan — Template Deployment & Model Serving Tests

**Prepared by:** QA Engineer
**Date:** 2026-03-24
**Status:** Preliminary (awaiting Phase 1 completion & Sprint 27 kickoff)
**Target Release:** Sprint 27 (post-Phase 1)

---

## Overview

Sprint 27 focus: **ACTIVATION** of Arabic model portfolio and template catalog. QA responsibilities:
1. **End-to-end template deployment testing** — Verify all 20 docker templates deploy correctly
2. **Model serving smoke tests** — Verify Tier A & B models serve requests without errors

---

## Part 1: End-to-End Template Deployment Testing

### Scope
Test all 20 docker templates from `infra/docker-templates/` deploying to live marketplace:

**Tier A Templates (Critical):**
- arabic-embeddings (BGE-M3)
- arabic-reranker (BGE reranker)
- nemotron-nano (Nemotron 4B)
- qwen25-7b (Qwen 2.5 7B)
- llama3-8b (Llama 3 8B)
- mistral-7b (Mistral 7B)

**Tier B Templates (High):**
- sdxl (Stable Diffusion XL)
- stable-diffusion (SD 1.5)
- vllm-serve (VLLM serving framework)
- jupyter-gpu (Jupyter with GPU)
- pytorch-vision (PyTorch + Vision)
- pytorch-nlp (PyTorch + NLP)

**Tier C Templates (Medium):**
- lora-finetune (LoRA fine-tuning)
- qlora-finetune (QLoRA fine-tuning)
- ollama (Ollama runtime)
- custom-container (User custom container)
- python-scientific-compute (Python sci-kit stack)
- falcon-h1-7b (Falcon H1 7B)
- jais-13b (JAIS 13B)

### Test Procedure

**Pre-Deployment Validation:**
1. Template JSON schema validation (20/20 templates)
2. Docker image availability check
3. Resource requirement verification (VRAM, CPU, disk)
4. Configuration parameter validation

**Deployment Test Flow (per template):**
1. Trigger one-click deploy from marketplace UI
2. Verify provider assignment (test provider pool)
3. Monitor deployment progress (docker pull, container startup, health check)
4. Verify template-specific endpoints accessible (API, port, health endpoint)
5. Run template-specific smoke test
6. Capture deployment time & resource usage metrics
7. Cleanup & deallocate

**Success Criteria per Template:**
- ✅ Deployment completes within 5 minutes (initial pull) or 1 minute (cached)
- ✅ Health endpoint returns HTTP 200 within 30 seconds of startup
- ✅ Template-specific test requests return expected responses
- ✅ No memory leaks or resource exhaustion during 5-minute soak
- ✅ Graceful shutdown on termination

**Test Data:**
- Small test models pre-seeded to providers
- Sample data files (images, text) for inference
- Expected outputs for validation

---

## Part 2: Model Serving Smoke Tests

### Scope
Verify Tier A & B models serve requests correctly with high availability:

**Tier A Models (must achieve >99% availability):**
- ALLaM 7B (Arabic language model)
- Falcon H1 7B (Falcon variant)
- Qwen 2.5 7B (Qwen variant)
- Llama 3 8B (Meta Llama)
- Mistral 7B (Mistral)
- Nemotron Nano 4B (NVIDIA Nemotron)

**Tier B Models (must achieve >95% availability):**
- JAIS 13B (Arabic specialized)
- BGE-M3 (Embeddings model)
- BGE-reranker (Reranking model)
- SDXL (Image generation)

### Test Scenarios

**Scenario 1: Basic Inference (per model)**
- Request type: Model-specific (text, image, embeddings)
- Payload size: Small, medium, large
- Expected latency: <30s (cold start), <5s (warm)
- Success metric: Response received + valid output format

**Scenario 2: Concurrent Load**
- 10 concurrent requests per model
- Duration: 2 minutes
- Expected: 95%+ success rate, <10s p99 latency
- Failure handling: Graceful queue/rejection

**Scenario 3: Cold Start Performance**
- Fresh container deployment
- Measure: Model load time + first inference time
- Target: <60s total cold start (for Tier A), <120s (for Tier B)
- Track: Model download, initialization, first request

**Scenario 4: Provider Failover**
- Single provider failure during active load
- System behavior: Auto-redirect to backup provider
- Success metric: <5 second interruption, automatic recovery

**Scenario 5: Token Metering Accuracy**
- Issue: Phase 1 Gap 1 (token counting)
- Test: Run inference, verify token counts match expected
- Reference: scripts/vllm-metering-smoke.mjs (verify logic)
- Success: 100% accuracy on token counts

### Test Execution

**Test Frequency:**
- Tier A models: 5x per day (automated smoke)
- Tier B models: 2x per day (automated smoke)
- Full load test: 1x (manual, on-demand)

**Test Environment:**
- Use live marketplace infrastructure
- Dedicated test provider pool (separate from production providers)
- Test credentials with time-limited billing codes

**Monitoring:**
- Track: Latency, throughput, error rates, availability
- Dashboard: Grafana + Datadog (existing infra)
- Alerts: >5% error rate, >30s p99 latency

---

## Part 3: Arabic RAG Integration Testing

### Scope (if RAG templates created in Sprint 27)
End-to-end "one-click Arabic RAG" testing:

**Components:**
1. Document ingestion (PDF, DOCX, TXT)
2. Embedding generation (BGE-M3)
3. Vector storage (pinecone/milvus)
4. Reranking (BGE-reranker)
5. LLM response generation (ALLaM/JAIS)

**Test Cases:**
1. Upload Arabic document → Generate embeddings → Rerank → Generate response
2. PDPL compliance: No data persistence outside-Kingdom
3. Latency: <10s end-to-end (p95)
4. Accuracy: Arabic language understanding + PDPL context

---

## Part 4: Go/No-Go Decision Framework

### Release Readiness Criteria

**Must-Have (GO-blocker if failed):**
- [ ] 20/20 templates deploy successfully
- [ ] Tier A models: 100% available, <30s latency (p99)
- [ ] Tier B models: 95%+ available
- [ ] Token metering accuracy: 100%
- [ ] No data loss on provider failover
- [ ] PDPL compliance verified (no Kingdom data egress)

**Should-Have (nice-to-have, can defer to Sprint 28):**
- [ ] Template deployment <1 minute (cached)
- [ ] Cold start <60s (Tier A)
- [ ] Concurrent load 10+ requests/sec

**Go/No-Go Decision:**
- **GO:** All must-haves met, no critical bugs
- **NO-GO:** Any must-have failed, require remediation
- **GO-WITH-CAVEATS:** Met must-haves but with known limitations (require stakeholder approval)

---

## Timeline

**Phase 1 Completion:** 2026-03-28 12:00 UTC
**Sprint 27 Kickoff:** 2026-03-28 13:00 UTC (est.)
**Template Testing Window:** 2026-03-28 to 2026-04-01 (4 days)
**Model Serving Testing:** Parallel with template testing
**RAG Testing:** If templates ready by 2026-03-31
**Sprint 27 Release Gate:** 2026-04-02 09:00 UTC
**Post-Release Monitoring:** 2026-04-02 onwards (daily smoke tests)

---

## Deliverables

1. **Test Execution Report** (per template + per model)
   - Pass/fail for all scenarios
   - Performance metrics
   - Issues & remediations

2. **Go/No-Go Decision Document** (2026-04-02)
   - Release readiness assessment
   - Known issues & mitigations
   - Post-release monitoring plan

3. **Smoke Test Automation** (post-launch)
   - Automated Tier A tests (daily)
   - Automated Tier B tests (twice daily)
   - Alert thresholds & escalation paths

4. **Performance Baseline** (for future comparisons)
   - Latency percentiles (p50, p95, p99)
   - Throughput capacity
   - Resource utilization per model

---

## Risks & Contingencies

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Template JSON schema validation failure | Medium | High | Pre-validate all schemas before Sprint 27 start |
| Model download timeout (network) | Low | High | Increase timeout window, pre-seed providers |
| Cold start >2 minutes | Medium | Medium | Profile model load paths, optimize init |
| Provider failover doesn't work | Low | Critical | Test failover in Phase 1, verify infra |
| Token metering still inaccurate | Low | High | Reference Phase 1 metering fix verification |
| PDPL data egress | Low | Critical | Audit provider networking, enforce PDPL proxy |

---

## Notes for QA Team

**Post-Phase 1 Actions:**
1. Review Phase 1 final report (2026-03-28 12:00 UTC)
2. Assess any Phase 1 findings that impact Sprint 27 testing
3. Confirm template & model inventory matches plan
4. Coordinate with Backend Architect (model API wiring)
5. Coordinate with DevOps (provider test pool setup)
6. Prepare test environment & automation scripts

**Success Indicator:**
This plan enables rapid validation that Sprint 27 activation work is production-ready, with minimal risk to core platform stability.

---

**Prepared by:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Status:** Preliminary — ready for refinement upon Sprint 27 kickoff
**Next Review:** 2026-03-28 13:00 UTC (post-Phase 1)

