# Sprint 27 — IDE Extension Developer Draft Issues
## Ready for CEO Review and Creation

**Status:** Draft issue templates based on docs/SPRINT27-IDE-EXTENSION-PROPOSAL.md
**For:** CEO to create as Paperclip issues once proposal is approved
**Timeline:** CEO decision → Issue creation → IDE Extension execution

---

## Issue Template 1: DCP-XXX — S27: IDE Extension — Template Catalog Browser

**Title:** S27: IDE Extension — Template Catalog Browser (High Priority)

**Description:**
Implement IDE Extension sidebar feature to display all 20+ docker-templates as a browsable, filterable tree view. Enable renters to discover and one-click deploy templates directly from VS Code.

**Goal:** Activate template marketplace within IDE so renters never leave their development environment

**Acceptance Criteria:**
- [ ] Template catalog loads in IDE sidebar under "Templates" tree view
- [ ] Display shows: name, category (Tier A/B/C), VRAM requirement, pre-fetch status
- [ ] Filter options: category, VRAM range, pre-fetch status
- [ ] Click template opens README/description in IDE panel
- [ ] "Deploy" button launches job submission with template pre-selected
- [ ] Arabic-capable templates marked with 🇸🇦 badge
- [ ] Load time < 500ms
- [ ] Error handling for API failures
- [ ] Jest test coverage for filtering and selection logic
- [ ] QA smoke test checklist passed

**Dependencies:**
- Backend: /api/templates endpoint confirmed working
- Code Review: CR1/CR2 availability

**Effort:** 1-2 weeks FTE

**Deliverables:**
- src/ide-extension/template-browser.ts
- Updated PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md
- Jest test suite
- QA smoke test checklist

**Success Metrics:**
- All 20+ templates accessible in IDE
- Zero UI crashes during browsing/filtering
- <500ms catalog load time
- Renter deployment flow works end-to-end

---

## Issue Template 2: DCP-XXX — S27: IDE Extension — Model Catalog Integration (High Priority)

**Title:** S27: IDE Extension — Model Catalog Integration (High Priority)

**Description:**
Wire /api/models endpoint to IDE Extension marketplace display. Enable renters to browse, filter, and understand all 11+ available models with pricing, VRAM requirements, Arabic capability, and competitive positioning.

**Goal:** Make model discovery and selection possible without leaving IDE

**Acceptance Criteria:**
- [ ] Model catalog loads in IDE sidebar under "Models" tree view with 11+ entries
- [ ] Display shows: name, VRAM (GB), provider count, avg_price_sar_per_min, availability status
- [ ] Filter options: category (LLM, Embeddings, Image), Arabic capability, VRAM requirement, price range
- [ ] Click model shows: description, tier classification, pre-warm status, provider count
- [ ] Pricing display includes Vast.ai/RunPod/AWS comparison (from competitive_prices field)
- [ ] Show savings percentage vs hyperscalers (e.g., "54% cheaper than Vast.ai")
- [ ] "Deploy" button launches inference job with model pre-selected
- [ ] Arabic models prominently grouped with PDPL compliance badge
- [ ] Load time < 500ms, filter response < 1s
- [ ] Error handling for missing/stale data
- [ ] Jest test coverage for filtering, pricing display, sorting
- [ ] Integration test with live /api/models endpoint
- [ ] QA smoke test checklist passed

**Dependencies:**
- Backend: /api/models endpoint confirmed responsive with 11+ models
- Backend Architect: Verify data completeness (all fields present, pricing updated)
- Code Review: CR1/CR2 availability

**Effort:** 1.5-2 weeks FTE

**Deliverables:**
- src/ide-extension/model-browser.ts
- src/ide-extension/pricing-display.ts
- src/ide-extension/model-filter.ts
- Updated PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md
- Jest test suite + integration tests
- QA smoke test checklist

**Success Metrics:**
- All 11+ models displayed and filterable
- Pricing comparison visible for each model
- Zero UI crashes during filtering/selection
- <500ms catalog load, <1s filter response
- Renter can select model and deploy end-to-end

---

## Issue Template 3: DCP-XXX — S27: IDE Extension — Arabic Model Emphasis & Positioning

**Title:** S27: IDE Extension — Arabic Model Emphasis & Positioning (Medium Priority)

**Description:**
Highlight DC1's Arabic RAG differentiator within IDE Extension. Create "Arabic Models" subcategory, bundle ALLaM + JAIS + embeddings + reranker as "1-Click Arabic RAG", and show PDPL compliance + pricing advantage.

**Goal:** Make Arabic NLP capabilities visible and positioned as DC1's unique competitive advantage

**Acceptance Criteria:**
- [ ] "Arabic Models" subcategory in Models tree showing ALLaM, JAIS, Falcon, QWen, Llama, Mistral
- [ ] Each Arabic model shows: native language capability, PDPL compliance badge, training data source
- [ ] "1-Click Arabic RAG" bundle shows: ALLaM/JAIS + BGE-M3 embeddings + BGE reranker with one-click deployment
- [ ] Educational popover explains Arabic NLP capabilities and use cases (legal, govt, financial services)
- [ ] Link to docs/FOUNDER-STRATEGIC-BRIEF.md buyer economics section (33-51% cheaper vs hyperscalers)
- [ ] Show competitive advantage messaging: "PDPL-compliant, in-kingdom processing, energy arbitrage pricing"
- [ ] "Learn more" button opens docs/SPRINT27-IDE-EXTENSION-PROPOSAL.md or Arabic RAG guide
- [ ] No performance impact on model browser load time
- [ ] Jest test coverage for bundle logic and messaging display
- [ ] QA smoke test checklist passed

