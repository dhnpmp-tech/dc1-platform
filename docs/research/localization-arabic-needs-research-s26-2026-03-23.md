# Localization & Arabic Language Needs Research
**Document:** Arabic Localization Priority Assessment
**Research Goal:** Validate Arabic language requirements for Saudi provider audience
**Owner:** UX Researcher
**Date:** 2026-03-23
**Target Sample:** 8-10 Saudi providers, cafe operators, tech professionals
**Duration:** 30-45 min per session
**Format:** Remote interviews + walkthrough (Arabic-language interviewer preferred)

---

## Research Objectives

✓ Identify which features MUST be in Arabic for provider adoption (signup, payments, support, etc.)
✓ Validate terminology translations (GPU, earnings, uptime, daemon, provider, escrow, etc.)
✓ Understand language preference by audience segment (cafe operators vs technical providers)
✓ Assess Arabic diaspora needs (non-Saudi Arabic speakers)
✓ Prioritize localization: MVP (launch) vs nice-to-have (post-launch)
✓ Test RTL (right-to-left) layout expectations
✓ Identify cultural/regional considerations beyond language

---

## Participant Recruitment

**Segment 1: Saudi Cafe/Small Business Operators (4-5)**
- Age 25-55
- Limited technical English
- Interested in monetizing idle GPU hardware
- Decision-makers for business operations
- Prefer Arabic for business communications

**Segment 2: Technical Providers (3-4)**
- Age 20-45
- Bilingual (Arabic + English)
- Server farm operators or technical leads
- May be comfortable with English but prefer Arabic for business
- Decision-makers for infrastructure investment

**Segment 3: University/Research IT (1-2)**
- Age 30-50
- Technical background
- Decision-makers for resource allocation
- May operate entirely in Arabic within institution

**Recruitment:**
- Direct outreach to DCP's 43 registered providers (if Saudi-based)
- KAUST, KFUPM IT departments
- Cafe owner networks (Riyadh, Jeddah, Dammam)
- Incentive: 500 SAR or $150 + DCP discount

---

## Session Structure (45 min)

### 1. Background & Language Preference (5 min)

```
"What's your preferred language for business communications?
When do you prefer Arabic vs English?"

Key insight: Is Arabic preference driven by law/regulation, personal comfort,
or business norms?
```

### 2. Critical Path Localization (10 min)

**Interview Topics:**

**Signup & Onboarding:**
- Can you comfortably sign up for an English-language service?
- Would Arabic signup increase your confidence in the platform?
- What signup steps MUST be in Arabic? (email confirmation, payment verification?)

**Payments & Earnings:**
- How do you manage payments in other platforms?
- Would you prefer to see earnings in SAR or USD?
- Any concerns about English payment terms/documentation?
- What payment-related terms are critical to understand?

**Support & Troubleshooting:**
- How do you prefer to contact support (email, chat, phone)?
- Would you use support if it were only in English?
- What issues would you want to discuss in Arabic?

**Regulatory/Compliance:**
- Do you need Arabic documentation for internal approval/audits?
- Are there Saudi regulations requiring Arabic?
- What compliance docs should be bilingual?

### 3. Terminology Translation Testing (12 min)

**English → Arabic Terminology:**

Present terms and ask for translation/understanding:

| English | Arabic Gloss | Meaning |
|---------|-------------|---------|
| GPU | بطاقة رسومات (bitaqat rusumat) | Graphics card |
| Provider | مزود (muzawwid) | Supplier/provider |
| Daemon | عفريت (ʿifrīt) / خادم (khādim) | Service/demon |
| Escrow | ضمان (daman) / حساب محجوز (hisab mahjouz) | Trust account |
| Uptime | وقت التشغيل (waqt al-tashghīl) | Running time |
| Earnings | الأرباح (al-arbaah) / العائد (al-ʿāʾid) | Profits/returns |
| Token | رمز (ramz) / علامة (ʿalāmah) | Symbol/token |
| Inference | الاستنتاج (al-istintāj) | Deduction |
| Throughput | معدل النقل (muʿaddal al-naql) | Transfer rate |

