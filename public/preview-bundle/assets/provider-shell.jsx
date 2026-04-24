/* eslint-disable */
/* provider-shell.jsx — sidebar/topbar for provider surface
 * Exports: window.PvSidebar, window.PvTopbar
 */
(() => {
  const D = window.DCP_PROVIDER;

  const NAV = [
    { section:"OPERATE", items: [
      { key:"dash",    ic:"⌂", label:"Dashboard",  href:"./Provider Dashboard.html" },
      { key:"rigs",    ic:"☷", label:"Rigs",       bd:String(D.rigs.length), href:"./Provider Rigs.html" },
      { key:"jobs",    ic:"≡", label:"Jobs",       href:"./Provider Jobs.html" },
      { key:"models",  ic:"◎", label:"Models",     bd:String(D.models.filter(m=>m.enabled).length), href:"./Provider Models.html" },
    ]},
    { section:"EARN", items: [
      { key:"earnings",ic:"△", label:"Earnings",   href:"./Provider Earnings.html" },
      { key:"wallet",  ic:"₪", label:"Wallet",     href:"./Provider Wallet.html" },
      { key:"rep",     ic:"✦", label:"Reputation", href:"./Provider Reputation.html" },
    ]},
    { section:"ACCOUNT", items: [
      { key:"settings",ic:"⚙", label:"Settings",   href:"./Provider Settings.html" },
      { key:"docs",    ic:"?", label:"Provider docs", bd:"↗", href:"../Docs v2.html" },
    ]},
  ];

  function PvSidebar({ current }) {
    const activeRigs = D.rigs.filter(r=>r.status==="earning").length;
    return (
      <aside className="pv-sb">
        <div className="pv-sb-head">
          <div className="mark">D</div>
          <div className="name">DCP<i>provider</i></div>
          <div className="env">v1</div>
        </div>
        <div className="pv-status">
          <div className="pv-status-row">
            <div className="pv-status-lbl">Status</div>
            <div className="pv-status-val on">{activeRigs}/{D.rigs.length} earning</div>
          </div>
          <div className="pv-status-row">
            <div className="pv-status-lbl">Today</div>
          </div>
          <div className="pv-status-earn">SAR {D.totals.today}<span>/ so far</span></div>
        </div>
        <nav className="pv-nav">
          {NAV.map(s => (
            <div key={s.section}>
              <div className="sec">§ {s.section}</div>
              {s.items.map(it => (
                <a key={it.key} className={current===it.key?"on":""} href={it.href||"#"}>
                  <span className="ic">{it.ic}</span>
                  <span>{it.label}</span>
                  {it.bd && <span className="bd">{it.bd}</span>}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="pv-sb-foot">
          <div className="avatar">{D.provider.avatar}</div>
          <div className="who">
            {D.provider.name}
            <span className="e">{D.provider.tier} · trust {D.provider.trust}</span>
          </div>
          <span className="out">↱</span>
        </div>
      </aside>
    );
  }

  function PvTopbar({ crumb, live = true }) {
    return (
      <div className="pv-tb">
        <div className="pv-crumb">
          <span>{D.provider.handle}</span>
          <span className="sep">/</span>
          <span className="cur">{crumb}</span>
        </div>
        {live && <div className="pv-tb-pill">● live · earning</div>}
        <button className="pv-tb-kill">◉ Kill switch</button>
      </div>
    );
  }

  window.PvSidebar = PvSidebar;
  window.PvTopbar = PvTopbar;
})();
