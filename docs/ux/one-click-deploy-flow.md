# One-Click Deploy Flow UX — Sprint 27

> **Owner:** UI/UX Specialist
> **Date:** 2026-03-23
> **Goal:** Reduce template → first job to <3 clicks

---

## EXECUTIVE SUMMARY

Current flow is unclear. **Goal: make deploying a template as easy as 1-click (or minimal decision tree).**

Expected flow: **Template → GPU Select (if needed) → Confirm Price → Deploy → Status**

Success: 60%+ of renters who click a template complete a deployment.

---

## 1. DEPLOYMENT FLOW MAP

### Flow Diagram

```
┌─ Template Card ──────┐
│  [→ Configure &      │
│   Deploy]            │
└─────────┬────────────┘
          │
          ▼
┌─ GPU Tier Selector ──────────────┐  ← CONDITIONAL (if template flexible)
│ "Which GPU?"                      │
│ ☐ 8GB RTX 4090  (5.0 SAR/hr)     │
│ ☐ 24GB RTX 4090 (9.0 SAR/hr)    │
│ ☐ 80GB H100     (65.0 SAR/hr)    │
│ [Cancel] [Next]                   │
└─────────┬───────────────────────┘
          │
          ▼
┌─ Deploy Parameters ──────────────┐  ← OPTIONAL (for advanced templates)
│ "Configure your deployment"       │
│                                   │
│ Model: nvidia/Nemotron-Mini-4B   │
│ (read-only)                       │
│                                   │
│ Duration: [30 minutes ▼]          │  ← Default reasonable value
│ Batch Size: [32 ▼]               │  ← Optional, expert tweaks
│ Temperature: [0.7 ▼]             │
│                                   │
│ [Back] [Review & Deploy]          │
└─────────┬───────────────────────┘
          │
          ▼
┌─ Confirm & Deploy ──────────────┐  ← FINAL STEP
│ "Ready to deploy?"              │
│                                   │
│ Template: Nemotron Nano 4B      │
│ GPU: 8GB RTX 4090 (5.0 SAR/hr)  │
│ Duration: 30 min                │
│ Estimated Cost: 2.5 SAR         │  ← Clear pricing
│                                   │
│ [Back] [✓ Deploy Now]            │
└─────────┬───────────────────────┘
          │
          ▼
┌─ Deployment Status ─────────────┐  ← CONFIRMATION
│ "Job submitted! 🎉"             │
│                                   │
│ Job ID: dcp-job-xyz123          │
│ Status: Allocating GPU...        │
│ Est. Ready: 30 seconds           │
│                                   │
│ [View Job] [Deploy Another]      │
└─────────────────────────────────┘
```

---

## 2. STEP BREAKDOWN

### Step 1: Template Selection
✓ User clicks template card  
✓ CTA button: "→ Configure & Deploy"  
→ Open modal/page with GPU selector

### Step 2: GPU Tier Selection (CONDITIONAL)

**Show this step if:**
- Template supports multiple GPU tiers (Llama 3, vLLM, training templates)

**Don't show if:**
- Template is GPU-specific (Nemotron Nano → 8GB only, H100 inference → 80GB only)

**Smart default:**
- Pre-select cheapest tier that meets min_vram_gb
- Show alternatives with price/performance tradeoff

**UI:**
- Radio buttons (not dropdown, to show all options at once)
- Show price/hr for each option
- Show estimated cold-start latency
- Show provider availability ("5 providers online")

### Step 3: Configure Parameters (OPTIONAL)

**Show for:**
- LLM inference (max_tokens, temperature, top_p)
- Training (batch_size, learning_rate, epochs)
- Image gen (num_steps, guidance_scale)

**Don't show for:**
- Notebooks, embeddings, Ollama (no meaningful parameters)

**UX:**
- Defaults provided (read from template.params)
- Sliders/dropdowns (not text input, to avoid errors)
- Tooltips on hover ("What's temperature?")
- "Reset to defaults" link

### Step 4: Review & Confirm

**Show:**
- Template name + icon
- Selected GPU + price/hr
- Duration (minutes)
- Estimated total cost: `price_per_hour * duration_minutes / 60`
- Renter balance + whether sufficient funds