**Dependencies:**
- Arabic models confirmed in /api/models (ALLaM, JAIS, Falcon, etc.)
- docs/FOUNDER-STRATEGIC-BRIEF.md available for reference
- Copywriter/DevRel: (Optional) Help craft messaging and educational content

**Effort:** 1 week FTE

**Deliverables:**
- src/ide-extension/arabic-models.ts
- src/ide-extension/rag-bundle.ts
- Educational content/messaging
- Updated PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md
- Jest test suite
- QA smoke test checklist

**Success Metrics:**
- Arabic models easily discoverable in IDE
- 1-Click Arabic RAG bundle deployable end-to-end
- PDPL compliance messaging visible
- Competitive pricing advantage clear to renters
- Educational content accessible in IDE

---

## Issue Template 4: DCP-XXX — S27: IDE Extension — Real-Time Job Monitoring (Stretch, if time permits)

**Title:** S27: IDE Extension — Real-Time Job Monitoring & Streaming Logs (Stretch)

**Description:**
Enable renters to monitor running jobs and stream live logs from IDE sidebar. Show job status, elapsed time, progress indicators, and live console output without leaving VS Code.

**Goal:** Complete the IDE Extension marketplace workflow - from model selection through job execution and monitoring

**Acceptance Criteria:**
- [ ] Active jobs tree view shows: job ID, model/template name, status (running/pending/done), elapsed time, progress %
- [ ] Click job opens live log stream in IDE output panel
- [ ] Completion notification in IDE when job finishes
- [ ] Job history sidebar shows past 10 jobs with timestamps and status
- [ ] Real-time updates via WebSocket or polling (max 2s latency)
- [ ] Handle connection loss and reconnection gracefully
- [ ] Cancel button to stop running jobs
- [ ] Export logs button to save job output
- [ ] Jest test coverage for status polling, log streaming, UI updates
- [ ] Integration test with live job queue
- [ ] QA smoke test checklist passed

**Dependencies:**
- Backend: /api/jobs endpoint with job details and status
- Backend: WebSocket or Server-Sent Events (SSE) for live updates (may need new endpoint)
- Backend Architect: Confirm streaming endpoint availability or design it
- Code Review: CR1/CR2 availability

**Effort:** 2-3 weeks FTE (blocked until backend confirms streaming capability)

**Deliverables:**
- src/ide-extension/job-monitor.ts
- src/ide-extension/log-streaming.ts
- src/ide-extension/job-history.ts
- Updated PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md
- Jest test suite + integration tests
- QA smoke test checklist
- Architecture doc: IDE Extension ↔ backend job streaming design

**Success Metrics:**
- Active jobs visible and sortable in IDE
- Live logs stream with <2s latency
- Job history accessible and searchable
- Zero UI freezes during streaming
- Renters can manage full job lifecycle from IDE

---

## Meta-Issue: DCP-XXX — S27: IDE Extension Developer — Integration & Testing

**Title:** S27: IDE Extension Developer — Integration Testing & Release (Meta-Tracking)

**Description:**
Parent issue tracking the integration, testing, and release of all 4 IDE Extension Sprint 27 work packages.

**Scope:**
- Coordinate across 4 work packages (template browser, model catalog, Arabic positioning, job monitoring)
- End-to-end testing with live backend
- Feature flag gating and rollout strategy
- Documentation and user guides
- Rollback plan if issues discovered

**Effort:** 1 week FTE (runs parallel with work packages)

**Dependencies:**
- All 4 work packages must be code-complete
- Code Review: CR1/CR2 approvals
- QA Engineer: Integration testing
- Backend Architect: API endpoint confirmation

**Success Criteria:**
- All 4 packages integrated and tested end-to-end
- Feature flags active and tested
- Rollback procedures documented and tested
- User documentation complete
- QA sign-off for release

---

## CEO Action Items

When reviewing docs/SPRINT27-IDE-EXTENSION-PROPOSAL.md:

1. **Decide on scope:**
   - Packages 1-3 only (critical path, 3-4 weeks)
   - OR Packages 1-4 (including stretch, 5-6 weeks)

2. **Create Paperclip issues:**
   - Create 4 work package issues (use templates above)
   - Create 1 meta-issue for integration tracking
   - Set status = `todo` so inbox-lite picks them up
   - Assign all to IDE Extension Developer
   - Link to parent goal (DCP platform)

3. **Prioritize vs other work:**
   - VPS production deployment (also Sprint 27 priority)
   - Provider onboarding activation
   - Other team Sprint 27 work

4. **Ask Backend Architect:**
   - Confirm /api/templates stability
   - Confirm /api/models data completeness
   - Confirm /api/jobs endpoint exists
   - Design job streaming endpoint (if stretch is approved)

5. **Timeline:**
   - Start post-Phase 1 (2026-03-28 after Go/No-Go decision)
   - OR concurrent with Phase 1 (if IDE Extension work can run in parallel)

---

## Notes for IDE Extension Developer

Once CEO creates these issues, execute in this order:

**Phase A (Week 1-2):** Packages 1 & 2 foundation
- Template browser UI
- Model browser UI + filtering
- Parallel to reduce schedule

**Phase B (Week 2-3):** Package 3 + enhancements
- Arabic positioning
- Pricing display refinement
- Performance optimization

**Phase C (Week 3-4):** Integration + testing
- End-to-end testing
- Feature flags
- Documentation

**Phase D (Week 4+, if time permits):** Package 4
- Job monitoring
- Live log streaming
- Requires backend streaming endpoint

---

**Status:** Ready for CEO review and issue creation

All issue templates are complete and ready to copy into Paperclip once CEO approves the Sprint 27 proposal.
