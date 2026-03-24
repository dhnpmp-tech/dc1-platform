# DCP is live: GPU compute at Saudi energy prices, Arabic AI ready to serve

We're announcing the public launch of **DC1**, the decentralised GPU compute marketplace built for the Middle East.

Today, an AI researcher in Riyadh pays the same price for compute as someone in Silicon Valley. A startup in Cairo pays AWS rates even though electricity in Saudi Arabia is 3.5–6x cheaper. This is inefficient, unfair, and — more importantly — unnecessary.

We've spent six months building DC1 to fix this. It's a peer-to-peer marketplace that connects GPUs owned by internet cafes, gaming centres, and universities across the Arab world with AI teams and researchers who need affordable compute. No middleman. No cloud vendor lock-in. Just supply meeting demand at the true cost of electricity.

Today, we're live with 43 registered GPU providers and we're onboarding the first renters.

---

## The Problem: Compute is Geographically Priced, but Electricity Isn't

Hyperscalers (AWS, Azure, GCP) use a one-size-fits-all pricing model. An RTX 4090 costs $3.06/hour on AWS, regardless of whether you're in London or Riyadh.

But electricity is dramatically cheaper in Saudi Arabia: **$0.048–0.053 per kWh** versus **$0.18–0.30 in Europe**.

That's a **3.5–6x cost advantage** that never reaches the customer. The margin stays with the cloud provider.

A startup training an AI model on 4x A100s pays **$42,000 per year on AWS**. The same hardware, running on DCP, costs **$25,536 per year**. That's **$16,500 in annual savings** — or a full engineer hire — just by being connected to cheaper power.

For an enterprise running 32x H100s, the savings jump to **$77,512 per year**. That's not rounding error; that's a strategy shift.

And this advantage only exists in the Middle East. Hyperscalers have no incentive to price for local energy costs. DC1 does, because we're built by people in this region, for teams in this region.

---

## Why Now? Why Us?

Three things converged:

**1. Energy arbitrage is finally being operationalized.**

The threadbare economics of crypto mining have proven out the infrastructure: bulk electricity procurement, provider networks, energy hedging. Except now we're moving the GPUs from mining rigs to AI compute, where the real economic value is. The providers, the pipes, and the billing systems all transfer.

**2. MENA's AI adoption is accelerating, but the infrastructure isn't here.**

Saudi Vision 2030 is allocating hundreds of billions to tech and AI. The government is pushing *local* data processing via PDPL (Personal Data Protection Law). Enterprise and government workloads — especially in finance, legal, healthcare, and government — now have a *regulatory requirement* to process data in-kingdom. Hyperscalers can't do this at scale. We're built in-kingdom. Data never leaves.

**3. Arabic LLMs are production-ready.**

ALLaM (from ARAMCO), JAIS, and fine-tuned Llama/Mistral models are now serving real workloads. But there's nowhere to deploy them at a reasonable cost. DC1 runs them natively, with pricing that makes Arabic NLP economically viable.

We're at a moment where all three pieces align: a solved infrastructure problem, regulatory pressure for local compute, and real AI workloads in Arabic. That alignment is rare.

---

## What We Built

DC1 is a marketplace. On one side, GPU owners (internet cafes making $180–350/month per RTX 4090, universities with idle H100s). On the other side, renters (AI teams, ML researchers, startups, enterprises) who need GPU hours.

We handle:
- **Matching:** Finding the right provider for the right job (matching latency requirements, model availability, utilisation)
- **Isolation:** Every job runs in a containerised environment — providers can't see renter code, renters can't break providers
- **Billing & Settlement:** Per-minute GPU usage, automatic invoicing, real-time cost tracking
- **Compliance:** PDPL-native (data stays in-kingdom), no US jurisdiction, no foreign data transfer
- **Templates:** One-click deployment of pre-built stacks (ALLaM, JAIS, BGE embeddings, SDXL, Jupyter, PyTorch, etc.)

Renters pay in SAR, USD, or EUR. Providers get paid weekly. The platform takes a 15% blended fee.

---

## The Proof: Numbers That Should Matter

### Renter Savings

| Use Case | Compute | AWS/Azure Cost/Year | DCP Cost/Year | Savings |
|----------|---------|---------------------|---------------|---------|
| AI Startup | 4x A100 | $42,048 | $25,536 | $16,512 (39% off) |
| ML Team | 8x H100 | $84,096 | $51,072 | $33,024 (39% off) |
| Render Farm | 16x RTX 4090 | $28,032 | $13,824 | $14,208 (51% off) |
| Enterprise | 32x H100 | $168,192 | $90,680 | $77,512 (46% off) |

