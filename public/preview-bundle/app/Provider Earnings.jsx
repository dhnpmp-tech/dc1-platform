/* Provider Earnings — 30d chart, breakdown, payouts */
const D = window.DCP_PROVIDER;

function Earnings() {
  const data = D.earnDaily;
  const max = Math.max(...data.map(d => d.sar));
  const total = data.reduce((a,x)=>a+x.sar,0);
  const avgDay = Math.round(total/data.length);
  const best = data.reduce((a,b)=>b.sar>a.sar?b:a);

  const byModel = D.models.filter(m=>m.enabled).sort((a,b)=>b.earnings30d-a.earnings30d);
  const modelTotal = byModel.reduce((a,m)=>a+m.earnings30d,0);

  return (
    <div className="pv-shell">
      <window.PvSidebar current="earnings" />
      <div className="pv-main">
        <window.PvTopbar crumb="Earnings" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Last 30 days</div>
              <h1 className="pv-page-h1">You earned <em>SAR {total.toLocaleString()}</em>.</h1>
              <div className="pv-page-lede">Provider share: 75% of gross. Paid weekly to {D.provider.iban}. Tax invoices available via your email on the 1st of each month.</div>
            </div>
            <a href="./Provider Wallet.html" className="pv-btn primary">Wallet & payouts →</a>
          </div>

          <div className="pv-grid c4" style={{marginBottom:24}}>
            <Kpi eb="30d gross" v={"SAR " + total.toLocaleString()} d="+22% vs prior 30d" />
            <Kpi eb="Daily avg" v={"SAR " + avgDay} d={`Range SAR ${Math.min(...data.map(d=>d.sar))} – ${max}`} />
            <Kpi eb="Best day" v={"SAR " + best.sar} d={best.date} />
            <Kpi eb="Jobs · 30d" v={D.totals.jobsMonth.toLocaleString()} d={`Avg SAR ${(total/D.totals.jobsMonth).toFixed(2)}/job`} />
          </div>

          <div className="pv-card" style={{marginBottom:24}}>
            <div className="pv-card-hd">
              <div className="pv-card-t">Daily earnings · SAR</div>
              <div className="pv-eb">Hover a bar for detail</div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:`repeat(${data.length},1fr)`, gap:4, alignItems:"end", height:240}}>
              {data.map((d, i) => (
                <div key={i} title={`${d.date} · SAR ${d.sar} · ${d.jobs} jobs · ${d.hours}h`}
                     style={{height:`${(d.sar/max)*100}%`, background: i === data.length-1 ? "var(--orange)" : "color-mix(in oklab, var(--orange) 60%, transparent)", minHeight:3, cursor:"pointer"}}/>
              ))}
            </div>
            <div style={{display:"flex", justifyContent:"space-between", marginTop:10, fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", letterSpacing:".06em"}}>
              <span>{data[0].date}</span>
              <span>{data[Math.floor(data.length/2)].date}</span>
              <span>today</span>
            </div>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1fr 1fr", marginBottom:24}}>
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">By model · 30 days</div></div>
              <div style={{display:"grid", gap:14}}>
                {byModel.map(m => (
                  <div key={m.id}>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4}}>
                      <span><b>{m.name}</b> <span className="pv-eb" style={{marginInlineStart:8}}>{m.jobs30d.toLocaleString()} jobs</span></span>
                      <span style={{fontFamily:"var(--mono)"}}>SAR {m.earnings30d.toLocaleString()}</span>
                    </div>
                    <div className="pv-bar"><div className="pv-bar-f" style={{width:(m.earnings30d/modelTotal*100)+"%"}}/></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">By rig · 30 days</div></div>
              <div style={{display:"grid", gap:14}}>
                {D.rigs.map(r => {
                  const est = r.rate * 18 * 30 * (r.util/100);
                  return (
                    <div key={r.id}>
                      <div style={{display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4}}>
                        <span><b>{r.name}</b> <span className="pv-eb" style={{marginInlineStart:8}}>{r.gpu}</span></span>
                        <span style={{fontFamily:"var(--mono)"}}>SAR {est.toFixed(0)}</span>
                      </div>
                      <div className="pv-bar teal"><div className="pv-bar-f" style={{width:r.util+"%"}}/></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pv-card" style={{padding:0}}>
            <div className="pv-card-hd" style={{padding:"16px 20px"}}>
              <div className="pv-card-t">Payouts</div>
              <a href="./Provider Wallet.html" className="pv-eb orange">WALLET →</a>
            </div>
            <table className="pv-tbl">
              <thead><tr><th>Period</th><th>Mode</th><th className="num">Amount</th><th>Status</th><th>Settled</th></tr></thead>
              <tbody>
              {D.payouts.map(p => (
                <tr key={p.id}>
                  <td><b>{p.period}</b></td>
                  <td className="mono">{p.mode}</td>
                  <td className="num" style={{color:"var(--orange)", fontWeight:500}}>SAR {p.sar.toLocaleString()}</td>
                  <td><span className={"pv-chip " + (p.status==="paid"?"ok":"hot")}>{p.status}</span></td>
                  <td className="mono" style={{color:"var(--mut)"}}>{p.date}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ eb, v, d }) {
  return (
    <div className="pv-kpi">
      <div className="pv-eb">{eb}</div>
      <div className="pv-kpi-v"><em>{v}</em></div>
      <div className="pv-kpi-d">{d}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Earnings />);
