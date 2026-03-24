# Phase 1 Days 4-6 Real-User UX Observation Runbook

**Agent:** UI/UX Specialist (24ab4f1e-0d13-41a5-8810-0c05bbb9e648)  
**Task:** DCP-904 (Phase 1 renter journey live testing support + iteration)  
**Mode:** Plan D2 — Real-user production observation (no scripted testing)  
**Timeline:** 2026-03-26 08:00 UTC (Day 4) to 2026-03-28 18:00 UTC (Post-Phase-1)

---

## PHASE 1 DAY 4 — MODEL DISCOVERY & BROWSING (2026-03-26 08:00-20:00 UTC)

### Observation Goals
- Model catalog accessibility & discoverability
- RTL/Arabic rendering quality
- Provider availability indicators accuracy
- Pricing clarity & competitive positioning

### Pre-Test Validation (08:00-09:00 UTC)
- [ ] Verify api.dcp.sa responding (GET /api/models → 11 models)
- [ ] Confirm Arabic model names rendering correctly (ALLaM, JAIS, Falcon H1)
- [ ] Check provider availability badges (should show "no providers" initially)
- [ ] Validate pricing display (SAR/minute conversion, competitor comparison visible)

### Live Observation Points (09:00-20:00 UTC)

#### Section 1: Model Catalog Page Load
**What to monitor:**
- Page load time (target: <2s)
- Model grid rendering (11 cards visible)
- Filter sidebar responsiveness
- Arabic text alignment (RTL verify)

**Observation notes template:**
```
- Load time: ___s
- Layout issue? (Y/N): ___
- Arabic rendering issues: None / [describe]
- Missing models: [list if any]
```

#### Section 2: Renter Filter Interaction
**What to monitor:**
- Language filter (Arabic / English toggles)
- Type filter (LLM / Embedding / Reranker / Image)
- VRAM filter (dropdown accuracy)
- Filter combination (multi-select behavior)

**Friction points to flag:**
- Slow filter updates
- Filter state not persisting
- Unclear filter labels
- Missing filter combinations

#### Section 3: Model Detail Pages
**What to monitor:**
- Detail page load time
- Tab content accuracy (stack, performance, pricing, compliance)
- CTA button clarity ("Deploy" → job submission flow)
- RTL stability in detail content

**Success criteria:**
- ✅ Detail page loads in <1.5s
- ✅ All tabs render correctly
- ✅ Pricing table aligned properly
- ✅ Deploy CTA is visible and clickable

#### Section 4: Pricing Display
**What to monitor:**
- DCP floor price accuracy (RTX 4090: 0.267/hr SAR conversion)
- Competitor comparison table visibility
- Monthly cost estimation clarity
- Currency symbol rendering (SAR vs USD)

**Red flags:**
- 🚩 Pricing mismatch with backend
- 🚩 Competitor data outdated
- 🚩 Currency conversion errors
- 🚩 Cost estimation missing

### Day 4 Observation Notes Template
Post as comment on DCP-904 by 20:00 UTC:

```markdown
## Day 4 Observation Notes (Model Discovery)

**Issues Found:** [X]
**Friction Points:** [list]
**RTL Rendering:** [status]
**Performance:** [avg load time]

### Critical Issues
[List any blockers for real renters]

### Minor Friction Points
[List nice-to-have improvements for Phase 2]

### RTL/Arabic Specific
[Any Arabic text rendering issues discovered]
```

---

## PHASE 1 DAY 5 — TRANSACTION FLOWS (2026-03-27 09:00-20:00 UTC)

### Observation Goals
- Job submission flow clarity
- Error state effectiveness
- Payment/balance interactions
- Wallet integration stability
- Provider job assignment accuracy

### Pre-Day Validation (09:00-10:00 UTC)
- [ ] Model catalog still responding with real provider status
- [ ] Job submission endpoint accepting requests
- [ ] Balance/credit check working
- [ ] Wallet auth flow responsive

### Live Observation Points (10:00-20:00 UTC)

#### Section 1: Job Submission Flow
**Renter journey:**
1. Model detail page → "Deploy" button
2. Job submission form (model, parameters, duration estimate)
3. Cost preview display
4. Wallet/balance check
5. Submit confirmation

**Friction points to monitor:**
- Form field clarity (what parameters are required?)
- Cost preview accuracy vs actual charge
- Wallet connection flow (smooth or blocked?)
- Confirmation messaging (clear success state?)

#### Section 2: Error Handling (Real Paths)
**Critical error scenarios:**
- ❌ Insufficient balance (402 error)
- ❌ Wallet not connected (401 error)
- ❌ Job submission timeout (504 error)
- ❌ Provider offline (no providers available)

**For each error:**
- Is error message clear? (Can user recover?)
- Is retry path obvious?
- Is support info visible?

**Observation template:**
```
Error: [type]
- Message clarity: [1-5 scale]
- Retry button visible: Y/N
- User can recover: Y/N
- Frustration risk: Low/Medium/High
```

#### Section 3: Payment & Balance
**What to monitor:**
- Balance display accuracy
- Charge calculation correctness
- Payment confirmation messaging
- Invoice/receipt availability

**Red flags:**
- 🚩 Balance mismatch with actual charges
- 🚩 Hidden fees or unexpected charges
- 🚩 No payment confirmation
- 🚩 No receipt/invoice generation

#### Section 4: Job Status Tracking
**What to monitor:**
- Job status updates in real-time
- Progress indicator accuracy
- Token count display
- Cost accumulation visibility

**Success criteria:**
- ✅ Status updates within 2s
- ✅ Token count matches inference output
- ✅ Running cost display updates live
- ✅ Completion state clear

### Day 5 Observation Notes Template
Post as comment on DCP-904 by 20:00 UTC:

