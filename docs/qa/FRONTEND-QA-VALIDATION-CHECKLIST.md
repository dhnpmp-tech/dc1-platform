# Frontend QA Validation Checklist — Phase 1 UI Launch
**Created by:** QA Engineer
**Date:** 2026-03-23 16:35 UTC
**Purpose:** Frontend team validation checklist for template catalog and model marketplace UI
**Status:** Ready for Frontend team to use during implementation

---

## Overview

This checklist helps Frontend developers validate their UI implementation against the backend API before Phase 1 launch. All backend endpoints are production-ready and tested. This checklist ensures the frontend wiring is correct.

**Expected Timeline:**
- Frontend implementation: 1-2 days
- QA validation: 30 min (automated tests + spot checks)
- Launch: 2026-03-25 or 2026-03-26

---

## Pre-Implementation Checklist

### Environment Setup ✓
- [ ] Node.js and npm installed
- [ ] API base URL configured: https://api.dcp.sa/api
- [ ] Test credentials available (DCP_RENTER_KEY)
- [ ] Browser DevTools opened for network inspection
- [ ] Postman or curl available for quick endpoint testing

### API Endpoints Available ✓
- [ ] GET /api/templates → Returns 20 templates (verify with curl)
- [ ] GET /api/models → Returns 11 models (verify with curl)
- [ ] GET /api/health → Returns status 200 (verify with curl)
- [ ] GET /api/docs → Available (verify with curl)

**Verification Command:**
```bash
curl https://api.dcp.sa/api/templates | jq '.templates | length'  # Should be 20
curl https://api.dcp.sa/api/models | jq 'length'                  # Should be 11
```

---

## Template Catalog UI Validation

### Template List Page

#### Data Loading ✓
- [ ] Page loads without errors
- [ ] All 20 templates appear in the list
- [ ] Template data includes all required fields:
  - [ ] ID (e.g., "vllm-serve")
  - [ ] Name (e.g., "vLLM Serve")
  - [ ] Description (50+ chars)
  - [ ] Icon/image
  - [ ] Category/tags
  - [ ] Min VRAM requirement

#### Filtering & Search ✓
- [ ] Filter by category works:
  - [ ] "llm" returns 12+ templates
  - [ ] "image-generation" returns 2+ templates
  - [ ] "training" returns 2+ templates
- [ ] Search works:
  - [ ] Type "vllm" → vllm-serve appears
  - [ ] Type "stable" → stable-diffusion appears
  - [ ] Type "pytorch" → pytorch templates appear
- [ ] Filtering combination works (category + search)

#### Sorting & Pagination ✓
- [ ] Templates can be sorted by:
  - [ ] Name A-Z
  - [ ] Newest first
  - [ ] Most popular (if implemented)
- [ ] Pagination or infinite scroll works (if >10 templates per page)

#### Cards Display ✓
- [ ] Each template card shows:
  - [ ] Template name and icon
  - [ ] 1-2 line description
  - [ ] Min VRAM requirement badge
  - [ ] Category tags
  - [ ] "Deploy" or "Use Template" button
- [ ] Card design is consistent across all templates
- [ ] No truncated or overflowing text

### Template Detail Page

#### Content Loaded Correctly ✓
- [ ] Click "Deploy" or template name → Detail page opens
- [ ] All template fields displayed:
  - [ ] Full description (200+ chars)
  - [ ] All environment variables listed:
    ```
    Example: vllm-serve should show:
    - MODEL_ID (required)
    - MAX_TOKENS (optional)
    - TEMPERATURE (optional)
    ```
  - [ ] Default values shown for optional fields
  - [ ] Min VRAM and GPU requirements clear
  - [ ] Docker image name displayed (e.g., "dc1/llm-worker:latest")

#### One-Click Deploy Flow ✓
- [ ] "Deploy" button visible on detail page
- [ ] Click "Deploy" → GPU tier selection modal opens
- [ ] GPU tier options shown with pricing:
  - [ ] RTX 4090 tier (24GB) with price
  - [ ] RTX 4080 tier (16GB) with price
  - [ ] Entry tier (6GB) with price
