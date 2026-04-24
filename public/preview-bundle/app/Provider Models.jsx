/* Provider Models — which models are served, enable/disable, earnings per model */
const { useState } = React;
const D = window.DCP_PROVIDER;

function Models() {
  const [items, setItems] = useState(D.models);
  const toggle = id => setItems(is => is.map(m => m.id===id ? {...m, enabled:!m.enabled} : m));
  const active = items.filter(m=>m.enabled);

  return (
    <div className="pv-shell">
      <window.PvSidebar current="models" />
      <div className="pv-main">
        <window.PvTopbar crumb="Models" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Catalog · served</div>
              <h1 className="pv-page-h1">Your rigs serve <em>{active.length} models</em>.</h1>
              <div className="pv-page-lede">Toggle a model to start or stop serving it across your fleet. New models auto-download when enabled. Weights are signed and content-addressed.</div>
            </div>
            <button className="pv-btn primary">+ Enable custom model</button>
          </div>

          <div className="pv-grid c3" style={{marginBottom:24}}>
            <Kpi eb="Active models" v={active.length + "/" + items.length} />
            <Kpi eb="Disk used" v={active.reduce((a,m)=>a + parseFloat(m.size), 0).toFixed(1) + " GB"} />
            <Kpi eb="Earnings · mo" v={"SAR " + active.reduce((a,m)=>a + m.earnings30d, 0).toLocaleString()} />
          </div>

          <div className="pv-grid c2">
            {items.map(m => (
              <div key={m.id} className="pv-card" style={{opacity: m.enabled ? 1 : .6}}>
                <div className="pv-card-hd">
                  <div>
                    <div className="pv-eb orange">{m.enabled ? "SERVING" : "DISABLED"}</div>
                    <div className="pv-card-t" style={{marginTop:2}}>{m.name}</div>
                  </div>
                  <label style={{position:"relative", width:42, height:22, display:"inline-block"}}>
                    <input type="checkbox" checked={m.enabled} onChange={()=>toggle(m.id)} style={{opacity:0, width:0, height:0}}/>
                    <span style={{position:"absolute", inset:0, background: m.enabled ? "var(--orange)":"var(--hair)", borderRadius:999, cursor:"pointer", transition:".2s"}}>
                      <span style={{position:"absolute", top:2, left: m.enabled ? 22 : 2, width:18, height:18, background:"var(--paper)", borderRadius:"50%", transition:".2s"}}/>
                    </span>
                  </label>
                </div>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14}}>
                  <KV k="Size" v={m.size} />
                  <KV k="Throughput" v={m.tok} />
                  <KV k="Your rate" v={m.rate} />
                </div>
                <div style={{paddingTop:12, borderTop:"1px dashed var(--hair)", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                  <div>
                    <div className="pv-eb">Jobs · 30d</div>
                    <div style={{fontFamily:"var(--mono)", fontSize:16, marginTop:3}}>{m.jobs30d.toLocaleString()}</div>
                  </div>
                  <div style={{textAlign:"end"}}>
                    <div className="pv-eb">Earned · 30d</div>
                    <div style={{fontFamily:"var(--serif)", fontStyle:"italic", fontSize:22, color:"var(--orange)", marginTop:1}}>SAR {m.earnings30d.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ eb, v }) { return <div className="pv-kpi"><div className="pv-eb">{eb}</div><div className="pv-kpi-v"><em>{v}</em></div></div>; }
function KV({ k, v }) { return <div><div className="pv-eb">{k}</div><div style={{fontFamily:"var(--mono)", fontSize:13, marginTop:3}}>{v}</div></div>; }

ReactDOM.createRoot(document.getElementById("root")).render(<Models />);
