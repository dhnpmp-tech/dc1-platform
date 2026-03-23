# Buyer Pricing Perception Survey — DCP vs Competitors
**Document:** Price Sensitivity & Messaging Validation
**Research Goal:** Validate DCP floor pricing and value proposition messaging for buyers
**Owner:** UX Researcher
**Date:** 2026-03-23
**Target Sample:** 20-30 current Vast.ai/RunPod users
**Duration:** 5-7 minutes per respondent
**Format:** Online survey (Google Forms / Typeform / Qualtrics)

---

## Research Objectives

✓ Validate DCP floor prices ($0.267/hr RTX 4090) feel attractive vs Vast.ai/RunPod
✓ Test messaging around energy arbitrage (Saudi electricity cost advantage)
✓ Measure price sensitivity and switching willingness
✓ Identify most compelling value props (cost savings, sustainability, speed, etc.)
✓ Test tone/messaging with buyer audience
✓ Identify pricing barriers or objections
✓ Validate DCP differentiation messaging

---

## Target Audience & Recruitment

**Profile:**
- Current Vast.ai or RunPod user (active in past 30 days)
- Using GPUs for: LLM inference, fine-tuning, training, image generation
- Budget-conscious (looking to optimize compute costs)
- Age 18-55, technical literacy moderate-high
- English-speaking (primarily)

**Recruitment Channels:**
1. **Reddit:** r/StableDiffusion, r/MachineLearning, r/LocalLLaMA, r/LanguageModels
   - Post: "5-min survey on GPU pricing preferences (all respondents qualify for DCP discount code)"

2. **Discord:** Stable Diffusion servers, LLM communities, Vast.ai/RunPod user groups
   - Link share with incentive note

3. **Twitter:** DCP account mention (if applicable)
   - "Help us validate pricing: 5-min survey, get 15% launch discount code"

4. **Email:** Vast.ai/RunPod community email lists (if available)

5. **Direct:** DCP early access waitlist (if exists)

**Incentive:**
- All completers get: **15% discount code for first month** on DCP
- Bonus: Raffle drawing for $50 Amazon gift card or USDC

---

## Survey Flow

### Section A: Screening & Background (1.5 min)

**A1. Which GPU marketplace are you currently using?** *(Single select)*
- [ ] Vast.ai
- [ ] RunPod
- [ ] Both Vast.ai and RunPod
- [ ] Akash
- [ ] io.net
- [ ] Other (specify): ___
- [ ] I don't use any (SKIP to A7)

**A2. How long have you been using it?** *(Single select)*
- [ ] Less than 1 month
- [ ] 1-3 months
- [ ] 3-6 months
- [ ] 6+ months

**A3. What do you use GPUs for?** *(Multi-select)*
- [ ] LLM inference / API serving
- [ ] Model fine-tuning
- [ ] Training from scratch
- [ ] Image generation (Stable Diffusion, etc.)
- [ ] Video processing
- [ ] Data analysis / analytics
- [ ] Other: ___

**A4. On average, how much do you spend per month on GPU rental?** *(Single select)*
- [ ] Less than $50
- [ ] $50-$200
- [ ] $200-$500
- [ ] $500-$1,000
- [ ] $1,000+
- [ ] Prefer not to say

**A5. How price-sensitive are you when choosing GPUs?** *(1-10 scale)*
- 1 = Not sensitive at all (quality/speed matters most)
- 10 = Extremely sensitive (lowest cost matters most)

**A6. Have you ever switched GPU providers?** *(Single select)*
- [ ] Yes, switched once
- [ ] Yes, switched multiple times
- [ ] No, never switched
- [ ] Still evaluating options

**A7 (if switched). What made you switch?** *(Open text, optional)*
- ___

---

### Section B: Current Pricing Perception (1 min)

**B1. How do you feel about Vast.ai's typical pricing?** *(Single select)*
- [ ] Too expensive
- [ ] Reasonable / fair
- [ ] Good value
- [ ] Excellent value
- [ ] Don't know

**B2. How do you feel about RunPod's typical pricing?** *(Single select)*
- [ ] Too expensive
- [ ] Reasonable / fair
- [ ] Good value
- [ ] Excellent value
- [ ] Don't know