- [ ] Select GPU tier → Deployment confirmation page
- [ ] Confirm button submits job to backend
- [ ] Success message shows job ID
- [ ] Redirect to job status page

---

## Model Marketplace UI Validation

### Model List Page

#### Data Loading ✓
- [ ] All 11 models appear in marketplace
- [ ] Each model shows:
  - [ ] Model name (e.g., "ALLaM 7B Instruct")
  - [ ] Brief description
  - [ ] VRAM requirement (e.g., "24 GB")
  - [ ] DCP price (e.g., "0.22 SAR/min")
  - [ ] Competitor prices (Vast.ai, RunPod, AWS)
  - [ ] Price comparison badge (e.g., "71% cheaper than Vast.ai")

#### Arabic Model Filtering ✓
- [ ] Filter by "Arabic-capable" returns 7 models:
  - [ ] ALLaM 7B
  - [ ] Falcon H1 7B
  - [ ] LLaMA 3 8B
  - [ ] Mistral 7B
  - [ ] Qwen2 7B
  - [ ] BGE-M3 (embeddings)
  - [ ] BGE Reranker (reranking)

#### VRAM Filtering ✓
- [ ] Filter by VRAM requirement works:
  - [ ] "4-8 GB" → Shows Phi-3, BGE-M3, BGE-Reranker
  - [ ] "16+ GB" → Shows LLaMA, Mistral, Qwen, ALLaM, Falcon, DeepSeek
  - [ ] "24+ GB" → Shows ALLaM, Falcon, JAIS, SDXL

#### Price Comparison Display ✓
- [ ] DCP price shown clearly (SAR/min)
- [ ] Competitor prices shown:
  - [ ] Vast.ai price ($/hr converted to SAR/min)
  - [ ] RunPod price
  - [ ] AWS price
- [ ] Savings badge shown:
  - [ ] "71% cheaper than Vast.ai" (for RTX 4090 tier models)
  - [ ] Correct math: (Vast.ai - DCP) / Vast.ai * 100
- [ ] Price comparison updates when VRAM tier changes

### Model Detail Page

#### Model Information ✓
- [ ] Click model card → Detail page opens
- [ ] Full model details shown:
  - [ ] Complete description (500+ chars)
  - [ ] Architecture and capabilities
  - [ ] Performance benchmarks (if available)
  - [ ] Training data summary
  - [ ] License information
  - [ ] Use cases (chat, embeddings, etc.)

#### Pricing Detail ✓
- [ ] Detailed pricing shown:
  - [ ] Base rate (SAR/min)
  - [ ] Competitor comparison table
  - [ ] Monthly cost estimate (for 30 days, 24/7 running)
  - [ ] Bulk discount (if applicable)
- [ ] Estimated monthly cost calculated:
  ```
  Example: ALLaM 7B at 0.22 SAR/min
  Monthly = 0.22 * 60 * 24 * 30 = 9,504 SAR
  Shown as: "9.5K SAR/month (24/7 usage)"
  ```

#### Deployment Options ✓
- [ ] "Deploy This Model" button visible
- [ ] Click → GPU tier selection modal (same as template flow)
- [ ] GPU tier pricing shown:
  - [ ] "RTX 4090 (24GB) - 0.22 SAR/min"
  - [ ] "RTX 4080 (16GB) - 0.17 SAR/min"
  - [ ] Pricing updates based on model requirements

#### Bilingual Content ✓
- [ ] Arabic content visible (if language toggle implemented):
  - [ ] Model name in Arabic
  - [ ] Description in Arabic (Modern Standard Arabic)
  - [ ] Use cases in Arabic
- [ ] Toggle between English/Arabic works smoothly

---

## Pricing Display Validation

