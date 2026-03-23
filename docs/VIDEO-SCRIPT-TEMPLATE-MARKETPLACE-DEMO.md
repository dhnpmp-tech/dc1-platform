# Video Script: "One-Click AI Models — The DCP Template Marketplace"

**Duration:** 3 minutes (YouTube/LinkedIn)
**Audience:** AI developers, startups, enterprises looking for GPU compute
**Goal:** Show how easy it is to discover, customize, and deploy ML models on DCP
**Style:** Fast-paced, practical, minimal jargon

---

## Scene 1: Problem (0:00 - 0:15)

**[VISUAL: Screen showing developer frustration]**
- Developer staring at 15 browser tabs
- Vast.ai pricing comparison
- RunPod documentation
- Custom Docker setup

**[VOICEOVER]**
"Finding the right GPU compute is a headache. You need to:
- Compare pricing across vendors
- Write custom Docker files
- Deal with different interfaces
- Hope it actually works

What if it just... worked?"

---

## Scene 2: Enter DCP (0:15 - 0:30)

**[VISUAL: DCP dashboard loads, hero shot of template grid]**
- Clean, modern interface
- Grid of 20 colorful template cards
- Category icons: LLMs, Vision, Arabic, Inference, etc.

**[VOICEOVER]**
"Meet DCP. We pre-built the templates. You just click.

Nemotron. SDXL. Llama. Qwen. Arabic models. Everything ready to run."

**[TEXT OVERLAY]**
"20 production-ready templates"

---

## Scene 3: Discovery (0:30 - 1:00)

**[VISUAL: Browse → Filter → Search flow]**

### A. Open Template Catalog
**[ACTION]** User clicks "Browse Templates"
**[VISUAL]** Grid appears with cards: "Nemotron 4B Nano," "SDXL Stable Diffusion," "Llama 3 8B," "Arabic RAG Stack," etc.
**[TEXT]** Hover tooltip shows: "GPU type," "VRAM," "Price/hour," "Speed rank"

### B. Filter by Need
**[ACTION]** Click "Arabic" filter
**[VISUAL]** Grid updates instantly → 6 Arabic models remain
**[VOICEOVER]** "Filter by language, GPU type, or task. Find exactly what you need in seconds."

### C. Compare Pricing
**[VISUAL]** Model card expands, showing:
- **DCP Price:** $0.45/hr
- **Vast.ai:** $1.20/hr (2.7x more)
- **RunPod:** $0.95/hr (2.1x more)
**[TEXT OVERLAY]** "68% cheaper than hyperscalers"

### D. Check Reviews
**[VISUAL]** Card shows: ⭐⭐⭐⭐⭐ (24 reviews)
- "Instant boot, no downtime" - AI Startup
- "Perfect for production" - Research Lab
- "Arabic accuracy is insane" - Enterprise

---

## Scene 4: One-Click Deploy (1:00 - 1:45)

**[VISUAL: Deployment flow animation]**

### Step 1: Select GPU
**[ACTION]** Click "Deploy" on "Nemotron 4B" template
**[VISUAL]** Modal opens: "Choose GPU"
- Options: RTX 4090, RTX 4080, A100
- Real-time availability: "5 available"
- Estimated cost: "$0.45/hr"

**[VOICEOVER]** "Choose your GPU. See real-time availability and pricing."

### Step 2: Configure (Optional)
**[VISUAL]** Collapse-able section: "Advanced Options"
- Environment variables (pre-filled)
- Model parameters (quantization, context length)
- Storage volume (optional)

**[VOICEOVER]** "Customize if you want. Or just use defaults. Your call."

### Step 3: Deploy
**[ACTION]** Click "Deploy Now"
**[VISUAL]** Loading screen with progress:
- ✅ Acquiring GPU (2 sec)
- ✅ Pulling container (8 sec)
- ✅ Starting model (5 sec)
- ✅ Running health check (3 sec)
**[TEXT]** "Ready in 18 seconds"

### Step 4: Use It
**[VISUAL]** Terminal opens with:
```bash
$ curl https://your-compute.dcp.sa/v1/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"prompt": "مرحبا", "max_tokens": 100}'

{
  "choices": [{
    "text": "مرحبا بك في منصة DCP..."
  }]
}
```

**[VOICEOVER]** "Get a live API endpoint. Standard OpenAI format. Your code works immediately."

---

## Scene 5: Real-World Use (1:45 - 2:30)

**[VISUAL: Split-screen montage of 3 use cases]**

