/* eslint-disable */
/* Providers — "Rent out your GPU" earnings + onboarding page */

const {
  LangCtx, useLang, MagneticButton, Reveal, Badge, Callout, SectionMeta,
  Eyebrow, Breadcrumb, HeroMap, Sparkline,
  Arrow, External, Download, Cpu, Zap, Shield,
  fmt, fmtInt, fmtMoney,
  PageShell,
} = window;

const P = window.DCP_PUBLIC.providers;

/* ═══ HERO ═══════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="pg-hero">
      <div className="hero-bg"><HeroMap/></div>
      <div className="wrap inner">
        <Breadcrumb items={[{label:"DCP", href:"../DCP Redesign.html"},{label:"Providers"}]} />
        <div style={{height:48}}/>
        <Eyebrow>§ providers · earn sar with your gpu</Eyebrow>
        <h1 style={{marginTop:20}}>
          Your GPU<br/>
          has a <em>day job.</em>
        </h1>
        <p className="lead">
          Plug into the Kingdom's GPU marketplace. We take the booking, the billing, the KYC, the SAR payouts.
          You keep the electricity receipt and 82% of every hour billed. The other 18% keeps the lights on.
        </p>
        <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
          <MagneticButton><a className="btn primary" href="#"><Download size={12}/> Download provider app</a></MagneticButton>
          <a className="btn ghost" href="#calc">Estimate earnings <Arrow size={12}/></a>
          <a className="btn" href="#steps">How it works</a>
        </div>

        <div className="big-num">
          <div>
            <div className="k">Top earner · 30d</div>
            <div className="v">104,200<span style={{fontFamily:"var(--mono)", fontSize:14, color:"var(--mut)", marginInlineStart:10}}>SAR</span></div>
            <div className="sub">8× H100 · Aramco-Edge-07 · 96% util</div>
          </div>
          <div>
            <div className="k">Average node · 30d</div>
            <div className="v">6,480<span style={{fontFamily:"var(--mono)", fontSize:14, color:"var(--mut)", marginInlineStart:10}}>SAR</span></div>
            <div className="sub">1× A100 80GB · RUH · 71% util</div>
          </div>
          <div>
            <div className="k">Payout cadence</div>
            <div className="v">Monthly</div>
            <div className="sub">5th of each month · Wathq IBAN · net 18%</div>
          </div>
          <div>
            <div className="k">Active providers</div>
            <div className="v">42</div>
            <div className="sub">24 datacenter · 18 personal</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ EARNINGS TABLE ════════════════════════════════════════ */

function EarningsTable() {
  const { lang } = useLang();
  return (
    <section style={{padding:"110px 0"}}>
      <div className="wrap">
        <SectionMeta idx="§01" label="EARNINGS" right="GROSS · BEFORE 18% PLATFORM FEE" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>
          What a GPU <em>earns</em>, roughly.
        </h2>
        <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          Assumes 70% utilization, on-demand pricing, 24/7 online. Reserved contracts deliver 60% of this but
          predictable. Spot delivers 30% and hands you smoothing.
        </p>
        <Reveal><table className="earn-table">
          <thead>
            <tr>
              <th>GPU</th>
              <th>Per hour online</th>
              <th>Monthly · 70% util</th>
              <th>Annual</th>
            </tr>
          </thead>
          <tbody>
            {P.ranges.map(r => (
              <tr key={r.gpu}>
                <td className="gpu">{r.gpu}</td>
                <td className="num">{fmt(r.hour, lang, {minimumFractionDigits:2})}<span className="u">SAR/HR</span></td>
                <td className="num hi">{fmtInt(r.month, lang)}<span className="u">SAR/MO</span></td>
                <td className="num">{fmtInt(r.annual, lang)}<span className="u">SAR</span></td>
              </tr>
            ))}
          </tbody>
        </table></Reveal>
      </div>
    </section>
  );
}

/* ═══ DEMAND HEATMAP ═════════════════════════════════════════ */

