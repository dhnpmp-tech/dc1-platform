/* eslint-disable */
/* DCP Kit reference sheet — demos every primitive from assets/dcp-kit.jsx
   Layout classes (.demo-*) live in DCP Kit.html only; real kit classes only inside examples. */

const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;
const {
  LangCtx,
  Reveal, MagneticButton, HeroMap, Sparkline,
  Arrow, Check, Play, Stop, Close, Search, Menu, Plus, Minus, ChevronDown,
  Copy, External, Download, Upload, Shield, Lock, Key, Zap, Cpu, Cloud, Dot,
  Marquee, Brand, LangToggle, Nav, Footer, SectionMeta, Eyebrow, Breadcrumb,
  Badge, Callout, Stat, StatRow, Field, EmptyState, Skeleton, Modal, Toast,
  fmt, fmtInt, fmtMoney,
} = window;

/* ═══ SECTION ═════════════════════════════════════════════════ */

function DemoSection({ id, n, title, sub, children }) {
  return (
    <section className="demo-sec" id={id}>
      <div style={{fontFamily:"var(--mono)",fontSize:10.5,letterSpacing:".18em",textTransform:"uppercase",color:"var(--mut)",marginBottom:8}}>§ {n}</div>
      <h2>{title}</h2>
      {sub ? <p className="demo-sec-sub">{sub}</p> : null}
      {children}
    </section>
  );
}

function Block({ label, hint, children, col, inset, flush }) {
  const klass = ["demo-block-body"];
  if (col) klass.push("col");
  if (inset) klass.push("inset");
  if (flush) klass.push("flush");
  return (
    <div className="demo-block">
      <div className="demo-block-hd">
        <b>{label}</b>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div className={klass.join(" ")}>{children}</div>
    </div>
  );
}

/* ═══ APP ═════════════════════════════════════════════════════ */

function App() {
  const [lang, setLang] = useState(
    (typeof document !== "undefined" && document.documentElement.lang) === "ar" ? "ar" : "en"
  );
  const t = (window.DCP_I18N && window.DCP_I18N[lang]) || {};

  // sync <html> attrs with language state
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.setAttribute("data-lang", lang);
    // sync utility-bar button
    const en = document.getElementById("btn-en"), ar = document.getElementById("btn-ar");
    if (en && ar) { en.classList.toggle("on", lang==="en"); ar.classList.toggle("on", lang==="ar"); }
  }, [lang]);

  // palette buttons (toolbar, outside React)
  useEffect(() => {
    const btns = document.querySelectorAll(".pal-btn");
    const handler = (e) => {
      const p = e.currentTarget.getAttribute("data-pal");
      document.documentElement.setAttribute("data-palette", p);
      btns.forEach(b => b.classList.toggle("on", b === e.currentTarget));
    };
    btns.forEach(b => b.addEventListener("click", handler));
    // top-of-page lang toggle (outside React)
    const en = document.getElementById("btn-en"), ar = document.getElementById("btn-ar");
    const onEn = () => setLang("en"), onAr = () => setLang("ar");
    en && en.addEventListener("click", onEn);
    ar && ar.addEventListener("click", onAr);
    return () => {
      btns.forEach(b => b.removeEventListener("click", handler));
      en && en.removeEventListener("click", onEn);
      ar && ar.removeEventListener("click", onAr);
    };
  }, []);

  return (
    <LangCtx.Provider value={{ lang, t }}>
      <Header lang={lang} />
      <main className="demo-shell">
        <Tokens />
        <Typography />
        <Buttons />
        <ChromeShowcase lang={lang} setLang={setLang} />
        <Badges />
        <Callouts />
        <Stats />
        <Forms />
        <Tables />
        <EmptyLoading />
        <Modals />
        <Motion />
        <Icons />
        <Footer />
      </main>
    </LangCtx.Provider>
  );
}

/* ═══ HEADER ══════════════════════════════════════════════════ */

