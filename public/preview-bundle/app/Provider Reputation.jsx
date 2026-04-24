/* Provider Reputation — tier ladder, trust score, reviews */
const D = window.DCP_PROVIDER;

function Reputation() {
  const cur = D.tiers.find(t => t.name === D.provider.tier);
  const curIdx = D.tiers.indexOf(cur);
  const next = D.tiers[curIdx + 1];
  const progress = next ? (D.totals.jobsMonth / next.jobs) * 100 : 100;

  return (
    <div className="pv-shell">
      <window.PvSidebar current="rep" />
      <div className="pv-main">
        <window.PvTopbar crumb="Reputation" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Tier · trust · reviews</div>
              <h1 className="pv-page-h1">Tier <em>{cur.name}</em>. Trust <em>{D.provider.trust}/100</em>.</h1>
              <div className="pv-page-lede">Tiers promote based on completed jobs and trust score. Higher tiers get priority routing, better splits, and featured placement.</div>
            </div>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1fr 1fr", marginBottom:24}}>
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Trust score · {D.provider.trust}/100</div></div>
              <div style={{position:"relative", padding:"30px 10px 0"}}>
                <div style={{width:"100%", height:12, background:"var(--hair)", borderRadius:6, overflow:"hidden"}}>
                  <div style={{width:D.provider.trust+"%", height:"100%", background:"linear-gradient(to right, var(--teal), var(--orange))"}}/>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:8, fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", letterSpacing:".1em", textTransform:"uppercase"}}>
                  <span>0 · new</span><span>50 · solid</span><span>100 · elite</span>
                </div>
              </div>
              <div style={{marginTop:24, display:"grid", gap:10}}>
                {[
                  {k:"Uptime", v:99.2, tone:"ok"},
                  {k:"Job success rate", v:98.7, tone:"ok"},
                  {k:"Avg latency", v:92, tone:"ok", display:"128ms · p95 340ms"},
                  {k:"Completed jobs", v:72, tone:"hot", display:"1,862 lifetime"},
                  {k:"Dispute rate", v:99.9, tone:"ok", display:"0 disputes in last 500 jobs"},
                ].map((x,i)=>(
                  <div key={i}>
                    <div style={{display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4}}>
                      <span>{x.k}</span><span className="mono" style={{color:x.tone==="ok"?"var(--teal)":"var(--orange)"}}>{x.display || (x.v + "%")}</span>
                    </div>
                    <div className="pv-bar teal"><div className="pv-bar-f" style={{width:x.v+"%"}}/></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Tier progression</div></div>
              <div style={{display:"grid", gap:10}}>
                {D.tiers.map((t, i) => {
                  const state = i < curIdx ? "past" : i === curIdx ? "cur" : "future";
                  return (
                    <div key={t.name} style={{padding:16, border: state==="cur" ? "1px solid var(--orange)" : "1px solid var(--hair)", background: state==="cur" ? "color-mix(in oklab, var(--orange) 8%, var(--paper))" : "transparent", opacity: state==="future" ? .7 : 1}}>
                      <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4}}>
                        <div style={{fontFamily:"var(--serif)", fontStyle:"italic", fontSize:22, color: state==="cur"?"var(--orange)":"var(--ink)"}}>{t.name}</div>
                        <div className="pv-eb">{t.cut}% split · {t.jobs}+ jobs</div>
                      </div>
                      <div style={{fontSize:12.5, color:"var(--ink-2)", lineHeight:1.5}}>{t.perks.join(" · ")}</div>
                      {state === "cur" && next && (
                        <>
                          <div className="pv-bar" style={{marginTop:10}}><div className="pv-bar-f" style={{width:Math.min(100,progress)+"%"}}/></div>
                          <div className="pv-eb" style={{marginTop:5}}>{D.totals.jobsMonth}/{next.jobs} jobs to {next.name}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pv-card">
            <div className="pv-card-hd">
              <div className="pv-card-t">What renters say · last {D.reviews.length} reviews</div>
              <div className="pv-eb orange">{D.reviews.filter(r=>r.stars===5).length} five-star · {Math.round(D.reviews.reduce((a,r)=>a+r.stars,0)/D.reviews.length*10)/10} avg</div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14}}>
              {D.reviews.map((r,i)=>(
                <div key={i} style={{padding:16, border:"1px solid var(--hair)", background:"var(--bg-2)"}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8}}>
                    <div style={{fontWeight:500}}>{r.renter}</div>
                    <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)"}}>{r.t}</div>
                  </div>
                  <div style={{color:"var(--orange)", letterSpacing:3, marginBottom:8}}>{"★".repeat(r.stars)}<span style={{color:"var(--dim)"}}>{"★".repeat(5-r.stars)}</span></div>
                  <div style={{fontStyle:"italic", color:"var(--ink-2)", fontSize:13.5, lineHeight:1.55}}>"{r.msg}"</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Reputation />);
