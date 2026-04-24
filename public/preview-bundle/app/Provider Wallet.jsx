/* Provider Wallet — SAR IBAN + USDC on Base · history · settings */
const { useState } = React;
const D = window.DCP_PROVIDER;

function Wallet() {
  const [mode, setMode] = useState(D.provider.payoutMode);
  const balance = 428;
  const onchain = 0;

  return (
    <div className="pv-shell">
      <window.PvSidebar current="wallet" />
      <div className="pv-main">
        <window.PvTopbar crumb="Wallet" />
        <div className="pv-page">
          <div className="pv-page-hd">
            <div>
              <div className="pv-page-eb">Payouts · wallet</div>
              <h1 className="pv-page-h1">Your balance is <em>SAR {balance}</em>.</h1>
              <div className="pv-page-lede">Paid every Monday. Switch between Saudi Riyal to your IBAN, or USDC on Base for on-chain settlement.</div>
            </div>
            <button className="pv-btn primary">Withdraw now</button>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1.4fr 1fr", marginBottom:24}}>
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-eb orange">Available to withdraw</div></div>
              <div style={{fontFamily:"var(--serif)", fontSize:96, fontStyle:"italic", color:"var(--orange)", lineHeight:1.08, letterSpacing:"-.02em", paddingBottom:8}}>SAR {balance}</div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:20, paddingTop:16, borderTop:"1px dashed var(--hair)"}}>
                <KV k="Accruing" v={"SAR " + balance} />
                <KV k="Cleared" v="SAR 0" />
                <KV k="On-chain · USDC" v={"$" + onchain.toFixed(2)} />
              </div>
            </div>

            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Payout mode</div></div>
              <div style={{display:"grid", gap:10}}>
                <button className={"pv-card tight " + (mode==="sar"?"":"")} onClick={()=>setMode("sar")} style={{border: mode==="sar"?"1px solid var(--orange)":"1px solid var(--hair)", cursor:"pointer", textAlign:"start", padding:16}}>
                  <div className="pv-eb orange">SAR · default</div>
                  <div style={{fontFamily:"var(--serif)", fontSize:20, marginTop:4}}>Saudi Riyal · IBAN</div>
                  <div className="mono" style={{fontSize:12, color:"var(--mut)", marginTop:4}}>{D.provider.iban} · Al Rajhi</div>
                </button>
                <button onClick={()=>setMode("usdc")} style={{border: mode==="usdc"?"1px solid var(--orange)":"1px solid var(--hair)", background:"transparent", cursor:"pointer", textAlign:"start", padding:16}}>
                  <div className="pv-eb">USDC · on-chain</div>
                  <div style={{fontFamily:"var(--serif)", fontSize:20, marginTop:4, color:"var(--ink)"}}>USDC on Base L2</div>
                  <div className="mono" style={{fontSize:12, color:"var(--mut)", marginTop:4}}>0x7Fe3…A2F1 · claim anytime</div>
                </button>
              </div>
            </div>
          </div>

          <div className="pv-grid" style={{gridTemplateColumns:"1fr 1fr", marginBottom:24}}>
            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Settlement · how it works</div></div>
              <ol style={{margin:0, padding:0, listStyle:"none", display:"grid", gap:14, counterReset:"step"}}>
                {[
                  ["Renter places estimate hold", "When a renter submits a job, we hold max estimated SAR from their balance."],
                  ["Your rig runs the job", "Tokens stream from your GPU. We time the whole thing to the millisecond."],
                  ["Settled by runtime", "Final amount is computed from actual runtime, not estimate. Unused hold returns to the renter."],
                  ["Provider share is 75%", "Immediately credited to your wallet. Platform takes 25%. Gold+ tiers get a bigger cut."],
                  ["Weekly payout", "Every Monday morning to SAR or USDC. On-chain claim is available anytime."],
                ].map(([t,d],i)=>(
                  <li key={i} style={{display:"grid", gridTemplateColumns:"auto 1fr", gap:14}}>
                    <div style={{fontFamily:"var(--serif)", fontStyle:"italic", fontSize:28, color:"var(--orange)", lineHeight:1}}>{String(i+1).padStart(2,"0")}</div>
                    <div>
                      <div style={{fontWeight:500, fontSize:14}}>{t}</div>
                      <div style={{fontSize:12.5, color:"var(--ink-2)", marginTop:3, lineHeight:1.5}}>{d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pv-card">
              <div className="pv-card-hd"><div className="pv-card-t">Tax · invoicing</div></div>
              <div style={{display:"grid", gap:14}}>
                <KV k="VAT registration" v="Optional · under SAR 375k/yr revenue" />
                <KV k="Invoice format" v="ZATCA-compliant PDF + XML" />
                <KV k="Invoice delivery" v={"Emailed to " + D.provider.email + " monthly"} />
                <KV k="Withholding" v="None — you are a sole trader service-provider" />
                <KV k="Tax number" v="— · add in Settings" />
              </div>
              <a className="pv-btn ghost" style={{marginTop:14, display:"inline-block"}}>Download October invoice ↓</a>
            </div>
          </div>

          <div className="pv-card" style={{padding:0}}>
            <div className="pv-card-hd" style={{padding:"16px 20px"}}>
              <div className="pv-card-t">Payout history</div>
            </div>
            <table className="pv-tbl">
              <thead><tr><th>Date</th><th>Period</th><th>Mode</th><th>Reference</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
              {D.payouts.map(p => (
                <tr key={p.id}>
                  <td className="mono">{p.date}</td>
                  <td><b>{p.period}</b></td>
                  <td className="mono">{p.mode}</td>
                  <td className="mono" style={{color:"var(--mut)"}}>{p.id}</td>
                  <td className="num" style={{color:"var(--orange)"}}>SAR {p.sar.toLocaleString()}</td>
                  <td><span className={"pv-chip " + (p.status==="paid"?"ok":"hot")}>{p.status}</span></td>
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

function KV({ k, v }) { return <div><div className="pv-eb">{k}</div><div style={{fontFamily:"var(--mono)", fontSize:13, marginTop:3}}>{v}</div></div>; }

ReactDOM.createRoot(document.getElementById("root")).render(<Wallet />);