function Header({ lang }) {
  return (
    <div className="demo-shell" style={{paddingBottom:0}}>
      <div className="demo-hd">
        <div>
          <div style={{fontFamily:"var(--mono)",fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:"var(--teal)",marginBottom:16}}>DCP · DESIGN KIT · v1</div>
          <h1>The full kit<br/>on one page.</h1>
          <p>Every primitive, token, and state exported by <code className="mono">assets/dcp-kit.jsx</code> + <code className="mono">assets/dcp-kit.css</code>. Screens import from here; nothing else. Flip palette in the toolbar to see midnight, paper and mono tokens; flip language to verify RTL + Arabic numerals + font swap.</p>
        </div>
        <nav className="demo-toc">
          <a href="#tokens">§01 tokens</a>
          <a href="#type">§02 type</a>
          <a href="#buttons">§03 buttons</a>
          <a href="#chrome">§04 chrome</a>
          <a href="#badges">§05 badges</a>
          <a href="#callouts">§06 callouts</a>
          <a href="#stats">§07 stats</a>
          <a href="#forms">§08 forms</a>
          <a href="#tables">§09 tables</a>
          <a href="#empty">§10 empty / loading</a>
          <a href="#modals">§11 modals · toast</a>
          <a href="#motion">§12 motion</a>
          <a href="#icons">§13 icons</a>
        </nav>
      </div>
    </div>
  );
}

/* ═══ 01 · TOKENS ═════════════════════════════════════════════ */

const TOKEN_GROUPS = [
  {
    label: "Color — palette-aware",
    tokens: [
      ["--bg","page"],["--bg-2","inset surface"],["--paper","elevated"],
      ["--ink","primary"],["--ink-2","body"],["--mut","muted"],["--dim","placeholder"],
      ["--line","heavy border"],["--hair","thin rule"],
      ["--teal","brand teal"],["--orange","brand orange"],
    ],
  },
  {
    label: "Semantic — shared",
    tokens: [["--ok","success"],["--warn","warn"],["--err","error"],["--info","informational"]],
  },
];