function Demand() {
  const regions = [
    { code:"RUH", city:"Riyadh",  gpu:"H100 / A100",  demand: 94, note:"ALLaM, enterprise", heat:"critical" },
    { code:"JED", city:"Jeddah",  gpu:"Any",          demand: 72, note:"Media pipelines",   heat:"high" },
    { code:"DMM", city:"Dammam",  gpu:"A100 / L40S",  demand: 58, note:"Aramco private",    heat:"medium" },
    { code:"BAH", city:"Bahrain", gpu:"Consumer",     demand: 31, note:"Batch overflow",    heat:"low" },
  ];
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§02" label="WHERE WE NEED YOU" right="UPDATED HOURLY · INSTANT LISTING" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>
          The map of <em>unmet demand.</em>
        </h2>
        <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          Providers in red cells earn a routing bonus this week. Capacity here gets a marketplace pin and first-match preference on reserved contracts.
        </p>
        <Reveal><div className="heat">
          {regions.map(r => (
            <div key={r.code} className="cell">
              <div className="reg">{r.code} · {r.heat.toUpperCase()}</div>
              <div className="city">{r.city}</div>
              <div className="bar-wrap"><div className="bar" style={{width: r.demand+"%"}}/></div>
              <div className="val">
                <span>{r.note}</span>
                <b>{r.demand}% booked</b>
              </div>
            </div>
          ))}
        </div></Reveal>
      </div>
    </section>
  );
}

/* ═══ ONBOARDING STEPS ═══════════════════════════════════════ */

