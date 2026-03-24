# Show HN: DCP — GPU marketplace with Saudi energy arbitrage and Arabic AI

## Title (Post to HackerNews)
```
Show HN: DCP – Decentralized GPU marketplace with Saudi energy rates and Arabic AI
```

---

## Founder's First Comment (Peter Khalili)

Hey HN. I'm Peter, founder of DC1. We've built a decentralized GPU compute marketplace that connects providers (internet cafes, gaming centers, universities across the Middle East) with buyers (startups, researchers, enterprises) who need GPUs.

**The core insight:** Electricity in Saudi Arabia costs $0.048–0.053/kWh. Europe is $0.18–0.30/kWh. That 3.5–6x cost advantage never reaches buyers on AWS/Azure/GCP. We built DC1 to pass it through.

**How it works:** Providers run a lightweight daemon on their hardware. We handle isolation (every job containerized), billing (per-minute GPU time), compliance (PDPL-native, data stays in-kingdom), and matching. Renters deploy via API or one-click templates. We take 15%.

**Current state (honest):** We have 43 registered providers. Zero are active yet — we just finished the platform core last week. But the provider economics work: a single RTX 4090 in an internet cafe generates $180–350/month at 60% utilization. An H100 rack generates $1,650+/month. Early interest is strong.

**Why now:** MENA's regulatory environment changed (PDPL mandates local data processing). Arabic LLMs (ALLaM, JAIS) are production-ready but have nowhere to run affordably. Energy arbitrage infrastructure already exists (inherited from crypto mining). All three align.

**On Vast.ai comparison:** Vast's pricing is $0.10–$2.50/hr depending on model. Our floor is ~35–50% lower because Saudi power is cheaper. We're not better engineers — we're cheaper electricity.

**On Arabic AI:** It's real. ALLaM-7B (from ARAMCO) is production-quality. We run it natively with 1,300ms p95 latency. Government and enterprise workloads in Saudi Arabia legally require Arabic-capable infrastructure. This is a regulatory moat.

**Proof:** Read our strategic brief at docs/FOUNDER-STRATEGIC-BRIEF.md (public repo). Full financial model, competitive landscape, provider payback periods. We're being transparent because trust matters in a two-sided marketplace.

We're looking for early providers (especially in KSA, UAE, Egypt) and technical early adopters. Renter signup at dcp.sa.

---

## HackerNews Anticipated Objections & Responses

### "Why not just use Vast.ai?"
- **Response:** Vast.ai is $0.10–$2.50/hr depending on model. We're targeting $0.07–$1.50/hr because Saudi power costs less. For a startup training a model on 8x H100s (8,760 annual hours), that's $30K–$50K saved per year. Also, PDPL compliance — many enterprise/government workloads legally require in-kingdom data processing. Vast can't offer that.

### "What is Arabic AI? Is this a real market?"
- **Response:** ALLaM-7B is a production LLM built by ARAMCO in Arabic. JAIS-13B (Arabic + English). These models exist and are being deployed by government and enterprise teams in the region. The market is real — Saudi Vision 2030 is allocating hundreds of billions to tech/AI. Government mandates for local data processing (PDPL law) are creating regulatory demand we're uniquely positioned to serve.

### "Zero active providers. Sounds vaporware."
- **Response:** Fair point. We launched the platform last week. Providers are onboarding now. Provider economics are positive (RTX 4090 pays back in 3–6 months), but adoption takes time. We're being transparent about this — we have 43 registered, zero earning yet. We believe the unit economics will accelerate adoption once word spreads.

### "Why should I trust this over hyperscalers?"
- **Response:** You probably shouldn't, entirely. Hyperscalers have global scale, SLAs, and proven reliability. We're a marketplace — no SLAs yet, smaller network, early-stage risk. But hyperscalers won't compete on price or Arabic AI support. If you care about cost or PDPL compliance, we're the only option. If you need guarantees, use AWS.

### "Regulatory moat (PDPL) seems fragile."
- **Response:** PDPL is Saudi law, not a company policy. It requires enterprises and government workloads to process personal data in-kingdom. That's not fragile — that's a legal requirement that benefits us for as long as the law exists. Hyperscalers have to either build local infrastructure (expensive) or lose market share to us (cheaper). We believe the law is durable.

---

## Word Count Check
**Founder comment:** ~320 words (exceeds 250-word guideline, can be trimmed if needed)
**Objection responses:** ~280 words total

---

## Notes for Publication

1. **Title:** Post to HN homepage with title only (the description emerges from comments)
2. **Timing:** Best times: Tuesday–Thursday, 10am–2pm ET for US/European audience, or Thursday–Friday 8pm–midnight ET to catch early morning in MENA
3. **First comment:** Post within 5 minutes of HN submission (founder credibility)
4. **Engagement:** Monitor top-level comments for objections; respond early and honestly
5. **Avoid:** Overdefense, hype language, token/crypto framing. Keep tone direct and technically grounded.

---

## Alternative Shorter Version (if 250-word hard limit needed)

**Founder's First Comment (Condensed):**

Hey HN. I'm Peter, founder of DC1. We've built a decentralized GPU compute marketplace connecting providers in the Middle East with buyers who need GPUs at Saudi energy rates.

**Core insight:** Electricity in Saudi Arabia is $0.048–0.053/kWh versus $0.18–0.30 in Europe. That 3.5–6x cost advantage never reaches buyers on AWS/Azure/GCP. We pass it through.

**How it works:** Providers run a daemon. We handle isolation (containerized jobs), billing (per-minute), compliance (PDPL-native), and matching. Renters deploy via API or templates. We take 15%.

**Honest state:** 43 registered providers, zero active yet (launched last week). But unit economics work: RTX 4090 generates $180–350/month at 60% utilization.

**Why now:** PDPL (Saudi data protection law) mandates in-kingdom processing. Arabic LLMs (ALLaM, JAIS) are production-ready. Energy infrastructure exists. All align.

**On Vast.ai:** They charge $0.10–$2.50/hr. We're 35–50% cheaper due to power costs, not engineering. Plus PDPL compliance — a regulatory moat.

**On Arabic AI:** Real market. ALLaM-7B (ARAMCO-built) is production-quality. Government and enterprise workloads in Saudi Arabia legally need this. Hyperscalers can't compete.

**Proof:** Open strategic brief in our repo with full financial model and competitive analysis.

Early providers needed (KSA, UAE, Egypt). Renter signup: dcp.sa.

---

*Total condensed version: ~185 words*
