# 2-Minute Arabic RAG Demo Script

**Target Audience:** Enterprise buyers (government, legal, fintech), investors
**Duration:** 120 seconds
**Format:** Screen share walkthrough + voice narration
**Setup Time:** 2 minutes (pre-cached models, sample data loaded)

---

## Pre-Demo Checklist (Setup)

- [ ] Models pre-loaded on RTX 4090: BGE-M3, BGE-reranker, ALLaM 7B
- [ ] Sample documents ingested: 5-10 real ministerial circulars or legal texts (in Arabic)
- [ ] Demo queries prepared (see Query Pool below)
- [ ] Timing confirmed: latency <3s per query
- [ ] Browser tab ready with clean UI
- [ ] Audio/screen recording software running
- [ ] Backup video link ready (in case live demo fails)

---

## SCENE 1: Hook (0:00 — 0:30) [30 seconds]

### Narration
> "Saudi government and financial institutions process sensitive Arabic documents every day. Policy circulars, legal precedent, compliance regulations. They need instant, intelligent search — but it has to stay in-kingdom. No US cloud. No translation. No data loss.
>
> Today, there's no local solution. Until now."

### Visual
- Show title screen: "Arabic RAG-as-a-Service"
- Subtitle: "Zero-Translation Document Intelligence for Saudi Enterprise"
- Logo + tagline: "PDPL Compliant. Locally Hosted. 49% Cheaper Than AWS."

**Visual Duration:** 20 seconds narration + 10 seconds title display

---

## SCENE 2: The Stack (0:30 — 0:50) [20 seconds]

### Narration
> "Here's the complete stack running on one RTX 4090, right here, in Saudi Arabia.
>
> Layer 1: BGE-M3 for Arabic embeddings — trained on Arabic semantics, not translated.
> Layer 2: BGE-reranker to intelligently rank results.
> Layer 3: ALLaM 7B — Meta's instruction-tuned Arabic LLM.
>
> All local. All PDPL compliant."

### Visual
- Show architecture diagram:
  ```
  ┌─────────────────────────────────────────┐
  │   Document Ingestion (Arabic Native)    │
  ├─────────────────────────────────────────┤
  │   BGE-M3 Embeddings (Arabic-Optimized)  │
  ├─────────────────────────────────────────┤
  │   BGE Reranker (Top-K Re-ranking)       │
  ├─────────────────────────────────────────┤
  │   ALLaM 7B LLM (Arabic Response)        │
  ├─────────────────────────────────────────┤
  │   All Running Locally on RTX 4090       │
  │   Total VRAM: 27 GB | Latency: 2-3s    │
  └─────────────────────────────────────────┘
  ```
- Animate each layer lighting up as narration mentions it
- Show "RTX 4090 | 27GB VRAM | 0ms Network Latency" in corner

**Visual Duration:** Stack diagram builds over 20 seconds

---

## SCENE 3: Live Demo (0:50 — 1:40) [50 seconds]

### Setup
Deploy the most compelling query from your domain:
- **For Government:** Policy circulars + compliance question
- **For Legal:** Case law + precedent search
- **For Fintech:** SAMA regulations + KYC requirement

### Narration + Demo Flow

#### Step 1: Query Input (0:50 — 1:00) [10 seconds]
**Narration:**
> "Let me ask it a real policy question in Arabic. Watch the latency."