### Use Case 1: Startup Fine-Tuning
**[VISUAL]** Founder's screen: Training custom Qwen model
**[VOICEOVER]** "Startups use DCP to fine-tune models on their data in hours."
**[TEXT]** "Fine-tune Qwen 7B: $8 (vs $400 on AWS)"

### Use Case 2: Enterprise Arabic RAG
**[VISUAL]** Corporate dashboard: Arabic document retrieval
- User types: "ابحث عن معاملات العقود الحكومية"
- Results: 5 relevant contracts in 0.2 seconds
**[VOICEOVER]** "Enterprises build Arabic RAG pipelines for legal, finance, government."
**[TEXT]** "On-shore. PDPL compliant. No data egress."

### Use Case 3: Researcher Benchmarking
**[VISUAL]** Researcher comparing 3 models in parallel
- Llama 3 8B
- Mistral 7B
- Qwen 2.5 7B
**[VOICEOVER]** "Researchers run benchmarks across models. Same interface. Different hardware."

---

## Scene 6: Why DCP? (2:30 - 2:50)

**[VISUAL: Benefit cards appear one by one]**

**Card 1:** 💰 **68% Cheaper**
- "Saudi energy arbitrage"

**Card 2:** ⚡ **18-Second Deploy**
- "No Docker knowledge needed"

**Card 3:** 🌍 **PDPL Compliant**
- "On-shore, your data stays in-country"

**Card 4:** 🔧 **20 Templates Ready**
- "LLMs, Vision, Arabic, Inference"

**Card 5:** 📊 **Standard API**
- "OpenAI format, use your existing code"

**[VOICEOVER]**
"DCP gives you enterprise-grade GPU compute without the complexity.

Cheaper. Faster. Compliant. Ready."

---

## Scene 7: CTA (2:50 - 3:00)

**[VISUAL: Clean, minimal call-to-action screen]**
- DCP logo (center)
- Blue "Get Started" button
- "Browse 20 templates now"
- URL: dcp.sa

**[VOICEOVER]**
"Start building today. First hour is free.

DCP — GPU compute, simplified."

**[TEXT OVERLAY]**
"dcp.sa | Explore Templates | Free First Hour"

**[FADE]** Music hits climax, logo holds 2 seconds.

---

## Audio Notes

**Music:**
- Upbeat, modern tech vibe (like Stripe or Figma ads)
- Builds from 0:00 to 1:00, then maintains energy
- Drops at CTA (2:50+) for impact

**Voiceover:**
- Friendly, conversational
- No corporate jargon
- Pacing matches visual flow
- Slight accent acceptable (Middle East-based founder)

**Sound Effects:**
- Click sounds (subtle) when UI buttons pressed
- Success chime when model deploys
- Whoosh transitions between scenes

---

## Thumbnail

**Recommended Design:**
- Top half: Colorful template grid (DCP dashboard)
- Bottom half: 2-3 model names (Nemotron, SDXL, Arabic RAG)
- Text overlay: "One-Click AI Deploy" + "68% Cheaper"
- Color scheme: Blue/white (DCP brand)

---

## Where This Video Plays

1. **Homepage (Hero Section)** — Auto-play, muted
2. **LinkedIn** — Full sound, professional audience
3. **YouTube** — Embedded in "Getting Started" playlist
4. **Twitter/X** — GIF version (looped, no audio)
5. **Sales Deck** — 40-second version for investor calls

---

## Variations

### Short Form (60 seconds)
**Cuts:** Remove detailed use cases (Scene 5), compress deploy flow
- Problem (15s) → Solution (15s) → Demo (20s) → CTA (10s)

### Technical Audience (2:30 minutes)
**Additions:** Add code snippets, architecture diagram, performance benchmarks
- Standard flow + 30-second benchmark comparison

### Arabic Version (3:00 minutes)
**Changes:** Voiceover in Modern Standard Arabic, UI text in Arabic
- Same visuals, dubbed audio

---

## Production Checklist

- [ ] Record screen capture of live DCP dashboard (20 deployments captured)
- [ ] Film voiceover (professional studio quality)
- [ ] Create motion graphics for benefit cards (Scene 6)
- [ ] Compose original music (3 minutes, upbeat, tech-forward)
- [ ] Add captions (English + Arabic)
- [ ] Color grade for brand consistency
- [ ] Test across platforms (YouTube, LinkedIn, Twitter specs)
- [ ] Optimize for mobile (vertical safe zones)
- [ ] Create thumbnail images (3 variations)
- [ ] Write YouTube description with links

---

**Status:** Ready for production
**Estimated Production Time:** 2-3 weeks (design + filming + sound)
**Target Launch:** April 2026 (Phase 1 post-launch marketing)

