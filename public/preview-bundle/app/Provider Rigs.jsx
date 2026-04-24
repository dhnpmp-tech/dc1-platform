/* Provider Rigs — multi-rig management table with detail drawer */
const { useState } = React;
const D = window.DCP_PROVIDER;

function Rigs() {
  const [sel, setSel] = useState(D.rigs[0].id);
  const rig = D.rigs.find(r => r.id === sel);

  return (
    <div className="pv-shell">
      <window.PvSidebar current="rigs" />
      <div className="pv-main">
        <window.PvTopbar crumb="Rigs" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Fleet</div>
              <h1 className="pv-page-h1">Your <em>{D.rigs.length} rigs</em>.</h1>
              <div className="pv-page-lede">Every rig is a container sandbox. Pause individually, rotate models, or add a new rig from the setup flow.</div>
            </div>
            <a href="./Setup.html" className="pv-btn primary">+ Add a rig</a>
          </div>

          <div className="pv-grid c4" style={{marginBottom:24}}>
            <Kpi eb="Earning now" v={D.rigs.filter(r=>r.status==="earning").length + "/" + D.rigs.length} />
            <Kpi eb="Fleet SAR/hr" v={"SAR " + D.rigs.filter(r=>r.status==="earning").reduce((a,r)=>a+r.rate, 0)} />
            <Kpi eb="Avg util · 7d" v={D.totals.utilAvg + "%"} />
            <Kpi eb="Total jobs · mo" v={D.totals.jobsMonth.toLocaleString()} />
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1.3fr 1fr"}}>
            <div className="pv-card" style={{padding:0}}>
              <div className="pv-card-hd" style={{padding:"16px 20px"}}>
                <div className="pv-card-t">Fleet</div>
                <div className="pv-eb">Click a row · manage</div>
              </div>
              <table className="pv-tbl">
                <thead><tr><th>Name</th><th>GPU</th><th>Engine</th><th>Util</th><th>Temp</th><th>Uptime</th><th>Status</th></tr></thead>
                <tbody>
                {D.rigs.map(r => (
                  <tr key={r.id} onClick={() => setSel(r.id)} style={{cursor:"pointer", background: sel===r.id ? "var(--bg-2)" : undefined}}>
                    <td><b>{r.name}</b><div className="pv-eb" style={{marginTop:2}}>{r.id}</div></td>
                    <td className="mono">{r.gpu}<div className="pv-eb">{r.vram} GB</div></td>
                    <td className="mono">{r.engine}</td>
                    <td>
                      <div className="pv-bar"><div className="pv-bar-f" style={{width:r.util+"%"}}/></div>
                      <div className="mono" style={{fontSize:11, color:"var(--mut)", marginTop:3}}>{r.util}%</div>
                    </td>
                    <td className="mono">{r.temp}°</td>
                    <td className="mono" style={{fontSize:11.5, color:"var(--mut)"}}>{r.uptime}</td>
                    <td><span className={"pv-chip " + (r.status==="earning"?"ok":r.status==="idle"?"mut":"hot")}>{r.status}</span></td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>

            <RigDetail rig={rig} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ eb, v }) {
  return <div className="pv-kpi"><div className="pv-eb">{eb}</div><div className="pv-kpi-v"><em>{v}</em></div></div>;
}

function RigDetail({ rig }) {
  if (!rig) return null;
  return (
    <div className="pv-card" style={{position:"sticky", top:80, alignSelf:"start"}}>
      <div className="pv-card-hd">
        <div>
          <div className="pv-eb orange">Rig · {rig.id}</div>
          <div className="pv-card-t" style={{marginTop:2}}>{rig.name}</div>
        </div>
        <span className={"pv-chip " + (rig.status==="earning"?"ok":rig.status==="idle"?"mut":"hot")}>{rig.status}</span>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px 18px", fontSize:13, marginBottom:16}}>
        <Row k="GPU" v={rig.gpu} />
        <Row k="VRAM" v={rig.vram + " GB"} />
        <Row k="Engine" v={rig.engine} />
        <Row k="OS" v={rig.os} />
        <Row k="Utilisation" v={rig.util + "%"} />
        <Row k="Temperature" v={rig.temp + "°C"} />
        <Row k="Uptime" v={rig.uptime} />
        <Row k="Rate" v={"SAR " + rig.rate + "/hr"} />
      </div>

      <div style={{paddingTop:16, borderTop:"1px dashed var(--hair)"}}>
        <div className="pv-eb" style={{marginBottom:10}}>Earnings · last 7d</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, height:46, alignItems:"end"}}>
          {[62,74,58,82,78,90,68].map((v,i)=>(
            <div key={i} style={{height:v+"%", background:"var(--orange)"}}/>
          ))}
        </div>
        <div style={{display:"flex", justifyContent:"space-between", marginTop:6, fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)"}}>
          <span>SAR 184</span><span>total · 7d SAR {(rig.rate*18*7).toLocaleString()}</span>
        </div>
      </div>

      <div style={{paddingTop:16, marginTop:16, borderTop:"1px dashed var(--hair)", display:"grid", gap:8}}>
        <button className="pv-btn primary">{rig.status==="paused" ? "Resume" : "Pause"} rig</button>
        <button className="pv-btn ghost">Rotate models →</button>
        <button className="pv-btn ghost">Download diagnostic bundle</button>
        <button className="pv-btn ghost" style={{color:"var(--red,#e66)", borderColor:"var(--red,#e66)"}}>Remove rig</button>
      </div>

      <div style={{paddingTop:16, marginTop:16, borderTop:"1px dashed var(--hair)"}}>
        <div className="pv-eb">Last heartbeat</div>
        <div className="mono" style={{fontSize:12, color:"var(--teal)", marginTop:4}}>{rig.status==="paused" ? "— paused" : "● just now"}</div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div>
      <div className="pv-eb">{k}</div>
      <div style={{fontFamily:"var(--mono)", fontSize:13, marginTop:3}}>{v}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Rigs />);