**B3. What's the #1 thing that would make you switch GPU providers?** *(Single select)*
- [ ] Lower prices
- [ ] Better uptime / reliability
- [ ] Faster hardware
- [ ] Better customer support
- [ ] More GPU types available
- [ ] Regional availability (closer to me)
- [ ] ESG / sustainability
- [ ] Other: ___

---

### Section C: DCP Introduction & Value Prop Test (2 min)

*Display this information:*

> ## DCP — New GPU Marketplace (Saudi Arabia)
>
> **The Opportunity:** Saudi Arabia has the lowest industrial electricity costs on Earth (USD 0.048-0.053/kWh, vs EU avg USD 0.190/kWh). DCP is the first marketplace to pass this energy savings to both buyers AND providers.
>
> **Pricing (RTX 4090 example):**
> - Vast.ai typical: **$0.35/hr**
> - RunPod: **$0.34/hr**
> - **DCP: $0.267/hr (23.7% discount vs Vast, 21.5% discount vs RunPod)**
>
> **What makes it possible:** Saudi renewable energy (solar $0.013/kWh) + regional data center ecosystem (Vision 2030 investment)
>
> **Value for you (as a buyer):**
> - 24% lower costs vs Vast.ai at same quality
> - Proven escrow contract on Base Sepolia blockchain
> - Same model availability (Llama, Nemotron, Stable Diffusion, etc.)
> - Early-mover advantage in energy-efficient computing

---

**C1. After reading that, how interested are you in DCP?** *(1-10 scale)*
- 1 = Not at all interested
- 10 = Very interested

**C2. What's your main reason for that rating?** *(Open text, optional)*
- ___

**C3. Which aspect is most compelling?** *(Single select)*
- [ ] Lower prices (24% savings)
- [ ] Energy efficiency / sustainability
- [ ] First-mover advantage in GCC
- [ ] Blockchain escrow for security
- [ ] Supporting Vision 2030 / Saudi ecosystem
- [ ] Combination of factors
- [ ] Nothing really compelling

**C4. What would make you MORE interested in DCP?** *(Multi-select)*
- [ ] Lower prices (even further discounts)
- [ ] Proof of security/audit
- [ ] More GPU types available
- [ ] Better uptime guarantees
- [ ] Customer testimonials from other users
- [ ] Faster onboarding/setup
- [ ] Local support (Arabic language)
- [ ] Nothing — already very interested

---

### Section D: Messaging A/B Testing (1.5 min)

*Show different messaging variants and test comprehension + appeal*

**D1. Which DCP message resonates most with you?** *(Single select)*

*Option A:*
> "DCP uses Saudi Arabia's structural energy advantage (3.6x cheaper than EU) to offer you 24% lower GPU prices — without sacrificing quality or reliability."

*Option B:*
> "DCP: The only GPU marketplace powered by Saudi renewable energy. Lower costs. Better for the planet. Better for your budget."

*Option C:*
> "Saudi data centers + lower energy costs = you save 24% on GPU rental. DCP: Energy-efficient compute for AI."

*Option D:*
> "Why pay full price? DCP gives you enterprise GPU quality at startup pricing, powered by regional energy advantage."

- [ ] Option A (energy arbitrage framing)
- [ ] Option B (sustainability framing)
- [ ] Option C (technical/efficiency framing)
- [ ] Option D (value framing)
- [ ] None of them

**D2. Why did you choose that message?** *(Open text, optional)*
- ___

**D3. Do you understand how DCP can offer lower prices?** *(Single select)*
- [ ] Yes, completely clear
- [ ] Mostly clear
- [ ] Somewhat unclear
- [ ] Confusing
- [ ] Don't know

**D4 (if unclear). What part is confusing?** *(Open text, optional)*
- ___

---

### Section E: Pricing Comparison & Willingness (1 min)

*Show detailed pricing table:*

**E1. Assuming equal uptime/reliability, which would you choose?** *(Single select)*

| Provider | RTX 4090 | RTX 3090 | A100 SXM |
|----------|----------|----------|----------|
| Vast.ai | $0.35/hr | $0.17/hr | $0.86/hr |
| RunPod | $0.34/hr | $0.22/hr | $1.39/hr |
| **DCP** | **$0.267/hr** | **$0.105/hr** | **$0.786/hr** |

