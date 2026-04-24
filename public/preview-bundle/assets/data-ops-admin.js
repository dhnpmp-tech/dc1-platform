/* eslint-disable */
/* DCP Ops (Admin) data — internal operator console
 * Consumed by: ops/*.html — fleet map, overview, jobs monitor, KYB queue,
 * customers, models admin, billing/payouts, incidents, compliance, pricing,
 * audit, feature flags, on-call, tickets.
 *
 * NOT consumer-facing. English only.
 *
 * Naming:
 *  rig     = provider's physical GPU machine
 *  node    = logical worker on a rig (usually 1:1 with GPU)
 *  slot    = active or queued job assignment on a node
 *  KYB     = Know-Your-Business verification (CR + VAT + IBAN)
 *  peg     = SAR/USD fixed rate used for stablecoin settlement (3.751)
 */

window.DCP_OPS_ADMIN = {

  /* ─── Header / quick facts ─── */
  now: "2026-04-23T14:22:00+03:00",
  on_call: { name: "Ammar Al-Sayegh", handle: "@ammar", phone: "+966 55 204 88xx", since: "14:00 AST" },
  env: "production",
  fleet_version: "v2.4.11",
  build: "ab1e0f6",

  /* ═══════════════════════════════════════════════════════════
   * FLEET — geographic + aggregate
   * 5 regions, ~487 providers, ~1120 rigs, ~1840 GPUs
   * ═══════════════════════════════════════════════════════════ */
  regions: [
    // coords: relative on a 1000x800 viewBox of stylized Saudi outline
    // numbers are internally consistent (providers × avg_rigs ≈ rigs)
    { id:"ruh", name:"Riyadh",   code:"RUH", x:540, y:410,
      providers:186, rigs:438, gpus:712, online:691, util:0.71,
      tps:154_200, p50:16, p95:31, jobs_active:2384, jobs_queued:42,
      sar_per_hour:8420, flag:null,
      pop:"Riyadh DC-1" },
    { id:"jed", name:"Jeddah",   code:"JED", x:286, y:528,
      providers:124, rigs:276, gpus:468, online:449, util:0.68,
      tps:94_800, p50:17, p95:34, jobs_active:1521, jobs_queued:28,
      sar_per_hour:5108, flag:null,
      pop:"Jeddah DC-1" },
    { id:"dmm", name:"Dammam",   code:"DMM", x:692, y:344,
      providers:94,  rigs:221, gpus:372, online:358, util:0.62,
      tps:70_100, p50:18, p95:38, jobs_active:1084, jobs_queued:19,
      sar_per_hour:3840, flag:null,
      pop:"Dammam DC-1" },
    { id:"med", name:"Madinah",  code:"MED", x:344, y:388,
      providers:51,  rigs:118, gpus:186, online:174, util:0.57,
      tps:33_500, p50:19, p95:41, jobs_active:512,  jobs_queued:8,
      sar_per_hour:1820, flag:null,
      pop:"Madinah DC-1" },
    { id:"abh", name:"Abha",     code:"ABH", x:332, y:658,
      providers:18,  rigs:42,  gpus:68,  online:62,  util:0.48,
      tps:11_400, p50:22, p95:48, jobs_active:176,  jobs_queued:3,
      sar_per_hour:612, flag:"capacity-tight",
      pop:"Abha DC-1 (beta)" },
    { id:"neom",name:"NEOM",     code:"NEOM",x:180, y:242,
      providers:14,  rigs:38,  gpus:44,  online:38,  util:0.31,
      tps:5_900,  p50:18, p95:35, jobs_active:52,   jobs_queued:1,
      sar_per_hour:318, flag:"new",
      pop:"NEOM Oxagon DC (pilot)" },
  ],

  /* Active routing lines — for the fleet map live layer.
   * from/to are region ids. weight 1..5. jobs in flight. */
  flows: [
    { from:"ruh", to:"jed",  weight:4, jobs:128 },
    { from:"jed", to:"ruh",  weight:3, jobs:92  },
    { from:"dmm", to:"ruh",  weight:5, jobs:214 },
    { from:"ruh", to:"dmm",  weight:2, jobs:58  },
    { from:"med", to:"ruh",  weight:2, jobs:41  },
    { from:"abh", to:"jed",  weight:1, jobs:18  },
    { from:"neom",to:"jed",  weight:1, jobs:12  },
    { from:"jed", to:"dmm",  weight:2, jobs:46  },
  ],

  /* ═══════════════════════════════════════════════════════════
   * OVERVIEW — topline KPIs
   * ═══════════════════════════════════════════════════════════ */
  topline: {
    gmv_today_sar: 187_420,   // gross marketplace volume today
    gmv_today_delta: +0.082,   // +8.2% vs avg
    net_today_sar:   46_855,   // platform take (25%)
    net_today_delta: +0.071,
    jobs_24h: 1_284_612,
    jobs_24h_delta: +0.033,
    p50_global_ms: 17.4,
    p95_global_ms: 34.8,
    err_rate: 0.0042,          // 0.42%
    error_budget_used: 0.38,   // 38% of monthly budget burned
    providers_total: 487,
    providers_online: 453,
    gpus_total: 1850,
    gpus_online: 1772,
    gpus_utilization: 0.66,
    payout_pending_sar: 892_140,
    payout_cycle_ends_in_h: 37,
    tokens_per_sec: 369_900,   // aggregate
    active_incidents: 1,
    sar_usd_peg: 3.751,
  },

  /* 24h revenue series — 24 hourly bins, in SAR */
  revenue_24h: [
    6120, 4840, 3720, 2980, 3140, 4210, 6390, 8840, 10420, 12180, 13860, 14120,
    14560, 15210, 14880, 13420, 11940, 10210, 8940, 7890, 6840, 6120, 5680, 5240,
  ],
  /* 24h p50 latency — ms */
  latency_24h: [
    16.2, 15.8, 15.6, 15.4, 15.6, 16.1, 16.8, 17.4, 17.9, 18.2, 18.4, 18.1,
    17.9, 17.6, 17.4, 17.2, 17.4, 17.6, 17.8, 17.6, 17.2, 16.9, 16.6, 16.4,
  ],

  /* ═══════════════════════════════════════════════════════════
   * JOBS MONITOR — live platform-wide stream
   * Anomalies flagged: slow, router_retry, hold_overrun, content_policy,
   * pdpl_residency, settlement_mismatch
   * ═══════════════════════════════════════════════════════════ */
  jobs_stream: [
    { id:"j_b2f0e9c1", ts:"14:22:04", customer:"nextwave.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-1042", tokens_in:864, tokens_out:1320,
      latency_ms:17, cost_sar:0.018, status:"ok" },
    { id:"j_b2f0e9c0", ts:"14:22:04", customer:"mozn.ai", model:"jais-13b",
      region:"jed", provider:"PRV-0881", tokens_in:2240, tokens_out:3840,
      latency_ms:28, cost_sar:0.089, status:"ok" },
    { id:"j_b2f0e9bf", ts:"14:22:03", customer:"stc.com.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-1042", tokens_in:180, tokens_out:420,
      latency_ms:12, cost_sar:0.005, status:"ok" },
    { id:"j_b2f0e9be", ts:"14:22:03", customer:"thiqa.gov.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-0992", tokens_in:1140, tokens_out:2180,
      latency_ms:41, cost_sar:0.031, status:"slow",
      anomaly:"p95 latency 41ms > 34ms threshold" },
    { id:"j_b2f0e9bd", ts:"14:22:02", customer:"elm.sa", model:"falcon-h1",
      region:"dmm", provider:"PRV-0612", tokens_in:820, tokens_out:0,
      latency_ms:null, cost_sar:0.012, status:"retry",
      anomaly:"provider timeout — rerouted to PRV-0614" },
    { id:"j_b2f0e9bc", ts:"14:22:02", customer:"jahez.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-1042", tokens_in:320, tokens_out:680,
      latency_ms:15, cost_sar:0.009, status:"ok" },
    { id:"j_b2f0e9bb", ts:"14:22:01", customer:"lean.com.sa", model:"jais-13b",
      region:"jed", provider:"PRV-0881", tokens_in:4840, tokens_out:8120,
      latency_ms:62, cost_sar:0.189, status:"hold_overrun",
      anomaly:"actual 0.189 SAR vs 0.120 SAR hold — +57% overrun" },
    { id:"j_b2f0e9ba", ts:"14:22:01", customer:"foodics.com", model:"allam-7b",
      region:"ruh", provider:"PRV-1044", tokens_in:210, tokens_out:540,
      latency_ms:14, cost_sar:0.007, status:"ok" },
    { id:"j_b2f0e9b9", ts:"14:22:00", customer:"rewaa.com", model:"bge-m3",
      region:"jed", provider:"PRV-0884", tokens_in:12800, tokens_out:0,
      latency_ms:9, cost_sar:0.014, status:"ok" },
    { id:"j_b2f0e9b8", ts:"14:22:00", customer:"salla.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-1042", tokens_in:640, tokens_out:1140,
      latency_ms:16, cost_sar:0.014, status:"ok" },
    { id:"j_b2f0e9b7", ts:"14:21:59", customer:"anon-0492", model:"sdxl-turbo",
      region:"dmm", provider:"PRV-0612", tokens_in:0, tokens_out:0,
      latency_ms:null, cost_sar:0.000, status:"blocked",
      anomaly:"prompt flagged by content policy — violent imagery" },
    { id:"j_b2f0e9b6", ts:"14:21:59", customer:"riyadhair.com", model:"allam-7b",
      region:"ruh", provider:"PRV-1044", tokens_in:180, tokens_out:380,
      latency_ms:13, cost_sar:0.005, status:"ok" },
    { id:"j_b2f0e9b5", ts:"14:21:58", customer:"seha.gov.sa", model:"allam-7b",
      region:"ruh", provider:"PRV-0992", tokens_in:740, tokens_out:1620,
      latency_ms:19, cost_sar:0.021, status:"pdpl_hold",
      anomaly:"health-adjacent data — held for PDPL review" },
  ],

  /* Anomaly counters, last hour */
  anomalies_1h: {
    slow: 142, retry: 84, hold_overrun: 38, blocked: 6, pdpl_hold: 3, settlement_mismatch: 0,
  },

  /* ═══════════════════════════════════════════════════════════
   * PROVIDERS — KYB queue + directory
   * ═══════════════════════════════════════════════════════════ */
  kyb_queue: [
    { id:"PRV-1104", legal_name:"Arjuman Technical Services Co.", cr:"1010498221",
      vat:"311028849400003", iban_tail:"9204", contact:"Faisal Al-Arjuman",
      phone:"+966 56 229 10xx", region:"Riyadh", rigs:3, gpus:6,
      model:"RTX 4090 × 6", submitted:"2026-04-22 09:14",
      status:"review", flags:["fresh-cr"],
      docs:{ cr:"ok", vat:"ok", iban:"ok", id:"ok" } },
    { id:"PRV-1103", legal_name:"Hail Cloud Services", cr:"3700294881",
      vat:"315042118700003", iban_tail:"0412", contact:"Sultan Al-Dosari",
      phone:"+966 55 804 12xx", region:"Hail", rigs:2, gpus:4,
      model:"RTX 3090 × 4", submitted:"2026-04-22 11:48",
      status:"review", flags:["new-region"],
      docs:{ cr:"ok", vat:"ok", iban:"pending", id:"ok" } },
    { id:"PRV-1102", legal_name:"Qassim Compute Cooperative", cr:"1128844210",
      vat:"311801992300003", iban_tail:"7748", contact:"Bader Al-Otaibi",
      phone:"+966 50 919 44xx", region:"Qassim", rigs:5, gpus:10,
      model:"H100 × 4, RTX 5090 × 6", submitted:"2026-04-21 16:32",
      status:"hold", flags:["datacenter-not-verified","ownership-entity-shared-with-suspended"],
      docs:{ cr:"ok", vat:"ok", iban:"ok", id:"ok" } },
    { id:"PRV-1101", legal_name:"Edge NEOM Holdings", cr:"7012994411",
      vat:"319884220100003", iban_tail:"2110", contact:"Reem Al-Qahtani",
      phone:"+966 57 108 22xx", region:"NEOM", rigs:8, gpus:16,
      model:"H100 × 16", submitted:"2026-04-21 08:12",
      status:"approved-pending-onboarding",
      flags:[], docs:{ cr:"ok", vat:"ok", iban:"ok", id:"ok" } },
    { id:"PRV-1100", legal_name:"AlKharj Distributed Compute", cr:"1022114499",
      vat:"310444119200003", iban_tail:"3392", contact:"Naif Al-Shehri",
      phone:"+966 54 411 08xx", region:"Riyadh", rigs:1, gpus:2,
      model:"RTX 4080 × 2", submitted:"2026-04-20 15:04",
      status:"rejected", flags:["iban-mismatch"],
      docs:{ cr:"ok", vat:"ok", iban:"mismatch", id:"ok" } },
  ],
  kyb_counters: { review: 7, hold: 2, approved_24h: 4, rejected_24h: 1, avg_review_h: 6.2 },

  provider_directory: [
    { id:"PRV-1042", name:"Al-Saedi Data Services", region:"ruh", rigs:18, gpus:32, online:31,
      kyb:"ok", tier:"A", rel:0.996, tps:58400, sar_24h:4820,
      owner:"Khalid Al-Saedi", joined:"2024-11" },
    { id:"PRV-0992", name:"Riyadh Sovereign Compute", region:"ruh", rigs:14, gpus:26, online:26,
      kyb:"ok", tier:"A", rel:0.998, tps:48210, sar_24h:3980,
      owner:"Majed Al-Harbi", joined:"2024-09" },
    { id:"PRV-0881", name:"Red Sea Edge LLC", region:"jed", rigs:9, gpus:18, online:17,
      kyb:"ok", tier:"A", rel:0.991, tps:31020, sar_24h:2640,
      owner:"Lina Fakieh", joined:"2025-01" },
    { id:"PRV-0612", name:"Dammam Compute Hub", region:"dmm", rigs:11, gpus:20, online:19,
      kyb:"ok", tier:"B", rel:0.982, tps:28440, sar_24h:2180,
      owner:"Omar Al-Zahrani", joined:"2024-08" },
    { id:"PRV-1044", name:"Kingdom GPU Partners", region:"ruh", rigs:7, gpus:14, online:14,
      kyb:"ok", tier:"B", rel:0.989, tps:22180, sar_24h:1780,
      owner:"Hessa Al-Shammari", joined:"2025-02" },
    { id:"PRV-0884", name:"Jeddah Inference Co.", region:"jed", rigs:5, gpus:10, online:9,
      kyb:"ok", tier:"B", rel:0.978, tps:15680, sar_24h:1240,
      owner:"Tariq Kurdi", joined:"2025-03" },
    { id:"PRV-0491", name:"NEOM Edge Pilot", region:"neom", rigs:3, gpus:6, online:5,
      kyb:"ok", tier:"C", rel:0.962, tps:8240, sar_24h:680,
      owner:"Faris Al-Rashid", joined:"2025-12" },
    { id:"PRV-0210", name:"Abha Cold-Region Compute", region:"abh", rigs:4, gpus:8, online:7,
      kyb:"ok", tier:"C", rel:0.958, tps:6840, sar_24h:540,
      owner:"Nasser Al-Qahtani", joined:"2025-06" },
  ],

  /* ═══════════════════════════════════════════════════════════
   * CUSTOMERS — enterprise accounts
   * ═══════════════════════════════════════════════════════════ */
  customers: [
    { id:"CX-0001", name:"NextWave Commerce", domain:"nextwave.sa",
      plan:"Scale", seats:11, joined:"2024-07",
      mtd_sar: 48_210, spend_90d: 132_480, p50:16.2, jobs_30d: 1_840_220,
      primary_region:"ruh", status:"healthy", account_manager:"Leen H.",
      contract:"annual · SAR 480k committed · 14% overage",
      compliance:"PDPL-attested · ksa-only-routing",
      notes:"Key customer — ALLaM-7B heavy user. +42% MoM." },
    { id:"CX-0002", name:"Mozn AI", domain:"mozn.ai",
      plan:"Scale", seats:28, joined:"2024-03",
      mtd_sar: 64_840, spend_90d: 188_120, p50:18.1, jobs_30d: 820_410,
      primary_region:"jed", status:"healthy", account_manager:"Leen H.",
      contract:"annual · SAR 600k committed · 10% overage",
      compliance:"PDPL-attested",
      notes:"Mix of ALLaM and JAIS. Bursty — 3× on Thursdays." },
    { id:"CX-0003", name:"STC (Solutions by stc)", domain:"stc.com.sa",
      plan:"Enterprise+", seats:52, joined:"2024-01",
      mtd_sar: 184_220, spend_90d: 492_180, p50:17.4, jobs_30d: 4_120_840,
      primary_region:"ruh", status:"healthy", account_manager:"Yousef R.",
      contract:"multi-year · SAR 2.1M committed · custom SLA (99.95%)",
      compliance:"PDPL + CST telco review signed",
      notes:"Anchor customer. Runs customer support chatbots on ALLaM." },
    { id:"CX-0004", name:"Seha Virtual Hospital", domain:"seha.gov.sa",
      plan:"Sovereign", seats:18, joined:"2025-02",
      mtd_sar: 36_840, spend_90d: 94_120, p50:19.2, jobs_30d: 284_120,
      primary_region:"ruh", status:"watch", account_manager:"Yousef R.",
      contract:"annual · SAR 240k committed · MoH security review",
      compliance:"PDPL + MoH HIPAA-equivalent · in-Kingdom-only",
      notes:"PDPL-held jobs at 2.1% — investigate categoriser." },
    { id:"CX-0005", name:"Thiqa (NDC)", domain:"thiqa.gov.sa",
      plan:"Sovereign", seats:32, joined:"2025-04",
      mtd_sar: 58_420, spend_90d: 142_280, p50:18.8, jobs_30d: 412_840,
      primary_region:"ruh", status:"healthy", account_manager:"Yousef R.",
      contract:"annual · SAR 420k committed",
      compliance:"PDPL + NDMO Class-2 clearance",
      notes:"" },
    { id:"CX-0006", name:"Elm", domain:"elm.sa",
      plan:"Enterprise", seats:24, joined:"2024-06",
      mtd_sar: 41_280, spend_90d: 112_820, p50:17.9, jobs_30d: 684_120,
      primary_region:"dmm", status:"healthy", account_manager:"Leen H.",
      contract:"annual · SAR 320k committed",
      compliance:"PDPL-attested",
      notes:"" },
    { id:"CX-0007", name:"Jahez", domain:"jahez.sa",
      plan:"Growth", seats:6, joined:"2025-08",
      mtd_sar: 14_220, spend_90d: 38_240, p50:16.1, jobs_30d: 182_440,
      primary_region:"ruh", status:"healthy", account_manager:"self-serve",
      contract:"month-to-month · SAR 12k/mo avg",
      compliance:"PDPL-attested",
      notes:"" },
    { id:"CX-0008", name:"Lean Technologies", domain:"lean.com.sa",
      plan:"Growth", seats:9, joined:"2025-05",
      mtd_sar: 22_840, spend_90d: 62_140, p50:19.4, jobs_30d: 94_220,
      primary_region:"jed", status:"at-risk", account_manager:"Leen H.",
      contract:"month-to-month · SAR 18k/mo avg",
      compliance:"PDPL-attested · SAMA sandbox acknowledgement",
      notes:"Hold overruns 4.2% — pricing model mismatch; reach out." },
  ],
  customer_counters: { total: 214, healthy: 182, watch: 24, at_risk: 8, mtd_gmv: 1_642_840 },

  /* ═══════════════════════════════════════════════════════════
   * MODELS ADMIN — catalog, approvals, per-model pricing
   * ═══════════════════════════════════════════════════════════ */
  models_admin: [
    { id:"allam-7b", name:"ALLaM · 7B · Instruct", vendor:"SDAIA", status:"ga",
      visibility:"public", approval_date:"2025-09-01",
      price_in:3.20, price_out:9.60, margin:0.25,
      jobs_30d: 2_840_120, sar_30d: 182_480,
      deployed_on:["ruh","jed","dmm","med"],
      policy:"pdpl-ok, content-filter-on, red-team-signed" },
    { id:"allam-34b", name:"ALLaM · 34B · Instruct", vendor:"SDAIA", status:"ga",
      visibility:"public", approval_date:"2025-11-14",
      price_in:12.80, price_out:38.40, margin:0.25,
      jobs_30d: 684_220, sar_30d: 142_120,
      deployed_on:["ruh","jed"],
      policy:"pdpl-ok, content-filter-on, red-team-signed" },
    { id:"jais-13b", name:"JAIS · 13B · Chat", vendor:"G42", status:"ga",
      visibility:"public", approval_date:"2025-06-22",
      price_in:5.60, price_out:16.80, margin:0.25,
      jobs_30d: 412_880, sar_30d: 82_440,
      deployed_on:["ruh","jed","dmm"],
      policy:"pdpl-ok, content-filter-on" },
    { id:"falcon-h1", name:"Falcon · H1 · 40B", vendor:"TII", status:"ga",
      visibility:"public", approval_date:"2025-04-08",
      price_in:7.20, price_out:21.60, margin:0.25,
      jobs_30d: 184_220, sar_30d: 48_120,
      deployed_on:["ruh","jed"],
      policy:"content-filter-on" },
    { id:"sdxl-turbo", name:"SDXL · Turbo", vendor:"Stability", status:"ga",
      visibility:"public", approval_date:"2025-05-14",
      price_in:null, price_out:null, price_per_image:0.28, margin:0.25,
      jobs_30d: 184_440, sar_30d: 51_640,
      deployed_on:["ruh","dmm"],
      policy:"nsfw-filter-on, content-filter-on, red-team-signed" },
    { id:"bge-m3", name:"BGE · M3 (embeddings)", vendor:"BAAI", status:"ga",
      visibility:"public", approval_date:"2025-03-18",
      price_in:0.80, price_out:null, margin:0.30,
      jobs_30d: 1_284_120, sar_30d: 42_180,
      deployed_on:["ruh","jed","dmm","med"],
      policy:"pdpl-ok" },
    { id:"controlnet-canny", name:"ControlNet · Canny", vendor:"Stability", status:"beta",
      visibility:"allow-list", approval_date:"2026-03-04",
      price_per_image:0.42, margin:0.25,
      jobs_30d: 18_420, sar_30d: 6_840,
      deployed_on:["ruh"],
      policy:"content-filter-on" },
    { id:"deepseek-v3", name:"DeepSeek · V3", vendor:"DeepSeek", status:"pending",
      visibility:"internal", approval_date:null,
      price_in:null, price_out:null, margin:0.25,
      jobs_30d: 0, sar_30d: 0,
      deployed_on:[],
      policy:"security-review-pending (origin · CN)" },
  ],
  model_queue: [
    { id:"qwen2-72b-ar", vendor:"Alibaba × SRCA fork", tags:["arabic","long-context"],
      submitted:"2026-04-20", blocker:"Awaiting SDAIA clearance" },
    { id:"allam-70b", vendor:"SDAIA", tags:["arabic","frontier"],
      submitted:"2026-04-18", blocker:"Red-team pass 2 of 3" },
    { id:"whisper-ar", vendor:"OpenAI × community", tags:["speech","arabic"],
      submitted:"2026-04-15", blocker:"PDPL content-residency review" },
  ],

  /* ═══════════════════════════════════════════════════════════
   * BILLING & PAYOUTS — provider reconciliation
   * ═══════════════════════════════════════════════════════════ */
  payout_cycle: {
    period: "2026-04-16 → 2026-04-30",
    ends_in_h: 37,
    total_pending_sar: 892_140,
    providers_included: 478,
    disputes_open: 4,
    next_release: "2026-05-02 09:00 AST (banking day +1)",
  },
  payouts: [
    { id:"PO-20260430-1042", provider:"PRV-1042", name:"Al-Saedi Data Services",
      gross_sar: 18_420, fees: 1_460, net_sar: 16_960, iban_tail:"7384",
      jobs: 48_220, status:"approved" },
    { id:"PO-20260430-0992", provider:"PRV-0992", name:"Riyadh Sovereign Compute",
      gross_sar: 15_280, fees: 1_210, net_sar: 14_070, iban_tail:"2211",
      jobs: 41_180, status:"approved" },
    { id:"PO-20260430-0881", provider:"PRV-0881", name:"Red Sea Edge LLC",
      gross_sar: 11_840, fees: 940, net_sar: 10_900, iban_tail:"9044",
      jobs: 32_080, status:"approved" },
    { id:"PO-20260430-0612", provider:"PRV-0612", name:"Dammam Compute Hub",
      gross_sar: 9_880, fees: 780, net_sar: 9_100, iban_tail:"4128",
      jobs: 28_440, status:"review", flag:"hold-overrun-share > 4%" },
    { id:"PO-20260430-1044", provider:"PRV-1044", name:"Kingdom GPU Partners",
      gross_sar: 8_640, fees: 680, net_sar: 7_960, iban_tail:"0912",
      jobs: 22_180, status:"approved" },
    { id:"PO-20260430-0884", provider:"PRV-0884", name:"Jeddah Inference Co.",
      gross_sar: 6_120, fees: 480, net_sar: 5_640, iban_tail:"6640",
      jobs: 15_680, status:"approved" },
    { id:"PO-20260430-0491", provider:"PRV-0491", name:"NEOM Edge Pilot",
      gross_sar: 2_840, fees: 220, net_sar: 2_620, iban_tail:"1820",
      jobs: 8_240, status:"review", flag:"new-provider-first-payout" },
    { id:"PO-20260430-0210", provider:"PRV-0210", name:"Abha Cold-Region Compute",
      gross_sar: 2_180, fees: 170, net_sar: 2_010, iban_tail:"3344",
      jobs: 6_840, status:"dispute", flag:"settlement mismatch — 184 jobs" },
  ],
  payout_totals_90d: [
    // 6 cycles, 15 days each
    { cycle:"Feb 01", total: 712_440 },
    { cycle:"Feb 16", total: 748_210 },
    { cycle:"Mar 01", total: 781_420 },
    { cycle:"Mar 16", total: 812_140 },
    { cycle:"Apr 01", total: 848_220 },
    { cycle:"Apr 16", total: 892_140 },
  ],

  /* ═══════════════════════════════════════════════════════════
   * INCIDENTS — status page editor / postmortems
   * ═══════════════════════════════════════════════════════════ */
  incidents: [
    { id:"INC-2026-0418", severity:"minor",
      title:"Elevated p95 latency in Dammam (18 min)",
      status:"investigating", started:"2026-04-23 13:44 AST",
      affects:["dmm"], impact:"~3% of Dammam jobs saw p95 latency 48–62ms",
      commander:"Ammar Al-Sayegh",
      updates:[
        { at:"14:08 AST", note:"Routing weight for DMM reduced to 0.6; overflow to RUH." },
        { at:"13:52 AST", note:"Investigating — suspected top-of-rack switch on PRV-0612 bank." },
        { at:"13:44 AST", note:"Detected — alerts firing." },
      ],
    },
    { id:"INC-2026-0417", severity:"major",
      title:"Scheduled maintenance — Jeddah DC-1 UPS swap",
      status:"scheduled", started:"2026-04-25 02:00 AST",
      affects:["jed"], impact:"Brief routing pause 02:00–02:30 AST. Failover to RUH pre-warmed.",
      commander:"Ops on-call",
      updates:[
        { at:"2026-04-20 10:00", note:"Maintenance window published to customers via status page." },
      ],
    },
    { id:"INC-2026-0416", severity:"minor",
      title:"OAuth token rotation — ALLaM weight bucket",
      status:"resolved", started:"2026-04-22 08:14 AST", resolved:"2026-04-22 08:41 AST",
      affects:["ruh","jed","dmm","med"], impact:"27 min · 0.3% job start failures during rotation",
      commander:"Reem Al-Qahtani",
      updates:[
        { at:"08:41 AST", note:"Resolved. Token cache warmed across all regions." },
        { at:"08:22 AST", note:"Mitigation: reverted to previous token set; new rotation re-queued with staggered start." },
        { at:"08:14 AST", note:"Detected — 0.3% job-start 503s reported." },
      ],
    },
  ],

  /* ═══════════════════════════════════════════════════════════
   * COMPLIANCE — PDPL reviews, content flags
   * ═══════════════════════════════════════════════════════════ */
  compliance_queue: [
    { id:"CMP-0442", kind:"pdpl-residency", customer:"seha.gov.sa",
      summary:"Health records data surfaced in prompt — held for PDPL review. Job j_b2f0e9b5.",
      raised:"2026-04-23 14:18", sla_h:4, state:"in-review", reviewer:"Hala N." },
    { id:"CMP-0441", kind:"content-policy", customer:"anon-0492",
      summary:"SDXL prompt violating content policy — blocked. No data retained.",
      raised:"2026-04-23 14:02", sla_h:72, state:"auto-closed", reviewer:"system" },
    { id:"CMP-0440", kind:"data-request", customer:"elm.sa",
      summary:"Customer exercised PDPL data export right — 30-day window.",
      raised:"2026-04-23 09:44", sla_h:720, state:"in-progress", reviewer:"Hala N." },
    { id:"CMP-0439", kind:"right-to-delete", customer:"self-serve-1042",
      summary:"Account deletion request — data tombstone scheduled for D+30.",
      raised:"2026-04-22 16:20", sla_h:720, state:"scheduled", reviewer:"Hala N." },
    { id:"CMP-0438", kind:"red-team", customer:"internal",
      summary:"Quarterly red-team for ALLaM-7B — prompt injection eval.",
      raised:"2026-04-22 10:00", sla_h:168, state:"in-progress", reviewer:"Omar K." },
  ],
  compliance_counters: { open:12, sla_risk:2, closed_30d:84 },

  /* ═══════════════════════════════════════════════════════════
   * PRICING CONTROL — rate cards, margin, peg
   * ═══════════════════════════════════════════════════════════ */
  pricing: {
    peg_sar_usd: 3.751,
    peg_drift_bps: 6,      // 0.06% — well within ±10bps tolerance
    peg_updated_at: "2026-04-23 14:10 AST",
    platform_take: 0.25,   // 25% · 75% provider
    rate_cards: [
      { model:"allam-7b",  in:3.20,  out:9.60,  provider_share:0.75,
        last_changed:"2025-09-01", next_review:"2026-05-01", delta_30d:0 },
      { model:"allam-34b", in:12.80, out:38.40, provider_share:0.75,
        last_changed:"2025-11-14", next_review:"2026-05-14", delta_30d:0 },
      { model:"jais-13b",  in:5.60,  out:16.80, provider_share:0.75,
        last_changed:"2025-06-22", next_review:"2026-06-22", delta_30d:0 },
      { model:"falcon-h1", in:7.20,  out:21.60, provider_share:0.75,
        last_changed:"2025-04-08", next_review:"2026-04-08", delta_30d:-0.04 },
      { model:"bge-m3",    in:0.80,  out:null,  provider_share:0.70,
        last_changed:"2025-03-18", next_review:"2026-06-18", delta_30d:0 },
      { model:"sdxl-turbo",per_image:0.28,       provider_share:0.75,
        last_changed:"2025-05-14", next_review:"2026-05-14", delta_30d:0 },
    ],
  },

  /* ═══════════════════════════════════════════════════════════
   * AUDIT LOG — admin actions, internal
   * ═══════════════════════════════════════════════════════════ */
  audit: [
    { at:"14:21:12", actor:"ammar@dcp.sa", action:"incident.update",
      target:"INC-2026-0418", note:"Routing weight for DMM reduced to 0.6" },
    { at:"14:18:42", actor:"hala@dcp.sa", action:"compliance.open",
      target:"CMP-0442", note:"PDPL-residency review opened for seha.gov.sa" },
    { at:"13:58:04", actor:"leen@dcp.sa", action:"customer.contract.update",
      target:"CX-0003", note:"STC: overage rate lowered from 12% to 10%" },
    { at:"13:44:02", actor:"system", action:"alert.fire",
      target:"dmm.p95", note:"p95 latency 48ms > 34ms threshold for 3m" },
    { at:"13:22:18", actor:"yousef@dcp.sa", action:"provider.kyb.approve",
      target:"PRV-1101", note:"Edge NEOM Holdings — KYB approved" },
    { at:"12:14:08", actor:"omar@dcp.sa", action:"model.pricing.update",
      target:"falcon-h1", note:"Price cut from SAR 7.50 → SAR 7.20 / 1M in" },
    { at:"11:02:40", actor:"reem@dcp.sa", action:"flag.enable",
      target:"allam-34b.public", note:"Rolled out 34B to public for 100% of Scale tier" },
    { at:"10:14:22", actor:"ammar@dcp.sa", action:"oncall.handoff",
      target:"rotation", note:"Shift handed from rahaf → ammar" },
    { at:"09:44:18", actor:"hala@dcp.sa", action:"compliance.open",
      target:"CMP-0440", note:"PDPL data-export request from elm.sa" },
    { at:"09:12:04", actor:"leen@dcp.sa", action:"customer.note",
      target:"CX-0008", note:"Lean — hold overrun investigation" },
    { at:"08:41:28", actor:"reem@dcp.sa", action:"incident.resolve",
      target:"INC-2026-0416", note:"OAuth rotation resolved" },
    { at:"08:22:04", actor:"reem@dcp.sa", action:"incident.mitigate",
      target:"INC-2026-0416", note:"Reverted token set; re-queued rotation" },
    { at:"08:14:12", actor:"system", action:"alert.fire",
      target:"job.start.503", note:"0.3% start failures — ALLaM weight bucket" },
    { at:"07:04:08", actor:"faisal@dcp.sa", action:"pricing.peg.update",
      target:"sar-usd", note:"Peg refreshed: 3.7512 → 3.7510 (−0.5bp)" },
  ],

  /* ═══════════════════════════════════════════════════════════
   * FEATURE FLAGS — experiments, rollouts
   * ═══════════════════════════════════════════════════════════ */
  flags: [
    { key:"router.use-latency-aware-v2",  rollout:1.00, state:"ga",
      targets:"all", owner:"Ammar", changed:"2026-03-04",
      desc:"Second-gen router prefers p50 over static tier." },
    { key:"console.arabic-ui",             rollout:1.00, state:"ga",
      targets:"all", owner:"Reem",  changed:"2026-02-12",
      desc:"Arabic locale + RTL for renter + provider consoles." },
    { key:"billing.usdc-base-l2",          rollout:1.00, state:"ga",
      targets:"all", owner:"Omar",  changed:"2026-01-18",
      desc:"Accept USDC on Base L2 for top-ups (≈2s finality)." },
    { key:"pricing.dynamic-surcharge",     rollout:0.25, state:"canary",
      targets:"CX-0001, CX-0002, CX-0007", owner:"Leen", changed:"2026-04-12",
      desc:"Demand-shaping surcharge up to 12% during peak RUH load." },
    { key:"models.deepseek-v3",            rollout:0.00, state:"internal-only",
      targets:"dcp-internal", owner:"Omar", changed:"2026-04-21",
      desc:"Allow internal eval only. Origin (CN) pending security review." },
    { key:"provider.mlx-engine-v3",        rollout:0.50, state:"canary",
      targets:"JED + RUH · opt-in", owner:"Ammar", changed:"2026-04-18",
      desc:"New MLX bindings with 14% better token/s on M3 Ultra." },
    { key:"compliance.auto-pdpl-classifier",rollout:1.00, state:"ga",
      targets:"all", owner:"Hala", changed:"2025-12-04",
      desc:"Auto-classify prompts for PDPL-hold before routing." },
    { key:"console.vision.preview",        rollout:0.10, state:"canary",
      targets:"NextWave + Mozn", owner:"Reem", changed:"2026-04-02",
      desc:"Multimodal playground — image inputs on ALLaM-34B." },
  ],

  /* ═══════════════════════════════════════════════════════════
   * ON-CALL rotation
   * ═══════════════════════════════════════════════════════════ */
  oncall: {
    rotation: [
      { shift:"Now · 14:00 → 22:00 AST",    primary:"Ammar Al-Sayegh", secondary:"Reem Al-Qahtani", pager:"+966 55 204 88xx", active:true },
      { shift:"22:00 → 06:00 AST",          primary:"Omar Khalifa",     secondary:"Ammar Al-Sayegh", pager:"+966 50 114 02xx" },
      { shift:"06:00 → 14:00 AST (Apr 24)", primary:"Rahaf Al-Yami",    secondary:"Omar Khalifa",    pager:"+966 54 811 20xx" },
      { shift:"14:00 → 22:00 AST (Apr 24)", primary:"Yousef Rashed",    secondary:"Rahaf Al-Yami",   pager:"+966 56 402 18xx" },
      { shift:"22:00 → 06:00 AST (Apr 25)", primary:"Leen Habibi",      secondary:"Yousef Rashed",   pager:"+966 53 220 44xx" },
    ],
    handoffs_30d: 92,
    mttr_30d_min: 14,
    pages_24h: 4,
    incidents_7d: 6,
  },

  /* ═══════════════════════════════════════════════════════════
   * TICKETS — support queue
   * ═══════════════════════════════════════════════════════════ */
  tickets: [
    { id:"TK-9482", subj:"Can we get SAML SSO for our account?", customer:"stc.com.sa",
      priority:"high", assignee:"Yousef R.", state:"in-progress", opened:"12h ago",
      last_reply:"30 min ago", tags:["sso","enterprise"] },
    { id:"TK-9481", subj:"Hold overrun on our jais-13b workload", customer:"lean.com.sa",
      priority:"high", assignee:"Leen H.", state:"awaiting-customer", opened:"1d ago",
      last_reply:"2h ago", tags:["billing","overrun"] },
    { id:"TK-9480", subj:"Arabic playground showing English fallbacks", customer:"mozn.ai",
      priority:"normal", assignee:"Reem Q.", state:"in-progress", opened:"2d ago",
      last_reply:"4h ago", tags:["i18n","console"] },
    { id:"TK-9479", subj:"Can we pin workloads to Riyadh only?", customer:"seha.gov.sa",
      priority:"high", assignee:"Yousef R.", state:"in-progress", opened:"3d ago",
      last_reply:"1d ago", tags:["routing","sovereign"] },
    { id:"TK-9478", subj:"API key rotation webhook isn't firing", customer:"nextwave.sa",
      priority:"normal", assignee:"Omar K.", state:"in-progress", opened:"3d ago",
      last_reply:"6h ago", tags:["api","webhooks"] },
    { id:"TK-9477", subj:"Request: increase rate limit to 10k rpm", customer:"jahez.sa",
      priority:"normal", assignee:"self-serve", state:"new", opened:"4d ago",
      last_reply:"—", tags:["rate-limit"] },
    { id:"TK-9476", subj:"Invoice discrepancy for March", customer:"elm.sa",
      priority:"normal", assignee:"Omar K.", state:"awaiting-customer", opened:"5d ago",
      last_reply:"1d ago", tags:["billing","invoice"] },
    { id:"TK-9475", subj:"Feature request: Python async SDK", customer:"rewaa.com",
      priority:"low", assignee:"Reem Q.", state:"backlog", opened:"8d ago",
      last_reply:"3d ago", tags:["sdk","feature-req"] },
  ],
  ticket_counters: { open:34, high:6, awaiting_customer:12, closed_7d:48, avg_first_response_h:1.8 },

  /* ═══════════════════════════════════════════════════════════
   * ADMIN TEAM
   * ═══════════════════════════════════════════════════════════ */
  admins: [
    { email:"ammar@dcp.sa",  name:"Ammar Al-Sayegh",  role:"SRE / on-call",       added:"2024-04" },
    { email:"reem@dcp.sa",   name:"Reem Al-Qahtani",  role:"Platform eng",        added:"2024-02" },
    { email:"omar@dcp.sa",   name:"Omar Khalifa",     role:"Platform eng",        added:"2024-05" },
    { email:"hala@dcp.sa",   name:"Hala Nashmi",      role:"Compliance",          added:"2024-03" },
    { email:"leen@dcp.sa",   name:"Leen Habibi",      role:"Customer success",    added:"2024-07" },
    { email:"yousef@dcp.sa", name:"Yousef Rashed",    role:"Enterprise",          added:"2024-06" },
    { email:"rahaf@dcp.sa",  name:"Rahaf Al-Yami",    role:"SRE",                 added:"2024-09" },
    { email:"faisal@dcp.sa", name:"Faisal Al-Qadi",   role:"CFO / pricing",       added:"2024-01" },
  ],
};