### Provider Economics (Monthly)

| Hardware | Monthly Revenue | Electricity Cost | Net Margin | Payback Period |
|----------|-----------------|------------------|------------|-----------------|
| RTX 4090 (Internet Cafe) | $180–350 | $25–35 | $145–315 | 3–6 months |
| RTX 4080 (Gaming Center) | $120–250 | $20–30 | $100–220 | 4–8 months |
| H100 (Dedicated Rack) | $1,800–3,500 | $150–250 | $1,650–3,250 | 8–12 months |

A small internet cafe with five RTX 4090s can generate **$900–1,750 per month** in GPU revenue. That's a material business line with zero operational overhead (the daemon just runs).

An H100 in a data center pays for itself in less than a year and then contributes $1,650+/month in pure upside.

---

## The Unfair Advantages

**1. Energy cost pass-through:** 3.5–6x cheaper power translates directly to lower prices.

**2. PDPL compliance:** Saudi government and enterprise workloads have legal reasons to buy from us. Hyperscalers can't compete on compliance.

**3. Local presence:** A startup in Jeddah gets 15–50ms latency to our providers. That matters for interactive workloads.

**4. Fiat-native payments:** No cryptocurrency, no tokens, no vaporware. Just buy GPU hours and pay your invoice.

**5. Arabic AI stack:** We're not just a marketplace; we're a native platform for Arabic NLP. ALLaM, JAIS, BGE-M3, Arabic RAG — these are first-class citizens, not afterthoughts.

---

## How to Get Started

**If you're a renter:**
1. Sign up at https://dcp.sa
2. Get your API key from your dashboard
3. List templates: `curl https://api.dcp.sa/api/templates`
4. Deploy ALLaM-7B: `curl -X POST https://api.dcp.sa/api/templates/allam-7b/deploy`
5. Start querying. Done.

Read the [5-minute API quickstart](https://dcp.sa/docs/api/developer-quickstart) for a full worked example.

**If you're a provider:**
1. Download our daemon (Linux, Windows, macOS)
2. Point it at your GPU(s)
3. Register your hardware
4. Start earning 85% of job revenue

Internet cafes and gaming centers in the KSA, UAE, Egypt, and beyond: we're actively recruiting. A single RTX 4090 can generate $180–350/month with 60% utilisation. A rack of H100s can generate $15,000+/month.

Contact providerops@dcp.sa or visit https://dcp.sa/provider.

---

## What's Next

In the next 90 days:
- **Template expansion:** We're adding vLLM, LPython, and custom container support so you can bring your own models
- **Enterprise tier:** SLA-backed reserved capacity for teams that need guarantees
- **Multi-region:** Expanding provider recruitment to Egypt, UAE, and beyond
- **Arabic RAG-as-a-Service:** A bundled stack (embeddings + reranker + LLM) for enterprise document processing

In six months:
- 5,000+ active GPUs
- $5M+ annual GMV
- 50+ enterprise customers

In 12 months:
- 20,000+ GPUs across MENA
- Series A funding round
- Profitability on platform fees

---

## Why We're Telling You This Now

The traditional VC playbook is: build in stealth, launch with a press release, hope the market notices.

We're doing the opposite. We're launching to early adopters, builders, and providers *first*. HackerNews. Reddit. Discord. Small group chats in Riyadh and Cairo and Dubai.

If you're a researcher, startup, or enterprise team that's been priced out of GPU compute, this is your moment.

If you're running hardware in the Middle East and want a new revenue stream, this is your on-ramp.

If you believe AI compute should be priced by *actual* cost, not by vendor lock-in, join us.

---

## The Bet

We're betting that:
1. Energy arbitrage is a **permanent economic advantage**, not a temporary blip
2. MENA compute demand will **outpace supply** in the next 2–3 years
3. A **community-first marketplace** beats a centralized cloud provider, at least at the edges

Ours is a bet against the premise that compute will always be distributed by three US companies. We think that's wrong, especially in a region with cheap power, strong regulatory moats, and world-class AI talent.

Today we prove it starts here.

---

## Join Us

- **Renter signup:** https://dcp.sa
- **Provider recruitment:** providerops@dcp.sa
- **Community Discord:** https://discord.gg/dcp
- **GitHub:** https://github.com/dc1-network/platform
- **Twitter:** @dccompute

DCP is live. Deploy your first model in 5 minutes. Join a community of builders, providers, and enterprises rethinking compute.

*Running on Saudi energy. Serving Arabic AI.*

---

**Peter Khalili**
Founder, DC1
March 24, 2026
