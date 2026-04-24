/* eslint-disable */
/* app-shell.jsx — shared sidebar/topbar React components for the logged-in surface
 * Exports: window.AppSidebar, window.AppTopbar, window.AppFrame, window.OrgSwitcher
 * Depends on: React, ReactDOM, dcp-kit.jsx, window.DCP_APP (data-app.js)
 */

(() => {
  const { useState, useEffect, useRef } = React;
  const D = window.DCP_APP;

  /* ─── Language + direction (shared across all app screens) ── */
  const I18N = window.DCP_I18N || {};
  const LS_LANG = "dcp.lang";
  function getLang() { try { return localStorage.getItem(LS_LANG) || "en"; } catch { return "en"; } }
  function setLang(l) {
    try { localStorage.setItem(LS_LANG, l); } catch {}
    document.documentElement.setAttribute("lang", l);
    document.documentElement.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    window.dispatchEvent(new CustomEvent("dcp-lang", { detail: l }));
  }
  // Apply immediately on load (before React paints) so users don't see a flicker
  setLang(getLang());

  function useLang() {
    const [lang, setL] = useState(getLang());
    useEffect(() => {
      const h = (e) => setL(e.detail);
      window.addEventListener("dcp-lang", h);
      return () => window.removeEventListener("dcp-lang", h);
    }, []);
    return [lang, setLang];
  }
  function T(lang, path, fallback) {
    const dict = I18N[lang === "ar" ? "app_ar" : "app_en"] || {};
    return path.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), dict) ?? fallback ?? path;
  }

  /* ─── Org switcher dropdown ────────────────────────────── */
  function OrgSwitcher() {
    const [lang] = useLang();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(D.orgs[0]);
    const ref = useRef(null);
    useEffect(() => {
      const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
      document.addEventListener("click", h);
      return () => document.removeEventListener("click", h);
    }, []);
    const seatWord = active.members===1 ? T(lang,"user.seat","seat") : T(lang,"user.seats","seats");
    return (
      <div className="org-switcher" ref={ref}>
        <button className="org-btn" onClick={e => { e.stopPropagation(); setOpen(o=>!o); }}>
          <div className="ol" style={{background: active.color}}>{active.logo}</div>
          <div className="on">
            <span className="t">{active.name}</span>
            <span className="s">{active.plan} · {active.members} {seatWord}</span>
          </div>
          <span className="chev">▾</span>
        </button>
        {open && (
          <div className="org-dd">
            <div className="divider">§ {T(lang,"user.your_orgs","YOUR ORGS")}</div>
            {D.orgs.map(o => (
              <div key={o.id} className="item" onClick={() => { setActive(o); setOpen(false); }}>
                <div className="ol" style={{background: o.color}}>{o.logo}</div>
                <span className="name">{o.name}</span>
                <span className="plan">{o.plan}</span>
              </div>
            ))}
            <div className="new">＋ {T(lang,"user.new_org","Create new organisation")}</div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Sidebar ──────────────────────────────────────────── */
  const NAV = [
    { section: "WORKSPACE", items: [
      { key:"home",       ic:"⌂", label:"Overview",   href:"./Console.html" },
      { key:"playground", ic:"⟡", label:"Playground", href:"./Playground.html" },
      { key:"keys",       ic:"◇", label:"API keys",   bd:"5", href:"./Settings.html#keys" },
      { key:"models",     ic:"◎", label:"Models",     bd:"4", href:"./Models.html" },
    ]},
    { section: "OPERATIONS", items: [
      { key:"usage",      ic:"△", label:"Usage",      href:"./Usage.html" },
      { key:"jobs",       ic:"☷", label:"Batch jobs", bd:"2", href:"./Jobs.html" },
      { key:"webhooks",   ic:"↻", label:"Webhooks" },
      { key:"logs",       ic:"▤", label:"Audit log",  href:"./Audit.html" },
    ]},
    { section: "ACCOUNT", items: [
      { key:"billing",    ic:"₪", label:"Billing",    href:"./Settings.html" },
      { key:"team",       ic:"◈", label:"Team",       bd:"8", href:"./Settings.html" },
      { key:"settings",   ic:"⚙", label:"Settings",   href:"./Settings.html" },
      { key:"docs",       ic:"?", label:"Docs",       bd:"↗", href:"../docs/DCP Docs.html" },
    ]},
  ];

  function AppSidebar({ current }) {
    const [lang] = useLang();
    return (
      <aside className="sb">
        <div className="sb-head">
          <div className="mark">D</div>
          <div className="name">DCP</div>
          <div className="env">v2.4</div>
        </div>
        <OrgSwitcher />
        <nav className="sb-nav">
          {NAV.map(s => (
            <div key={s.section}>
              <div className="section">§ {T(lang, "nav_sections."+s.section, s.section)}</div>
              {s.items.map(it => (
                <a key={it.key} className={"sb-item " + (current === it.key ? "on" : "")}
                   href={it.href || "#"}>
                  <span className="ic">{it.ic}</span>
                  <span>{T(lang, "nav."+it.key, it.label)}</span>
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
          <span className="out" title={T(lang,"user.signout","Sign out")}>↱</span>
        </div>
      </aside>
    );
  }

  /* ─── Language toggle button ──────────────────────────── */
  function LangToggle() {
    const [lang, set] = useLang();
    return (
      <button className="tb-act lang-tog" onClick={() => set(lang === "en" ? "ar" : "en")}
              title={lang === "en" ? "العربية" : "English"}
              style={{width:"auto", padding:"0 10px", fontFamily:"var(--mono)", fontSize:11, letterSpacing:".08em"}}>
        {lang === "en" ? "AR" : "EN"}
      </button>
    );
  }

  /* ─── Topbar ───────────────────────────────────────────── */
  function AppTopbar({ crumb, right, searchPlaceholder }) {
    const [lang] = useLang();
    const placeholder = searchPlaceholder || T(lang, "topbar.search", "Search models, keys, logs, members…");
    return (
      <div className="tb">
        <div className="tb-crumb">
          <span>NextWave Commerce</span>
          <span className="sep">/</span>
          <span className="cur">{crumb}</span>
        </div>
        <div className="tb-search">
          <span className="ic">⌕</span>
          <input placeholder={placeholder} />
          <span className="kbd">⌘K</span>
        </div>
        <div className="tb-actions">
          {right}
          <span className="env-pill prod">● {T(lang,"topbar.prod","PRODUCTION")}</span>
          <LangToggle />
          <button className="tb-act" title={T(lang,"topbar.notifs","Notifications")}>◉<span className="n">3</span></button>
          <button className="tb-act" title={T(lang,"topbar.help","Help")}>?</button>
          <button className="tb-act" title={T(lang,"topbar.whatsnew","What's new")}>✦</button>
        </div>
      </div>
    );
  }

  /* ─── Frame wrapper: sidebar + topbar + your content ────── */
  function AppFrame({ current, crumb, children, topbarRight }) {
    return (
      <div className="app">
        <AppSidebar current={current} />
        <AppTopbar crumb={crumb} right={topbarRight} />
        {children}
      </div>
    );
  }

  /* ─── Return strip (reviewer nav) ──────────────────────── */
  function ReturnStrip() {
    return (
      <div className="return-strip">
        <a href="./Console.html">← CONSOLE</a>
        <a href="./Index.html">APP INDEX</a>
        <a href="../public/Index.html">PUBLIC</a>
      </div>
    );
  }

  Object.assign(window, { AppSidebar, AppTopbar, AppFrame, OrgSwitcher, ReturnStrip, LangToggle, APP_NAV: NAV, useLang, T, getLang, setLang });
})();
