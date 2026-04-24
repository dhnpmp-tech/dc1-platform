/* Provider Settings — availability, rate overrides, notifications, kill switch */
const { useState } = React;
const D = window.DCP_PROVIDER;

function Settings() {
  const [rate, setRate] = useState(38);
  const [hours, setHours] = useState(24);
  const [auto, setAuto] = useState(true);
  const [quiet, setQuiet] = useState(false);
  const [notif, setNotif] = useState({ dailyDigest:true, payoutCleared:true, rigOffline:true, weeklyInsights:false, tierChange:true });

  return (
    <div className="pv-shell">
      <window.PvSidebar current="settings" />
      <div className="pv-main">
        <window.PvTopbar crumb="Settings" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Account · fleet-wide</div>
              <h1 className="pv-page-h1">Provider <em>settings</em>.</h1>
              <div className="pv-page-lede">Fleet-wide defaults for rate, availability, payouts, and notifications. Per-rig overrides live in the Rigs page.</div>
            </div>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1fr 1fr", marginBottom:24}}>
            {/* Rate */}
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Rate</div></div>
              <div style={{fontFamily:"var(--serif)", fontSize:56, fontStyle:"italic", color:"var(--orange)", lineHeight:1, marginTop:6}}>SAR {rate}<span style={{fontFamily:"var(--mono)", fontSize:14, color:"var(--mut)", fontStyle:"normal", marginInlineStart:8, letterSpacing:".04em"}}>/hr default</span></div>
              <div style={{marginTop:24, position:"relative"}}>
                <div style={{height:6, background:"var(--hair)", position:"relative"}}>
                  <div style={{position:"absolute", left:0, top:0, bottom:0, width:((rate-22)/(62-22)*100)+"%", background:"var(--orange)"}}/>
                </div>
                <input type="range" min="22" max="62" value={rate} onChange={e=>setRate(+e.target.value)} style={{position:"absolute", inset:"-6px 0 auto 0", width:"100%", opacity:0, cursor:"pointer"}}/>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:8, fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", letterSpacing:".08em"}}>
                  <span>SAR 22 · min</span><span>SAR 41 · market</span><span>SAR 62 · max</span>
                </div>
              </div>
              <div style={{marginTop:20, padding:14, background:"var(--bg-2)", borderLeft:"2px solid var(--orange)"}}>
                <div className="pv-eb orange">What this does</div>
                <div style={{fontSize:12.5, color:"var(--ink-2)", marginTop:4, lineHeight:1.5}}>Fleet-wide default — each rig can override in Rigs. Changes apply to new jobs within ~60s.</div>
              </div>
            </div>

            {/* Availability */}
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Availability</div></div>
              <div className="pv-eb" style={{marginBottom:10}}>Hours online</div>
              <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:18}}>
                {[8,16,24].map(h=>(
                  <button key={h} onClick={()=>setHours(h)} style={{padding:"12px 10px", border: hours===h ? "1px solid var(--orange)" : "1px solid var(--hair)", background: hours===h ? "var(--bg-2)":"transparent", cursor:"pointer", textAlign:"start"}}>
                    <div style={{fontFamily:"var(--serif)", fontStyle:"italic", fontSize:26, color: hours===h?"var(--orange)":"var(--ink)", lineHeight:1}}>{h}<span style={{fontFamily:"var(--mono)", fontStyle:"normal", fontSize:12, color:"var(--mut)"}}>/24</span></div>
                    <div className="pv-eb" style={{marginTop:4}}>{h===8?"Evenings":h===16?"Off at night":"Always on"}</div>
                  </button>
                ))}
              </div>
              <Switch label="Auto-accept compatible jobs" sub="Queue fills automatically within capacity" on={auto} set={setAuto}/>
              <Switch label="Quiet hours (22:00–06:00)" sub="Throttle fans · reduce acoustic output" on={quiet} set={setQuiet}/>
            </div>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1fr 1fr", marginBottom:24}}>
            {/* Profile */}
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Profile</div></div>
              <div style={{display:"grid", gap:14}}>
                <Field k="Name" v={D.provider.name} />
                <Field k="Handle" v={D.provider.handle} mono />
                <Field k="Email" v={D.provider.email} mono />
                <Field k="Joined" v={D.provider.joined} />
                <Field k="Location" v="Riyadh · KSA" />
              </div>
            </div>

            {/* Notifications */}
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Notifications</div></div>
              <div style={{display:"grid", gap:4}}>
                <Switch label="Daily earnings digest" sub="Every morning · 07:00 Riyadh" on={notif.dailyDigest} set={v=>setNotif(n=>({...n, dailyDigest:v}))}/>
                <Switch label="Payout cleared" sub="Every Monday when SAR lands in your IBAN" on={notif.payoutCleared} set={v=>setNotif(n=>({...n, payoutCleared:v}))}/>
                <Switch label="Rig goes offline" sub="Immediate · so you can intervene fast" on={notif.rigOffline} set={v=>setNotif(n=>({...n, rigOffline:v}))}/>
                <Switch label="Weekly insights" sub="Fleet health, utilisation, optimisation tips" on={notif.weeklyInsights} set={v=>setNotif(n=>({...n, weeklyInsights:v}))}/>
                <Switch label="Tier change" sub="When you promote or demote" on={notif.tierChange} set={v=>setNotif(n=>({...n, tierChange:v}))}/>
              </div>
            </div>
          </div>

          <div className="pv-card" style={{border:"1px solid var(--hair)"}}>
            <div className="pv-card-hd"><div className="pv-card-t" style={{color:"var(--ink)"}}>Danger zone</div></div>
            <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:14, padding:"12px 0", borderBottom:"1px dashed var(--hair)"}}>
              <div>
                <div style={{fontWeight:500, fontSize:14}}>Kill switch — all rigs</div>
                <div style={{fontSize:12.5, color:"var(--mut)", marginTop:4}}>Pauses every rig immediately. In-flight jobs complete; no new jobs routed. Reversible.</div>
              </div>
              <button className="pv-btn ghost" style={{alignSelf:"center"}}>Pause all rigs</button>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr auto", gap:14, padding:"12px 0"}}>
              <div>
                <div style={{fontWeight:500, fontSize:14, color:"var(--ink)"}}>Close provider account</div>
                <div style={{fontSize:12.5, color:"var(--mut)", marginTop:4}}>Removes all rigs, cancels future payouts. Settles accrued earnings to your IBAN first. Cannot be undone.</div>
              </div>
              <button className="pv-btn ghost" style={{alignSelf:"center", color:"var(--red,#e66)", borderColor:"var(--red,#e66)"}}>Close account</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Switch({ label, sub, on, set }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"44px 1fr", gap:14, padding:"10px 0", borderBottom:"1px dashed var(--hair)", alignItems:"start"}}>
      <label style={{position:"relative", width:42, height:22, marginTop:2, cursor:"pointer"}}>
        <input type="checkbox" checked={on} onChange={e=>set(e.target.checked)} style={{opacity:0, width:0, height:0}}/>
        <span style={{position:"absolute", inset:0, background:on?"var(--orange)":"var(--hair)", borderRadius:999, transition:".2s"}}>
          <span style={{position:"absolute", top:2, left:on?22:2, width:18, height:18, background:"var(--paper)", borderRadius:"50%", transition:".2s"}}/>
        </span>
      </label>
      <div>
        <div style={{fontSize:14, fontWeight:500}}>{label}</div>
        <div style={{fontSize:12, color:"var(--mut)", marginTop:3, lineHeight:1.5}}>{sub}</div>
      </div>
    </div>
  );
}

function Field({ k, v, mono }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"160px 1fr", gap:14, alignItems:"center", padding:"10px 0", borderBottom:"1px dashed var(--hair)"}}>
      <div className="pv-eb">{k}</div>
      <div style={{fontFamily: mono?"var(--mono)":"var(--sans)", fontSize:13}}>{v}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Settings />);
