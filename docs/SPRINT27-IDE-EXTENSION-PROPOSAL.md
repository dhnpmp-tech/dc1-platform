# Sprint 27 — IDE Extension Developer Work Proposal

**Status:** DRAFT — Awaiting CEO review and assignment
**Proposed by:** IDE Extension Developer (self-proposal)
**Context:** Founder directive to activate template catalog, wire model API, and position Arabic RAG capabilities
**Timeline:** Sprint 27 (post-Phase 1, estimated 2026-03-28 onwards)

---

## Strategic Alignment

The founder's Sprint 27 priorities require three critical activations:
1. **ACTIVATE THE TEMPLATE CATALOG** — 20 docker-templates/*.json built but not exposed in marketplace UI
2. **WIRE THE MODEL CATALOG API** — /api/models exists but not connected to frontend
3. **DEPLOY ARABIC PORTFOLIO PRE-FETCHING** — Arabic models (ALLaM, JAIS, Nemotron, QWen, Llama, Mistral, SDXL) ready to serve

These activations require both backend/frontend work AND IDE Extension integration to enable renters to:
- Browse templates and models in VS Code (IDE is the renter's control plane)
- One-click deploy from IDE Extension
- See real-time pricing, VRAM requirements, Arabic capability flags
- Monitor job status and logs from IDE sidebar

---

## IDE Extension Developer — Sprint 27 Proposal

### Why IDE Extension Matters for Sprint 27

Current state:
- Frontend marketplace UI exists but is separate from renter workflow
- Renters must leave IDE, go to web browser, select model/template, then return to VS Code to submit jobs
- This friction reduces marketplace adoption

With IDE Extension enhancements:
- Renters browse templates and models inside VS Code (no context switch)
- One-click deploy launches jobs directly from IDE
- Results stream back to IDE sidebar
- Job management (pause, cancel, monitor) all in IDE
- **Result:** Higher marketplace adoption, better renter experience, more job volume

### Proposed Work Packages

#### **Package 1: Template Catalog Browser (High Priority)**
- **Goal:** Display all 20 template-as-a-service options in IDE Extension sidebar
- **Acceptance Criteria:**
  - VS Code sidebar shows "Templates" tree view with 20+ options
  - Each template shows: name, category (Tier A/B/C), VRAM requirement, pre-fetch status
  - Click to see full template README/description
  - "Deploy" button launches job submission with template pre-selected
  - Arabic-capable templates marked with 🇸🇦 badge

- **Effort:** Medium (1-2 weeks)
- **Dependencies:** Backend serves /api/templates (confirmed working)
- **Blockers:** None

---

#### **Package 2: Model Catalog Integration (High Priority)**
- **Goal:** Wire /api/models endpoint to IDE Extension marketplace display
- **Acceptance Criteria:**
  - IDE Extension sidebar shows "Models" tree view with 11+ live models
  - Each model shows: name, VRAM (GB), provider count, avg_price_sar_per_min, availability
  - Filter by: category (LLM, Embeddings, Image, etc.), Arabic capability, VRAM requirement, price range
  - Click model to see: description, pricing vs Vast.ai/RunPod (competitive context), sample prompts
  - "Deploy" button launches inference job with model pre-selected
  - Arabic models show PDPL compliance badge

- **Effort:** Medium (1.5-2 weeks)
- **Dependencies:** Backend /api/models confirmed responding with 11 models
- **Blockers:** None

---

#### **Package 3: Arabic Model Emphasis & Pricing Display (Medium Priority)**
- **Goal:** Highlight DC1's Arabic RAG differentiator within IDE Extension
- **Acceptance Criteria:**
  - "Arabic Models" sub-category in Models tree with ALLaM, JAIS, Falcon, QWen, etc.
  - Each Arabic model shows: native Arabic capability, PDPL compliance, pricing (33-51% cheaper than hyperscalers)
  - "1-Click Arabic RAG" bundle shows: ALLaM/JAIS LLM + BGE-M3 embeddings + BGE reranker
  - Educational content: brief description of Arabic NLP capabilities, use cases (legal, govt, financial services)
  - Link to docs/FOUNDER-STRATEGIC-BRIEF.md buyer economics section

- **Effort:** Small (1 week)
- **Dependencies:** Models confirmed in catalog; docs/FOUNDER-STRATEGIC-BRIEF.md content available
- **Blockers:** None

---

#### **Package 4: Real-Time Job Monitoring & Streaming Logs (Stretch)**
- **Goal:** Show job status, live logs, and completion status in IDE sidebar
- **Acceptance Criteria:**
  - Active jobs tree view shows: job ID, template/model, status (running/pending/done), elapsed time
  - Click job to stream live logs to IDE output panel
  - Completion notification in IDE
  - Job history sidebar (past 10 jobs)

- **Effort:** Large (2-3 weeks)
- **Dependencies:** Backend /api/jobs endpoint; WebSocket or polling for live updates
- **Blockers:** Backend may need to expose job streaming endpoint

---

### Success Metrics for IDE Extension Sprint 27

1. **Adoption:** Template catalog accessible in IDE (no external marketplace needed)
2. **Model Discovery:** Renters can filter/browse all 11+ models in VS Code
3. **Arabic Positioning:** Arabic models prominently featured, PDPL badge visible, competitive pricing highlighted
4. **User Experience:** Zero-friction deployment path (IDE → model select → deploy → results in IDE)
5. **Performance:** Catalog load <500ms, pricing update <1s
6. **Documentation:** Quick reference guide updated with new IDE Extension features

---

## Implementation Timeline

### Phase A: Foundations (Week 1-2)
- Verify /api/templates and /api/models endpoints are stable
- Design IDE sidebar UI/UX for template and model browsers
- Implement template browser tree view
- Implement basic model list

### Phase B: Enhancements (Week 2-3)
- Add filtering (category, VRAM, price, Arabic capability)
- Add competitive pricing display (vs Vast.ai/RunPod)
- Add PDPL/Arabic RAG messaging
- Test with 20 templates + 11 models

### Phase C: Polish & Testing (Week 3-4)
- Performance optimization (lazy loading, caching)
- Error handling for API failures
- Update docs and quick reference guides
- QA smoke testing with live backend

### Phase D: Stretch (Week 4+, if time permits)
- Add job monitoring & live logs streaming
- Implement job history sidebar
- Add WebSocket support for real-time updates

---

## Resource Requirements

- **IDE Extension Developer:** 3-4 weeks FTE
- **Backend Architect:** ~2 hours (API endpoint verification/stabilization)
- **Code Reviewers (CR1/CR2):** ~1 week for reviews + merges
- **QA Engineer:** ~1 week for integration testing

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| /api/pricing endpoint missing (discovered in Phase 1) | Low | Use /api/models pricing field instead; workaround verified in dry-run |
| Model metadata incomplete (VRAM, pricing, category) | Medium | Verify data completeness with Backend Architect before starting Package 2 |
| IDE Extension complexity (new filtering, tree views) | Medium | Use existing IDE Extension architecture; iterate incrementally with CR1/CR2 feedback |
| Late discovery of API gaps | Medium | Execute rapid Phase B prototype; design loosely coupled to API schema |

---

## Why This Matters for DC1

**Current state:** Renters see marketplace UI but must context-switch from IDE
**Sprint 27 outcome:** Renters stay in IDE, browse templates/models, deploy with one click, see results inline

This eliminates friction and drives:
- Higher job submission rate
- Faster model experimentation
- Better renter experience
- Increased marketplace activity
- Stronger positioning vs Vast.ai/RunPod (which don't have IDE integration)

**Arabic RAG differentiation:** DC1's unique value is PDPL-compliant Arabic NLP + energy arbitrage. Sprint 27 makes this visible and accessible directly from IDE.

---

## Deliverables

### Code
- `src/ide-extension/template-browser.ts` — Template catalog view
- `src/ide-extension/model-browser.ts` — Model catalog + filtering
- `src/ide-extension/pricing-display.ts` — Competitive pricing widget
- `src/ide-extension/arabic-models.ts` — Arabic RAG highlights
- (Stretch) `src/ide-extension/job-monitor.ts` — Job status streaming

### Documentation
- Updated `PHASE1-IDE-EXTENSION-QUICK-REFERENCE.md` with Sprint 27 features
- `SPRINT27-IDE-EXTENSION-FEATURE-OVERVIEW.md` — User-facing guide
- `SPRINT27-IDE-EXTENSION-ARCHITECTURE.md` — Technical design doc

### Testing
- Jest suite covering template browser, model browser, filtering logic
- Integration tests with live /api/templates and /api/models endpoints
- QA smoke test checklist for both templates and models

### Deployment
- Feature flags to gate new UI (activate for Phase 1 launch verification)
- Rollback plan if issues discovered
- Monitoring dashboard for sidebar performance

---

## Next Steps

1. **CEO Review:** Assess alignment with Sprint 27 priorities and resource availability
2. **Backend Architect Input:** Confirm /api/templates and /api/models data completeness
3. **Assignment:** If approved, create Paperclip issues for each work package (4 subtasks under one parent)
4. **PR Process:** Follow code review workflow (CR1/CR2 mandatory, no direct main commits)

---

## Questions for CEO

1. **Priority:** Should IDE Extension Sprint 27 be started before or after VPS production deployment?
2. **Scope:** Should we include job monitoring (Package 4 stretch) or focus on template/model activation (Packages 1-3)?
3. **Timeline:** Is post-Phase 1 (starting 2026-03-28) feasible, or should this wait until Phase 1 closes (2026-03-28 08:00 UTC)?

---

**Proposed by:** IDE Extension Developer
**Status:** Draft - awaiting CEO review & assignment
**Estimated Total Effort:** 3-4 weeks FTE (or 5-6 weeks if stretch included)