### Accuracy ✓
- [ ] Template pricing matches backend:
  ```
  Backend rates (from api.dcp.sa/api/models):
  - ALLaM 7B: 0.22 SAR/min
  - Falcon H1: 0.20 SAR/min
  - LLaMA 3 8B: 0.17 SAR/min
  - Mistral 7B: 0.15 SAR/min
  - Qwen2 7B: 0.14 SAR/min
  - BGE-M3: 0.12 SAR/min
  - BGE Reranker: 0.14 SAR/min
  - SDXL: 0.30 SAR/min
  ```
  UI must show exactly these values.

- [ ] Competitor pricing matches backend:
  ```
  Backend comparison (from api.dcp.sa/api/models):
  - Vast.ai vs DCP: Calculate correct savings %
  - RunPod vs DCP: Calculate correct savings %
  - AWS vs DCP: Calculate correct savings %
  ```

### Calculations ✓
- [ ] Savings percentage calculated correctly:
  ```
  Formula: ((Competitor Price - DCP Price) / Competitor Price) * 100
  Example (RTX 4090):
  - Vast.ai: 10.00 SAR/min
  - DCP: 0.22 SAR/min
  - Savings: ((10.00 - 0.22) / 10.00) * 100 = 97.8% ✓
  ```

- [ ] Monthly cost calculated correctly:
  ```
  Formula: Price (SAR/min) * 60 * 24 * 30
  Example (ALLaM 7B):
  - 0.22 SAR/min * 60 * 24 * 30 = 9,504 SAR/month ✓
  ```

### Edge Cases ✓
- [ ] Prices displayed with 2 decimal places
- [ ] Large numbers use K/M notation (9.5K not 9504)
- [ ] No overflow in price display fields
- [ ] RTL layout respected if Arabic text shown

---

## One-Click Deploy Flow Validation

### Step 1: Template/Model Selection ✓
- [ ] User can browse templates or models
- [ ] User selects a template or model
- [ ] Template/model detail view loads

### Step 2: GPU Tier Selection ✓
- [ ] Click "Deploy" button
- [ ] Modal opens with GPU tier options
- [ ] Tiers shown:
  - [ ] RTX 4090 (24GB) - if model needs ≤24GB
  - [ ] RTX 4080 (16GB) - if model needs ≤16GB
  - [ ] Entry tier (6GB) - if model needs ≤6GB
- [ ] Price shown for each tier
- [ ] Tier selection highlighted on click
- [ ] "Next" button enables after selection

### Step 3: Confirmation ✓
- [ ] Selected template/model name shown
- [ ] Selected GPU tier shown with price
- [ ] Estimated cost calculation shown
- [ ] Duration selection available (if applicable):
  - [ ] 1 hour
  - [ ] 24 hours
  - [ ] 7 days
  - [ ] Custom duration
- [ ] "Deploy" button visible

### Step 4: Submission ✓
- [ ] Click "Deploy" submits job to /api/jobs/submit
- [ ] Backend response validated:
  ```
  Expected response:
  {
    "jobId": "uuid",
    "status": "pending",
    "templateId": "...",
    "gpuTier": "...",
    "estimatedCost": "..."
  }
  ```
- [ ] No 400/401/500 errors
- [ ] Success message shown with job ID
- [ ] Redirect to job status page

### Step 5: Job Status Page ✓
- [ ] Job ID displayed
- [ ] Current status shown (pending, running, completed, failed)
- [ ] Cost accumulation shown
- [ ] Logs visible (if available)
- [ ] Stop/cancel button available (if running)

---

## Performance Validation

### Load Times ✓
- [ ] Template list loads < 2 seconds (20 templates)
- [ ] Model list loads < 2 seconds (11 models)
- [ ] Template detail loads < 1 second
- [ ] Model detail loads < 1 second
- [ ] No blocking on API calls (use spinner)

### Responsiveness ✓
- [ ] UI responsive on mobile (< 768px width)
- [ ] UI responsive on tablet (768-1024px)
- [ ] UI responsive on desktop (> 1024px)
- [ ] Touch-friendly buttons (≥44px height)
- [ ] Text readable without zoom

### Network ✓
- [ ] Use browser DevTools → Network tab
- [ ] Check API calls are made to correct endpoints
- [ ] No duplicate API calls
- [ ] No unnecessary requests
- [ ] HTTPS enforced (no mixed content warnings)

