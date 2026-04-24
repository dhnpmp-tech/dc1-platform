/* eslint-disable */
/* Pricing — SAR-first pricing page with mode switcher + calculator */

const {
  LangCtx, useLang, Nav, Footer, Marquee, Brand, LangToggle,
  MagneticButton, Reveal, Badge, Callout, SectionMeta, Eyebrow, Breadcrumb,
  Arrow, External, Copy, Check,
  fmt, fmtInt, fmtMoney,
  PageShell,
} = window;

const P = window.DCP_PUBLIC.pricing;

/* (PageShell now lives in _shell.jsx) */

/* ═══ HERO ═══════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="pg-hero">
      <div className="wrap">
        <Breadcrumb items={[{label:"DCP", href:"../DCP Redesign.html"},{label:"Pricing"}]} />
        <div style={{height:48}}/>
        <Eyebrow>§ pricing · priced in SAR</Eyebrow>
        <h1 style={{marginTop:20}}>
          Priced by the halala.<br/>
          Billed <em>in seconds.</em>
        </h1>
        <p className="lead">
          GPU compute in three shapes — on-demand per-second, reserved monthly, or spot. Every price in SAR,
          every invoice in SAR. USD shown as a reference only; the money that leaves your account
          never touches an FX desk.
        </p>
        <div style={{display:"flex", gap:12, marginTop:36, flexWrap:"wrap"}}>
          <MagneticButton><a className="btn primary" href="#calc">Calculate my cost <Arrow size={12}/></a></MagneticButton>
          <a className="btn ghost" href="#rates">Jump to rate card</a>
          <a className="btn" href="./Contact.html">Enterprise pricing <Arrow size={12}/></a>
        </div>
      </div>
    </section>
  );
}

/* ═══ MODE TABS ══════════════════════════════════════════════ */

