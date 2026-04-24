// Remaining sections + App root

function Playground() {
  const { t, lang } = useLang();
  const D = window.DCP_DATA;
  const [model, setModel] = useState("allam-7b");
  const [prompt, setPrompt] = useState(D.demoPrompts["allam-7b"]);
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [latency, setLatency] = useState(0);
  const [tab, setTab] = useState("ui");
  const timerRef = useRef(null);

  function chooseModel(id) {
    setModel(id);
    setPrompt(D.demoPrompts[id]);
    setOut("");
  }

  const responses = {
    "allam-7b":   "تُعدّ منصة DCP أول سوق سحابي سعودي لوحدات معالجة الرسوميات المصمَّم خصّيصًا للذكاء الاصطناعي العربي. نوفّر بنية تحتية سيادية داخل المملكة، مع فوترة بالريال لكل رمز، وزمن استجابة يقلّ عن ٤٠ مللي ثانية، وبلا أي تسريب للبيانات خارج الحدود — فقط حوسبة موثوقة تتحدث لغتك.",
    "jais-13b":   "الذكاء الاصطناعي التوليدي يُنشئ محتوى جديداً كالنصوص والصور، بينما التمييزي يُصنّف ويحلّل المدخلات الموجودة. الأول إبداعي، والثاني تشخيصي — وكلاهما يعملان بكفاءة أعلى على بنية DCP السيادية.",
    "falcon-h1":  "تشغيل النماذج داخل المملكة يعني: إقامة بيانات كاملة، التزام بنظام حماية البيانات الشخصية، زمن استجابة أقل بنسبة ٨٥٪، تكاليف بالريال بدون تحويلات بنكية، ودعم أصلي للعربية في طبقة النموذج الأساسية.",
    "qwen-3-72b": "DCP is a GPU compute marketplace with Saudi data residency, Arabic AI models, and PDPL compliance. It offers an OpenAI-compatible API with per-token SAR billing. Saudi energy-cost conditions provide a structural advantage for sustained AI operations, and Arabic AI support is first-class across ALLaM 7B, Falcon H1, JAIS 13B, and BGE-M3.",
    "llama-3-70b":"DCP is the GPU compute marketplace with Saudi data residency and PDPL compliance. OpenAI-compatible API, Arabic AI models hosted in the Kingdom, per-token billing. Drop-in replacement for OpenAI — swap the base URL to https://api.dcp.sa/v1 and start generating.",
    "mistral-l":  `import { OpenAI } from "openai";\nconst client = new OpenAI({\n  baseURL: "https://api.dcp.sa/v1",\n  apiKey:  process.env.DCP_KEY,\n});\nconst r = await client.chat.completions.create({\n  model: "allam-7b-instruct",\n  messages: [{ role: "user", content: "مرحباً" }],\n});\nconsole.log(r.choices[0].message.content);`,
    "bge-m3":     "[0.0142, -0.0831, 0.2104, 0.0572, -0.1109, … 1024 dim]",
    "sdxl-turbo": "[image generated · 1024×1024 · 2.3s · falcon.png]",
  };

  function run() {
    setOut("");
    setRunning(true);
    setTokens(0);
    setLatency(38 + Math.random() * 14);
    const target = responses[model] || "...";
    let i = 0;
    const startT = performance.now();
    timerRef.current = setInterval(() => {
      i += Math.random() > 0.5 ? 2 : 1;
      setOut(target.slice(0, i));
      setTokens(Math.round(i / 4));
      if (i >= target.length) {
        clearInterval(timerRef.current);
        setRunning(false);
        setLatency(performance.now() - startT);
      }
    }, 22);
  }
  function stop() {
    clearInterval(timerRef.current);
    setRunning(false);
  }
  useEffect(() => () => clearInterval(timerRef.current), []);

  const isArabicOut = /[\u0600-\u06FF]/.test(out);
  const modelObj = D.models.find(m => m.id === model);
  const cost = ((tokens/1000) * (modelObj?.out || 1) * 3.75).toFixed(4); // USD→SAR ~3.75

  const curl = `curl https://api.dcp.sa/v1/chat/completions \\\n  -H "Authorization: Bearer $DCP_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "model": "${modelObj?.name || model}",\n    "messages": [\n      {"role":"user","content": "${prompt.replace(/"/g,'\\"').slice(0,60)}..."}\n    ]\n  }'`;

  return (
    <section id="api">
      <div className="wrap">
        <SectionMeta idx="02" label="Platform · API"/>
        <div className="grid-2" style={{alignItems:"end", marginBottom: 36}}>
          <Reveal>
            <Eyebrow>{t.playground.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.playground.title}</h2>
          </Reveal>
          <Reveal delay={120}><p className="ss">{t.playground.sub}</p></Reveal>
        </div>

        <div className="pg">
          <div className="pg-pane">
            <div className="pg-label">{t.playground.model}</div>
            <select className="select" value={model} onChange={e => chooseModel(e.target.value)}
              style={{appearance:"none", font:"inherit"}}>
              {D.models.filter(m => m.kind === "chat").map(m =>
                <option key={m.id} value={m.id}>{m.name} · {m.org}</option>
              )}
            </select>

            <div className="pg-label" style={{marginTop:18}}>{t.playground.prompt}</div>
            <textarea className="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)}
              dir={/[\u0600-\u06FF]/.test(prompt) ? "rtl" : "ltr"}/>

            <div className="pg-actions">
              {running
                ? <button className="btn" onClick={stop}><Stop/> {t.playground.stop}</button>
                : <button className="btn primary" onClick={run}><Play/> {t.playground.run}</button>}
              <div className="pg-meta">
                <span><b>{fmtInt(tokens, lang)}</b> {t.playground.tokens}</span>
                <span><b>{cost}</b> {t.playground.cost}</span>
                <span><b>{fmtInt(latency, lang)}</b> {t.playground.latency}</span>
              </div>
            </div>
          </div>

          <div className="pg-pane">
            <div className="tabs">
              <button className={tab==="ui"?"on":""} onClick={()=>setTab("ui")}>{t.playground.response}</button>
              <button className={tab==="curl"?"on":""} onClick={()=>setTab("curl")}>cURL</button>
              <button className={tab==="sdk"?"on":""} onClick={()=>setTab("sdk")}>Node</button>
            </div>
            {tab === "ui" && (
              <div className={"pg-response " + (isArabicOut?"rtl-out ":"") + (!out?"empty":"")}>
                {out
                  ? <>{out}{running && <span className="cursor"/>}</>
                  : <span>{t.playground.empty}</span>}
                {tokens > 0 && (
                  <div className="token-ribbon">
                    {Array.from({length: Math.min(24, Math.floor(tokens/3))}).map((_,i) => (
                      <span className="tok-chip" key={i}>{"•".repeat(1+i%3)}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {tab === "curl" && (
              <pre className="code"><span className="f">curl</span>{" "}<span className="n">https://api.dcp.sa/v1/chat/completions</span> {"\\\n  "}
                <span className="k">-H</span> <span className="s">"Authorization: Bearer $DCP_KEY"</span> {"\\\n  "}
                <span className="k">-H</span> <span className="s">"Content-Type: application/json"</span> {"\\\n  "}
                <span className="k">-d</span> <span className="s">{`'{"model":"${modelObj?.name}","messages":[{"role":"user","content":"..."}]}'`}</span>
              </pre>
            )}
            {tab === "sdk" && (
              <pre className="code">
                <span className="k">import</span> {"{ "}<span className="f">OpenAI</span>{" }"} <span className="k">from</span> <span className="s">"openai"</span>;{"\n\n"}
                <span className="k">const</span> client = <span className="k">new</span> <span className="f">OpenAI</span>({"{ "}{"\n  "}
                  baseURL: <span className="s">"https://api.dcp.sa/v1"</span>,{"\n  "}
                  apiKey:  process.env.<span className="n">DCP_KEY</span>,{"\n"}
                {"});"}{"\n\n"}
                <span className="k">const</span> r = <span className="k">await</span> client.chat.completions.<span className="f">create</span>({"{"}{"\n  "}
                  model: <span className="s">"{modelObj?.name}"</span>,{"\n  "}
                  messages: [{"{"} role: <span className="s">"user"</span>, content: <span className="s">"مرحباً"</span> {"}"}],{"\n"}
                {"});"}
              </pre>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Models() {
  const { t, lang } = useLang();
  const D = window.DCP_DATA;
  const [filter, setFilter] = useState("all");
  const filtered = useMemo(() =>
    D.models.filter(m => {
      if (filter === "ar" && !m.arabic) return false;
      if (filter === "chat" && m.kind !== "chat") return false;
      if (filter === "image" && m.kind !== "image") return false;
      if (filter === "embed" && m.kind !== "embed") return false;
      return true;
    }), [filter]);
  const chips = [
    ["all", t.models.all], ["ar", t.models.ar],
    ["chat", t.models.chat], ["image", t.models.image], ["embed", t.models.embed]
  ];
  return (
    <section id="models">
      <div className="wrap">
        <SectionMeta idx="03" label="Model catalog"/>
        <div className="grid-2" style={{alignItems:"end", marginBottom: 36}}>
          <Reveal>
            <Eyebrow>{t.models.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.models.title}</h2>
          </Reveal>
          <Reveal delay={120}><p className="ss">{t.models.sub}</p></Reveal>
        </div>
        <div className="mk-controls" style={{marginBottom:20}}>
          {chips.map(([k,l]) =>
            <button key={k} className={"chip "+(filter===k?"on":"")} onClick={()=>setFilter(k)}>{l}</button>
          )}
        </div>
        <div className="models-grid">
          {filtered.map(m => (
            <div className="m-card" key={m.id}>
              {m.hot && <span className="hot"><span className="d"/>hot</span>}
              <div className="org">{m.org} · {m.ctx}</div>
              <div className="mname">{m.name}</div>
              <div className="mtag">{m.tag}</div>
              <div className="mrow">
                <span>{t.models.in}</span>
                <span><b>{fmt(m.in, lang, {minimumFractionDigits:2, maximumFractionDigits:2})}</b> SAR</span>
              </div>
              <div className="mrow" style={{marginTop:0, borderTop:"0", paddingTop:6}}>
                <span>{t.models.out}</span>
                <span><b>{fmt(m.out, lang, {minimumFractionDigits:2, maximumFractionDigits:2})}</b> SAR</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mk-foot" style={{marginTop:16}}><span>{t.models.per}</span><span>+ {fmtInt(14, lang)} more in catalog</span></p>
      </div>
    </section>
  );
}

function Billing() {
  const { t } = useLang();
  return (
    <section id="pricing">
      <div className="wrap">
        <SectionMeta idx="04" label="Settlement"/>
        <div className="grid-2" style={{alignItems:"end", marginBottom: 20}}>
          <Reveal>
            <Eyebrow>{t.billing.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.billing.title}</h2>
          </Reveal>
          <Reveal delay={120}><p className="ss">{t.billing.sub}</p></Reveal>
        </div>
        <div className="bill-list">
          {t.billing.rows.map(([n, title, desc]) => (
            <div className="bill-row" key={n}>
              <div className="n">{n}</div>
              <div className="t">{title}</div>
              <div className="d">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Providers() {
  const { t, lang } = useLang();
  const [hours, setHours] = useState(16);
  const [util, setUtil]   = useState(55);
  const [gpu, setGpu]     = useState("rtx4090");
  const rates = { rtx4070: 1.6, rtx4080: 2.4, rtx4090: 3.4, rtx5090: 4.8, m4max: 2.2, a100: 9.6, h100: 20.1 };
  const price = rates[gpu];
  const earn = price * 0.75 * hours * (util/100) * 30;

  return (
    <section id="providers">
      <div className="wrap">
        <SectionMeta idx="05" label="Provider network"/>
        <div className="prov-wrap">
          <Reveal>
            <Eyebrow>{t.providers.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.providers.title}</h2>
            <p className="ss">{t.providers.sub}</p>
            <ul className="prov-list">
              {t.providers.items.map((it, i) => (
                <li key={i}><span className="mk">0{i+1}</span><span className="tx">{it}</span></li>
              ))}
            </ul>
            <div style={{marginTop:28, display:"flex", gap:10, flexWrap:"wrap"}}>
              <MagneticButton><a className="btn primary" href="#">{t.providers.cta} <Arrow size={13}/></a></MagneticButton>
              <a className="btn ghost" href="#">docs</a>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="calc-card">
            <div className="pg-label">{t.providers.calc}</div>

            <div className="calc-field" style={{marginTop:16}}>
              <div className="calc-row"><span>GPU</span><b>{gpu.toUpperCase()}</b></div>
              <select className="select" value={gpu} onChange={e=>setGpu(e.target.value)}>
                <option value="rtx4070">RTX 4070 Ti · 12GB</option>
                <option value="rtx4080">RTX 4080 · 16GB</option>
                <option value="rtx4090">RTX 4090 · 24GB</option>
                <option value="rtx5090">RTX 5090 · 32GB</option>
                <option value="m4max">Apple M4 Max · 36GB</option>
                <option value="a100">A100 · 40GB</option>
                <option value="h100">H100 · 80GB</option>
              </select>
            </div>

            <div className="calc-field">
              <div className="calc-row"><span>Hours / day</span><b>{fmtInt(hours, lang)} h</b></div>
              <input className="slider" type="range" min="1" max="24" value={hours} onChange={e=>setHours(+e.target.value)}/>
            </div>

            <div className="calc-field">
              <div className="calc-row"><span>Utilization</span><b>{fmtInt(util, lang)}%</b></div>
              <input className="slider" type="range" min="10" max="95" value={util} onChange={e=>setUtil(+e.target.value)}/>
            </div>

              <div className="calc-out">
                <div className="big">
                  {fmt(earn, lang, {maximumFractionDigits:0})}
                  <span className="u">SAR {t.providers.mo}</span>
                </div>
                <div className="sub">{fmt(price, lang, {minimumFractionDigits:2, maximumFractionDigits:2})} SAR/hr · 75/25 · weekly payout</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Enterprise() {
  const { t } = useLang();
  return (
    <section style={{padding:"96px 0"}}>
      <div className="wrap">
        <div className="ent">
          <div className="ent-bg"/>
          <Reveal>
            <Eyebrow>{t.enterprise.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:16, maxWidth: "18ch"}}>{t.enterprise.title}</h2>
            <p className="ss">{t.enterprise.sub}</p>
            <div className="ent-cta">
              <MagneticButton><a className="btn primary" href="#">{t.enterprise.cta} <Arrow size={13}/></a></MagneticButton>
              <a className="btn ghost" href="#">whitepaper.pdf</a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const { t } = useLang();
  return (
    <section>
      <div className="wrap">
        <SectionMeta idx="06" label="How DCP runs"/>
        <div className="grid-2" style={{alignItems:"end", marginBottom: 20}}>
          <Reveal>
            <Eyebrow>{t.trust.eyebrow}</Eyebrow>
            <h2 className="st" style={{marginTop:12}}>{t.trust.title}</h2>
          </Reveal>
          <Reveal delay={120}><p className="ss">These are platform policy and operating-model statements, separate from live telemetry.</p></Reveal>
        </div>
        <div className="trust-grid">
          {t.trust.items.map(([k,v], i) => (
            <div className="tr" key={k}>
              <div className="n">0{i+1} / {String(t.trust.items.length).padStart(2,"0")}</div>
              <h3>{k}</h3>
              <p>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EndCTA() {
  const { t } = useLang();
  return (
    <section className="end-cta">
      <div className="wrap">
        <Reveal>
          <Eyebrow>{t.cta_block.small}</Eyebrow>
          <div className="big">
            {t.cta_block.big_1}<br/><em>{t.cta_block.big_2}</em>
          </div>
          <p className="ss">{t.cta_block.body}</p>
          <div className="ctas">
            <MagneticButton><a className="btn primary lg" href="#">{t.cta_block.primary} <Arrow size={14}/></a></MagneticButton>
            <MagneticButton strength={0.18}><a className="btn ghost lg" href="#">{t.cta_block.secondary}</a></MagneticButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLang();
  const cols = [
    [t.footer.product, ["Start Renting","Start Earning","Marketplace","Console Login"]],
    [t.footer.dev,     ["Docs","Build via API","Provider install help","Billing support"]],
    [t.footer.company, ["Support","Job failure support","Enterprise support","System status"]],
    [t.footer.legal,   ["Terms of Service","Privacy Policy","Acceptable Use","System Status"]],
  ];
  return (
    <footer className="site foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="brand">
              <span className="brand-mark"><img src="assets/dcp-logo-square.jpeg" alt="DCP"/></span>
              <span className="brand-name">DCP<i>·sa</i></span>
            </div>
            <p style={{marginTop:16, maxWidth:"36ch", color:"color-mix(in oklab, var(--bg) 75%, transparent)", fontSize:14, lineHeight:1.55}}>
              {t.footer.tag}
            </p>
            <div style={{marginTop:20, fontFamily:"var(--mono)", fontSize:11, letterSpacing:".1em", color:"var(--teal)"}}>
              ● {t.footer.status}
            </div>
          </div>
          {cols.map(([h, ls]) => (
            <div key={h}>
              <h4>{h}</h4>
              <ul>{ls.map(l => <li key={l}><a href="#">{l}</a></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          <span>© 2026 DC Power Solutions Company · Riyadh, KSA</span>
          <span>CR: 7053667775 · dcp.sa</span>
        </div>
      </div>
    </footer>
  );
}

function TweaksPanel() {
  const { open, state, setKey } = useTweaks();
  if (!open) return null;
  const palettes = ["paper","night","mono"];
  const densities = ["editorial","compact"];
  return (
    <div className={"tweaks on"}>
      <h4>Tweaks</h4>
      <label>Palette</label>
      <div className="opts">
        {palettes.map(p => (
          <button key={p} className={"opt "+(state.palette===p?"on":"")} onClick={()=>setKey("palette", p)}>{p}</button>
        ))}
      </div>
      <label>Density</label>
      <div className="opts">
        {densities.map(d => (
          <button key={d} className={"opt "+(state.density===d?"on":"")} onClick={()=>setKey("density", d)}>{d}</button>
        ))}
      </div>
      <label>Accent hue</label>
      <div className="opts">
        {["desert","saudi","ink"].map(a => (
          <button key={a} className={"opt "+(state.accent===a?"on":"")} onClick={()=>setKey("accent", a)}>{a}</button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [lang, setLang] = useState(() => {
    const s = localStorage.getItem("dcp_lang");
    return (s === "en" || s === "ar") ? s : "en";
  });
  useEffect(() => {
    localStorage.setItem("dcp_lang", lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    document.documentElement.setAttribute("data-lang", lang);
  }, [lang]);

  const t = window.DCP_I18N[lang] || window.DCP_I18N.en;
  return (
    <LangCtx.Provider value={{ lang, t }}>
      <Marquee/>
      <Nav lang={lang} setLang={setLang}/>
      <Hero/>
      <Marketplace/>
      <Playground/>
      <Models/>
      <Billing/>
      <Providers/>
      <Enterprise/>
      <Trust/>
      <EndCTA/>
      <Footer/>
      <TweaksPanel/>
    </LangCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
