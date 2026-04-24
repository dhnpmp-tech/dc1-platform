// Batch 1 — public marketing screens
// Pricing tiers, region health, incident log, providers earnings, FAQ
window.DCP_PUBLIC = {

  /* ─── PRICING ──────────────────────────────────────────────── */
  pricing: {
    modes: [
      {
        id: "ondemand",
        label: "Per-second on-demand",
        sub: "Billed by the halala, no minimum. Cancel mid-job.",
        good: ["Spiky workloads", "Batch eval", "Playground / dev"],
      },
      {
        id: "reserved",
        label: "Reserved monthly",
        sub: "Lock a node for 30 / 90 / 365 days. Up to 42% off.",
        good: ["Training runs", "Fine-tunes", "Always-on inference"],
      },
      {
        id: "spot",
        label: "Spot (interruptible)",
        sub: "Bid on idle capacity. Up to 71% off on-demand.",
        good: ["Overnight batches", "Checkpointed jobs"],
      },
    ],
    gpus: [
      { id: "h100-80", name: "H100 SXM · 80GB", ondemand: 22.40, reserved: 13.80, spot: 7.20, usd: 5.97, avail: "RUH · JED" },
      { id: "h100-p",  name: "H100 PCIe · 80GB", ondemand: 20.10, reserved: 12.40, spot: 6.40, usd: 5.36, avail: "JED" },
      { id: "a100-80", name: "A100 · 80GB",      ondemand: 12.80, reserved: 7.90,  spot: 4.10, usd: 3.41, avail: "RUH · DMM" },
      { id: "a100-40", name: "A100 · 40GB",      ondemand:  9.60, reserved: 5.90,  spot: 3.00, usd: 2.56, avail: "DMM" },
      { id: "l40s",    name: "L40S · 48GB",      ondemand:  7.20, reserved: 4.50,  spot: 2.30, usd: 1.92, avail: "RUH" },
      { id: "rtx4090", name: "RTX 4090 · 24GB",  ondemand:  3.40, reserved: 2.10,  spot: 1.10, usd: 0.91, avail: "RUH · JED" },
    ],
    inference: [
      { id: "allam-7b",  name: "ALLaM-7B-Instruct",  arabic:true,  in: 0.40, out: 1.20 },
      { id: "jais-13b",  name: "JAIS-13B-Chat",      arabic:true,  in: 0.80, out: 2.40 },
      { id: "falcon-h1", name: "Falcon-H1-34B",      arabic:true,  in: 1.10, out: 3.30 },
      { id: "qwen-3",    name: "Qwen3-72B",          arabic:false, in: 2.20, out: 6.60 },
      { id: "llama-70",  name: "Llama-3-70B",        arabic:false, in: 1.80, out: 5.40 },
      { id: "bge-m3",    name: "BGE-M3 embeddings",  arabic:true,  in: 0.04, out: 0.00 },
    ],
    addons: [
      { k: "Egress · in-Kingdom", v: "Free" },
      { k: "Egress · out-of-Kingdom", v: "0.02 SAR / GB" },
      { k: "Persistent storage (NVMe)", v: "0.18 SAR / GB-month" },
      { k: "Object storage (S3-compat)", v: "0.08 SAR / GB-month" },
      { k: "Static public IPv4", v: "1.80 SAR / day" },
      { k: "Private networking", v: "Included" },
    ],
    faq: [
      { q: "Why SAR pricing?", a: "Every bill is denominated in SAR — no FX risk, no conversion spread. USD shown as reference; the invoice is always SAR." },
      { q: "What is a halala?", a: "1 SAR = 100 halala. Per-second billing resolves down to the halala, so a 9-second job costs exactly what it costs." },
      { q: "Can I pay in USD?", a: "Enterprise contracts can settle in USD or EUR via wire. Self-serve is SAR only (Moyasar: Mada, Visa, Apple Pay, STC Pay)." },
      { q: "Is data residency guaranteed?", a: "Yes. By default jobs pin to RUH / JED / DMM. Toggle off-Kingdom routing to allow Bahrain fallback during peaks." },
      { q: "What happens to spot jobs on interruption?", a: "You get a 90-second SIGTERM window to checkpoint. Jobs with persistent storage auto-resume on the next available node." },
      { q: "Do you offer training credits?", a: "SDAIA Tuwaiq and Misk Academy graduates receive 500 SAR in credits. Apply with your program ID." },
    ],
  },

  /* ─── STATUS ───────────────────────────────────────────────── */
  status: {
    overall: "operational",      // operational | degraded | outage
    overallLabel: "All systems operational",
    regions: [
      { code: "RUH", name: "Riyadh",  status: "operational", p95: 38, nodes: 184, up: 99.99 },
      { code: "JED", name: "Jeddah",  status: "operational", p95: 44, nodes:  96, up: 99.98 },
      { code: "DMM", name: "Dammam",  status: "operational", p95: 41, nodes:  42, up: 99.97 },
      { code: "BAH", name: "Bahrain", status: "degraded",    p95: 82, nodes:  24, up: 99.81, note: "Elevated latency · failover in progress" },
    ],
    services: [
      { k: "Inference API",        status: "operational", up: 99.99 },
      { k: "Marketplace",          status: "operational", up: 99.98 },
      { k: "Playground",           status: "operational", up: 99.99 },
      { k: "Jobs & batches",       status: "operational", up: 99.96 },
      { k: "Billing · Moyasar",    status: "operational", up: 99.95 },
      { k: "Object storage",       status: "operational", up: 99.99 },
      { k: "Webhooks",             status: "degraded",    up: 99.72, note: "Retries queued · delivery within 15 min" },
      { k: "Status page (this)",   status: "operational", up: 100.0 },
    ],
    // 90 days of 0|1|2 (ok | degraded | outage), newest first
    uptime90: Array.from({length:90},(_,i)=>{
      if (i===3)  return 1;
      if (i===17) return 2;
      if (i===42) return 1;
      if (i===71) return 1;
      return 0;
    }),
    incidents: [
      { id:"i-2026-04-19", date:"19 Apr 2026", dur:"47m", sev:"degraded", region:"BAH", title:"Elevated latency in Bahrain edge",
        updates:[
          { t:"14:22", msg:"Failover to JED in progress. Affected requests routed transparently." },
          { t:"14:07", msg:"Investigating cross-border link saturation to BAH. RUH / JED unaffected." },
        ]},
      { id:"i-2026-03-02", date:"02 Mar 2026", dur:"1h 12m", sev:"outage", region:"JED", title:"Moyasar webhook delivery delayed",
        updates:[
          { t:"09:18", msg:"Resolved. Backlog drained, signatures validated, no lost events." },
          { t:"08:06", msg:"Root cause: upstream TLS rotation at the gateway. Mitigation rolled out." },
        ]},
      { id:"i-2026-01-11", date:"11 Jan 2026", dur:"23m", sev:"degraded", region:"RUH", title:"Cold-start spike on ALLaM-7B",
        updates:[
          { t:"22:48", msg:"Added 14 warm replicas. Queue depth back to baseline." },
        ]},
    ],
  },

  /* ─── PROVIDERS EARNINGS ───────────────────────────────────── */
  providers: {
    ranges: [
      { gpu: "H100 80GB",  hour: 16.80, month: 9800, annual: 117600 },
      { gpu: "A100 80GB",  hour:  9.60, month: 5600, annual:  67200 },
      { gpu: "L40S 48GB",  hour:  5.40, month: 3100, annual:  37200 },
      { gpu: "RTX 4090",   hour:  2.55, month: 1480, annual:  17760 },
    ],
    steps: [
      { n:"01", t:"Register node", d:"Install the DCP agent. ARM, x86, bare-metal, any datacenter. Takes 6 minutes." },
      { n:"02", t:"Attach GPUs",   d:"The agent auto-fingerprints your silicon. H100 to RTX 3090 — we price it." },
      { n:"03", t:"Pass health",   d:"72-hour burn-in: thermals, memory, bandwidth, network stability, Arabic kernel latency." },
      { n:"04", t:"Go live",       d:"Listed in the marketplace. First job inside 48h, monthly payouts via Wathq-verified bank account." },
    ],
    faq: [
      { q: "Who qualifies as a provider?", a: "Any Saudi-registered entity with tamkeen data-center, or an individual with Wathq verification and a business IBAN. Expats: need a registered entity." },
      { q: "How are payouts handled?", a: "Monthly, on the 5th, net of the 18% platform fee. Payouts above 10,000 SAR require Wathq re-verification per SAMA rules." },
      { q: "What's the uptime SLA for providers?", a: "95% rolling 30-day. Below that your node is shadow-listed. Below 90% it's delisted; you get 14 days to remediate." },
      { q: "Can I run my own workloads on my node?", a: "Yes — any node can be 'private mode' so it's only available to your own org. You still pay platform ops (3%) but keep 100% utilization." },
    ],
  },

  /* ─── ABOUT / COMPANY ──────────────────────────────────────── */
  about: {
    story: [
      { year: "2023", t: "Founded in Riyadh", d: "Three engineers from SDAIA and Aramco ship the first DCP prototype on a rack of four 4090s in Olaya." },
      { year: "2024", t: "Public launch",      d: "Marketplace opens with 11 providers, 84 GPUs. First paying customer — an Arabic e-commerce platform — goes live in February." },
      { year: "2025", t: "SAMA & Wathq approval", d: "Escrow licence and KYC integration complete. Moyasar settlement enabled across Mada, Apple Pay, STC Pay." },
      { year: "2026", t: "ALLaM on-platform",  d: "Partnership with SDAIA: ALLaM-7B hosted with guaranteed sub-40ms p95 latency from within the Kingdom." },
    ],
    numbers: [
      { k:"GPUs live",     v:"346" },
      { k:"Providers",     v:"42"  },
      { k:"SAR processed", v:"18.2M" },
      { k:"Uptime · 12mo", v:"99.97%" },
    ],
    team: [
      { name:"Faisal Al-Qahtani", role:"CEO · co-founder", bio:"Ex-SDAIA. Led ALLaM inference infra." },
      { name:"Lina Al-Otaibi",    role:"CTO · co-founder", bio:"Ex-Aramco Edge. 12 years on distributed schedulers." },
      { name:"Khaled Al-Harbi",   role:"Head of Marketplace", bio:"Ex-Careem. Built the Riyadh surge-pricing engine." },
      { name:"Maryam Nasser",     role:"Head of Trust",    bio:"SAMA + Wathq liaison. Runs our compliance bench." },
    ],
    investors: ["Sanabil · PIF", "STV", "Raed Ventures", "Aramco Ventures"],
  },

  /* ─── CONTACT ──────────────────────────────────────────────── */
  contact: {
    office: {
      name: "DCP Technologies",
      street: "King Fahd Road, Olaya Towers, Tower B · 12th floor",
      city: "Riyadh 12333 · Kingdom of Saudi Arabia",
      cr: "CR · 1010987654",
      vat: "VAT · 310012345600003",
    },
    channels: [
      { k:"Sales",    v:"sales@dcp.sa",    sub:"Reply within one business day" },
      { k:"Support",  v:"help@dcp.sa",     sub:"24 / 7 · Arabic & English" },
      { k:"Security", v:"security@dcp.sa", sub:"PGP key fingerprint on request" },
      { k:"Press",    v:"press@dcp.sa",    sub:"Media & analyst enquiries" },
    ],
  },
};