```markdown
## Day 5 Observation Notes (Transaction Flows)

**Jobs Submitted:** [count]
**Errors Encountered:** [count, types]
**Completion Rate:** [%]

### Friction Points Ranked by Impact
1. [highest friction item]
2. [second highest]
3. [etc.]

### Error Handling Assessment
- Balance/Auth errors: [description]
- Provider errors: [description]
- System errors: [description]

### Payment Flow Observations
[Clarity, accuracy, confidence level observed in renters]

### Phase 2 Recommendations
[Features to add based on real user behavior]
```

---

## PHASE 1 DAY 6 — LOAD TESTING & GO/NO-GO (2026-03-28 08:00-18:00 UTC)

### Observation Goals
- System stability under concurrent load
- Error recovery quality
- RTL stability under stress
- Real-time updates reliability
- Provider routing accuracy

### Pre-Test Checklist (08:00-09:00 UTC)
- [ ] All monitoring dashboards accessible
- [ ] Real-time data feeding to DCP-904
- [ ] Alert system ready for critical issues
- [ ] Rollback plan confirmed with DevOps

### Live Observation Points (09:00-18:00 UTC)

#### Section 1: Concurrent Job Handling
**What to monitor as load increases:**
- Job submission latency (target: <500ms)
- Job assignment speed (target: <2s)
- Provider routing accuracy (correct GPU for job size)
- Queue handling (no job losses)

**Observation template:**
```
- Concurrent jobs: [N]
- Avg submission latency: [ms]
- Failed submissions: [count]
- Routing errors: [count]
```

#### Section 2: Error Path Recovery
**Real error scenarios under load:**
- Provider goes offline mid-job
- Balance check fails under high load
- Wallet integration timeouts
- Provider returns error response

**For each scenario:**
- Does UI gracefully degrade?
- Can user recover/retry?
- Is data consistency maintained?

#### Section 3: RTL Stability Under Stress
**What to monitor:**
- Arabic text rendering under high concurrent load
- RTL layout stability (no layout shifts)
- Model names display correctly even during job execution
- Error messages render properly in Arabic

#### Section 4: Real-Time Updates Reliability
**What to monitor:**
- Job status updates (latency)
- Balance updates (accuracy)
- Provider status changes (immediate reflection)
- Notification reliability (no missed updates)

**Success criteria:**
- ✅ All real-time updates <2s latency
- ✅ Zero missed status updates
- ✅ Consistent state across tabs/sessions

### Day 6 GO/NO-GO Decision Framework

#### GO Criteria (All must pass)
- ✅ 95%+ job submission success rate
- ✅ <5% of jobs error out
- ✅ 100% of errors recoverable by user
- ✅ <2s avg job completion time
- ✅ RTL rendering stable under load
- ✅ Real-time updates reliable

#### NO-GO Criteria (Any one blocks launch)
- 🔴 >20% job failure rate
- 🔴 Data inconsistency observed
- 🔴 Critical error with no recovery path
- 🔴 RTL rendering breaks under load
- 🔴 Provider routing failures
- 🔴 Wallet integration unreliable

### Day 6 GO/NO-GO Decision Comment
Post on DCP-904 by 12:15 UTC (after QA reports):

```markdown
## Day 6 GO/NO-GO Decision: [GO / NO-GO]

### Executive Summary
[Brief status of Phase 1 testing]

### Key Metrics
- Job success rate: [%]
- Error recovery: [% recoverable]
- Performance: [avg latencies]
- Stability: [observations]

### Recommendation
[GO with confidence / NO-GO with blockers]

### Phase 2 Priorities
[Top 3-5 features/fixes based on real-user data]
```

---

## CRITICAL SUCCESS FACTORS

### Data Capture
- Document observations AS THEY HAPPEN (don't wait until end of day)
- Include timestamps for each issue
- Link to specific models/jobs/errors when possible
- Capture screenshots of error states

### Real-Time Coordination
- Sync with QA Engineer (DCP-773, 774, 775) on timeline
- Flag critical issues immediately to DevOps/Backend
- Escalate blockers to CEO within 30 minutes
- Post daily observations to DCP-904 for team visibility

### Authenticity Focus
- Observe REAL renter behavior (not scripted)
- Don't intervene unless critical safety issue
- Capture genuine friction points
- Document workarounds users attempt

### Phase 2 Value
- Connect every issue to product prioritization
- Recommend features based on observed needs
- Quantify impact (N users experienced X friction)
- Propose solutions users actually requested

---

## ESCALATION MATRIX

| Severity | Example | Action | Timeline |
|----------|---------|--------|----------|
| 🔴 CRITICAL | Data loss, wallet hack, job routing failure | Notify DevOps + CEO immediately | <5 min |
| 🟠 HIGH | 50%+ job failure rate, provider offline | Comment on DCP-904, notify QA | <30 min |
| 🟡 MEDIUM | Slow page loads, minor UI misalignment | Document, include in daily notes | <2 hours |
| 🟢 LOW | Copy typos, color mismatch | Document for Phase 2 backlog | End of day |

---

## SUCCESS DEFINITION

✅ **Phase 1 UX Observation Complete When:**
1. Day 4-6 real-user behavior captured
2. Friction points ranked by impact
3. Error handling quality assessed
4. RTL stability verified
5. Phase 2 prioritization recommendations delivered
6. GO/NO-GO decision supported by real data

**Deliverable:** Post-Phase-1 UX Findings Summary (1 page, authentic user insights for Phase 2)

---

**Prepared by:** UI/UX Specialist (24ab4f1e-0d13-41a5-8810-0c05bbb9e648)  
**Status:** Ready for execution  
**Next:** Execute Day 4 observation starting 2026-03-26 08:00 UTC
