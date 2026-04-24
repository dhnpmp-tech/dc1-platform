/* Provider Dashboard — live rigs, earnings today, incoming job feed */
const { useState, useEffect, useRef } = React;
const D = window.DCP_PROVIDER;

function Dashboard() {
  const active = D.rigs.filter(r => r.status === "earning");
  return (
    <div className="pv-shell">
      <window.PvSidebar current="dash" />
      <div className="pv-main">
        <window.PvTopbar crumb="Dashboard" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Home · Provider</div>
              <h1 className="pv-page-h1">Today, your rigs earned <em>SAR {D.totals.today}</em>.</h1>
              <div className="pv-page-lede">{active.length} of {D.rigs.length} rigs are serving jobs. Queue is healthy; next payout accrues through the weekend.</div>
            </div>
            <a href="./Provider Earnings.html" className="pv-btn">Full earnings →</a>
          </div>

          <div className="pv-grid c4" style={{marginBottom:24}}>
            <Kpi eb="Today" v={`SAR ${D.totals.today}`} d="+12% vs yesterday" orange />
            <Kpi eb="This week" v={`SAR ${D.totals.week.toLocaleString()}`} d="+8.4%" />
            <Kpi eb="This month" v={`SAR ${D.totals.month.toLocaleString()}`} d="+22% vs Nov" />
            <Kpi eb="Lifetime" v={`SAR ${D.totals.lifetime.toLocaleString()}`} d={`${D.totals.jobsMonth.toLocaleString()} jobs · Mo`} />
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1.5fr 1fr", marginBottom:24}}>
            <EarningsSparkCard />
            <LiveFeed />
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1.2fr 1fr", marginBottom:24}}>
            <RigsList />
            <ModelsMini />
          </div>

          <div className="pv-grid c3">
            <UtilCard />
            <PayoutCard />
            <TierCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ eb, v, d, orange }) {
  return (
    <div className="pv-kpi">
      <div className="pv-eb">{eb}</div>
      <div className="pv-kpi-v">{orange ? <em>{v}</em> : v}</div>
      <div className="pv-kpi-d">{d}</div>
    </div>
  );
}