- [ ] Vast.ai (even though it's more expensive)
- [ ] RunPod (even though it's more expensive)
- [ ] DCP (lowest cost)
- [ ] Not sure / depends on other factors

**E2. If DCP had a slight reliability concern initially (new platform), would you still try it with the 24% discount?** *(Single select)*
- [ ] Yes, definitely
- [ ] Probably
- [ ] Maybe (depends on the concern)
- [ ] Probably not
- [ ] No, wouldn't risk it

**E3. What assurance would you need to trust DCP as a new platform?** *(Multi-select)*
- [ ] Security audit by third party
- [ ] Legal/escrow transparency
- [ ] User testimonials / case studies
- [ ] Uptime guarantee (SLA) in writing
- [ ] Trial period / free credits
- [ ] Gradual migration (test small first)
- [ ] Local support team
- [ ] Institutional backing / funding

**E4. How likely are you to try DCP in the next 30 days?** *(1-10 scale)*
- 1 = Not likely at all
- 10 = Very likely

**E5. If Vast.ai matched DCP's prices, would you stay with Vast.ai?** *(Single select)*
- [ ] Yes, brand loyalty
- [ ] Yes, switching costs are high
- [ ] Maybe (depends on quality)
- [ ] No, I'd still try DCP
- [ ] Don't know

---

### Section F: Closing (0.5 min)

**F1. How did you hear about DCP?** *(Single select)*
- [ ] This survey
- [ ] Reddit / social media
- [ ] Friend / colleague
- [ ] Twitter / blog
- [ ] Other: ___

**F2. Can we contact you about DCP beta access?** *(Single select)*
- [ ] Yes, please
- [ ] Maybe later
- [ ] No thanks

**F3 (if yes). Best way to contact you?**
- Email: ___
- Discord: ___
- Twitter: ___

**F4. Any other feedback about DCP pricing or messaging?** *(Open text, optional)*
- ___

---

## Analysis Framework

### Quantitative Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Interest (C1 ≥ 7) | 60%+ | Warm leads |
| Willing to try (E4 ≥ 7) | 50%+ | Conversion potential |
| Price resonance (D1) | Top message >40% | Messaging clarity |
| Trust concern (E3) | <3 avg concerns | Addressable barriers |
| Understand arbitrage (D3) | "Clear" >70% | Value prop comprehension |

### Messaging Resonance

**Track by option:**
- A (Energy arbitrage): Which demos understand it? → B2B vs B2C?
- B (Sustainability): Which demos care? → Younger users, ESG focus?
- C (Technical): Which demos prefer? → Engineers, technical buyers?
- D (Value): Which demos respond? → Price-sensitive users?

### Segmentation Analysis

**By current platform:**
- Vast.ai users: more likely to switch? More price-sensitive?
- RunPod users: different pain points?

**By spending:**
- Heavy users ($500+): different priorities?
- Light users (<$50): most price-sensitive?

**By use case:**
- LLM inference vs image generation: different cost sensitivity?
- Hobbyists vs professionals: different trust concerns?

---

## Delivery Timeline

**Timeline:**
- Setup survey: 2026-03-23 (today)
- Recruit participants: 2026-03-24 (1-2 days)
- Collect responses: 2026-03-24 to 2026-03-27 (3-5 days)
- Analyze data: 2026-03-27 (1 day)
- Report findings: 2026-03-28

**Target:** 20-30 responses by 2026-03-28

---

## Report Output

**Executive Summary:**
1. Interest level (% scoring 7+)
2. Key messaging that resonates
3. Top trust barriers
4. Willingness to switch

**Key Findings:**
1. Messaging preference breakdown
2. Price sensitivity by segment
3. Trust concerns and mitigation strategies
4. Early adopter vs skeptic profiles

**Recommendations:**
1. Refine messaging based on A/B test winner
2. Address top trust barriers in go-to-market
3. Segment outreach (early adopters vs price-sensitive)
4. Pricing positioning strategy

---

**Prepared by:** UX Researcher
**For:** Sprint 26 Phase 1 Launch
**Status:** Ready for Distribution
**Survey Link:** [To be generated]
**Target Completion:** 2026-03-28
