/* eslint-disable */
/* Settings — tabbed: Profile / Team / Billing / API keys */

const {
  useState, useEffect, useRef,
  Badge, Callout, MagneticButton,
  Arrow, Check, Copy, External, Download, Plus,
  fmt, fmtInt, fmtMoney,
} = window;

const D = window.DCP_APP;

/* ═══ SHARED SHELL (sidebar + topbar) ═══════════════════════ */

function Sidebar({ currentKey="settings" }) {
  const nav = [
    { section: "WORKSPACE", items: [
      { key:"home", ic:"⌂", label:"Overview", href:"./Console.html" },
      { key:"playground", ic:"⟡", label:"Playground" },
      { key:"keys", ic:"◇", label:"API keys", bd:"5" },
      { key:"models", ic:"◎", label:"Models", bd:"4" },
    ]},
    { section: "OPERATIONS", items: [
      { key:"usage", ic:"△", label:"Usage" },
      { key:"jobs", ic:"☷", label:"Batch jobs", bd:"2" },
      { key:"webhooks", ic:"↻", label:"Webhooks" },
      { key:"logs", ic:"▤", label:"Audit log" },
    ]},
    { section: "ACCOUNT", items: [
      { key:"billing", ic:"₪", label:"Billing" },
      { key:"team", ic:"◈", label:"Team", bd:"8" },
      { key:"settings", ic:"⚙", label:"Settings" },
      { key:"docs", ic:"?", label:"Docs", href:"../docs/DCP Docs.html", bd:"↗" },
    ]},
  ];
  const active = D.orgs[0];
  return (
    <aside className="sb">
      <div className="sb-head">
        <div className="mark">D</div>
        <div className="name">DCP</div>
        <div className="env">v2.4</div>
      </div>
      <div className="org-switcher">
        <button className="org-btn">
          <div className="ol" style={{background: active.color}}>{active.logo}</div>
          <div className="on">
            <span className="t">{active.name}</span>
            <span className="s">{active.plan} · {active.members} seats</span>
          </div>
          <span className="chev">▾</span>
        </button>
      </div>
      <nav className="sb-nav">
        {nav.map(s => (
          <div key={s.section}>
            <div className="section">§ {s.section}</div>
            {s.items.map(it => (
              <a key={it.key} className={"sb-item " + (currentKey === it.key ? "on" : "")}
                 href={it.href || "#"}>
                <span className="ic">{it.ic}</span>
                <span>{it.label}</span>
                {it.bd && <span className="bd">{it.bd}</span>}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="sb-foot">
        <div className="avatar">{D.user.avatar}</div>
        <div className="who">
          {D.user.name}
          <span className="e">{D.user.email}</span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumb }) {
  return (
    <div className="tb">
      <div className="tb-crumb">
        <span>NextWave Commerce</span>
        <span className="sep">/</span>
        <span className="cur">{crumb}</span>
      </div>
      <div className="tb-actions">
        <span className="env-pill prod">● PRODUCTION</span>
      </div>
    </div>
  );
}

/* ═══ PROFILE TAB ═══════════════════════════════════════════ */

function TabProfile() {
  const u = D.user;
  return (
    <div>
      <div className="sect-h">
        <div>
          <h2>Your profile</h2>
          <div className="d">This is what your org admins and audit logs see. Your Nafath ID is private.</div>
        </div>
      </div>

      <div className="card">
        <div className="prof-head">
          <div className="avatar">{u.avatar}</div>
          <div className="who">
            <h3>{u.name} <span className="verified-inline">✓ NAFATH VERIFIED</span></h3>
            <div className="e">{u.email} · {u.role.toUpperCase()} · MEMBER SINCE {u.joined.split("-")[0]}</div>
            <div className="m">
              <span>◈ {u.role}</span>
              <span>☎ {u.phone}</span>
              <span>⌕ Last sign-in · {u.last_login}</span>
            </div>
          </div>
          <button className="btn ghost">Change avatar</button>
        </div>
      </div>

      <div className="card">
        <h3>Personal information</h3>
        <p className="cd">Edits to your name or date-of-birth require re-verification with Nafath.</p>
        <div className="form-row">
          <div><label className="fg-label">First name</label><input className="input" defaultValue="Faisal" /></div>
          <div><label className="fg-label">Last name</label><input className="input" defaultValue="Al-Qahtani" /></div>
        </div>
        <div className="form-row">
          <div><label className="fg-label">Work email</label><input className="input" defaultValue={u.email} /></div>
          <div><label className="fg-label">Phone</label><input className="input" defaultValue={u.phone} /></div>
        </div>
        <div className="form-row">
          <div><label className="fg-label">Job title</label><input className="input" defaultValue="CTO & Co-founder" /></div>
          <div>
            <label className="fg-label">Interface language</label>
            <select className="input">
              <option>English</option>
              <option>العربية</option>
            </select>
          </div>
        </div>
        <div style={{display:"flex", gap:10, marginTop:20}}>
          <MagneticButton><button className="btn primary">Save changes</button></MagneticButton>
          <button className="btn ghost">Cancel</button>
        </div>
      </div>

      <div className="card">
        <h3>Security</h3>
        <p className="cd">Two-factor authentication is required on Scale plans and above.</p>
        <div style={{display:"grid", gap:0, border:"1px solid var(--hair)"}}>
          <div style={{padding:"16px 20px", borderBottom:"1px solid var(--hair)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{color:"var(--ink)", fontSize:14}}>SMS to {u.phone.slice(-4).padStart(u.phone.length, "•")}</div>
              <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", marginTop:4}}>PRIMARY · ENABLED</div>
            </div>
            <button className="btn ghost">Change</button>
          </div>
          <div style={{padding:"16px 20px", borderBottom:"1px solid var(--hair)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{color:"var(--ink)", fontSize:14}}>Authenticator app</div>
              <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", marginTop:4}}>BACKUP · ENABLED · GOOGLE AUTHENTICATOR</div>
            </div>
            <button className="btn ghost">Reset</button>
          </div>
          <div style={{padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div>
              <div style={{color:"var(--ink)", fontSize:14}}>Passkey</div>
              <div style={{fontFamily:"var(--mono)", fontSize:11, color:"var(--mut)", marginTop:4}}>NOT SET · RECOMMENDED FOR FASTEST LOGIN</div>
            </div>
            <button className="btn primary">Add passkey</button>
          </div>
        </div>
      </div>

      <div className="danger">
        <h3>§ DANGER ZONE</h3>
        <div className="row">
          <div>
            <div className="t">Transfer ownership</div>
            <div className="s">Assign the Owner role to another Admin. You'll become an Admin.</div>
          </div>
          <button className="btn-d">Transfer</button>
        </div>
        <div className="row">
          <div>
            <div className="t">Delete your account</div>
            <div className="s">Permanent · cannot be undone · organisations you own will be frozen.</div>
          </div>
          <button className="btn-d">Delete account</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ TEAM TAB ═══════════════════════════════════════════ */

function TabTeam() {
  return (
    <div>
      <div className="sect-h">
        <div>
          <h2>Team members</h2>
          <div className="d">{D.team.length} members · Scale plan includes up to 25 seats.</div>
        </div>
        <MagneticButton><button className="btn primary">Invite member <Arrow size={12}/></button></MagneticButton>
      </div>

      <div className="card" style={{padding:0}}>
        <div className="invite-bar">
          <input className="input" placeholder="name@company.sa" />
          <select className="input"><option>Member</option><option>Admin</option><option>Billing</option><option>Developer</option></select>
          <button className="btn primary">Send invite</button>
        </div>

        {D.team.map((m, i) => (
          <div key={i} className="member-row">
            <div className="av">{m.avatar}</div>
            <div>
              <div className="n">{m.name}</div>
              <div className="e">{m.email}</div>
            </div>
            <div className={"role " + (m.role.toLowerCase())}>{m.role}</div>
            <div className="la">Active {m.last}</div>
            <div className="dots" title="More">···</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Role permissions</h3>
        <p className="cd">Define what each role can do. Owner is implied — full access to everything.</p>
        <table style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr style={{fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", letterSpacing:".12em", textTransform:"uppercase"}}>
              <th style={{textAlign:"start", padding:"10px 0", fontWeight:500, borderBottom:"1px solid var(--hair)"}}>Permission</th>
              <th style={{textAlign:"center", padding:"10px 0", fontWeight:500, borderBottom:"1px solid var(--hair)"}}>Admin</th>
              <th style={{textAlign:"center", padding:"10px 0", fontWeight:500, borderBottom:"1px solid var(--hair)"}}>Billing</th>
              <th style={{textAlign:"center", padding:"10px 0", fontWeight:500, borderBottom:"1px solid var(--hair)"}}>Developer</th>
              <th style={{textAlign:"center", padding:"10px 0", fontWeight:500, borderBottom:"1px solid var(--hair)"}}>Member</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["View models and playground", "✓","✓","✓","✓"],
              ["Create / revoke API keys", "✓","—","✓","—"],
              ["Manage team and roles", "✓","—","—","—"],
              ["View & pay invoices", "✓","✓","—","—"],
              ["Change org billing plan", "—","✓","—","—"],
              ["Deploy fine-tuned models", "✓","—","✓","—"],
            ].map((r, i) => (
              <tr key={i} style={{borderBottom: "1px solid var(--hair)"}}>
                <td style={{padding:"14px 0", color:"var(--ink)", fontSize:14}}>{r[0]}</td>
                {r.slice(1).map((c, j) => (
                  <td key={j} style={{padding:"14px 0", textAlign:"center", fontFamily:"var(--mono)", fontSize:14, color: c === "✓" ? "var(--ok)" : "var(--dim)"}}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ BILLING TAB ═══════════════════════════════════════════ */

function TabBilling() {
  const u = D.usage;
  return (
    <div>
      <div className="sect-h">
        <div>
          <h2>Billing</h2>
          <div className="d">SAR invoicing · SAMA-licensed · VAT 15% included where applicable.</div>
        </div>
      </div>

      <div className="bill-hero">
        <div className="pane">
          <div className="k">§ CURRENT PLAN</div>
          <div className="v">Scale<span className="unit">· SAR 4,500 / mo base</span></div>
          <div className="s">Renews 01 MAY 2026 · 11 of 25 seats used</div>
          <div style={{marginTop:20, display:"flex", gap:10}}>
            <button className="btn primary">Upgrade to Enterprise</button>
            <button className="btn ghost">Change plan</button>
          </div>
        </div>
        <div className="pane">
          <div className="k">§ THIS MONTH · SAR</div>
          <div className="v"><em>{fmtInt(u.spend_sar, "en")}</em><span className="unit">/ {fmtInt(u.budget_sar, "en")} budget</span></div>
          <div className="s">Base 4,500 + Usage 10,321 · Projected month-end 19,100</div>
          <div style={{marginTop:20, display:"flex", gap:10}}>
            <button className="btn ghost">Set new budget</button>
            <button className="btn ghost">Download invoice</button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:22, padding:0}}>
        <div style={{padding:"22px 28px", borderBottom:"1px solid var(--hair)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <h3>Payment methods</h3>
            <div style={{color:"var(--ink-2)", fontSize:13, marginTop:4}}>Mada, STC Pay, and international cards are all supported.</div>
          </div>
          <button className="btn primary">＋ Add method</button>
        </div>
        <div className="pm-list">
          {D.payment_methods.map((p, i) => {
            const logoKind = p.kind === "Mada" ? "mada" : p.kind === "Visa" ? "visa" : "stc";
            return (
              <div key={i} className="pm">
                <div className={"logo " + logoKind}>{p.kind === "Visa" ? "VISA" : p.kind === "Mada" ? "MADA" : "STC"}</div>
                <div className="info">
                  <div className="n">{p.brand} {p.last4 !== "—" ? "•••• " + p.last4 : ""}</div>
                  <div className="e">{p.holder} · {p.exp !== "—" ? "Expires " + p.exp : "Non-expiring"}</div>
                </div>
                {p.default && <span className="default">✓ DEFAULT</span>}
                {!p.default && <span style={{width:80}}></span>}
                <span className="dots">···</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card" style={{padding:0}}>
        <div style={{padding:"22px 28px", borderBottom:"1px solid var(--hair)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
          <div>
            <h3>Invoices</h3>
            <div style={{color:"var(--ink-2)", fontSize:13, marginTop:4}}>Monthly statements · ZATCA e-invoices · downloadable as PDF.</div>
          </div>
          <button className="btn ghost">Export all CSV</button>
        </div>
        <table className="inv-table">
          <thead><tr>
            <th>Invoice</th><th>Period</th><th>Amount (SAR)</th><th>Status</th><th>Issued</th><th></th>
          </tr></thead>
          <tbody>
            {D.invoices.map((inv, i) => (
              <tr key={i}>
                <td className="mono">{inv.id}</td>
                <td>{inv.period}</td>
                <td className="mono">{fmtInt(inv.amount, "en")}</td>
                <td><span className={"status " + inv.status}>{inv.status}</span></td>
                <td className="mono">{inv.paid || inv.due}</td>
                <td><a href="#" className="dl">↓ PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Billing details</h3>
        <p className="cd">These appear on every invoice and ZATCA e-invoice issued on your behalf.</p>
        <div className="form-row">
          <div><label className="fg-label">Legal entity</label><input className="input" defaultValue={D.orgs[0].name} /></div>
          <div><label className="fg-label">CR number</label><input className="input" defaultValue={D.orgs[0].cr} /></div>
        </div>
        <div className="form-row">
          <div><label className="fg-label">VAT number</label><input className="input" defaultValue={D.orgs[0].vat} /></div>
          <div><label className="fg-label">Billing email</label><input className="input" defaultValue="billing@nextwave.sa" /></div>
        </div>
        <div className="form-row wide">
          <div><label className="fg-label">Registered address</label><input className="input" defaultValue="Al Olaya, Riyadh 12211, Saudi Arabia" /></div>
        </div>
        <div style={{marginTop:16}}>
          <button className="btn primary">Save billing details</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ API KEYS TAB ═══════════════════════════════════════════ */

function TabKeys() {
  const [reveal, setReveal] = useState({});
  return (
    <div>
      <div className="sect-h">
        <div>
          <h2>API keys</h2>
          <div className="d">One secret per environment. Rotate at least every 90 days — we'll remind you.</div>
        </div>
        <MagneticButton><button className="btn primary">＋ Create new key</button></MagneticButton>
      </div>

      <Callout tone="warn" label="ROTATION DUE">
        Key <span style={{fontFamily:"var(--mono)"}}>dcp_live_••••4F2a</span> was created 94 days ago. We strongly recommend rotating keys every 90 days — <a href="#" style={{color:"var(--ink)", borderBottom:"1px solid currentColor"}}>rotate now →</a>
      </Callout>

      <div className="card" style={{padding:0, marginTop:22}}>
        <div style={{padding:"18px 22px", borderBottom:"1px solid var(--hair)", display:"grid", gridTemplateColumns:"1fr 120px 160px 120px 40px", gap:16, fontFamily:"var(--mono)", fontSize:10.5, color:"var(--mut)", letterSpacing:".12em", textTransform:"uppercase"}}>
          <span>Name & secret</span><span>Scope</span><span>Last used</span><span>Status</span><span></span>
        </div>
        {D.keys.map((k, i) => {
          const env = k.env === "production" ? "PROD" : "STG";
          const envClass = k.env === "production" ? "prod" : "stg";
          return (
            <div key={k.id} className="key-row">
              <div>
                <div className="knm">{k.name}</div>
                <div className="kv">
                  <span>{reveal[k.id] ? k.prefix + "_" + "x".repeat(28) : k.prefix + "_" + "•".repeat(24) + "••••"}</span>
                  <span className="copy" onClick={()=>setReveal(r=>({...r, [k.id]: !r[k.id]}))}>{reveal[k.id] ? "HIDE" : "SHOW"}</span>
                  <span className="copy">COPY</span>
                </div>
              </div>
              <span className={"scope " + envClass}>{env}</span>
              <span className="lu">{k.last_used}</span>
              <span className="st active">ACTIVE</span>
              <span className="dots">···</span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>IP allow-list</h3>
        <p className="cd">Restrict which addresses can authenticate with your keys. CIDR ranges welcome. Leave empty to allow any.</p>
        <div style={{display:"grid", gap:8, fontFamily:"var(--mono)", fontSize:12}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 120px 40px", gap:8, padding:"10px 14px", border:"1px solid var(--hair)", background:"var(--bg)"}}>
            <span>213.171.32.0/24</span>
            <span style={{color:"var(--mut)"}}>RIYADH-OFFICE</span>
            <span style={{color:"var(--mut)", cursor:"pointer"}}>✕</span>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 120px 40px", gap:8, padding:"10px 14px", border:"1px solid var(--hair)", background:"var(--bg)"}}>
            <span>45.130.81.4/32</span>
            <span style={{color:"var(--mut)"}}>API-GATEWAY</span>
            <span style={{color:"var(--mut)", cursor:"pointer"}}>✕</span>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 120px 40px", gap:8, padding:"10px 14px", border:"1px dashed var(--hair)", background:"var(--bg-2)", color:"var(--mut)"}}>
            <span>Add CIDR · e.g. 1.2.3.0/24</span>
            <span>Label</span>
            <span style={{color:"var(--orange)", cursor:"pointer"}}>＋</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Webhooks</h3>
        <p className="cd">We'll POST signed events here — job completions, usage alerts, budget warnings.</p>
        <div style={{display:"flex", gap:10, alignItems:"center", padding:"14px 18px", border:"1px solid var(--hair)", background:"var(--bg)", fontFamily:"var(--mono)", fontSize:13}}>
          <span style={{color:"var(--ok)"}}>●</span>
          <span style={{flex:1, color:"var(--ink)"}}>https://nextwave.sa/api/dcp/webhooks</span>
          <span style={{color:"var(--mut)", fontSize:11}}>7 EVENTS · LAST 12M AGO</span>
          <button className="btn ghost" style={{padding:"6px 12px", fontSize:11}}>Test</button>
          <button className="btn ghost" style={{padding:"6px 12px", fontSize:11}}>Edit</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ APP ══════════════════════════════════════════════════ */

function SettingsApp() {
  const [tab, setTab] = useState(() => localStorage.getItem("dcp.settings.tab") || "profile");
  useEffect(() => localStorage.setItem("dcp.settings.tab", tab), [tab]);

  const TABS = [
    { k:"profile", n:"01", label:"Profile" },
    { k:"team",    n:"02", label:"Team" },
    { k:"billing", n:"03", label:"Billing" },
    { k:"keys",    n:"04", label:"API keys" },
  ];
  const cur = TABS.find(t => t.k === tab) || TABS[0];

  return (
    <div className="app">
      <Sidebar currentKey="settings" />
      <Topbar crumb={"SETTINGS · " + cur.label.toUpperCase()} />
      <main className="main">
        <div className="set-head">
          <div className="eb">§ SETTINGS</div>
          <h1>Your <em>workspace.</em></h1>
          <p>Profile, team, billing, and keys — everything that governs how your org uses DCP.</p>
          <div className="set-tabs">
            {TABS.map(t => (
              <div key={t.k} className={"tab " + (tab===t.k?"on":"")} onClick={()=>setTab(t.k)}>
                <span className="num">§{t.n}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="set-body">
          {tab==="profile" && <TabProfile />}
          {tab==="team"    && <TabTeam />}
          {tab==="billing" && <TabBilling />}
          {tab==="keys"    && <TabKeys />}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<SettingsApp />);
