/* data-provider.js — mock data for provider surface */
window.DCP_PROVIDER = (() => {
  const provider = {
    name: "Yazeed Al-Qahtani",
    handle: "riyadh-studio-01",
    email: "yazeed@example.sa",
    avatar: "Y",
    joined: "2024-08-14",
    tier: "Silver",
    trust: 92,
    payoutMode: "sar",
    iban: "SA03 •••• •••• •••• 2847",
  };

  const rigs = [
    { id:"rig-01", name:"studio-main", gpu:"RTX 4090", vram:24, engine:"Ollama", os:"Ubuntu 22.04", status:"earning", util:78, temp:62, rate:46, uptime:"23d 14h", jobs:1284, health:"healthy" },
    { id:"rig-02", name:"studio-bench", gpu:"RTX 4080", vram:16, engine:"Ollama", os:"Ubuntu 22.04", status:"earning", util:54, temp:58, rate:38, uptime:"18d 02h", jobs:842, health:"healthy" },
    { id:"rig-03", name:"office-mac",   gpu:"M3 Max 64GB", vram:64, engine:"MLX", os:"macOS 14.5", status:"idle", util:4, temp:42, rate:32, uptime:"9d 22h", jobs:318, health:"healthy" },
    { id:"rig-04", name:"garage-3090",  gpu:"RTX 3090", vram:24, engine:"Ollama", os:"Ubuntu 20.04", status:"paused", util:0, temp:38, rate:28, uptime:"0h", jobs:2104, health:"maintenance" },
  ];

  // 30 days of earnings
  const earnDaily = Array.from({length:30}, (_,i)=>{
    const d = new Date(); d.setDate(d.getDate() - (29-i));
    const base = 180 + Math.sin(i/3)*40 + (i>20?60:0);
    const jitter = (i*7 % 13) - 6;
    return { date: d.toISOString().slice(0,10), sar: Math.round(base + jitter), jobs: 40 + (i*3 % 22), hours: 18 + (i % 6) };
  });

  const totals = {
    today: 218, yesterday: 194, week: 1424, month: 5826, lifetime: 42180,
    jobsToday: 63, jobsMonth: 1862,
    utilAvg: 71,
  };

  const jobHistory = [
    { id:"j_ac81", rig:"rig-01", model:"ALLaM-7B", renter:"NextWave Commerce", tokens:412, sec:38, sar:0.34, status:"settled", t:"2m ago" },
    { id:"j_ac7f", rig:"rig-02", model:"JAIS-13B", renter:"Musbah Legal",      tokens:1824, sec:212, sar:1.92, status:"settled", t:"6m ago" },
    { id:"j_ac7e", rig:"rig-01", model:"ALLaM-7B", renter:"Qira'a Learning",   tokens:208, sec:19, sar:0.18, status:"settled", t:"8m ago" },
    { id:"j_ac7c", rig:"rig-01", model:"BGE-M3",   renter:"NextWave Commerce", tokens:64, sec:3, sar:0.02, status:"settled", t:"11m ago" },
    { id:"j_ac7a", rig:"rig-02", model:"ALLaM-7B", renter:"Haya Therapy",      tokens:928, sec:102, sar:0.91, status:"settled", t:"14m ago" },
    { id:"j_ac78", rig:"rig-03", model:"Falcon-H1",renter:"Najdi Heritage",    tokens:2104, sec:288, sar:2.48, status:"settled", t:"18m ago" },
    { id:"j_ac76", rig:"rig-01", model:"ALLaM-7B", renter:"NextWave Commerce", tokens:512, sec:46, sar:0.41, status:"settled", t:"22m ago" },
    { id:"j_ac74", rig:"rig-02", model:"JAIS-13B", renter:"Musbah Legal",      tokens:624, sec:74, sar:0.66, status:"failed",  t:"26m ago" },
    { id:"j_ac72", rig:"rig-01", model:"ALLaM-7B", renter:"Qira'a Learning",   tokens:288, sec:24, sar:0.24, status:"settled", t:"29m ago" },
  ];

  const models = [
    { id:"allam-7b",  name:"ALLaM-7B",    size:"4.2 GB", enabled:true,  jobs30d:1842, earnings30d:3120, tok:"180 t/s", rate:"SAR 0.22/1k" },
    { id:"jais-13b",  name:"JAIS-13B",    size:"7.8 GB", enabled:true,  jobs30d:428,  earnings30d:1180, tok:"110 t/s", rate:"SAR 0.38/1k" },
    { id:"bge-m3",    name:"BGE-M3",      size:"1.1 GB", enabled:true,  jobs30d:2104, earnings30d:412,  tok:"—",       rate:"SAR 0.02/1k" },
    { id:"falcon-h1", name:"Falcon-H1",   size:"5.6 GB", enabled:true,  jobs30d:284,  earnings30d:820,  tok:"140 t/s", rate:"SAR 0.28/1k" },
    { id:"llama-3-8b",name:"Llama-3-8B",  size:"4.7 GB", enabled:false, jobs30d:0,    earnings30d:0,    tok:"—",       rate:"SAR 0.18/1k" },
    { id:"sdxl",      name:"SDXL",        size:"6.9 GB", enabled:false, jobs30d:0,    earnings30d:0,    tok:"—",       rate:"SAR 0.14/img" },
  ];

  const payouts = [
    { id:"po-2024-11-w4", period:"Nov 25 – Dec 01", sar:1482, mode:"SAR", status:"paid",    date:"2024-12-02" },
    { id:"po-2024-11-w3", period:"Nov 18 – Nov 24", sar:1284, mode:"SAR", status:"paid",    date:"2024-11-25" },
    { id:"po-2024-11-w2", period:"Nov 11 – Nov 17", sar:1164, mode:"SAR", status:"paid",    date:"2024-11-18" },
    { id:"po-2024-11-w1", period:"Nov 04 – Nov 10", sar:982,  mode:"SAR", status:"paid",    date:"2024-11-11" },
    { id:"po-2024-10-w4", period:"Oct 28 – Nov 03", sar:914,  mode:"SAR", status:"paid",    date:"2024-11-04" },
    { id:"po-pending",    period:"Dec 02 – Dec 08", sar:428,  mode:"SAR", status:"accruing",date:"—" },
  ];

  const reviews = [
    { renter:"NextWave Commerce", stars:5, t:"2d ago", msg:"Consistently low latency for ALLaM. Never seen a timeout." },
    { renter:"Musbah Legal",      stars:5, t:"4d ago", msg:"Great for long JAIS-13B contexts. Settled exactly to the second." },
    { renter:"Haya Therapy",      stars:4, t:"1w ago", msg:"One cold-start timeout at 3am, otherwise solid." },
    { renter:"Qira'a Learning",   stars:5, t:"1w ago", msg:"Fast, stable, and the rig doesn't blink on traffic spikes." },
  ];

  const tiers = [
    { name:"Bronze", jobs:0,    cut:70, perks:["Public marketplace","SAR weekly payouts"] },
    { name:"Silver", jobs:50,   cut:75, perks:["Priority routing","USDC option","+5% cut"] },
    { name:"Gold",   jobs:500,  cut:78, perks:["Dedicated account manager","Enterprise SLA jobs","+3% cut"] },
    { name:"Platinum",jobs:2500,cut:82, perks:["Featured placement","Co-marketing","Custom contracts","+4% cut"] },
  ];

  return { provider, rigs, earnDaily, totals, jobHistory, models, payouts, reviews, tiers };
})();
