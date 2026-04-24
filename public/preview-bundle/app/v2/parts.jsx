// Reusable section bits

function SectionMeta({ idx, label, right }) {
  return (
    <div className="section-meta">
      <span><span className="idx">{idx}</span> · {label}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

function Eyebrow({ children }) { return <span className="eyebrow">{children}</span>; }

function Marquee() {
  const { t } = useLang();
  const words = t.marquee.split(" — ");
  const content = (
    <>
      {words.map((w,i) => <span key={"a"+i}>{w}</span>)}
      {words.map((w,i) => <span key={"b"+i}>{w}</span>)}
    </>
  );
  return <div className="marquee"><div className="marquee-in">{content}</div></div>;
}

function Nav({ lang, setLang }) {
  const { t } = useLang();
  return (
    <header className="nav">
      <div className="nav-in">
        <a href="#" className="brand">
          <span className="brand-mark"><img src="assets/dcp-logo-square.jpeg" alt="DCP"/></span>
          <span className="brand-name">DCP</span>
        </a>
        <nav className="nav-links">
          <a href="#marketplace">{t.nav.marketplace}</a>
          <a href="#api">{t.nav.platform}</a>
          <a href="#models">{t.nav.models}</a>
          <a href="#providers">{t.nav.providers}</a>
          <a href="#pricing">{t.nav.pricing}</a>
        </nav>
        <div className="nav-right">
          <span className="nav-status" title="Riyadh latency">
            <span className="d"/><span>RUH · 38ms</span>
          </span>
          <span className="lang-pill">
            <button className={lang==="en"?"on":""} onClick={()=>setLang("en")}>EN</button>
            <button className={lang==="ar"?"on":""} onClick={()=>setLang("ar")}>ع</button>
          </span>
          <a className="btn ghost small" href="#">{t.nav.signin}</a>
          <MagneticButton><a className="btn primary small" href="#">{t.nav.start} <Arrow size={12}/></a></MagneticButton>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t, lang } = useLang();
  const dateStr = new Date().toLocaleDateString(lang==="ar"?"ar-SA":"en-US",{year:"numeric",month:"short",day:"2-digit"});
  return (
    <section className="hero" style={{paddingTop: 30, borderTop:0}}>
      <div className="hero-bg"><HeroMap/></div>
      <div className="wrap">
        <div className="hero-meta">
          <span className="left">
            <span><span className="dot">◦</span> Riyadh · Jeddah · Dammam · NEOM</span>
            <span>{t.topline.live} · 40+ providers registered</span>
          </span>
          <span>{dateStr}</span>
        </div>
        <div className="hero-body">
          <Reveal>
            <Eyebrow>{t.hero.eyebrow}</Eyebrow>
            <h1 className="hero-h">
              {t.hero.headline_1}<br/><em>{t.hero.headline_2}</em>
            </h1>
            <p className="hero-sub">{t.hero.sub}</p>
            <div className="hero-ctas">
              <MagneticButton><a href="#api" className="btn primary lg">{t.hero.cta_primary} <Arrow size={14}/></a></MagneticButton>
              <MagneticButton strength={0.18}><a href="#marketplace" className="btn ghost lg">{t.hero.cta_secondary}</a></MagneticButton>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <FeatureCard/>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureCard() {
  const { t, lang } = useLang();
  const en = lang !== "ar";
  const rows = (t.platform && t.platform.rows) || [];
  return (
    <div className="ticker-card feat">
      <div className="tc-hd">
        <span className="live"><span className="d"/>{en ? "PLATFORM" : "المنصة"}</span>
        <span>dcp.sa</span>
      </div>
      <ul className="feat-list">
        {rows.map(([n, k, v]) => (
          <li key={n}>
            <span className="n">{n}</span>
            <div>
              <div className="k">{k}</div>
              <div className="v">{v}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TickerCard({ gpus, tokps, jobs, price, watching }) {
  const { t, lang } = useLang();
  const feed = useFeed();
  return (
    <div className="ticker-card">
      <div className="tc-hd">
        <span className="live"><span className="d"/>{t.topline.live}</span>
        <span>dcp/mesh · <span style={{color:"var(--ink)"}}>{fmtInt(watching, lang)}</span> {t.hero.watching}</span>
      </div>
      <div className="tc-stats">
        <div className="tc-stat">
          <div className="tc-k">{t.stats.providers}</div>
          <div className="tc-v">{fmtInt(gpus, lang)}</div>
          <div className="tc-delta">↑ 4 last hour</div>
        </div>
        <div className="tc-stat">
          <div className="tc-k">{t.stats.tokens}</div>
          <div className="tc-v">{fmtInt(tokps/1000, lang)}<span className="u">K</span></div>
          <div className="tc-delta">↑ 2.1%</div>
        </div>
        <div className="tc-stat">
          <div className="tc-k">{t.stats.jobs}</div>
          <div className="tc-v">{fmtInt(jobs, lang)}</div>
          <div className="tc-delta">↑ 12%</div>
        </div>
        <div className="tc-stat">
          <div className="tc-k">{t.stats.price}</div>
          <div className="tc-v">${fmt(price, lang, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
          <div className="tc-delta down">↓ 38% {t.stats.vs}</div>
        </div>
      </div>
      <div className="feed-card">
        {feed.map((it,i) => (
          <div className="feed-row" key={i}>
            <span className="arrow">›</span>
            <span className="m">{it.msg}</span>
            <span className="r">{it.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Marketplace() {
  const { t, lang } = useLang();
  const D = window.DCP_DATA;
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => D.marketplace.filter(r => {
    if (filter === "ar" && !r.arabic) return false;
    if (filter === "h100" && !/H100|A100/.test(r.gpu)) return false;
    if (filter === "rtx" && !/RTX|M4/.test(r.gpu)) return false;
    if (q && !(r.gpu + " " + r.provider + " " + r.region).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [filter, q]);

  // Jitter util + price live
  const [ticks, setTicks] = useState(0);
  useEffect(() => { const id = setInterval(() => setTicks(t=>t+1), 2400); return ()=>clearInterval(id); }, []);

  // Demand meter: avg utilization across all listings + sparkline history
  const meanUtil = useMemo(() => {
    if (!D.marketplace.length) return 0;
    return D.marketplace.reduce((s, r, i) =>
      s + Math.max(5, Math.min(99, r.util + Math.sin((ticks + i) * 0.8) * 4)), 0) / D.marketplace.length;
  }, [ticks]);
  const histRef = useRef([]);
  useEffect(() => {
    histRef.current = [...histRef.current, meanUtil].slice(-40);
    if (histRef.current.length < 12) {
      // Seed so sparkline isn't empty on first render
      while (histRef.current.length < 12) histRef.current.unshift(meanUtil + (Math.random()-.5)*6);
    }
  }, [meanUtil]);
  const demandLabel = meanUtil > 78 ? (lang==="ar"?"طلب مرتفع":"High demand")
                     : meanUtil > 55 ? (lang==="ar"?"طلب معتدل":"Moderate")
                                     : (lang==="ar"?"سعة متاحة":"Capacity available");

  const chipOpts = [
    ["all", t.market.f_all,   D.marketplace.length],
    ["ar",  t.market.f_ar,    D.marketplace.filter(r=>r.arabic).length],
    ["h100",t.market.f_h100,  D.marketplace.filter(r=>/H100|A100/.test(r.gpu)).length],
    ["rtx", t.market.f_rtx,   D.marketplace.filter(r=>/RTX|M4/.test(r.gpu)).length],
  ];

  return (
    <section id="marketplace">
      <div className="wrap">
        <SectionMeta idx="01" label="Marketplace"/>
        <div className="grid-2" style={{alignItems:"end", marginBottom: 36}}>
          <Reveal>
            <Eyebrow>{t.market.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.market.title}</h2>
          </Reveal>
          <Reveal delay={120}><p className="ss">{t.market.sub}</p></Reveal>
        </div>

        <div className="demand">
          <div className="demand-left">
            <div className="demand-label">
              <span>{lang==="ar"?"طلب الشبكة · متوسط الاستخدام":"Network demand · mean utilization"}</span>
              <b>{fmtInt(meanUtil, lang)}% · {demandLabel}</b>
            </div>
            <div className="demand-bar"><span style={{transform:`scaleX(${meanUtil/100})`}}/></div>
          </div>
          <div className="demand-right">
            <div className="k">{lang==="ar"?"آخر 40 تحديث":"last 40 ticks"}</div>
            <Sparkline values={histRef.current} height={28}/>
          </div>
        </div>

        <div className="mk-controls">
          <input className="mk-search" placeholder={t.market.search} value={q} onChange={e=>setQ(e.target.value)}/>
          {chipOpts.map(([k,label,n]) =>
            <button key={k} className={"chip "+(filter===k?"on":"")} onClick={()=>setFilter(k)}>
              {label} <span className="n">{fmtInt(n, lang)}</span>
            </button>
          )}
        </div>

        <table className="mk-table">
          <thead>
            <tr>
              {t.market.headers.map((h,i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i) => {
              const util = Math.max(5, Math.min(99, r.util + Math.sin((ticks + i) * 0.8) * 4));
              const sar  = r.sarhr * (1 + Math.sin((ticks + i) * 0.6) * 0.01);
              return (
                <tr key={r.id}>
                  <td className="gpu-cell">
                    {r.gpu}
                    <small>vram {r.vram}GB · {r.arabic ? "🇸🇦 in-kingdom" : "mesh"}</small>
                  </td>
                  <td><span className="region"><span className="pin"/>{r.region}</span></td>
                  <td className="provider">{r.provider}</td>
                  <td>
                    <div className="util-cell">
                      <div className="util-bar"><span style={{transform:`scaleX(${util/100})`}}/></div>
                      <span className="util-val">{fmtInt(util, lang)}%</span>
                    </div>
                  </td>
                  <td className="price">{fmt(sar, lang, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td className="price usd">${fmt(r.usd, lang, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
                  <td className="rel">{fmt(r.reliability, lang, {minimumFractionDigits:1, maximumFractionDigits:1})}%</td>
                  <td>
                    <span className="perf">
                      {Array.from({length:5}).map((_,b) =>
                        <span key={b} className={"bar "+(b < Math.ceil(r.perf/20) ? "on":"")} style={{height: 6 + b*3}}/>
                      )}
                    </span>
                  </td>
                  <td><button className="btn small">{t.market.reserve}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mk-foot">
          <span>{fmtInt(rows.length, lang)} / {fmtInt(D.marketplace.length, lang)} listings</span>
          <span>{lang==="ar"?"يحدَّث كل 2.4 ثانية":"live · updated every 2.4s"}</span>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { SectionMeta, Eyebrow, Marquee, Nav, Hero, TickerCard, Marketplace });
