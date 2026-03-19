# Discord & Telegram Provider Outreach Templates

*DCP — Saudi Arabia's First GPU Compute Marketplace*
*Target communities: GPU owners, gaming communities, tech expats in KSA, mining groups, AI/ML communities*

---

## Template 1 — Short Intro (Discord / Telegram, English)

**For:** General tech Discord servers, expat communities in KSA, GPU enthusiasts

---

Hey everyone 👋

Quick question — does anyone here have an NVIDIA GPU sitting idle when they're not gaming or working?

I've been using **DCP** (dcp.sa) to earn SAR from my RTX 3090 while I sleep. It's Saudi Arabia's first GPU marketplace for AI compute — they pay you for running machine learning jobs on your hardware.

**How it works:**
- Register your GPU at dcp.sa/provider/register
- Run a lightweight background daemon
- Earn 75% of job revenue, paid weekly to your Saudi bank account via IBAN

My RTX 3090 makes ~150 SAR/day on 12 hours of idle time. No crypto, just SAR.

Happy to answer questions if anyone's curious 🙂

---

## Template 2 — Detailed Technical Post (Discord #general or #hardware)

**For:** Tech-savvy audiences, hardware enthusiasts, developers

---

**[Resource] Monetize your idle NVIDIA GPU in Saudi Arabia**

If you have an NVIDIA card with 8GB+ VRAM, you can now earn SAR from AI compute jobs while your machine is idle — through **DCP** (dcp.sa), Saudi Arabia's first decentralized GPU marketplace.

**What they're paying (provider rates, you keep 75%):**
```
RTX 3080  →  ~81 SAR/day  (12hr idle)
RTX 3090  →  ~150 SAR/day (12hr idle)
RTX 4090  →  ~200 SAR/day (12hr idle)
A100      →  ~675 SAR/day (12hr idle)
```

**Tech stack:**
- Python daemon (`dc1_daemon.py`) runs in the background
- Jobs execute inside Docker + NVIDIA Container Toolkit (fully isolated)
- Heartbeat every 30s, auto-reconnect if you lose internet
- No root access required for renters — pure GPU compute isolation

**Setup (Linux):**
```bash
curl -fsSL https://dcp.sa/api/providers/download/daemon?key=YOUR_KEY \
  -o dc1_daemon.py && python3 dc1_daemon.py
```

Weekly SAR payouts via IBAN. Founding provider rates locked until public scale.

Sign up: **dcp.sa/provider/register**

---

## Template 3 — Minimal / Low-Pressure (Telegram groups)

**For:** Quiet Telegram groups, professional networks, conservative outreach

---

Sharing something that might be useful for GPU owners in KSA:

**DCP** (dcp.sa) pays Saudi Riyals for AI compute jobs on idle NVIDIA hardware. RTX 3090 owners typically earn 100–200 SAR/day during off hours.

Setup is ~10 minutes. Weekly IBAN payout. Fully isolated Docker execution.

More info: dcp.sa/provider/register

---

## Template 4 — Gaming Community Post (Discord #off-topic)

**For:** Gaming Discords where members have high-end GPUs

---

Gamers with RTX cards — your GPU could be earning while you're at school/work/sleeping 💰

**DCP** (Saudi GPU marketplace) pays you to run AI jobs on your NVIDIA card when you're not gaming. Your GPU stays yours, the jobs run in a sandboxed container.

RTX 4090? ~200 SAR/day of passive income on idle hours. RTX 3090? ~150 SAR/day.

Payout in SAR to your Saudi bank — no crypto. Takes 10 min to set up.

→ dcp.sa/provider/register

---

## Template 5 — Arabic (Mixed Communities)

**For:** Arabic-language Telegram groups, Saudi tech communities

---

أصحاب بطاقات NVIDIA الرسومية في السعودية 🇸🇦

منصة DCP (dcp.sa) تدفع لكم ريالات سعودية مقابل تشغيل مهام ذكاء اصطناعي على بطاقتكم وقت ما تكون خاملة.

RTX 3090 = ~150 ريال يومياً
RTX 4090 = ~200 ريال يومياً

دفع أسبوعي لحسابكم البنكي عبر IBAN. بدون عملات رقمية.

التسجيل: dcp.sa/provider/register

---

## Posting Guidelines

### Channels to target
- Discord: #hardware, #tech-chat, #passive-income, #off-topic, #jobs-and-gigs
- Telegram: GPU mining groups (post-crypto downturn, many have idle rigs), Saudi tech groups, KAUST/KFUPM student groups, expat professionals
- Reddit (r/saudiarabia, r/GPUmining): template 2 works well for technical subs

### Engagement tips
- Always respond to questions within 2 hours if possible
- Don't over-post in the same server — once per channel is enough
- Use template 1 or 3 for cold outreach, template 2 for technical channels
- Mention specific GPU models to spark interest from hardware owners
- Never make income guarantees — always frame as estimates based on utilization

### DM follow-up template
> Hey [name], saw you have a [GPU model] — happy to help you get set up on DCP if you want. Takes about 10 minutes. The setup guide is at dcp.sa/docs/provider-guide

### Tracking
- Use UTM params on links for campaign tracking: `dcp.sa/provider/register?utm_source=discord&utm_campaign=provider-q1-2026`
- Track signups by asking new providers where they heard about DCP