function Steps() {
  return (
    <section id="steps" style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§03" label="ONBOARDING" right="6 MINUTES TO LISTED · 72H TO EARNING" />
        <h2 className="st" style={{marginTop:12, marginBottom:16}}>
          Register, attach, pass, <em>go live.</em>
        </h2>
        <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:"0 0 16px"}}>
          No commercial call. No datacenter walkthrough. You run the agent, we handle the rest — with a 72h burn-in so buyers can trust the listing.
        </p>
        <div className="steps">
          {P.steps.map(s => (
            <Reveal key={s.n}><div className="step-row">
              <div className="n">STEP {s.n}</div>
              <h3 className="t">{s.t}</h3>
              <p className="d">{s.d}</p>
            </div></Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ EARNINGS CALCULATOR ═══════════════════════════════════ */

function Calc() {
  const { lang } = useLang();
  const gpus = [
    { id:"h100",    name:"H100 SXM 80GB", hour: 16.80 },
    { id:"a100-80", name:"A100 80GB",     hour:  9.60 },
    { id:"a100-40", name:"A100 40GB",     hour:  7.20 },
    { id:"l40s",    name:"L40S 48GB",     hour:  5.40 },
    { id:"rtx4090", name:"RTX 4090",      hour:  2.55 },
    { id:"rtx3090", name:"RTX 3090",      hour:  1.60 },
  ];
  const regions = [
    { id:"ruh", name:"Riyadh · RUH",  mult: 1.00 },
    { id:"jed", name:"Jeddah · JED",  mult: 0.92 },
    { id:"dmm", name:"Dammam · DMM",  mult: 0.95 },
    { id:"bah", name:"Bahrain · BAH", mult: 0.80 },
  ];

  const [gpu, setGpu]     = useState("rtx4090");
  const [count, setCount] = useState(1);
  const [util, setUtil]   = useState(62);
  const [hours, setHours] = useState(22);
  const [region, setRegion] = useState("ruh");

  const g = gpus.find(x=>x.id===gpu);
  const r = regions.find(x=>x.id===region);
  const monthly = g.hour * r.mult * count * hours * 30 * (util/100);
  const payout  = monthly * 0.82;
  const fee     = monthly * 0.18;

  return (
    <section id="calc" style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§04" label="CALCULATOR" right="BASED ON YOUR NODE" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>
          Run the <em>numbers</em> on your hardware.
        </h2>
        <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          Payouts are monthly, net of 18%. Spot contracts pay 40% of on-demand, reserved pays 72%. This calculator assumes on-demand.
        </p>

        <div className="earn-calc">
          <div className="earn-inputs">
            <div className="calc-field">
              <label className="lbl">GPU</label>
              <div className="pick">
                {gpus.map(x => (
                  <button key={x.id} className={gpu===x.id?"on":""} onClick={()=>setGpu(x.id)}>{x.name}</button>
                ))}
              </div>
            </div>

            <div className="calc-field">
              <label className="lbl">Count · how many of this GPU</label>
              <input className="slider" type="range" min="1" max="16" value={count} onChange={e=>setCount(+e.target.value)}/>
              <div className="val">{fmtInt(count, lang)} <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--mut)", letterSpacing:".12em"}}>GPUs</span></div>
            </div>

            <div className="calc-field">
              <label className="lbl">Hours online per day</label>
              <input className="slider" type="range" min="4" max="24" value={hours} onChange={e=>setHours(+e.target.value)}/>
              <div className="val">{fmtInt(hours, lang)} <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--mut)", letterSpacing:".12em"}}>H / DAY</span></div>
            </div>

            <div className="calc-field">
              <label className="lbl">Expected utilization · % of online time billed</label>
              <input className="slider" type="range" min="10" max="95" value={util} onChange={e=>setUtil(+e.target.value)}/>
              <div className="val">{fmtInt(util, lang)}<span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--mut)", letterSpacing:".12em", marginInlineStart:4}}>%</span></div>
            </div>

            <div className="calc-field">
              <label className="lbl">Region</label>
              <div className="pick">
                {regions.map(x => (
                  <button key={x.id} className={region===x.id?"on":""} onClick={()=>setRegion(x.id)}>{x.name}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="earn-out">
            <span className="k">Your payout · monthly · net of 18%</span>
            <div className="big">{fmtInt(payout, lang)}<span className="u">SAR</span></div>
            <span className="sub">≈ {fmtInt(payout * 12, lang)} SAR / year</span>

            <div className="breakdown">
              <span className="bk-k">Gross marketplace earnings</span>
              <span className="bk-v">{fmtInt(monthly, lang)} SAR</span>
              <span className="bk-k">Platform fee (18%)</span>
              <span className="bk-v" style={{color:"var(--mut)"}}>− {fmtInt(fee, lang)} SAR</span>
              <span className="bk-k">Base hourly · {g.name}</span>
              <span className="bk-v">{fmt(g.hour, lang, {minimumFractionDigits:2})} SAR</span>
              <span className="bk-k">Region modifier · {r.name.split(" · ")[0]}</span>
              <span className="bk-v">× {fmt(r.mult, lang, {minimumFractionDigits:2})}</span>
            </div>
          </div>
        </div>

        <Callout tone="info" label="NOTE" >
          Earnings shown are indicative. Real payout depends on market demand, your uptime SLA, and whether you've opted into reserved contracts. New providers see 30–50% utilization in the first 90 days as we route traffic onto new nodes.
        </Callout>
      </div>
    </section>
  );
}

/* ═══ PROVIDER APP ═══════════════════════════════════════════ */

function AppCallout() {
  const sparkGpu  = [14, 18, 22, 26, 31, 28, 32, 35, 38, 42, 39, 44];
  const sparkEarn = [48, 52, 58, 62, 70, 78, 75, 82, 91, 98, 104, 112];
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§05" label="THE APP" right="4 MB · WINDOWS · MACOS · LINUX" />
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center", marginTop:16}}>
          <div>
            <h2 className="st" style={{marginTop:0, marginBottom:20}}>
              One binary. <em>Zero config.</em>
            </h2>
            <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.65, margin:"0 0 24px"}}>
              The DCP agent auto-detects your silicon, installs the right engine (Ollama for CUDA, MLX for Apple Silicon),
              pulls models on demand, punches through your NAT via Cloudflare Tunnel, and streams live telemetry
              to your dashboard. No port forwarding. No static IP. No Electron.
            </p>
            <ul style={{listStyle:"none", padding:0, margin:"0 0 32px", color:"var(--ink-2)", fontSize:15, lineHeight:1.9}}>
              <li>· 4 MB installer — one static binary</li>
              <li>· Auto GPU fingerprint · 27 silicon families supported</li>
              <li>· 100–270 tok/s on consumer GPUs (3060 Ti → 5090)</li>
              <li>· Cloudflare Tunnel · no port forwarding, no static IP</li>
              <li>· Live dashboard: temp, util, earnings, job feed</li>
            </ul>
            <div style={{display:"flex", gap:12, flexWrap:"wrap"}}>
              <MagneticButton><a className="btn primary" href="#"><Download size={12}/> Download · Windows</a></MagneticButton>
              <a className="btn ghost" href="#"><Download size={12}/> macOS</a>
              <a className="btn ghost" href="#"><Download size={12}/> Linux</a>
            </div>
          </div>

          <div style={{border:"1px solid var(--line)", background:"var(--bg-2)", padding:28}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
              <span style={{fontFamily:"var(--mono)", fontSize:11, letterSpacing:".14em", color:"var(--mut)"}}>DCP-AGENT · v2.4.1 · RUNNING</span>
              <Badge tone="ok" pulse>ONLINE · 12d</Badge>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20}}>
              <div style={{border:"1px solid var(--hair)", padding:"18px 20px"}}>
                <div style={{fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".14em", color:"var(--mut)", textTransform:"uppercase"}}>GPU temp</div>
                <div style={{fontFamily:"var(--serif)", fontSize:36, color:"var(--ink)", marginTop:8}}>67°</div>
                <Sparkline values={sparkGpu} height={28}/>
              </div>
              <div style={{border:"1px solid var(--hair)", padding:"18px 20px"}}>
                <div style={{fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".14em", color:"var(--mut)", textTransform:"uppercase"}}>Earnings · today</div>
                <div style={{fontFamily:"var(--serif)", fontSize:36, color:"var(--teal)", marginTop:8}}>184<span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--mut)", marginInlineStart:6}}>SAR</span></div>
                <Sparkline values={sparkEarn} height={28} color="var(--orange)"/>
              </div>
            </div>

            <div style={{borderTop:"1px dashed var(--hair)", paddingTop:18}}>
              <div style={{fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".14em", color:"var(--mut)", textTransform:"uppercase", marginBottom:12}}>Live jobs</div>
              {[
                { t:"SERVE · ALLaM-7B",    c:"running", sar:"+0.24/s" },
                { t:"SERVE · BGE-M3",       c:"running", sar:"+0.03/s" },
                { t:"BATCH · Falcon-H1",   c:"queued",  sar:"—" },
              ].map(j => (
                <div key={j.t} style={{display:"flex", justifyContent:"space-between", padding:"10px 0", borderTop:"1px solid var(--hair)", fontFamily:"var(--mono)", fontSize:12}}>
                  <span style={{color:"var(--ink)"}}>{j.t}</span>
                  <span style={{color: j.c==="running" ? "var(--teal)" : "var(--mut)"}}>{j.c} · {j.sar}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ FAQ ═══════════════════════════════════════════════════ */

function FAQ() {
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap" style={{maxWidth:960}}>
        <SectionMeta idx="§06" label="FAQ" right="PROVIDER QUESTIONS" />
        <h2 className="st" style={{marginTop:12, marginBottom:24}}>Before you sign up.</h2>
        <div className="faq">
          {P.faq.map((f, i) => (
            <details key={i} open={i===0}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ CTA ═══════════════════════════════════════════════════ */

function EndCTA() {
  return (
    <section className="end-cta">
      <div className="wrap" style={{textAlign:"center"}}>
        <div className="big">Your GPU, <em>working</em> while you sleep.</div>
        <p className="ss" style={{margin:"32px auto 40px", maxWidth:"56ch"}}>
          You supply the silicon and the electricity. We supply the demand, the billing, the KYC, the SAR.
        </p>
        <div className="ctas">
          <MagneticButton><a className="btn primary lg" href="#"><Download size={14}/> Download provider app</a></MagneticButton>
          <a className="btn ghost lg" href="./Contact.html">Talk to a DC partner lead</a>
        </div>
      </div>
    </section>
  );
}

/* ═══ PAGE ═══════════════════════════════════════════════════ */

function ProvidersPage() {
  return (
    <PageShell active="providers">
      <Hero />
      <EarningsTable />
      <Demand />
      <Steps />
      <Calc />
      <AppCallout />
      <FAQ />
      <EndCTA />
    </PageShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<ProvidersPage />);