---

## Security Validation

### Authentication ✓
- [ ] If user not logged in:
  - [ ] Can browse templates and models (public endpoints)
  - [ ] Cannot deploy without logging in
  - [ ] Click "Deploy" → Redirect to login page
- [ ] If user logged in:
  - [ ] User token included in API requests (Authorization header)
  - [ ] Deploy button functional

### Input Validation ✓
- [ ] Search input sanitized (no XSS)
- [ ] Filter parameters validated
- [ ] No direct API URL exposure in UI
- [ ] No credentials in browser console or localStorage

### HTTPS ✓
- [ ] All API calls use https:// (not http://)
- [ ] No mixed content warnings
- [ ] Certificate valid (Let's Encrypt 2026-06-21)

---

## Accessibility Validation

### Screen Readers ✓
- [ ] Template cards have alt text for images
- [ ] Pricing information accessible via semantic HTML
- [ ] Deploy button has clear label
- [ ] Form fields have associated labels

### Keyboard Navigation ✓
- [ ] Tab through template list → All cards accessible
- [ ] Tab through pricing display → All prices readable
- [ ] Tab through deploy flow → All steps navigable
- [ ] Enter/Space to click buttons
- [ ] Escape to close modals

### Contrast ✓
- [ ] Text contrast ratio ≥ 4.5:1 (WCAG AA)
- [ ] Pricing display clearly readable
- [ ] Buttons have visible focus state

---

## Spot Checks (Manual QA)

### Happy Path ✓
- [ ] Browse templates → Select vllm-serve → Deploy → Confirm → Success
- [ ] Browse models → Select ALLaM 7B → Deploy → Select RTX 4090 → Success
- [ ] Filter Arabic models → Select Falcon H1 → Deploy → Success

### Error Handling ✓
- [ ] Network error during load → Error message shown, retry button visible
- [ ] Template not found → 404 page shown, back button visible
- [ ] Deploy fails → Error message shown, dismiss button visible

### Edge Cases ✓
- [ ] Very long template description → No overflow, readable
- [ ] Very long model name → No overflow in card
- [ ] Rapid filter changes → No race conditions, latest filter applied
- [ ] Deploy while offline → Error shown, message clear

---

## Launch Readiness Sign-Off

### Frontend Developer ✓
- [ ] All checklist items validated
- [ ] No console errors or warnings
- [ ] No network errors from API
- [ ] Responsive design tested on 3+ screen sizes
- [ ] All pricing calculations verified

### QA Engineer (Spot Check) ✓
- [ ] 30-min spot check performed
- [ ] Core flows tested (browse → detail → deploy)
- [ ] Pricing display validated against backend
- [ ] No critical issues found
- [ ] Ready for Phase 1 launch

### Sign-Off
- **Frontend:** _____________________ (Name) | Date: _______
- **QA:** _____________________ (Name) | Date: _______

---

## How to Use This Checklist

1. **Before Implementation:** Review pre-implementation section
2. **During Implementation:** Reference relevant sections for each page
3. **Before Submission:** Complete all checkbox items
4. **After Implementation:** Run spot checks in "Spot Checks" section
5. **Launch Approval:** Get sign-off from both Frontend and QA

---

## Contact & Support

**Questions about API endpoints?**
- Check: https://api.dcp.sa/api/docs
- All endpoints are production-ready and tested
- Expected response times: <200ms per endpoint

**Questions about pricing calculations?**
- Check: docs/FOUNDER-STRATEGIC-BRIEF.md (competitive pricing section)
- All rates verified and tested by QA (Phase 1 validation)

**Found a bug?**
- Document in QA ticket with:
  - Screenshot/video
  - Steps to reproduce
  - Expected vs actual result
  - Browser/device info

---

**Created by:** QA Engineer (891b2856-c2eb-4162-9ce4-9f903abd315f)
**Date:** 2026-03-23 16:35 UTC
**Status:** Ready for Frontend team implementation and validation