**Task:**
```
"How would you explain [term] to someone who doesn't know GPU rental?"

Success: Provider understands concept AND prefers Arabic term
```

**Key insight:** Are international tech terms used in Arabic or translated?

### 4. UI/UX Walkthrough (10 min)

**Show Arabic mockup/prototype:**
```
"Walk me through signing up and checking your earnings on this dashboard.
Tell me what's clear and what's confusing."
```

**Observation points:**
- Do they understand the flow in Arabic?
- Any terms that seem wrong or unclear?
- RTL (right-to-left) layout feels natural?
- Button labels, menu text, help text clarity

### 5. Localization Prioritization (5 min)

**Ranking exercise:**
```
"If we could only translate 5 things into Arabic before launch, what would be
most important? Rank these:"

- [ ] Signup & authentication
- [ ] Dashboard (earnings, jobs)
- [ ] Payment & withdrawal
- [ ] Help & support documentation
- [ ] API documentation
- [ ] Terms of Service / Legal
- [ ] Email notifications
- [ ] Error messages
```

**Follow-up:**
- What could you live with in English?
- What would require Arabic for business approval?

### 6. Regional Considerations (3 min)

```
"Are there cultural or regional factors (beyond language) that matter for DCP?
- Payment methods preference (bank transfer vs crypto)?
- Weekend/holiday expectations?
- Contract/escrow comfort level?
- Vision 2030 messaging resonance?
```

---

## Analysis Framework

### Localization MVP (Must-Have for Launch)

**Criteria:** >70% of target audience sees as essential

Likely candidates:
- [ ] Signup page & email verification
- [ ] Dashboard (earnings, status, history)
- [ ] Payment withdrawal interface
- [ ] Basic help documentation
- [ ] Critical error messages
- [ ] Terms & conditions (compliance requirement?)

### Localization Phase 2 (Post-Launch)

Likely candidates:
- [ ] Full API documentation
- [ ] Advanced settings & configuration
- [ ] Community/forum
- [ ] Blog & educational content

### Never Localize (Stays English)

- [ ] International tech terminology (GPU, API, etc.) — probably used in Arabic tech industry as-is
- [ ] Code/technical logs
- [ ] Developer-only features

---

## Metrics

| Metric | Success | Rationale |
|--------|---------|-----------|
| Arabic essential for signup | >60% providers | Gate for adoption |
| Dashboard clarity in Arabic | >75% | Core value proposition |
| Support preference (Arabic) | >50% | User satisfaction |
| Terminology understood | >80% | Domain comprehension |

---

## Deliverables

**Report:**
1. MVP localization feature list
2. Terminology recommendations
3. Phase 2 localization candidates
4. Regional/cultural insights
5. Implementation recommendation (full vs phased)

**Outputs:**
- Terminology glossary (English ↔ Arabic)
- Localization roadmap (MVP + timeline)
- RTL layout considerations
- Compliance/regulatory requirements (if any)

---

## Timeline

**Phase 1: Setup** (2026-03-24 — 1 day)
- [ ] Recruit 8-10 Saudi providers
- [ ] Prepare Arabic interview guide & mockups
- [ ] Confirm session times (work around Saudi timezone)

**Phase 2: Interviews** (2026-03-25 to 2026-03-26 — 2 days)
- [ ] Conduct 8-10 sessions (45 min each)
- [ ] Capture terminology preferences
- [ ] Test mockup clarity

**Phase 3: Analysis** (2026-03-27 — 1 day)
- [ ] Synthesize MVP localization list
- [ ] Create terminology glossary
- [ ] Prioritize by urgency + effort

**Phase 4: Delivery** (2026-03-28)
- [ ] Report findings
- [ ] Localization roadmap
- [ ] Engineering estimate for implementation

---

## Success Criteria for Research

✅ Clear MVP localization feature list
✅ Terminology glossary approved by native speakers
✅ Provider confidence in platform increases with Arabic
✅ Compliance requirements identified (if any)
✅ Phase 1 vs 2 prioritization clear

---

**Prepared by:** UX Researcher
**For:** Sprint 26 Phase 1 Launch
**Status:** Ready to Execute
**Next Step:** Recruit Saudi providers, conduct interviews 2026-03-25+