function Tokens() {
  return (
    <DemoSection id="tokens" n="01" title="Tokens" sub="Every colour is a CSS variable so palette swaps re-theme the whole app. Never hardcode a hex — always reference a token.">
      {TOKEN_GROUPS.map(g => (
        <div key={g.label} className="demo-block">
          <div className="demo-block-hd"><b>{g.label}</b><span>{g.tokens.length} tokens</span></div>
          <div className="demo-tokens">
            {g.tokens.map(([name,role]) => (
              <div key={name} className="tok">
                <div className="swatch" style={{background:`var(${name})`}}/>
                <div className="name">{name}</div>
                <div className="val">{role}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="demo-block">
        <div className="demo-block-hd"><b>Layout / type stacks</b><span>--maxw · --sans · --serif · --mono · --arabic</span></div>
        <div className="demo-tokens" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
          <div className="tok"><div className="name">--sans</div><div style={{fontFamily:"var(--sans)",fontSize:20,color:"var(--ink)",marginTop:8}}>Inter — the quick brown fox.</div></div>
          <div className="tok"><div className="name">--serif</div><div style={{fontFamily:"var(--serif)",fontSize:28,color:"var(--ink)",marginTop:4,lineHeight:1}}>Instrument Serif</div></div>
          <div className="tok"><div className="name">--mono</div><div style={{fontFamily:"var(--mono)",fontSize:14,color:"var(--ink)",marginTop:8}}>JetBrains 0123456789</div></div>
          <div className="tok"><div className="name">--arabic</div><div style={{fontFamily:"var(--arabic)",fontSize:22,color:"var(--ink)",marginTop:4,direction:"rtl",lineHeight:1.4}}>الحوسبة السحابية السعودية</div></div>
          <div className="tok"><div className="name">--maxw</div><div className="val" style={{fontFamily:"var(--mono)",color:"var(--ink)",fontSize:14,marginTop:8}}>1280px</div></div>
          <div className="tok"><div className="name">--grad</div><div className="swatch" style={{background:"var(--grad)",marginTop:8,marginBottom:0}}/></div>
        </div>
      </div>
    </DemoSection>
  );
}

/* ═══ 02 · TYPE ═══════════════════════════════════════════════ */

function Typography() {
  return (
    <DemoSection id="type" n="02" title="Typography" sub="Headlines use Instrument Serif at weight 400 with italic gradient emphasis wrapped in <em>. Body is Inter; monospace is JetBrains Mono. Arabic auto-swaps when html[data-lang='ar'].">
      <div className="demo-type">
        <span className="k">h1.hero-h</span>
        <h1 className="hero-h" style={{margin:0,fontSize:72}}>Rent a GPU <em>in seconds</em>.</h1>
        <span className="k">h2.st</span>
        <h2 className="st" style={{margin:0,fontSize:56}}>Built for <em>Saudi AI</em>.</h2>
        <span className="k">.eyebrow</span>
        <span className="eyebrow">§ 03 · MARKETPLACE</span>
        <span className="k">.section-meta</span>
        <SectionMeta idx="02" label="PLATFORM" right="LIVE · RUH · 38ms" />
        <span className="k">.prose h2</span>
        <div className="prose" style={{margin:0}}><h2>Prose heading</h2></div>
        <span className="k">.prose h3</span>
        <div className="prose" style={{margin:0}}><h3>Subheading</h3></div>
        <span className="k">.prose p</span>
        <div className="prose" style={{margin:0}}><p>Body copy for docs and marketing longform. Keeps a comfortable 68-character measure and 1.7 line-height for readable Arabic and Latin.</p></div>
        <span className="k">.ss / hero-sub</span>
        <p className="hero-sub" style={{margin:0}}>Section supporting copy sits at 16.5–18.5px, colour <code className="inline">--ink-2</code>, line-height 1.55.</p>
        <span className="k">code.inline</span>
        <p style={{margin:0,color:"var(--ink-2)"}}>Example with <code className="inline">claude.complete()</code> inside body text.</p>
      </div>
    </DemoSection>
  );
}

/* ═══ 03 · BUTTONS ════════════════════════════════════════════ */

function Buttons() {
  return (
    <DemoSection id="buttons" n="03" title="Buttons" sub="Three tones (neutral / primary / ghost / danger) × three sizes, plus disabled and icon slots. Wrap primaries in <MagneticButton> for the cursor-pull effect.">
      <Block label="Tones" hint=".btn · .btn.primary · .btn.ghost · .btn.danger">
        <a className="btn" href="#">Neutral</a>
        <MagneticButton><a className="btn primary" href="#">Primary <Arrow size={12}/></a></MagneticButton>
        <a className="btn ghost" href="#">Ghost</a>
        <a className="btn danger" href="#">Danger</a>
        <a className="btn danger primary" href="#">Danger · primary</a>
      </Block>

      <Block label="Sizes" hint=".small · default · .lg">
        <a className="btn small" href="#">Small</a>
        <a className="btn" href="#">Default</a>
        <a className="btn lg primary" href="#">Large <Arrow size={14}/></a>
      </Block>

      <Block label="States" hint="hover · focus-visible · disabled">
        <a className="btn primary" href="#">Idle</a>
        <a className="btn primary" href="#" style={{filter:"brightness(1.1)"}}>Hover</a>
        <a className="btn" href="#" tabIndex="0">Focus</a>
        <a className="btn disabled" href="#">Disabled</a>
      </Block>

      <Block label="With icon" hint="any SVG icon, 12–14px">
        <a className="btn small ghost" href="#"><Copy size={12}/> Copy key</a>
        <a className="btn small" href="#"><Download size={12}/> Download SDK</a>
        <a className="btn small primary" href="#"><Play size={11}/> Run</a>
        <a className="btn small ghost" href="#">Docs <External size={11}/></a>
      </Block>
    </DemoSection>
  );
}

/* ═══ 04 · CHROME ═════════════════════════════════════════════ */

function ChromeShowcase({ lang, setLang }) {
  return (
    <DemoSection id="chrome" n="04" title="Chrome" sub="Navigation, marquee ticker, footer, section markers, breadcrumbs. Every screen uses the same shell.">
      <Block label="<Marquee>" flush>
        <div style={{width:"100%"}}><Marquee /></div>
      </Block>

      <Block label="<Nav>" flush>
        <div style={{width:"100%",position:"relative"}}>
          <Nav lang={lang} setLang={setLang} active="marketplace" />
        </div>
      </Block>

      <Block label="<Brand>" hint="logo + wordmark">
        <Brand/>
      </Block>

      <Block label="<LangToggle>" hint="EN / ع — pill">
        <LangToggle lang={lang} setLang={setLang} />
      </Block>

      <Block label="<SectionMeta>" hint="mono section marker">
        <div style={{flex:1}}><SectionMeta idx="04" label="CHROME" right="REF · dcp-kit.jsx" /></div>
      </Block>

      <Block label="<Eyebrow>" hint=".eyebrow · mono kicker">
        <Eyebrow>§ 04 · CHROME</Eyebrow>
      </Block>

      <Block label="<Breadcrumb>" hint="mono crumb trail">
        <Breadcrumb items={[{label:"Dashboard",href:"#"},{label:"Jobs",href:"#"},{label:"run_4f0a"}]} />
      </Block>
    </DemoSection>
  );
}

/* ═══ 05 · BADGES ═════════════════════════════════════════════ */

function Badges() {
  return (
    <DemoSection id="badges" n="05" title="Badges" sub="Tonal pills for status and counts. Add pulse for 'live'.">
      <Block label=".badge — tones" hint="ok · warn · err · info · default">
        <Badge tone="ok">Operational</Badge>
        <Badge tone="warn">Degraded</Badge>
        <Badge tone="err">Outage</Badge>
        <Badge tone="info">Scheduled</Badge>
        <Badge>Default</Badge>
      </Block>
      <Block label=".badge .d.pulse" hint="live-status dot with pulse">
        <Badge tone="ok" pulse>RUH · 38ms</Badge>
        <Badge tone="err" pulse>Queue · paused</Badge>
        <Badge tone="info" pulse>Streaming</Badge>
      </Block>
    </DemoSection>
  );
}

/* ═══ 06 · CALLOUTS ═══════════════════════════════════════════ */

function Callouts() {
  return (
    <DemoSection id="callouts" n="06" title="Callouts" sub="Inline notices inside docs and forms. Left border carries the tone.">
      <Block label="info · warn · err" col>
        <Callout label="NOTE">100 halala = 1 SAR. All prices per-second, billed to the halala — no minimum, no rounding.</Callout>
        <Callout tone="warn" label="HEADS UP">Provider payouts above 10,000 SAR require a Wathq verification step before the first settlement.</Callout>
        <Callout tone="err" label="ACTION REQUIRED">Your escrow balance is below the minimum for on-chain settlement. Top up with Moyasar to resume jobs.</Callout>
      </Block>
    </DemoSection>
  );
}

/* ═══ 07 · STATS ══════════════════════════════════════════════ */

function Stats() {
  const sparkUp = [12,14,16,15,18,22,24,23,27,30,29,34];
  const sparkDn = [40,38,36,37,32,30,28,28,26,22,20,18];
  return (
    <DemoSection id="stats" n="07" title="Stats" sub="Dashboard KPI cards. Use <StatRow> for bordered 4-up layouts.">
      <Block label="<StatRow> — 4 up" flush>
        <StatRow>
          <Stat k="Jobs today" v="1,284" delta="+12%" deltaDir="up" spark={sparkUp}/>
          <Stat k="Cost" v="4,822" unit="SAR" delta="-3%" deltaDir="down" spark={sparkDn}/>
          <Stat k="P95 latency" v="38" unit="ms" delta="+2ms" deltaDir="down" spark={sparkUp}/>
          <Stat k="Success" v="99.94" unit="%" delta="+0.02" deltaDir="up" spark={sparkUp}/>
        </StatRow>
      </Block>
      <Block label="Single <Stat>" hint="no delta · no spark">
        <div style={{flex:1,maxWidth:280}}>
          <Stat k="Active providers" v="42"/>
        </div>
        <div style={{flex:1,maxWidth:280}}>
          <Stat k="Uptime" v="99.99" unit="%"/>
        </div>
      </Block>
    </DemoSection>
  );
}

/* ═══ 08 · FORMS ══════════════════════════════════════════════ */

function Forms() {
  const [v, setV] = useState("sk_live_•••••••••••••••••");
  return (
    <DemoSection id="forms" n="08" title="Forms" sub="Inputs, textareas, selects, sliders, checkboxes — all wrapped in <Field> for consistent label + hint + error semantics.">
      <Block label="<Field>" col>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          <Field label="Organisation name" hint="Shown on receipts.">
            <input className="input" defaultValue="Jahez AI"/>
          </Field>
          <Field label="API key" hint="Reveals once. Store securely.">
            <input className="input" value={v} onChange={(e)=>setV(e.target.value)}/>
          </Field>
          <Field label="Region">
            <select className="select">
              <option>RUH — Riyadh</option>
              <option>JED — Jeddah</option>
              <option>DMM — Dammam</option>
            </select>
          </Field>
          <Field label="Monthly cap (SAR)" error="Cap must be at least 10 SAR.">
            <input className="input" defaultValue="5"/>
          </Field>
        </div>
        <Field label="System prompt" hint="Supports Arabic. RTL flips automatically.">
          <textarea className="textarea" rows="3" defaultValue="You are a helpful assistant for Saudi e-commerce support."/>
        </Field>
      </Block>

      <Block label=".slider · .checkbox · .radio">
        <div style={{flex:1}}>
          <div className="demo-label">Temperature</div>
          <input className="slider" type="range" min="0" max="100" defaultValue="72"/>
        </div>
        <label style={{display:"inline-flex",alignItems:"center",gap:8,color:"var(--ink)"}}>
          <input className="checkbox" type="checkbox" defaultChecked/> Stream tokens
        </label>
        <label style={{display:"inline-flex",alignItems:"center",gap:8,color:"var(--ink)"}}>
          <input className="checkbox" type="checkbox"/> Log requests
        </label>
        <label style={{display:"inline-flex",alignItems:"center",gap:8,color:"var(--ink)"}}>
          <input className="radio" type="radio" name="tier" defaultChecked/> Per-second
        </label>
        <label style={{display:"inline-flex",alignItems:"center",gap:8,color:"var(--ink)"}}>
          <input className="radio" type="radio" name="tier"/> Reserved (monthly)
        </label>
      </Block>
    </DemoSection>
  );
}

/* ═══ 09 · TABLES ═════════════════════════════════════════════ */

function Tables() {
  const { lang } = useContext(LangCtx);
  const rows = [
    { id:"ruh-a100-01", gpu:"H100 80GB", vram:80, region:"RUH · Riyadh", provider:"dcp_node_07", sarhr:14.8, usd:3.95, util:78, perf:8 },
    { id:"ruh-a100-02", gpu:"A100 80GB", vram:80, region:"RUH · Riyadh", provider:"dcp_node_03", sarhr:8.2,  usd:2.19, util:62, perf:6 },
    { id:"jed-4090-05", gpu:"RTX 4090",  vram:24, region:"JED · Jeddah", provider:"jed_ml_12",   sarhr:4.1,  usd:1.09, util:45, perf:4 },
    { id:"dmm-l40-02",  gpu:"L40S 48GB", vram:48, region:"DMM · Dammam", provider:"dmm_infra_01", sarhr:6.3, usd:1.68, util:88, perf:7 },
  ];
  return (
    <DemoSection id="tables" n="09" title="Marketplace tables" sub="The GPU-marketplace surface. Utilisation bars, SAR / USD dual-pricing, chip filters, performance dots.">
      <div className="demo-block">
        <div className="demo-block-hd"><b>.mk-controls + .mk-table</b><span>4 rows · demo data</span></div>
        <div style={{padding:"16px 16px 0"}}>
          <div className="mk-controls">
            <div className="mk-search"><Search size={14}/><input className="input" placeholder="Search GPUs, regions, providers…" /></div>
            <button className="chip on">All <span className="n">12</span></button>
            <button className="chip">H100 <span className="n">3</span></button>
            <button className="chip">A100 <span className="n">4</span></button>
            <button className="chip">4090 <span className="n">3</span></button>
            <button className="chip">L40S <span className="n">2</span></button>
          </div>
        </div>
        <div className="mk-wrap">
          <table className="mk-table">
            <thead>
              <tr>
                <th>GPU</th>
                <th>Region</th>
                <th>Provider</th>
                <th>Utilisation</th>
                <th style={{textAlign:"end"}}>SAR / hr</th>
                <th style={{textAlign:"end"}}>Perf</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td><div className="gpu-cell">{r.gpu}<span style={{color:"var(--mut)",fontFamily:"var(--mono)",fontSize:11}}>{r.vram}GB</span></div></td>
                  <td><span className="region"><span className="pin"/> {r.region}</span></td>
                  <td><span className="provider mono">{r.provider}</span></td>
                  <td>
                    <div className="util-cell">
                      <div className="util-bar"><span style={{width:r.util+"%"}}/></div>
                      <span className="util-val">{r.util}%</span>
                    </div>
                  </td>
                  <td style={{textAlign:"end"}}>
                    <div className="price">{fmt(r.sarhr, lang, {minimumFractionDigits:1})} <span className="mono" style={{color:"var(--mut)"}}>SAR</span></div>
                    <div className="price usd">${fmt(r.usd, lang, {minimumFractionDigits:2})}</div>
                  </td>
                  <td style={{textAlign:"end"}}>
                    <div className="perf">
                      {[1,2,3,4,5,6,7,8,9].map(i=><span key={i} className={"bar "+(i<=r.perf?"on":"")}/>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mk-foot">
          <span>4 of 12 · updated {lang==="ar"?"الآن":"just now"}</span>
          <a className="btn small ghost" href="#">View all <Arrow size={12}/></a>
        </div>
      </div>
    </DemoSection>
  );
}

/* ═══ 10 · EMPTY & LOADING ════════════════════════════════════ */

function EmptyLoading() {
  return (
    <DemoSection id="empty" n="10" title="Empty & loading" sub="Dashed-border empties and shimmering skeletons.">
      <div className="demo-grid g2">
        <div className="demo-block">
          <div className="demo-block-hd"><b>&lt;EmptyState&gt;</b></div>
          <div className="demo-block-body flush">
            <EmptyState
              title="No jobs yet"
              body="Submit your first inference job from the Playground, or via the REST API."
              action={<a className="btn primary small" href="#">Open Playground <Arrow size={12}/></a>}
            />
          </div>
        </div>
        <div className="demo-block">
          <div className="demo-block-hd"><b>&lt;Skeleton&gt;</b><span>.line · .block</span></div>
          <div className="demo-block-body col">
            <Skeleton variant="line"/>
            <Skeleton variant="line"/>
            <Skeleton variant="line"/>
            <div style={{height:8}}/>
            <Skeleton variant="block"/>
          </div>
        </div>
      </div>
    </DemoSection>
  );
}

/* ═══ 11 · MODALS · TOAST ═════════════════════════════════════ */

function Modals() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(()=>setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <DemoSection id="modals" n="11" title="Modals & toasts" sub="Backdrop-blur modal with ESC-to-close; bottom-centred toast with tonal ribbon.">
      <Block label="Triggers">
        <button className="btn primary" onClick={()=>setOpen(true)}>Open modal</button>
        <button className="btn" onClick={()=>setToast({tone:"ok",msg:"API key copied"})}>Toast · ok</button>
        <button className="btn" onClick={()=>setToast({tone:"warn",msg:"Rate limit approaching"})}>Toast · warn</button>
        <button className="btn" onClick={()=>setToast({tone:"err",msg:"Job failed — out of memory"})}>Toast · err</button>
      </Block>

      <Modal
        open={open}
        onClose={()=>setOpen(false)}
        title="Delete API key?"
        footer={<>
          <button className="btn ghost" onClick={()=>setOpen(false)}>Cancel</button>
          <button className="btn danger primary" onClick={()=>{setOpen(false);setToast({tone:"err",msg:"Key revoked"});}}>Delete</button>
        </>}
      >
        <p style={{margin:0,color:"var(--ink-2)",lineHeight:1.6}}>
          Revoking <code className="inline">sk_live_•••••••••••</code> immediately invalidates all outstanding sessions. This action can not be undone.
        </p>
        <Callout tone="warn" label="IRREVERSIBLE">
          Active jobs using this key will fail on their next request. Rotate gracefully by creating a new key first.
        </Callout>
      </Modal>

      {toast && <Toast tone={toast.tone}>{toast.msg}</Toast>}
    </DemoSection>
  );
}

/* ═══ 12 · MOTION ═════════════════════════════════════════════ */

function Motion() {
  const spark = [24,27,29,28,30,34,33,38,41,44,42,48,52,50,56];
  return (
    <DemoSection id="motion" n="12" title="Motion" sub="Reveals, magnetic CTAs, animated hero map, sparkline canvases. All honour prefers-reduced-motion.">
      <div className="demo-grid g2">
        <div className="demo-block">
          <div className="demo-block-hd"><b>&lt;HeroMap&gt;</b><span>animated GPU mesh · canvas</span></div>
          <div className="demo-block-body flush" style={{height:260,position:"relative",background:"var(--bg)"}}>
            <HeroMap />
          </div>
        </div>
        <div className="demo-block">
          <div className="demo-block-hd"><b>&lt;Sparkline&gt;</b><span>mini line canvas</span></div>
          <div className="demo-block-body col">
            <Sparkline values={spark} height={60} />
            <Sparkline values={spark.slice().reverse()} color="var(--orange)" height={60} />
          </div>
        </div>
      </div>

      <div className="demo-block">
        <div className="demo-block-hd"><b>&lt;Reveal&gt;</b><span>fade + rise on intersect — scroll to trigger</span></div>
        <div className="demo-block-body col">
          <Reveal><div style={{padding:24,border:"1px solid var(--hair)",background:"var(--bg-2)",color:"var(--ink)"}}>First panel · delay 0</div></Reveal>
          <Reveal delay={140}><div style={{padding:24,border:"1px solid var(--hair)",background:"var(--bg-2)",color:"var(--ink)"}}>Second panel · delay 140ms</div></Reveal>
          <Reveal delay={260}><div style={{padding:24,border:"1px solid var(--hair)",background:"var(--bg-2)",color:"var(--ink)"}}>Third panel · delay 260ms</div></Reveal>
        </div>
      </div>

      <div className="demo-block">
        <div className="demo-block-hd"><b>&lt;MagneticButton&gt;</b><span>cursor-pull wrapper · hover to feel it</span></div>
        <div className="demo-block-body">
          <MagneticButton><a className="btn primary lg" href="#">Start renting <Arrow size={14}/></a></MagneticButton>
          <MagneticButton strength={0.4}><a className="btn lg ghost" href="#">Docs <External size={12}/></a></MagneticButton>
        </div>
      </div>
    </DemoSection>
  );
}

/* ═══ 13 · ICONS ══════════════════════════════════════════════ */

const ICONS = [
  ["Arrow",Arrow],["Check",Check],["Play",Play],["Stop",Stop],["Close",Close],
  ["Search",Search],["Menu",Menu],["Plus",Plus],["Minus",Minus],["ChevronDown",ChevronDown],
  ["Copy",Copy],["External",External],["Download",Download],["Upload",Upload],
  ["Shield",Shield],["Lock",Lock],["Key",Key],["Zap",Zap],["Cpu",Cpu],["Cloud",Cloud],["Dot",Dot],
];

function Icons() {
  return (
    <DemoSection id="icons" n="13" title="Icons" sub="currentColor line icons — no external libraries. Pass size={n} to override.">
      <div className="demo-block">
        <div className="demo-block-hd"><b>kit/icons</b><span>{ICONS.length} icons</span></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:1,background:"var(--hair)",border:"1px solid var(--hair)"}}>
          {ICONS.map(([name,Ico]) => (
            <div key={name} style={{background:"var(--paper)",padding:"20px 10px",textAlign:"center"}}>
              <div style={{color:"var(--ink)",marginBottom:10}}><Ico size={20}/></div>
              <div style={{fontFamily:"var(--mono)",fontSize:10.5,letterSpacing:".08em",color:"var(--mut)"}}>{name}</div>
            </div>
          ))}
        </div>
      </div>
    </DemoSection>
  );
}

/* ═══ MOUNT ═══════════════════════════════════════════════════ */

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<App/>);