**Final check:**
- Show payment method (credit card, SAR wallet)
- Link to docs: "What happens next?"

### Step 5: Status Page

**Post-deploy:**
- Job ID (copyable)
- Status badges: "Allocating GPU → Building Image → Running → Complete"
- Estimated time to ready
- Progress bar (indeterminate until job starts)
- Links: View detailed logs, Download results

---

## 3. MOBILE FLOW

### Responsive Adjustments
- **Step 1:** Full-screen modal instead of new page
- **Step 2-4:** Tab-based flow (swipe between steps)
- **Duration input:** Number input with +/- buttons (larger touch targets)
- **Buttons:** Full-width, 48px minimum height
- **Back button:** Always available at top-left

---

## 4. ERROR STATES

### Insufficient Funds
```
"❌ Insufficient balance"
"Your account has 1.0 SAR."
"This job costs 2.5 SAR."
"[→ Top up account] [Cancel]"
```

### GPU Unavailable
```
"❌ GPU temporarily unavailable"
"8GB RTX 4090 is fully booked."
"Try 24GB RTX 4090 or wait 5 minutes."
"[Try different GPU] [Cancel]"
```

### Network Error
```
"⚠ Deployment failed"
"Connection error: please try again"
"[Retry] [Cancel]"
```

---

## 5. LOADING STATES

### While Allocating GPU
```
"Allocating GPU from provider pool..."
(spinning loader)
"Usually takes <30 seconds..."

[Cancel Job]
```

### While Building Image
```
"Building Docker container..."
Progress: [████░░░░░░░░░░░░░░] 30%
"Pulling model weights..."

[Cancel Build]
```

---

## 6. SUCCESS MESSAGING

### When Job Submitted
```
✅ "Deployment submitted!"

Job ID: dcp-xyz-123
Template: Nemotron Nano 4B
Status: Allocating GPU...

Ready in ~30 seconds.

[→ View Live Status] [Deploy Another]
```

### When Job Running
```
🎯 "Job is live!"

Endpoint: https://dcp.sa/jobs/dcp-xyz/endpoint
Docs: curl -X POST https://...

[Copy Endpoint] [View Logs] [Stop Job]
```

---

## 7. CONVERSION OPTIMIZATION

### Friction Reduction
| Friction | Solution |
|----------|----------|
| Too many steps | Limit to 3-4 steps max |
| Unclear pricing | Show total cost before confirming |
| Fear of error | Provide safe defaults, show hints |
| Stuck waiting | Show ETA, allow cancel |

### Psychology
- **Color:** Green CTA for "Deploy" (action color)
- **Progress:** Show step indicator (2/4) to build confidence
- **Reassurance:** "Usually takes 30 seconds..." (expectations setting)
- **Undo:** "You can stop the job anytime" (reduces fear)

---

## 8. ANALYTICS TRACKING

Track per-template:
- **Flow start:** % of card clicks that enter flow
- **GPU selection drop-off:** % who abandon at step 2
- **Deploy completion:** % who reach final confirmation
- **Error rates:** Which errors most common
- **Time-to-deploy:** How long from card click to job submit

Goal: >60% completion rate from card click to deploy.

---

## 9. Detailed Component Structure

```
DeployFlow/
├── Step1_TemplateSelect
│   └── Shows selected template details
├── Step2_GPUSelector (conditional)
│   ├── RadioGroup with GPU options
│   ├── Price + latency per option
│   └── Provider availability badge
├── Step3_ConfigureParams (conditional)
│   ├── ParamSlider for each configurable param
│   ├── Tooltip on hover
│   └── Reset button
├── Step4_ReviewConfirm
│   ├── Summary of all choices
│   ├── Total cost calculation
│   ├── Balance check
│   └── Terms acceptance (if needed)
└── Step5_Status
    ├── Job ID + copy button
    ├── Status timeline
    ├── Progress bar
    └── Result links
```

---

## 10. Future Enhancements

- **Quick deploy:** Skip config if user just wants defaults (1-click)
- **Template presets:** "Deploy Nemotron for chatbot" pre-fills duration, params
- **One-click repeat:** "Deploy same config again?" after first job
- **Scheduled jobs:** "Deploy at 11 PM daily for training"
