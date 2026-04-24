/* data-renter.js — mock data for renter gap pages */
window.DCP_RENTER = (() => {
  const liveJobs = [
    { id:"j_live_ac81", model:"ALLaM-7B", rig:"riyadh-studio-01", provider:"Yazeed Q.", status:"streaming", tokens:1482, elapsed:12.4, est:28, sarHold:0.38, sarActual:0.18, region:"Riyadh" },
    { id:"j_live_ac7c", model:"JAIS-13B", rig:"jeddah-gold-02",   provider:"Noura A.",  status:"queued",    tokens:0,    elapsed:0,    est:120, sarHold:1.40, sarActual:0,   region:"Jeddah" },
    { id:"j_live_ac7a", model:"BGE-M3",   rig:"riyadh-bench-04",  provider:"Faisal T.", status:"streaming", tokens:64,   elapsed:0.8,  est:3,   sarHold:0.02, sarActual:0.01, region:"Riyadh" },
    { id:"j_live_ac78", model:"Falcon-H1",rig:"dammam-rig-11",    provider:"Omar H.",   status:"streaming", tokens:824,  elapsed:48.2, est:92,  sarHold:0.92, sarActual:0.48, region:"Dammam" },
  ];

  const wallet = {
    sar:  { balance: 2184.52, holds: 2.72, currency:"SAR" },
    usdc: { balance: 1250.00, address:"0x7Fe3…A2F1", chain:"Base L2" },
    autoTopup: { enabled:true, threshold:500, amount:2000 },
  };

  const transactions = [
    { t:"2m ago",  kind:"debit",  amt:-0.18, note:"j_live_ac81 · ALLaM-7B · settled", mode:"SAR" },
    { t:"12m ago", kind:"debit",  amt:-1.92, note:"j_ac7f · JAIS-13B · settled",      mode:"SAR" },
    { t:"2h ago",  kind:"debit",  amt:-14.20,note:"Batch b_2847 · 62 jobs · settled", mode:"SAR" },
    { t:"1d ago",  kind:"credit", amt:500,   note:"Auto top-up · card •• 4192",       mode:"SAR" },
    { t:"3d ago",  kind:"debit",  amt:-82.40,note:"Daily settlement · Dec 01",        mode:"SAR" },
    { t:"1w ago",  kind:"credit", amt:2000,  note:"Top-up · bank transfer",            mode:"SAR" },
    { t:"2w ago",  kind:"credit", amt:1000,  note:"USDC deposit · 0x7Fe3…",            mode:"USDC" },
  ];

  // Comparison matrix
  const gpus = [
    { id:"4090",   name:"RTX 4090",        vram:24,  tok_allam:268, tok_jais:164, tok_falcon:192, sar_hr:46, region:"Riyadh · Jeddah", avail:"82 online", best:"Hi-tok chat" },
    { id:"4080",   name:"RTX 4080",        vram:16,  tok_allam:212, tok_jais:128, tok_falcon:148, sar_hr:38, region:"Riyadh · Jeddah · Dammam", avail:"148 online", best:"Balanced mix" },
    { id:"m3max",  name:"M3 Max · 64 GB",  vram:64,  tok_allam:184, tok_jais:112, tok_falcon:132, sar_hr:32, region:"Riyadh", avail:"28 online", best:"Long context" },
    { id:"3090",   name:"RTX 3090",        vram:24,  tok_allam:148, tok_jais:88,  tok_falcon:104, sar_hr:28, region:"Riyadh · Jeddah · Dammam", avail:"104 online", best:"Cheapest VRAM" },
    { id:"3060ti", name:"RTX 3060 Ti",     vram:8,   tok_allam:120, tok_jais:0,   tok_falcon:72,  sar_hr:22, region:"All regions", avail:"312 online", best:"Tight budget" },
  ];

  // 30 days spend
  const dailySpend = Array.from({length:30}, (_,i)=>{
    const base = 58 + Math.sin(i/4)*22 + (i>20?28:0);
    const j = (i*7%11)-4;
    return { date:`Nov ${String(((i+1)%30)||30).padStart(2,"0")}`, sar: Math.round((base+j)*100)/100, jobs: 180+((i*5)%80) };
  });

  const costByModel = [
    { model:"ALLaM-7B",    sar: 1420, share:58, jobs:14820 },
    { model:"JAIS-13B",    sar: 624,  share:25, jobs: 1284 },
    { model:"BGE-M3",      sar:  120, share: 5, jobs:48200 },
    { model:"Falcon-H1",   sar:  182, share: 7, jobs: 2140 },
    { model:"SDXL",        sar:  110, share: 5, jobs:  412 },
  ];

  return { liveJobs, wallet, transactions, gpus, dailySpend, costByModel };
})();
