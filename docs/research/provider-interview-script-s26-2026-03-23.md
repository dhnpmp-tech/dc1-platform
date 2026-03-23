# DCP Provider Interview Script — Sprint 26
**Date:** 2026-03-23
**Research Goal:** Understand provider experience, onboarding friction, earnings expectations, and trust signals for first 10 active providers
**Duration:** 45-60 minutes per interview
**Format:** Structured with open-ended follow-ups

---

## Interview Context

We are recruiting GPU providers in Saudi Arabia, targeting:
- **Internet cafes** ($2,140-$2,980/mo from idle hardware, 16-18 hrs/day unused)
- **Universities** (KAUST, KFUPM, King Abdulaziz, King Saud — off-hours/weekend idle capacity)
- **Server farms** (purpose-built for DCP marketplace)

**Strategic Insight:** DCP offers 52% higher earnings than UK providers (at same rate) AND buyers pay 8-38% less than competitors — both simultaneously, due to Saudi energy advantage.

---

## Section 1: Background & Current Setup (8 min)

### 1.1 Provider Type & Operation
- What type of GPU infrastructure do you operate? (e.g., internet cafe, university, dedicated server farm, gaming cafe, rendering studio)
- How many GPUs do you currently have, and what are they? (e.g., RTX 4090, 4080, A100)
- How long have you been running GPUs for shared workloads or rental?

### 1.2 Current Revenue Model
- Are you currently renting out your GPUs? If yes:
  - Which marketplace(s)? (e.g., Vast.ai, RunPod, Akash, other)
  - How long have you been on that platform?
  - What's your average monthly revenue per GPU?
- If not renting: What do you do with idle GPU capacity?
  - Is it completely unused?
  - Do you use it internally?
  - Have you considered renting in the past?

### 1.3 Utilization & Economics
- **For cafes/universities:** How many hours per day are your GPUs typically idle?
  - (Follow-up) How much of that idle time is during peak business hours vs. off-hours?
- **For all providers:** What's your current power budget for GPU operations?
- Do you know your monthly power cost per GPU?

---

## Section 2: Onboarding & Setup (12 min)

### 2.1 Current Platform Experience
*(Only if already renting)*
- Walk me through the onboarding process you went through to join [current platform].
- How long did it take from signup to your first rental?
- What was the hardest part of setup?

### 2.2 Daemon & Software Setup
- Do you currently run any daemon or agent software? (e.g., container agents, marketplace clients)
- If yes: How hard was it to get running? Any specific blockers?
- Do you understand what your GPU daemon does on a daily basis?
- Do you feel confident troubleshooting it if it stops?

### 2.3 Technical Confidence
- Who in your organization is responsible for the GPU infrastructure?
  - Are they local, or remote IT support?
  - How technical are they on a scale of 1-10?
- What's your biggest fear about running shared GPU workloads?

### 2.4 Trust & Security
- What would need to be true for you to feel safe renting out your GPUs?
- Do you worry about:
  - Malicious workloads / data theft?
  - Hardware damage?
  - Unexpected downtime?
  - Non-payment?

---

## Section 3: Earnings Expectations & Value Proposition (10 min)

### 3.1 Price Sensitivity
- If you were to rent out your RTX 4090 on a marketplace, what hourly rate would you need to justify the operational overhead?
  - (Follow-up) Is that monthly revenue or profit target?

### 3.2 DCP Value Proposition Test
*Present the strategic brief data:*
> "DCP is a GPU marketplace operated from Saudi Arabia. Because of Saudi Arabia's energy costs (3.5-6x cheaper than EU/UK), we can offer buyers 8-38% discounts vs. Vast.ai/RunPod, while **paying providers MORE** than those platforms. For example: an RTX 4090 on Vast.ai typical price ($0.35/hr) would earn you **$149/month at DCP's lower rate** — which is **52% more** than a UK provider earns at that same price. And our buyers still save 24%."

- How does that land with you?
- Does the Saudi energy cost advantage make sense?
- Would lower absolute rental rates feel acceptable if they meant more stable utilization?

### 3.3 Competing Platforms
- Have you looked at other GPU marketplaces?
  - (Follow-up) What kept you from joining them?
- What's your perception of Vast.ai? RunPod? Akash?
- What would make DCP more attractive than those options?

---

## Section 4: Operational Fit (10 min)

### 4.1 Geographic & Regulatory Context
- Are you aware of Vision 2030 and Saudi Arabia's data center investments?
- Do you see GPU rental as aligned with your organization's mission/business?
  - (Cafes) Would monetizing idle hours be a revenue win?
  - (Universities) Would this align with research compute needs?
  - (Server farms) Would this be your primary revenue model?

### 4.2 Support & Operability
- What level of support would you need to run DCP?
  - Just API docs + email support?
  - Regular check-ins from an operations team?
  - On-call support?
- How often do you expect to need help?

### 4.3 Payment & Financial Terms
- How do you prefer to be paid?
  - Weekly? Monthly?
  - Stablecoin? Local currency (SAR)?
  - Crypto? Traditional bank transfer?
- What's your minimum viable payment amount?
- How long are you willing to wait between work and payment?

---

## Section 5: Pain Points & Objections (8 min)

### 5.1 Barriers to Participation
- What's your biggest worry about joining a GPU marketplace?
- Are there regulatory concerns in your region?
- Do you have technical bandwidth to support a new platform?
- What would your organization's leadership need to approve this?

### 5.2 Competitive Friction
- If you're already on a platform: What would make you switch to DCP?
  - Better rates?
  - Simpler setup?
  - Better support?
  - All of the above?
- If you're not on a platform: What's stopped you so far?

### 5.3 Trust & Credibility
- What would make you trust DCP as a new platform?
  - Team credentials?
  - Funding/investor backing?
  - User testimonials?
  - Proof of concept?
  - Audit of smart contracts / escrow system?

---

## Section 6: Closing & Next Steps (2 min)

### 6.1 Interest & Timeline
- On a scale of 1-10, how interested are you in DCP if we solved the issues you mentioned?
- What's your timeline? (Immediate, next 30 days, Q2, exploratory only)
- What's the next conversation we should have?

### 6.2 Referrals
- Do you know other GPU operators in your region who might be interested?
- Can we follow up with you in 2 weeks with a demo?

---

## Interview Notes Template

```
Interview #: ___
Provider Name: ___
Type: [ ] Cafe [ ] University [ ] Server Farm [ ] Other: ___
Date: ___
Interviewer: ___

Current Setup:
- GPUs: ___
- Currently renting? Y/N
- If yes, platform(s): ___
- Current revenue/GPU: ___

Key Blockers:
1. ___
2. ___
3. ___

Value Proposition Response:
- Understood energy arbitrage? Y/N
- Interested in DCP? (1-10): ___

Next Step:
- [ ] Send demo access
- [ ] Follow up on specific concern
- [ ] Referral to other provider
- [ ] Not a fit

Quote / Insight:
"___"
```

---

## Research Success Criteria

✅ Understand daemon setup difficulty for non-technical operators
✅ Validate pricing expectations vs. DCP floor price
✅ Identify top 3 trust barriers for first-time renters
✅ Confirm operational fit for cafes/universities
✅ Gather 3-5 qualified referrals for next cohort
✅ Document support level needed to scale recruiting

---

**Prepared by:** UX Researcher
**For:** DCP Sprint 26 Provider Onboarding
**Status:** Ready for first 10 interviews
