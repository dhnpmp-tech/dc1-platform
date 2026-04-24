/* eslint-disable */
/* Status — live region + service health + incidents */

const {
  LangCtx, useLang, MagneticButton, Reveal, Badge, Callout, SectionMeta,
  Eyebrow, Breadcrumb, Sparkline,
  Arrow, External, Check, Copy,
  fmt, fmtInt,
  PageShell,
} = window;

const S = window.DCP_PUBLIC.status;

/* ═══ OVERALL BANNER ═════════════════════════════════════════ */

function Banner() {
  const now = new Date();
  const stamp = now.toLocaleTimeString("en-GB", { hour12: false }) + " AST";
  return (
    <section className={"status-hero " + S.overall}>
      <div className="wrap">
        <div className="crumb">
          <Breadcrumb items={[{label:"DCP", href:"../DCP Redesign.html"},{label:"Status"}]} />
        </div>
        <div className="banner">
          <div>
            <Eyebrow>§ status · real-time</Eyebrow>
            <div className="t" style={{marginTop:14}}>
              {S.overall === "operational" && "All systems operational."}
              {S.overall === "degraded"    && "Service is degraded."}
              {S.overall === "outage"      && "We're investigating an outage."}
            </div>
          </div>
          <div className="meta">
            <div><span className="dot">●</span> {S.overallLabel.toUpperCase()}</div>
            <div>LAST CHECK · {stamp}</div>
            <div>AUTO-REFRESH · 60S</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ REGIONS ═══════════════════════════════════════════════ */

function Regions() {
  return (
    <section style={{padding:"80px 0"}}>
      <div className="wrap">
        <SectionMeta idx="§01" label="REGIONS" right="IN-KINGDOM + BAHRAIN FALLBACK" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>
          By region.
        </h2>
        <p style={{color:"var(--ink-2)", fontSize:17, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          Data residency means your jobs route to RUH, JED or DMM by default. Bahrain fallback only engages if you've opted in.
        </p>
        <div className="reg-grid">
          {S.regions.map(r => (
            <div key={r.code} className="r">
              <div className="code">{r.code} · {r.name.toUpperCase()}</div>
              <div className="name">{r.name}</div>
              <div className="row"><span className="k">STATUS</span>
                <span className={"v " + (r.status === "operational" ? "ok" : r.status === "degraded" ? "warn" : "")}>
                  {r.status.toUpperCase()}
                </span>
              </div>
              <div className="row"><span className="k">P95</span><span className="v">{r.p95} ms</span></div>
              <div className="row"><span className="k">NODES</span><span className="v">{r.nodes}</span></div>
              <div className="row"><span className="k">UPTIME · 30d</span><span className="v">{r.up}%</span></div>
              {r.note && <div className="note">⚠ {r.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ SERVICES ═══════════════════════════════════════════════ */

function Services() {
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§02" label="SERVICES" right="API · PLATFORM · INFRA" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>By service.</h2>
        <p style={{color:"var(--ink-2)", fontSize:17, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          SLA target is 99.95% for core surfaces. Webhooks are best-effort with 24h replay. Rolling 30-day uptime below.
        </p>
        <div className="svc-list">
          {S.services.map(s => (
            <div key={s.k} className="svc-row">
              <div className="name">{s.k}</div>
              <div className="up">{s.up.toFixed(2)}%</div>
              <span className={"pill " + s.status}>
                {s.status === "operational" ? "● OK" : s.status === "degraded" ? "▲ DEGRADED" : "■ OUTAGE"}
              </span>
              <div className="note">{s.note || ""}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══ 90-DAY UPTIME ══════════════════════════════════════════ */

function Uptime90() {
  const total = S.uptime90.length;
  const ok = S.uptime90.filter(x => x === 0).length;
  const pct = (ok / total * 100).toFixed(2);
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§03" label="UPTIME · 90 DAYS" right={`OVERALL ${pct}%`} />
        <h2 className="st" style={{marginTop:12, marginBottom:24}}>Ninety days.</h2>

        <div style={{border:"1px solid var(--hair)", background:"var(--paper)", padding:32}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:20, fontFamily:"var(--mono)", fontSize:11, letterSpacing:".1em", color:"var(--mut)"}}>
            <span>INFERENCE API</span>
            <span>● OK · ▲ DEGRADED · ■ OUTAGE</span>
          </div>
          <div className="uptime-strip" aria-label="90-day uptime history">
            {S.uptime90.slice().reverse().map((v, i) => (
              <span
                key={i}
                className={"bar " + (v === 1 ? "warn" : v === 2 ? "err" : "")}
                title={`D-${total - 1 - i} · ${v === 0 ? "operational" : v === 1 ? "degraded" : "outage"}`}
              />
            ))}
          </div>
          <div className="uptime-foot">
            <span>90 DAYS AGO</span>
            <span>TODAY</span>
          </div>
        </div>

        <Callout tone="info" label="NOTE" >
          Each bar is a 24h window. Coloured bars are clickable in the live dashboard — they jump to the corresponding incident below.
        </Callout>
      </div>
    </section>
  );
}

/* ═══ INCIDENTS ══════════════════════════════════════════════ */

function Incidents() {
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§04" label="INCIDENT LOG" right="MOST RECENT FIRST" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>What happened.</h2>
        <p style={{color:"var(--ink-2)", fontSize:17, lineHeight:1.55, maxWidth:"62ch", margin:"0 0 24px"}}>
          Every degraded window logged, with a post-mortem if duration {'>'} 10 minutes. Retained for 12 months.
        </p>

        {S.incidents.map(inc => (
          <Reveal key={inc.id}><div className="incident">
            <div className="head">
              <h3>{inc.title}</h3>
              <div className="meta">
                <div>{inc.date}</div>
                <div>{inc.region} · {inc.dur}</div>
                <div className={"sev " + inc.sev}>● {inc.sev.toUpperCase()}</div>
              </div>
            </div>
            <div className="upd">
              {inc.updates.map((u,i) => (
                <div key={i} className="u">
                  <span className="t">{u.t}</span>
                  <span>{u.msg}</span>
                </div>
              ))}
            </div>
          </div></Reveal>
        ))}
      </div>
    </section>
  );
}

/* ═══ SUBSCRIBE ══════════════════════════════════════════════ */

function Subscribe() {
  return (
    <section style={{padding:"60px 0 120px"}}>
      <div className="wrap">
        <div className="subscribe">
          <div className="left">
            <h3>Get pinged when something breaks.</h3>
            <p>Pick a channel. We only ping on confirmed incidents, not on every warning. No marketing — ever.</p>
            <form className="form" onSubmit={e=>e.preventDefault()}>
              <input className="input" type="email" placeholder="you@company.sa"/>
              <button className="btn primary" type="submit">Subscribe <Arrow size={12}/></button>
            </form>
          </div>
          <div className="right">
            <div className="ch"><span className="k">EMAIL</span>      <span className="v">Instant · ar / en</span></div>
            <div className="ch"><span className="k">WEBHOOK</span>    <span className="v">POST · signed</span></div>
            <div className="ch"><span className="k">SLACK</span>      <span className="v">#dcp-status channel</span></div>
            <div className="ch"><span className="k">RSS / ATOM</span> <span className="v">status.dcp.sa/rss</span></div>
            <div className="ch"><span className="k">SMS · KSA</span>  <span className="v">Enterprise only</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══ PAGE ═══════════════════════════════════════════════════ */

function StatusPage() {
  return (
    <PageShell active="status">
      <Banner />
      <Regions />
      <Services />
      <Uptime90 />
      <Incidents />
      <Subscribe />
    </PageShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<StatusPage />);