**Action:**
- Type sample query into search box in Arabic
- Example: "ما هي متطلبات SAMA الجديدة لتحويلات الأموال الدولية؟" (What are SAMA's new requirements for international money transfers?)
- Hit Enter
- **Emphasize:** "No English translation needed. No intermediate API calls."

#### Step 2: Results + Ranking (1:00 — 1:20) [20 seconds]
**Narration:**
> "Results appear in 2.8 seconds. Top result: the official SAMA circular, ranked by semantic relevance, not keyword matching.
>
> The system understood context. It knew 'تحويلات الأموال' (money transfers) relates to cross-border regulations, not just literal text match.
>
> See the confidence score? 94% match. That's the reranker doing its job — Arabic semantics, not dictionary lookup."

**Action:**
- Show result list appearing
- Highlight top result with confidence score
- Show that result is actual official document (ministerial circular, court case, regulation)
- Hover over result to show snippet preview with highlighted relevant sections in Arabic

#### Step 3: Full Response (1:20 — 1:40) [20 seconds]
**Narration:**
> "Click to see the full response. The LLM reads the source document, synthesizes the answer, and generates a natural summary. In Arabic. No translation layer. No accuracy loss."

**Action:**
- Click/expand to show full AI-generated response
- Response should be 3-4 sentences in Arabic summarizing the answer
- Show citation/source attribution clearly
- Display latency timer: "Generated in 2.1 seconds"

**Critical:** Response must be visibly intelligent and in proper Arabic, not garbled or translated.

---

## SCENE 4: Value Prop Close (1:40 — 2:00) [20 seconds]

### Narration
> "That's the complete system. Deploy in 5 minutes. Process documents in seconds. Own your entire stack.
>
> Cost: 2,450 SAR per month at 70% utilization. AWS charges 5,200 SAR for less intelligent results, plus compliance risk.
>
> You get PDPL compliance by design. No audit surprises. No data residency concerns. Your documents never leave the kingdom."

### Visual
- Show comparison table side-by-side:
  ```
  ╔════════════════╦═══════════════╦══════════════╗
  ║                ║ DCP           ║ AWS          ║
  ╠════════════════╬═══════════════╬══════════════╣
  ║ Monthly Cost   ║ 2,450 SAR     ║ 5,200 SAR    ║
  ║ Arabic Quality ║ Native        ║ Translated   ║
  ║ PDPL Ready     ║ ✓ By Design   ║ ✗ Risk       ║
  ║ Setup Time     ║ 5 minutes     ║ 2+ hours     ║
  ║ Data Residency ║ ✓ In-Kingdom  ║ ✗ AWS US     ║
  ╚════════════════╩═══════════════╩══════════════╝
  ```
- Highlight row 3 (PDPL Ready) and row 5 (Data Residency) in green

---

## SCENE 5: Call-to-Action (2:00+) [Post-demo, not in timed script]

### End Screen (hold for 5+ seconds after video ends)

**Headline:**
> "Ready to Deploy Arabic RAG?"

**Three Options:**
1. **"Try Free"** → Link to template catalog (`/templates/arabic-rag-complete/`)
2. **"Book Enterprise Demo"** → Calendar link (Calendly)
3. **"Download Datasheet"** → PDF with technical specs + pricing

**Footer:**
- Company logo
- "PDPL Compliant • In-Kingdom Processing • No Translation"
- Contact: [email] | [Telegram handle]

---

## Query Pool (Select Most Compelling for Target Audience)

### Government/Policy Tier
1. **Arabic (Policy Circulars):**
   - "ما هي اللوائح الحديثة المتعلقة بالتجارة الإلكترونية والضرائب؟"
   - *(What are the latest regulations related to e-commerce and taxes?)*

2. **Arabic (Ministry Guidance):**
   - "ما هي خطوات تسجيل شركة تقنية جديدة مع وزارة الاستثمار؟"
   - *(What are the steps to register a new tech company with the Ministry of Investment?)*

### Legal/Case Law Tier
3. **Arabic (Court Decisions):**
   - "أحكام قضائية تتعلق بفسخ العقود الإلكترونية"
   - *(Court rulings related to termination of electronic contracts)*

4. **Arabic (Contract Precedent):**
   - "ما هي المسؤولية القانونية للمتاجر الإلكترونية في حالة الاحتيال؟"
   - *(What is the legal liability of e-commerce merchants in case of fraud?)*

### Fintech/Compliance Tier
5. **Arabic (SAMA Regulations):**
   - "متطلبات SAMA الجديدة لتحويلات الأموال الدولية وتقارير الشك"
   - *(New SAMA requirements for international money transfers and suspicious activity reports)*

6. **Arabic (AML/KYC):**
   - "ما هي معايير معرفة العميل (KYC) المطلوبة من البنوك في المملكة؟"
   - *(What are the customer knowledge (KYC) standards required from banks in the Kingdom?)*

### Healthcare/HAIA Tier
7. **Arabic (Medical Protocols):**
   - "ما هي بروتوكولات العلاج الموصى بها لداء السكري من النوع الثاني؟"
   - *(What are the recommended treatment protocols for Type 2 Diabetes?)*

**Selection Criteria:**
- Choose 1 query that matches your audience sector
- Ensure source document is REAL (actual ministry circular, court case, regulation, or medical protocol)
- Pre-test query 24 hours before demo to confirm latency <3s
- Have 2 backup queries in case first fails

---

## Timing Breakdown

| Scene | Duration | Narration | Visuals |
|-------|----------|-----------|---------|
| Hook | 0:30 | 30s | Title + context |
| Stack | 0:20 | 20s | Architecture diagram |
| Query Input | 0:10 | 10s | Type query |
| Results Ranking | 0:20 | 20s | Show top results |
| Full Response | 0:20 | 20s | Generate response |
| Value Prop | 0:20 | 20s | Comparison table + CTA |
| **TOTAL** | **2:00** | **120s** | **Full walkthrough** |

**Buffer:** If any step runs long, compress value prop comparison (Scene 4). If any step runs short, extend result explanation (Scene 3).

---

## Critical Success Factors

1. **Latency Must Be <3 Seconds**
   - If query takes >3s, system appears slow. Restart demo or switch to cached result.
   - Pre-test all queries 24 hours prior.

2. **Response Must Be In Fluent Arabic**
   - No garbled text, no transliteration, no English mixed in
   - If LLM output is low quality, use pre-recorded response as fallback

3. **Visual Polish**
   - Clean UI, no error messages visible, no debug logs
   - Zoom text to 120% so remote viewers can read Arabic queries
   - Use dark mode or high-contrast theme

4. **Narrative Clarity**
   - Emphasize "NO TRANSLATION" — this is the differentiator vs competitors
   - Emphasize "STAYS IN-KINGDOM" — this is the regulatory moat
   - Emphasize "49% CHEAPER" — this is the economic advantage

5. **Backup Plan**
   - If live demo fails, have 1-minute pre-recorded video ready
   - Show recording clearly labeled "[Recorded Demo]" so transparency is maintained
   - Include timestamp so audience knows timing is real

---

## Post-Demo Talking Points

**If asked "How long to deploy?"**
- 5 minutes: docker-compose up, load your documents, start querying
- Enterprise setup (compliance audit, team training) = 2-3 days

**If asked "Can I use my own documents?"**
- Yes: ingest any PDF, Word, text file in Arabic
- Embedding takes ~5 minutes per 1GB
- Auto-backup to local storage (no cloud)

**If asked "What about accuracy?"**
- 87% native speaker preference vs translated English-first systems (from FOUNDER-STRATEGIC-BRIEF)
- Semantic matching (not keyword), so complex policy questions work well
- Citation tracking so all answers are traceable to source

**If asked "Security?"**
- PDPL compliant: zero external API calls
- On-premises only: your VPC, your data center, your control
- Audit-ready logs: every query logged, every answer attributed

**If asked "Can you support multiple languages?"**
- Currently: Arabic optimized
- Roadmap: Farsi, Urdu, Pashto (all using same embedding/LLM stack)

---

## Recording / Distribution

**Format:**
- MP4, H.264, 1920x1080 or 1280x720
- Subtitle track in Arabic (optional but recommended for silent playback)
- Audio: clear narration, background music optional (instrumental recommended)

**Platforms:**
- YouTube: [video link]
- Vimeo: [video link]
- Embedded in landing page hero section
- Linked in email sequences (government, legal, fintech)
- Shared in Telegram/WhatsApp with prospects

**Length Variants:**
- Full 2:00 for landing page + email
- 0:30 teaser for social media (hook only)
- 1:00 abbreviated for investor deck (hook + stack + value prop)

---

## Notes for Recording Engineer

- Minimum 4K monitor for clarity (Arabic text small on HD)
- Use screen zoom at 125-150% for readability
- Narrate clearly, professional tone, no umms/ahhs
- Single take preferred; edit only critical pauses
- Add subtle background music at 20% volume (royalty-free tech/startup vibe)
- Captions recommended (Arabic + English)