function EarningsSparkCard() {
  const data = D.earnDaily;
  const max = Math.max(...data.map(d => d.sar));
  return (
    <div className="pv-card">
      <div className="pv-card-hd">
        <div>
          <div className="pv-eb">Last 30 days · SAR earned</div>
          <div className="pv-card-t" style={{marginTop:4}}>SAR {data.reduce((a,x)=>a+x.sar,0).toLocaleString()}</div>
        </div>
        <a href="./Provider Earnings.html" className="pv-eb orange">DRILL DOWN →</a>
      </div>
      <div style={{display:"grid", gridTemplateColumns:`repeat(${data.length}, 1fr)`, gap:4, alignItems:"end", height:160}}>
        {data.map((d, i) => (
          <div key={i} title={`${d.date} · SAR ${d.sar}`}
               style={{height:`${(d.sar/max)*100}%`, background: i === data.length-1 ? "var(--orange)" : "color-mix(in oklab, var(--orange) 60%, transparent)", minHeight:2}} />
        ))}
      </div>
      <div style={{display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", marginTop:8, letterSpacing:".08em"}}>
        <span>{data[0].date}</span><span>{data[Math.floor(data.length/2)].date}</span><span>today</span>
      </div>
    </div>
  );
}

function LiveFeed() {
  const [rows, setRows] = useState(D.jobHistory.slice(0, 4));
  useEffect(() => {
    const t = setInterval(() => {
      setRows(rs => {
        const seed = D.jobHistory[Math.floor(Math.random() * D.jobHistory.length)];
        const fresh = { ...seed, id: "j_" + Math.random().toString(36).slice(2, 6), t: "just now" };
        return [fresh, ...rs].slice(0, 5);
      });
    }, 3800);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="pv-card">
      <div className="pv-card-hd">
        <div className="pv-eb orange">● live · incoming jobs</div>
        <a href="./Provider Jobs.html" className="pv-eb">ALL JOBS →</a>
      </div>
      <div style={{display:"grid", gap:8}}>
        {rows.map((r, i) => (
          <div key={r.id + i} style={{display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 12px", border:"1px solid var(--hair)", background:"var(--bg-2)"}}>
            <div>
              <div style={{fontFamily:"var(--mono)", fontSize:12, color:"var(--ink)"}}>{r.model} <span style={{color:"var(--mut)"}}>· {r.rig}</span></div>
              <div style={{fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", marginTop:3, letterSpacing:".04em"}}>{r.renter} · {r.tokens} tok · {r.sec}s · {r.t}</div>
            </div>
            <div style={{textAlign:"end", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:18, color: r.status === "failed" ? "var(--mut)" : "var(--orange)"}}>SAR {r.sar}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RigsList() {
  return (
    <div className="pv-card" style={{padding:0}}>
      <div className="pv-card-hd" style={{padding:"16px 20px"}}>
        <div className="pv-card-t">Rigs</div>
        <a href="./Provider Rigs.html" className="pv-eb orange">MANAGE →</a>
      </div>
      <table className="pv-tbl">
        <thead><tr><th>Name</th><th>GPU</th><th>Util</th><th>Temp</th><th>SAR/hr</th><th>Status</th></tr></thead>
        <tbody>
        {D.rigs.map(r => (
          <tr key={r.id}>
            <td><b>{r.name}</b></td>
            <td className="mono">{r.gpu}</td>
            <td style={{width:"16%"}}>
              <div className="pv-bar"><div className="pv-bar-f" style={{width: r.util + "%"}} /></div>
              <div className="mono" style={{fontSize:11, color:"var(--mut)", marginTop:3}}>{r.util}%</div>
            </td>
            <td className="mono">{r.temp}°</td>
            <td className="mono">SAR {r.rate}</td>
            <td><span className={"pv-chip " + (r.status==="earning"?"ok":r.status==="idle"?"mut":"hot")}>{r.status}</span></td>
          </tr>
        ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelsMini() {
  const on = D.models.filter(m => m.enabled).slice(0, 4);
  return (
    <div className="pv-card">
      <div className="pv-card-hd">
        <div className="pv-card-t">Top-earning models</div>
        <a href="./Provider Models.html" className="pv-eb orange">ALL →</a>
      </div>
      <div style={{display:"grid", gap:10}}>
        {on.map(m => (
          <div key={m.id} style={{display:"grid", gridTemplateColumns:"1fr auto", gap:10, padding:"10px 0", borderTop:"1px dashed var(--hair)"}}>
            <div>
              <div style={{fontWeight:500}}>{m.name}</div>
              <div className="pv-eb" style={{marginTop:3}}>{m.jobs30d.toLocaleString()} jobs · 30d</div>
            </div>
            <div style={{textAlign:"end", fontFamily:"var(--serif)", fontStyle:"italic", fontSize:20, color:"var(--orange)"}}>SAR {m.earnings30d.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilCard() {
  return (
    <div className="pv-card">
      <div className="pv-card-hd"><div className="pv-eb">Utilisation · 7 days</div></div>
      <div style={{display:"flex", alignItems:"baseline", gap:10, marginBottom:14}}>
        <div style={{fontFamily:"var(--serif)", fontSize:52, fontStyle:"italic", color:"var(--orange)", lineHeight:1}}>{D.totals.utilAvg}%</div>
        <div className="pv-eb teal">+6 pts wk/wk</div>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4, height:50, alignItems:"end"}}>
        {[64,58,72,80,76,68,78].map((v,i)=>(
          <div key={i} style={{height:v+"%", background:"var(--orange)"}}/>
        ))}
      </div>
      <div className="pv-eb" style={{marginTop:6}}>M · T · W · T · F · S · S</div>
    </div>
  );
}

function PayoutCard() {
  const pending = D.payouts.find(p => p.status === "accruing");
  return (
    <div className="pv-card">
      <div className="pv-card-hd"><div className="pv-eb">Next payout · accruing</div></div>
      <div style={{fontFamily:"var(--serif)", fontSize:44, fontStyle:"italic", color:"var(--orange)", lineHeight:1, margin:"4px 0 8px"}}>SAR {pending.sar}</div>
      <div className="pv-eb">Settlement {pending.period.split(" – ")[1]}</div>
      <div className="pv-bar teal" style={{marginTop:14}}><div className="pv-bar-f" style={{width:"32%"}}/></div>
      <div className="pv-eb" style={{marginTop:6}}>Pays to IBAN {D.provider.iban}</div>
      <a href="./Provider Wallet.html" className="pv-btn sm ghost" style={{marginTop:14, display:"inline-block"}}>Open wallet →</a>
    </div>
  );
}

function TierCard() {
  const cur = D.tiers.find(t => t.name === D.provider.tier);
  const next = D.tiers[D.tiers.indexOf(cur) + 1];
  const progress = next ? (D.totals.jobsMonth / next.jobs) * 100 : 100;
  return (
    <div className="pv-card">
      <div className="pv-card-hd"><div className="pv-eb">Tier · reputation</div></div>
      <div style={{display:"flex", alignItems:"baseline", gap:14, marginBottom:10}}>
        <div style={{fontFamily:"var(--serif)", fontSize:36, fontStyle:"italic", color:"var(--orange)", lineHeight:1}}>{cur.name}</div>
        <div className="pv-eb">{cur.cut}% cut · trust {D.provider.trust}</div>
      </div>
      {next && (
        <>
          <div className="pv-bar"><div className="pv-bar-f" style={{width: Math.min(100, progress) + "%"}}/></div>
          <div className="pv-eb" style={{marginTop:6}}>{D.totals.jobsMonth}/{next.jobs} jobs → {next.name} (+{next.cut - cur.cut}% cut)</div>
        </>
      )}
      <a href="./Provider Reputation.html" className="pv-btn sm ghost" style={{marginTop:14, display:"inline-block"}}>See perks →</a>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Dashboard />);
