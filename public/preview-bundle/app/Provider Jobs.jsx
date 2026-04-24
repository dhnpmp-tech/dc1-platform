/* Provider Jobs — filterable job history per rig */
const { useState, useMemo } = React;
const D = window.DCP_PROVIDER;

// Extended job list
const EXT = [...D.jobHistory, ...D.jobHistory.map((j,i)=>({...j, id:j.id+"x"+i, t:(20+i*3)+"m ago"})), ...D.jobHistory.map((j,i)=>({...j, id:j.id+"y"+i, t:"1h "+i*7+"m ago"}))];

function Jobs() {
  const [rigF, setRigF] = useState("all");
  const [modelF, setModelF] = useState("all");
  const [statusF, setStatusF] = useState("all");

  const filtered = useMemo(() => EXT.filter(j =>
    (rigF==="all" || j.rig===rigF) &&
    (modelF==="all" || j.model===modelF) &&
    (statusF==="all" || j.status===statusF)
  ), [rigF, modelF, statusF]);

  const totalSar = filtered.reduce((a,j)=>a + (j.status==="failed"?0:j.sar), 0);
  const totalTok = filtered.reduce((a,j)=>a+j.tokens, 0);

  return (
    <div className="pv-shell">
      <window.PvSidebar current="jobs" />
      <div className="pv-main">
        <window.PvTopbar crumb="Jobs" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Work log</div>
              <h1 className="pv-page-h1">Jobs · <em>settled & pending</em>.</h1>
              <div className="pv-page-lede">Every job your rigs have served. Runtime-based settlement; failed jobs return the hold automatically.</div>
            </div>
          </div>

          <div className="pv-grid c4" style={{marginBottom:24}}>
            <Kpi eb={`Matching jobs (${filtered.length})`} v={filtered.length.toLocaleString()} />
            <Kpi eb="Tokens" v={totalTok.toLocaleString()} />
            <Kpi eb="Earned" v={"SAR " + totalSar.toFixed(2)} />
            <Kpi eb="Avg per job" v={"SAR " + (totalSar/Math.max(filtered.length,1)).toFixed(2)} />
          </div>

          <div style={{display:"flex", gap:10, flexWrap:"wrap", marginBottom:18}}>
            <Filter lbl="Rig" value={rigF} setValue={setRigF} options={[["all","All rigs"], ...D.rigs.map(r=>[r.id,r.name])]} />
            <Filter lbl="Model" value={modelF} setValue={setModelF} options={[["all","All models"], ...D.models.filter(m=>m.enabled).map(m=>[m.name,m.name])]} />
            <Filter lbl="Status" value={statusF} setValue={setStatusF} options={[["all","All statuses"], ["settled","Settled"], ["failed","Failed"]]} />
          </div>

          <div className="pv-card" style={{padding:0}}>
            <table className="pv-tbl">
              <thead><tr><th>Job id</th><th>Rig</th><th>Model</th><th>Renter</th><th className="num">Tokens</th><th className="num">Runtime</th><th className="num">SAR</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
              {filtered.map(j => (
                <tr key={j.id}>
                  <td className="mono" style={{color:"var(--ink)"}}>{j.id}</td>
                  <td className="mono">{j.rig}</td>
                  <td><b>{j.model}</b></td>
                  <td style={{color:"var(--ink-2)"}}>{j.renter}</td>
                  <td className="num">{j.tokens.toLocaleString()}</td>
                  <td className="num">{j.sec}s</td>
                  <td className="num" style={{color: j.status==="failed"?"var(--mut)":"var(--orange)", fontWeight:500}}>{j.status==="failed"?"—":"SAR " + j.sar}</td>
                  <td><span className={"pv-chip " + (j.status==="settled"?"ok":"err")}>{j.status}</span></td>
                  <td className="mono" style={{fontSize:11, color:"var(--mut)"}}>{j.t}</td>
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

function Kpi({ eb, v }) {
  return <div className="pv-kpi"><div className="pv-eb">{eb}</div><div className="pv-kpi-v"><em>{v}</em></div></div>;
}

function Filter({ lbl, value, setValue, options }) {
  return (
    <div style={{display:"grid", gap:4}}>
      <div className="pv-eb">{lbl}</div>
      <select value={value} onChange={e=>setValue(e.target.value)} style={{padding:"8px 12px", border:"1px solid var(--hair)", background:"var(--paper)", color:"var(--ink)", fontFamily:"var(--mono)", fontSize:12, minWidth:160}}>
        {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Jobs />);
