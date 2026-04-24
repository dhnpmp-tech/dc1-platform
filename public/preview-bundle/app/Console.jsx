/* eslint-disable */
/* Console — full product shell: sidebar + org switcher + topbar + dashboard */

const {
  useState, useEffect, useRef,
  Sparkline, Badge, Callout, MagneticButton,
  Arrow, Check, Copy, External, Download, Plus, Cpu, Zap, Shield, Key,
  fmt, fmtInt, fmtMoney,
} = window;

const D = window.DCP_APP;

/* ═══ SIDEBAR ═══════════════════════════════════════════════ */

function OrgSwitcher() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(D.orgs[0]);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  return (
    <div className="org-switcher" ref={ref}>
      <button className="org-btn" onClick={e => { e.stopPropagation(); setOpen(o=>!o); }}>
        <div className="ol" style={{background: active.color}}>{active.logo}</div>
        <div className="on">
          <span className="t">{active.name}</span>
          <span className="s">{active.plan} · {active.members}{active.members===1?" seat":" seats"}</span>
        </div>
        <span className="chev">▾</span>
      </button>
      {open && (
        <div className="org-dd">
          <div className="divider">§ YOUR ORGS</div>
          {D.orgs.map(o => (
            <div key={o.id} className="item" onClick={() => { setActive(o); setOpen(false); }}>
              <div className="ol" style={{background: o.color}}>{o.logo}</div>
              <span className="name">{o.name}</span>
              <span className="plan">{o.plan}</span>
            </div>
          ))}
          <div className="new">＋ Create new organisation</div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ current }) {
  const nav = [
    {
      section: "WORKSPACE",
      items: [
        { key:"home",       ic:"⌂", label:"Overview",   bd:null },
        { key:"playground", ic:"⟡", label:"Playground", bd:null },
        { key:"keys",       ic:"◇", label:"API keys",   bd:"5" },
        { key:"models",     ic:"◎", label:"Models",     bd:"4" },
      ],
    },
    {
      section: "OPERATIONS",
      items: [
        { key:"usage",      ic:"△", label:"Usage",      bd:null },
        { key:"jobs",       ic:"☷", label:"Batch jobs", bd:"2" },
        { key:"webhooks",   ic:"↻", label:"Webhooks",   bd:null },
        { key:"logs",       ic:"▤", label:"Audit log",  bd:null },
      ],
    },
    {
      section: "ACCOUNT",
      items: [
        { key:"billing",    ic:"₪", label:"Billing",    bd:null },
        { key:"team",       ic:"◈", label:"Team",       bd:"8" },
        { key:"settings",   ic:"⚙", label:"Settings",   bd:null },
        { key:"docs",       ic:"?", label:"Docs",       bd:"↗" },
      ],
    },
  ];
  return (
    <aside className="sb">
      <div className="sb-head">
        <div className="mark">D</div>
        <div className="name">DCP</div>
        <div className="env">v2.4</div>
      </div>

      <OrgSwitcher />

      <nav className="sb-nav">
        {nav.map(s => (
          <div key={s.section}>
            <div className="section">§ {s.section}</div>
            {s.items.map(it => (
              <a key={it.key} className={"sb-item " + (current === it.key ? "on" : "")}
                href={it.key === "settings" ? "./Settings.html" : it.key === "docs" ? "../docs/DCP Docs.html" : "#"}>
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
        <span className="out" title="Sign out">↱</span>
      </div>
    </aside>
  );
}

/* ═══ TOPBAR ═══════════════════════════════════════════════ */

function Topbar({ crumb }) {
  return (
    <div className="tb">
      <div className="tb-crumb">
        <span>NextWave Commerce</span>
        <span className="sep">/</span>
        <span className="cur">{crumb}</span>
      </div>
      <div className="tb-search">
        <span className="ic">⌕</span>
        <input placeholder="Search models, keys, logs, members…" />
        <span className="kbd">⌘K</span>
      </div>
      <div className="tb-actions">
        <span className="env-pill prod">● PRODUCTION</span>
        <button className="tb-act" title="Notifications">◉<span className="n">3</span></button>
        <button className="tb-act" title="Help">?</button>
        <button className="tb-act" title="What's new">✦</button>
      </div>
    </div>
  );
}

/* ═══ DASHBOARD — OVERVIEW ═══════════════════════════════════ */

function UsageChart() {
  const spark = D.usage.sparkline_30d;
  const max = Math.max(...spark);
  return (
    <div className="chart">
      <div style={{display:"flex", gap:2, alignItems:"flex-end", height:160}}>
        {spark.map((v, i) => {
          const h = (v / max) * 100;
          const isToday = i === spark.length - 1;
          return (
            <div key={i} style={{
              flex: 1, height: h + "%",
              background: isToday ? "var(--orange)" : "var(--teal)",
              minWidth: 3, opacity: isToday ? 1 : 0.7,
            }} title={`Day ${i+1}: ${v} req`} />
          );
        })}
      </div>
      <div className="chart-axis">
        <span>30 DAYS AGO</span>
        <span>TODAY · 824 REQ</span>
      </div>
    </div>
  );
}

function Overview() {
  const u = D.usage;
  const pct = (u.spend_sar / u.budget_sar) * 100;

  return (
    <main className="main">
      <div className="page-head-2">
        <div className="eb">§ OVERVIEW · {u.month_label.toUpperCase()}</div>
        <h1>Good morning, <em>Faisal.</em></h1>
        <p>Your month-to-date. All systems operational, 3 incidents resolved, and your budget has some runway left.</p>
      </div>

      {/* Stat row */}
      <div className="stats-4">
        <div className="s">
          <div className="k">Requests · MTD</div>
          <div className="v">{fmtInt(u.requests, "en")}</div>
          <div className="sub ok">↗ +24.1% vs last month</div>
        </div>
        <div className="s">
          <div className="k">Tokens · IN / OUT</div>
          <div className="v">{(u.tokens_in/1e6).toFixed(1)}M<span style={{fontFamily:"var(--sans)", fontSize:16, color:"var(--mut)", marginInlineStart:8}}>/ {(u.tokens_out/1e6).toFixed(1)}M</span></div>
          <div className="sub">18.4M billed input</div>
        </div>
        <div className="s">
          <div className="k">Spend · MTD</div>
          <div className="v">{fmtInt(u.spend_sar, "en")}<span style={{fontFamily:"var(--mono)", fontSize:13, color:"var(--mut)", marginInlineStart:8}}>SAR</span></div>
          <div className="sub warn">⚠ 74% of monthly budget</div>
        </div>
        <div className="s">
          <div className="k">P95 latency</div>
          <div className="v">{u.p95_ms}<span style={{fontFamily:"var(--mono)", fontSize:13, color:"var(--mut)", marginInlineStart:4}}>ms</span></div>
          <div className="sub ok">● {u.uptime_30d}% uptime · 30d</div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="budget">
        <div className="info">
          <div className="k">§ BUDGET · APRIL 2026</div>
          <div className="v"><em>{fmtInt(u.spend_sar, "en")}</em><span className="of">of {fmtInt(u.budget_sar, "en")} SAR</span></div>
          <div className="s">Projected month-end · 19,100 SAR · within budget</div>
        </div>
        <div>
          <div className="meter">
            <div className="fill" style={{width: pct + "%"}}/>
            <div className="tick" style={{left: "50%"}}/>
            <div className="tick" style={{left: "75%"}}/>
            <div className="tick" style={{left: "90%"}}/>
          </div>
          <div className="meta">
            <span>0</span><span>50%</span><span>75%</span><span>90%</span><span>CAP</span>
          </div>
        </div>
      </div>

      {/* Two-col */}
      <div className="dash-2">
        <div>
          {/* Usage chart */}
          <div className="panel">
            <div className="panel-hd">
              <div>
                <h3>Requests · last 30 days</h3>
                <div className="sub">INFERENCE API · ALL MODELS</div>
              </div>
              <a className="more" href="#">Open usage →</a>
            </div>
            <UsageChart />
          </div>

          {/* Model share */}
          <div className="panel" style={{marginTop:24}}>
            <div className="panel-hd">
              <div>
                <h3>By model · MTD spend</h3>
                <div className="sub">4 MODELS · 18,420,000 IN · 6,180,000 OUT</div>
              </div>
              <a className="more" href="#">All models →</a>
            </div>
            <div className="model-list">
              {u.by_model.map(m => (
                <div key={m.m} className="row">
                  <span className="name">{m.m}</span>
                  <span className="sar">{fmtInt(m.sar, "en")} SAR</span>
                  <div className="bar"><div className="fill" style={{width: m.share + "%"}}/></div>
                  <div className="sub">
                    <span>{(m.in/1e6).toFixed(1)}M in · {(m.out/1e6).toFixed(1)}M out</span>
                    <span>{m.share}% of spend</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          {/* Onboarding checklist */}
          <div className="panel">
            <div className="panel-hd">
              <div>
                <h3>Get set up</h3>
                <div className="sub">5 / 8 COMPLETE</div>
              </div>
              <a className="more" href="#">Skip →</a>
            </div>
            <div className="checklist">
              {D.onboarding.map(o => (
                <div key={o.id} className={"row " + (o.done ? "done" : "")}>
                  <div className="chk">{o.done ? "✓" : ""}</div>
                  <div>
                    <div className="t">{o.t}</div>
                    <div className="hint">{o.hint}</div>
                  </div>
                  {!o.done && <span className="go">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="panel" style={{marginTop:24}}>
            <div className="panel-hd">
              <div>
                <h3>Recent activity</h3>
                <div className="sub">LAST 72 HOURS</div>
              </div>
              <a className="more" href="#">Audit log →</a>
            </div>
            <div className="act-list">
              {D.activity.map((a,i) => (
                <div key={i} className="row">
                  <div className={"dot " + a.sev}/>
                  <div>
                    <div className="who">{a.who}</div>
                    <div className="e">{a.e}</div>
                  </div>
                  <div className="t">{a.t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ═══ APP ══════════════════════════════════════════════════ */

function App() {
  return (
    <div className="app">
      <Sidebar current="home" />
      <Topbar crumb="OVERVIEW" />
      <Overview />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
