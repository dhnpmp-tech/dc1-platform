/* eslint-disable */
/* ops-shell.jsx — internal operator console shell
 * Exports: window.OpsShell, window.OpsNav (data), window.OpsSidebar, window.OpsTopbar
 * Depends on: React only.
 */

(() => {
  const { useState, useEffect } = React;

  const NAV = [
    { section: "Live", items: [
      { key:"overview", ic:"◐", label:"Overview",    href:"./Overview.html" },
      { key:"fleet",    ic:"◉", label:"Fleet map",   href:"./Fleet Map.html" },
      { key:"jobs",     ic:"≡", label:"Jobs monitor", bd:"LIVE", href:"./Jobs Monitor.html" },
      { key:"incidents",ic:"!", label:"Incidents",   bd:"1",    bdType:"hot", href:"./Incidents.html" },
      { key:"oncall",   ic:"☎", label:"On-call",     href:"./On-call.html" },
    ]},
    { section: "Directory", items: [
      { key:"providers",ic:"◇", label:"Providers",   bd:"9",    bdType:"hot", href:"./Providers.html" },
      { key:"customers",ic:"◈", label:"Customers",   href:"./Customers.html" },
      { key:"models",   ic:"◎", label:"Models",      bd:"3",    href:"./Models.html" },
      { key:"tickets",  ic:"☰", label:"Tickets",     bd:"34",   href:"./Tickets.html" },
    ]},
    { section: "Control", items: [
      { key:"pricing",  ic:"₪", label:"Pricing",     href:"./Pricing.html" },
      { key:"payouts",  ic:"⤓", label:"Billing · Payouts", href:"./Billing.html" },
      { key:"flags",    ic:"⚑", label:"Feature flags", href:"./Flags.html" },
      { key:"compliance",ic:"§",label:"Compliance",  bd:"12",   bdType:"hot", href:"./Compliance.html" },
      { key:"audit",    ic:"▤", label:"Audit log",   href:"./Audit.html" },
    ]},
  ];

  function OpsSidebar({ current, env="PROD", build="ab1e0f6" }) {
    return (
      <aside className="ops-sb">
        <div className="ops-sb-head">
          <div className="ops-sb-title">
            <div className="ops-sb-mark">D</div>
            <div className="ops-sb-name">DCP<span>Ops</span></div>
          </div>
          <div className="ops-sb-sub">
            <span>Internal console</span>
            <span className="env">{env}</span>
          </div>
        </div>

        <div className="ops-sb-env">
          <div className="row ok"><span>API</span><span className="v">operational</span></div>
          <div className="row ok"><span>Router</span><span className="v">v2.4.11</span></div>
          <div className="row warn"><span>DMM p95</span><span className="v">41ms</span></div>
          <div className="row ok"><span>Build</span><span className="v">{build}</span></div>
        </div>

        <nav className="ops-nav">
          {NAV.map(s => (
            <div key={s.section}>
              <div className="sec">§ {s.section}</div>
              {s.items.map(it => (
                <a key={it.key} className={"ops-nav-a " + (current === it.key ? "on" : "")}
                   href={it.href || "#"}>
                  <span className="ic">{it.ic}</span>
                  <span>{it.label}</span>
                  {it.bd && <span className={"bd " + (it.bdType || "")}>{it.bd}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="ops-sb-foot">
          <div className="av">A</div>
          <div className="who">
            <div className="n">ammar</div>
            <div className="e">on-call · primary</div>
          </div>
          <span className="out" title="Sign out">⏻</span>
        </div>
      </aside>
    );
  }

  function OpsClock() {
    const [t, setT] = useState("");
    useEffect(() => {
      const tick = () => {
        const d = new Date();
        const hh = String(d.getHours()).padStart(2,"0");
        const mm = String(d.getMinutes()).padStart(2,"0");
        const ss = String(d.getSeconds()).padStart(2,"0");
        setT(`${hh}:${mm}:${ss}`);
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }, []);
    return <span className="ops-tb-clock">{t}<span className="tz">AST</span></span>;
  }

  function OpsTopbar({ crumb, right, alarms=0 }) {
    return (
      <div className="ops-tb">
        <div className="ops-crumb">
          <span>ops.dcp.sa</span>
          <span className="sep">/</span>
          <span className="cur">{crumb}</span>
        </div>
        <OpsClock />
        {alarms > 0 && (
          <button className="ops-tb-btn alarm" title="Active alerts">{alarms} ALERT{alarms>1?"S":""}</button>
        )}
        <div style={{display:"flex", gap:6}}>
          {right}
          <button className="ops-tb-btn" title="Search">⌕ Search</button>
        </div>
      </div>
    );
  }

  function OpsShell({ current, crumb, alarms, children, topbarRight, env, build }) {
    return (
      <div className="ops-shell">
        <OpsSidebar current={current} env={env} build={build} />
        <div className="ops-main">
          <OpsTopbar crumb={crumb} right={topbarRight} alarms={alarms} />
          {children}
        </div>
      </div>
    );
  }

  /* Sparkline from array of numbers */
  function Spark({ data, color="accent", height=34, peakHi=true }) {
    const max = Math.max(...data);
    return (
      <div className={"ops-spark " + (color !== "accent" ? color : "")} style={{height}}>
        {data.map((v, i) => (
          <div key={i} className={"bar " + (peakHi && v === max ? "peak" : "")}
               style={{ height: `${(v/max)*100}%` }} />
        ))}
      </div>
    );
  }

  /* Simple chip */
  function Chip({ kind="mut", dot=false, children }) {
    return <span className={`ops-chip ${kind} ${dot ? "dot" : ""}`}>{children}</span>;
  }

  /* Bar meter */
  function Bar({ v, color="accent" }) {
    const cls = color === "accent" ? "" : color;
    return <div className={`ops-bar ${cls}`}><div className="ops-bar-f" style={{width: `${Math.min(100, v*100)}%`}} /></div>;
  }

  /* KPI card */
  function Kpi({ label, value, delta, deltaKind="up", unit, em=false }) {
    const dCls = deltaKind === "down" ? "down" : deltaKind === "neutral" ? "neutral" : "";
    return (
      <div className="ops-kpi">
        <div className="ops-kpi-lbl">{label}</div>
        <div className="ops-kpi-v">
          {em ? <em>{value}</em> : value}
          {unit && <span>{unit}</span>}
        </div>
        {delta != null && <div className={"ops-kpi-d " + dCls}>{delta}</div>}
      </div>
    );
  }

  Object.assign(window, { OpsShell, OpsSidebar, OpsTopbar, OpsClock, Spark, Chip, Bar, Kpi, OPS_NAV: NAV });
})();
