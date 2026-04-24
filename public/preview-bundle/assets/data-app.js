/* eslint-disable */
/* DCP app-side data — current user, orgs, teams, API keys, usage, invoices.
 * Consumed by Auth / Console / Settings. Single source of truth across the app surface.
 */

window.DCP_APP = {

  /* ─── CURRENT USER ─────────────────────────────────────────── */
  user: {
    id: "usr_4Kq9n2mPx",
    name: "Faisal Al-Qahtani",
    email: "faisal@nextwave.sa",
    role: "Owner",
    avatar: "FQ",
    joined: "2024-11-03",
    last_login: "2026-04-21 · 09:14 AST",
    mfa: true,
    phone: "+966 54 •••• 4721",
    national_id_verified: true,   // Nafath
  },

  /* ─── ORGS ────────────────────────────────────────────────── */
  orgs: [
    {
      id: "org_nw",
      name: "NextWave Commerce",
      slug: "nextwave",
      logo: "NW",
      color: "#d9541f",
      cr: "1010987654",
      vat: "310012345600003",
      plan: "Scale",
      region_default: "RUH",
      active: true,
      members: 11,
      monthly_spend: 14820,
    },
    { id:"org_lab", name:"NextWave Labs",   slug:"nw-labs",   logo:"NL", color:"#0d7a6b", plan:"Growth",  members:4, monthly_spend:2140 },
    { id:"org_dev", name:"Personal · Dev",  slug:"faisal-dev", logo:"FD", color:"#1e3a5f", plan:"Free",    members:1, monthly_spend:0 },
  ],

  /* ─── TEAM MEMBERS (current org) ──────────────────────────── */
  team: [
    { id:"usr_4Kq9n2mPx", name:"Faisal Al-Qahtani", email:"faisal@nextwave.sa",  role:"Owner",    avatar:"FQ", last:"2m ago",   status:"active"  },
    { id:"usr_7Pw3d1L",   name:"Lina Al-Otaibi",    email:"lina@nextwave.sa",    role:"Admin",    avatar:"LO", last:"14m ago",  status:"active"  },
    { id:"usr_2Bq8t9X",   name:"Khaled Al-Harbi",   email:"khaled@nextwave.sa",  role:"Developer",avatar:"KH", last:"1h ago",   status:"active"  },
    { id:"usr_9Mx1r5N",   name:"Maryam Nasser",     email:"maryam@nextwave.sa",  role:"Billing",  avatar:"MN", last:"yesterday",status:"active"  },
    { id:"usr_3Cv7j2P",   name:"Omar Al-Ghamdi",    email:"omar@nextwave.sa",    role:"Developer",avatar:"OG", last:"3d ago",   status:"active"  },
    { id:"usr_6Hy4s0T",   name:"Sara Al-Dosari",    email:"sara@nextwave.sa",    role:"Viewer",   avatar:"SD", last:"1w ago",   status:"active"  },
    { id:"usr_8Gz2k6Q",   name:"Abdullah Al-Shehri",email:"abdullah@nextwave.sa",role:"Developer",avatar:"AS", last:"—",        status:"invited" },
    { id:"usr_1Fn5h3W",   name:"Noura Al-Rashed",   email:"noura@nextwave.sa",   role:"Developer",avatar:"NR", last:"—",        status:"invited" },
  ],

  roles: [
    { id:"owner",     name:"Owner",     desc:"Full access, billing, org deletion.",             count:1 },
    { id:"admin",     name:"Admin",     desc:"Manage keys, members, budgets. No org deletion.", count:1 },
    { id:"developer", name:"Developer", desc:"Create keys, call API, read invoices.",           count:3 },
    { id:"billing",   name:"Billing",   desc:"Read-only on usage + invoices. No API access.",   count:1 },
    { id:"viewer",    name:"Viewer",    desc:"Read-only on everything except billing.",         count:1 },
  ],

  /* ─── API KEYS ────────────────────────────────────────────── */
  keys: [
    { id:"key_1", name:"prod-edge-gateway", prefix:"dcp_live_8k2n", created:"2025-11-12", last_used:"2m ago",  scope:["inference:read","inference:write"], env:"production", rate:"10k rpm" },
    { id:"key_2", name:"analytics-batch",   prefix:"dcp_live_q4f1", created:"2026-01-08", last_used:"1h ago",  scope:["inference:read","embeddings"],      env:"production", rate:"1k rpm"  },
    { id:"key_3", name:"staging-qa",        prefix:"dcp_test_p3v9", created:"2026-02-22", last_used:"yesterday", scope:["all"],                            env:"staging",    rate:"100 rpm" },
    { id:"key_4", name:"lina-local-dev",    prefix:"dcp_test_wm7b", created:"2026-03-14", last_used:"6d ago",  scope:["all"],                              env:"staging",    rate:"100 rpm" },
    { id:"key_5", name:"ci-runner",         prefix:"dcp_test_z0a2", created:"2026-04-02", last_used:"—",       scope:["inference:read"],                   env:"staging",    rate:"100 rpm" },
  ],

  /* ─── USAGE SUMMARY ───────────────────────────────────────── */
  usage: {
    month_label: "April 2026",
    tokens_in:   18_420_000,
    tokens_out:   6_180_000,
    requests:      412_800,
    spend_sar:     14_820.66,
    budget_sar:    20_000,
    p95_ms:        42,
    err_rate:       0.14,        // percent
    uptime_30d:    99.98,        // percent
    by_model: [
      { m:"allam-7b",       in: 9_200_000, out: 2_400_000, sar: 6_180.40, share: 41.7 },
      { m:"llama-3.1-70b",  in: 4_800_000, out: 2_100_000, sar: 5_420.18, share: 36.5 },
      { m:"bge-m3",         in: 3_600_000, out:         0, sar: 1_840.00, share: 12.4 },
      { m:"falcon-h1-34b",  in:   820_000, out:  1_680_000, sar: 1_380.08, share:  9.3 },
    ],
    sparkline_30d: [ 412, 438, 461, 487, 502, 498, 476, 512, 548, 571, 604, 612, 588, 542, 519, 546, 582, 610, 648, 691, 728, 702, 684, 719, 753, 781, 798, 812, 796, 824 ],
  },

  /* ─── INVOICES ────────────────────────────────────────────── */
  invoices: [
    { id:"INV-2026-04-APR", period:"April 2026",    amount: 14820.66, vat:2223.10, status:"open",   due:"2026-05-15", url:"#" },
    { id:"INV-2026-03-MAR", period:"March 2026",    amount: 12180.40, vat:1827.06, status:"paid",   paid:"2026-04-11", url:"#" },
    { id:"INV-2026-02-FEB", period:"February 2026", amount:  9840.22, vat:1476.03, status:"paid",   paid:"2026-03-09", url:"#" },
    { id:"INV-2026-01-JAN", period:"January 2026",  amount:  8210.18, vat:1231.53, status:"paid",   paid:"2026-02-08", url:"#" },
    { id:"INV-2025-12-DEC", period:"December 2025", amount:  6480.04, vat: 972.01, status:"paid",   paid:"2026-01-10", url:"#" },
    { id:"INV-2025-11-NOV", period:"November 2025", amount:  5120.88, vat: 768.13, status:"paid",   paid:"2025-12-07", url:"#" },
  ],

  /* ─── PAYMENT METHODS ─────────────────────────────────────── */
  payment_methods: [
    { id:"pm_1", kind:"Mada",      brand:"Mada",     last4:"4432", exp:"09 / 27", holder:"Faisal Al-Qahtani", default:true },
    { id:"pm_2", kind:"Visa",      brand:"Visa",     last4:"1118", exp:"03 / 28", holder:"NextWave Commerce", default:false },
    { id:"pm_3", kind:"STC Pay",   brand:"STC Pay",  last4:"—",    exp:"—",       holder:"+966 54 •••• 4721", default:false },
  ],

  /* ─── RECENT ACTIVITY ─────────────────────────────────────── */
  activity: [
    { t:"2m ago",     who:"prod-edge-gateway",  e:"1,248 inference requests", sev:"ok" },
    { t:"14m ago",    who:"Lina Al-Otaibi",     e:"Rotated key · analytics-batch", sev:"warn" },
    { t:"1h ago",     who:"Khaled Al-Harbi",    e:"Created key · ci-runner",   sev:"ok"  },
    { t:"3h ago",     who:"Billing",            e:"Budget alert: 74% of April cap used", sev:"warn" },
    { t:"yesterday",  who:"Maryam Nasser",      e:"Downloaded invoice INV-2026-03-MAR",  sev:"ok" },
    { t:"yesterday",  who:"prod-edge-gateway",  e:"Rate-limit hit · 12 requests throttled", sev:"err" },
    { t:"2d ago",     who:"Faisal Al-Qahtani",  e:"Invited 2 developers",     sev:"ok"  },
    { t:"3d ago",     who:"System",             e:"Monthly invoice generated · INV-2026-04-APR", sev:"ok" },
  ],

  /* ─── QUICKSTART / ONBOARDING CHECKLIST ───────────────────── */
  onboarding: [
    { id:"kyc",     t:"Verify identity · Nafath",       done:true,  hint:"Saudi National ID · 30 seconds" },
    { id:"org",     t:"Create organisation",            done:true,  hint:"CR + VAT · required for billing" },
    { id:"key",     t:"Generate your first API key",    done:true,  hint:"Scoped · staging by default" },
    { id:"call",    t:"Make your first API call",       done:true,  hint:"412,800 this month — nice work" },
    { id:"pay",     t:"Add a payment method",           done:true,  hint:"Mada · •••• 4432" },
    { id:"team",    t:"Invite your team",               done:false, hint:"2 seats used of 10 on Scale plan" },
    { id:"budget",  t:"Set a spending budget",          done:false, hint:"Get alerts at 50 / 75 / 90%" },
    { id:"webhook", t:"Configure a webhook endpoint",   done:false, hint:"Usage alerts + incident pings" },
  ],

};