function Modes({ mode, setMode }) {
  return (
    <div className="mode-tabs">
      {P.modes.map(m => (
        <button key={m.id} className={mode===m.id?"on":""} onClick={()=>setMode(m.id)}>
          <span className="m-label">{m.id === "ondemand" ? "§01 · on-demand" : m.id === "reserved" ? "§02 · reserved" : "§03 · spot"}</span>
          <span className="m-title">{m.label}</span>
          <span className="m-sub">{m.sub}</span>
          <span className="m-good">good for — {m.good.join(" · ")}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══ RATE CARD ══════════════════════════════════════════════ */

function RateCard({ mode }) {
  const { lang } = useLang();
  return (
    <div className="price-grid">
      <div className="hd">GPU</div>
      <div className="hd hd-ondemand" style={{textAlign:"end"}}>SAR / hour · on-demand</div>
      <div className="hd hd-reserved" style={{textAlign:"end"}}>SAR / hour · reserved</div>
      <div className="hd hd-spot"     style={{textAlign:"end"}}>SAR / hour · spot</div>
      <div className="hd" style={{textAlign:"end"}}>Regions</div>

      {P.gpus.map(g => (
        <React.Fragment key={g.id}>
          <div className="cell gpu">
            <b>{g.name}</b>
            <span>USD {fmt(g.usd, lang, {minimumFractionDigits:2})} / hr · reference</span>
          </div>
          <div className={"cell num c-ondemand"+(mode==="ondemand"?" active-col":"")}>
            <span><b className={mode!=="ondemand"?"dim":""}>{fmt(g.ondemand, lang, {minimumFractionDigits:2})}</b><span className="u">SAR</span></span>
          </div>
          <div className={"cell num c-reserved"+(mode==="reserved"?" active-col":"")}>
            <span><b className={mode!=="reserved"?"dim":""}>{fmt(g.reserved, lang, {minimumFractionDigits:2})}</b><span className="u">SAR</span></span>
          </div>
          <div className={"cell num c-spot"+(mode==="spot"?" active-col":"")}>
            <span><b className={mode!=="spot"?"dim":""}>{fmt(g.spot, lang, {minimumFractionDigits:2})}</b><span className="u">SAR</span></span>
          </div>
          <div className="cell num">
            <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--ink-2)"}}>{g.avail}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ═══ INFERENCE API TABLE ════════════════════════════════════ */

function InferenceTable() {
  const { lang } = useLang();
  return (
    <div className="inf-wrap">
      <table className="inf-table">
        <thead>
          <tr>
            <th>Model</th>
            <th style={{textAlign:"end"}}>Input · SAR / 1M tok</th>
            <th style={{textAlign:"end"}}>Output · SAR / 1M tok</th>
          </tr>
        </thead>
        <tbody>
          {P.inference.map(m => (
            <tr key={m.id}>
              <td className="mname">
                <b>{m.name}</b>
                {m.arabic ? <span className="ar-chip">ع · AR</span> : null}
              </td>
              <td style={{textAlign:"end"}}>
                <span className="per">{fmt(m.in, lang, {minimumFractionDigits:2})}<span className="u">SAR</span></span>
              </td>
              <td style={{textAlign:"end"}}>
                {m.out === 0
                  ? <span className="per" style={{color:"var(--mut)"}}>—</span>
                  : <span className="per">{fmt(m.out, lang, {minimumFractionDigits:2})}<span className="u">SAR</span></span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ CALCULATOR ═════════════════════════════════════════════ */

function Calculator() {
  const { lang } = useLang();
  const [gpu, setGpu]   = useState("h100-80");
  const [mode, setMode] = useState("ondemand");
  const [hours, setHours] = useState(16);     // per day
  const [days, setDays]   = useState(30);     // per month
  const [util, setUtil]   = useState(70);     // % utilization (only for reserved)

  const row = P.gpus.find(g => g.id === gpu);
  const rate = row ? row[mode] : 0;
  const effectiveHours = mode === "reserved" ? 24 * days : hours * days * (util/100);
  const total = rate * effectiveHours;

  return (
    <section id="calc" style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§02" label="CALCULATOR" right="LIVE · based on current rate card" />
        <h2 className="st" style={{marginTop:12, marginBottom:16}}>What it <em>actually</em> costs.</h2>
        <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          Pick a GPU, a mode, and the hours you'd really run. We'll show the monthly SAR bill — including
          partial-second billing that rolls into halala.
        </p>

        <div className="calc">
          <div className="calc-inputs">

            <div className="calc-field">
              <label className="lbl">GPU</label>
              <select className="select" value={gpu} onChange={e=>setGpu(e.target.value)}>
                {P.gpus.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            <div className="calc-field">
              <label className="lbl">Mode</label>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                {P.modes.map(m => (
                  <button key={m.id} type="button"
                    className={"btn small " + (mode===m.id ? "primary" : "ghost")}
                    onClick={()=>setMode(m.id)}>
                    {m.id === "ondemand" ? "On-demand" : m.id === "reserved" ? "Reserved" : "Spot"}
                  </button>
                ))}
              </div>
            </div>

            {mode !== "reserved" && (
              <div className="calc-field">
                <label className="lbl">Hours per day</label>
                <input className="slider" type="range" min="1" max="24" value={hours} onChange={e=>setHours(+e.target.value)}/>
                <div className="val">{fmtInt(hours, lang)} <span style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", letterSpacing:".12em"}}>H / DAY</span></div>
              </div>
            )}

            <div className="calc-field">
              <label className="lbl">Days per month</label>
              <input className="slider" type="range" min="1" max="31" value={days} onChange={e=>setDays(+e.target.value)}/>
              <div className="val">{fmtInt(days, lang)} <span style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", letterSpacing:".12em"}}>DAYS</span></div>
            </div>

            {mode !== "reserved" && (
              <div className="calc-field">
                <label className="lbl">Utilization (actual runtime)</label>
                <input className="slider" type="range" min="10" max="100" value={util} onChange={e=>setUtil(+e.target.value)}/>
                <div className="val">{fmtInt(util, lang)}<span style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", letterSpacing:".12em", marginInlineStart:4}}>%</span></div>
              </div>
            )}
          </div>

          <div className="calc-out-big">
            <span className="k">Monthly bill · estimated</span>
            <div className="big">
              {fmt(total, lang, {minimumFractionDigits:0, maximumFractionDigits:0})}
              <span className="u">SAR / MO</span>
            </div>
            <span style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--mut)"}}>
              ≈ USD {fmt(total * (row?.usd / row?.ondemand) , lang, {maximumFractionDigits:0})} · ref only
            </span>

            <div className="breakdown">
              <span className="bk-k">Rate</span>
              <span className="bk-v">{fmt(rate, lang, {minimumFractionDigits:2})} SAR / hr</span>
              <span className="bk-k">Effective hours / month</span>
              <span className="bk-v">{fmt(effectiveHours, lang, {maximumFractionDigits:0})} h</span>
              <span className="bk-k">Mode</span>
              <span className="bk-v">{P.modes.find(m=>m.id===mode).label}</span>
              {mode === "ondemand" && (
                <>
                  <span className="bk-k">Savings vs manual reserved</span>
                  <span className="bk-v" style={{color:"var(--mut)"}}>—</span>
                </>
              )}
              {mode === "reserved" && (
                <>
                  <span className="bk-k">Savings vs on-demand</span>
                  <span className="bk-v" style={{color:"var(--teal)"}}>
                    − {fmtInt((1 - row.reserved / row.ondemand) * 100, lang)}%
                  </span>
                </>
              )}
              {mode === "spot" && (
                <>
                  <span className="bk-k">Savings vs on-demand</span>
                  <span className="bk-v" style={{color:"var(--teal)"}}>
                    − {fmtInt((1 - row.spot / row.ondemand) * 100, lang)}%
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ ADDONS ═════════════════════════════════════════════════ */

function Addons() {
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§03" label="ADDONS" right="STORAGE · EGRESS · NETWORK" />
        <h2 className="st" style={{marginTop:12, marginBottom:32}}>Everything <em>else.</em></h2>
        <div className="addon-grid">
          {P.addons.map(a => (
            <div key={a.k} className="ad">
              <div className="k">{a.k}</div>
              <div className="v">{a.v}</div>
            </div>
          ))}
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
        <SectionMeta idx="§04" label="FAQ" right="common pricing questions" />
        <h2 className="st" style={{marginTop:12, marginBottom:24}}>Questions, <em>answered.</em></h2>
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
        <div className="big">Stop paying <em>in dollars.</em></div>
        <p className="ss" style={{margin:"32px auto 40px", maxWidth:"56ch"}}>
          Sign up in SAR, invoice in SAR, settle in SAR. USD is a rounding error at the bottom of a footer.
        </p>
        <div className="ctas">
          <MagneticButton><a className="btn primary lg" href="#">Start renting <Arrow size={14}/></a></MagneticButton>
          <a className="btn ghost lg" href="./Contact.html">Talk to sales</a>
        </div>
      </div>
    </section>
  );
}

/* ═══ PAGE ═══════════════════════════════════════════════════ */

function PricingPage() {
  const [mode, setMode] = useState("ondemand");
  return (
    <PageShell active="pricing">
      <Hero />
      <section id="rates" style={{padding:"80px 0"}}>
        <div className="wrap">
          <SectionMeta idx="§01" label="RATE CARD" right="ALL SAR · PER-SECOND · IN-KINGDOM" />
          <h2 className="st" style={{marginTop:12, marginBottom:8}}>GPUs, <em>three ways.</em></h2>
          <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
            Pick a mode — see what it costs against every GPU we list. Click a tier to highlight its column.
          </p>
          <Modes mode={mode} setMode={setMode} />
          <Reveal><RateCard mode={mode} /></Reveal>
        </div>
      </section>

      <section style={{padding:"0 0 110px"}}>
        <div className="wrap">
          <div style={{borderTop:"1px solid var(--hair)", paddingTop:80}}>
            <SectionMeta idx="§01b" label="INFERENCE API" right="PER-TOKEN · SAR / 1M" />
            <h2 className="st" style={{marginTop:12, marginBottom:24}}>Or skip the GPU, <em>buy tokens.</em></h2>
            <p style={{color:"var(--ink-2)", fontSize:18, lineHeight:1.55, maxWidth:"62ch", margin:"0 0 24px"}}>
              Don't want to manage a box? Hit the OpenAI-compatible inference endpoint and we take care of the runtime. Same SAR billing, rolled up per token.
            </p>
            <Reveal><InferenceTable /></Reveal>
            <Callout tone="info" label="NOTE">
              Inference API prices are final — they include GPU + serving + routing. On-demand GPU prices are raw silicon; bring your own serving stack.
            </Callout>
          </div>
        </div>
      </section>

      <Calculator />
      <Addons />
      <FAQ />
      <EndCTA />
    </PageShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<PricingPage />);
