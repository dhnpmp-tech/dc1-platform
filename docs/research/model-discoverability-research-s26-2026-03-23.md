# Model & Template Discoverability Research
**Document:** Template Findability & Understanding Validation
**Research Goal:** Validate that buyers can find and understand available models/templates
**Owner:** UX Researcher
**Date:** 2026-03-23
**Target Sample:** 8-10 buyers with varied AI background
**Duration:** 20-30 min per session
**Format:** Moderated usability testing (Zoom with screen sharing)

---

## Research Objectives

✓ Can buyers find specific models (Llama 3, SDXL, Nemotron, etc.)?
✓ Do tier descriptions (Instant/Cached/On-demand) make sense?
✓ Can users compare models side-by-side?
✓ Are filtering/search capabilities effective?
✓ Do documentation and specs answer key questions?
✓ Is pricing information clear relative to performance?
✓ Can users understand VRAM requirements and cold-start times?

---

## Participant Recruitment

**Profile:**
- Age 18-55
- AI/ML background: varied (from beginner to advanced)
- Familiar with models: Llama, GPT, SDXL, Mistral (concepts familiar)
- Some cloud/compute experience
- English-speaking

**Recruitment:** Discord AI communities, Reddit r/StableDiffusion, r/LocalLLaMA

**Incentive:** $15 gift card or course credit

---

## Session Structure (30 min)

### 1. Background (3 min)
- What models are you familiar with?
- What type of work would you do (inference, fine-tuning, image gen)?
- How do you currently find/choose models?

### 2. Model Discovery Tasks (15 min)

**Task 1: Find Llama 3** (3 min)
```
"You want to use Llama 3 for text completion. Find it in the DCP template catalog."
Success: Located Llama 3 template, understands VRAM requirement and tier
```

**Task 2: Compare Instant vs Cached** (3 min)
```
"Explain the difference between Instant and Cached tiers. Which would you choose for
rapid prototyping with fast turnaround?"
Success: Understands tier differences, knows when to use each
```

**Task 3: Find SDXL** (3 min)
```
"You want to generate images. Find the Stable Diffusion XL template."
Success: Located SDXL, understands resource requirements
```

**Task 4: Price Comparison** (3 min)
```
"Compare the cost of running Llama 3 vs GPT-4 (if available) on DCP vs Vast.ai.
Show me how you'd do this comparison."
Success: Finds pricing, understands cost difference
```

**Task 5: Filter by Capability** (3 min)
```
"Show me all models under 8GB VRAM that you could run on your laptop GPU at home.
How would you find that?"
Success: Uses filters effectively, understands constraints
```

### 3. Copy & Terminology Understanding (8 min)

**Card Labels:**
- "What does 'cold start time' mean?" → Should explain delay for first execution
- "What's an 'Instant' model?" → Should understand pre-cached, fast startup
- "What does 'VRAM' mean?" → Should relate to memory/speed tradeoff

**Success:** 80%+ comprehension of key terms without looking them up

### 4. Documentation & Discoverability (4 min)

```
"Are there any questions about a model you'd want to answer before using it?
Are those answers easy to find in the template docs?"
```

**Key questions:** Model size, VRAM needed, typical latency, supported features, pricing

---

## Analysis

### Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Find Llama 3 | <1 min | Core model should be discoverable |
| Understand tiers | >80% | Key to price/performance tradeoff |
| Find SDXL | <1.5 min | Popular use case |
| Tier terminology | >75% comprehension | Mental model clarity |
| Satisfied with docs | >70% | Info architecture working |

### Issues to Track

- Difficulty finding specific models
- Confusion about tier differences
- Missing filtering capabilities
- Unclear documentation
- Terminology that confuses users
- Information gaps (latency, specs, pricing)

---

## Deliverables

**Report:**
1. Model findability success rates
2. Terminology comprehension
3. Filtering/search effectiveness
4. Documentation clarity
5. Copy/UX issues

**Go/No-Go:** Can users find and understand models before launch?

---

**Prepared by:** UX Researcher
**For:** Sprint 26 Phase 1 Launch
**Status:** Ready to Execute
**Timeline:** 2026-03-25 to 2026-03-27
