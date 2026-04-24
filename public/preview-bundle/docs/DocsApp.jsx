// Docs React components — builds everything from window.DCP_DOCS
// Globals available: React, ReactDOM

const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ─── i18n ───
const DOCS_I18N = {
  en: {
    brand: "Docs",
    nav_home: "dcp.sa", nav_docs: "Docs", nav_api: "API", nav_changelog: "Changelog", nav_status: "Status",
    search_ph: "Search docs…", search_kbd: "⌘K",
    toc: "On this page",
    prev: "Previous", next: "Next",
    helpful: "Was this helpful?", yes: "Yes", no: "No",
    tryit_t: "Try it live", tryit_sub: "streams from api.dcp.sa",
    tryit_model: "Model", tryit_prompt: "Prompt", tryit_run: "Run",
    tryit_tokens: "tokens", tryit_ms: "ms",
    copy: "Copy", copied: "Copied",
    on_this_page: "On this page",
  },
  ar: {
    brand: "التوثيق",
    nav_home: "dcp.sa", nav_docs: "التوثيق", nav_api: "الـ API", nav_changelog: "التحديثات", nav_status: "الحالة",
    search_ph: "ابحث في التوثيق…", search_kbd: "⌘K",
    toc: "في هذه الصفحة",
    prev: "السابق", next: "التالي",
    helpful: "هل كان هذا مفيداً؟", yes: "نعم", no: "لا",
    tryit_t: "جرّب مباشرة", tryit_sub: "بث من api.dcp.sa",
    tryit_model: "النموذج", tryit_prompt: "المدخل", tryit_run: "تشغيل",
    tryit_tokens: "رمز", tryit_ms: "مللي ثانية",
    copy: "نسخ", copied: "تم",
    on_this_page: "في هذه الصفحة",
  },
};

const LangCtx = React.createContext({ lang: "en", t: DOCS_I18N.en });
const useLang = () => React.useContext(LangCtx);

// ─── tiny slug ───
const slug = (s) => (s || "").toString()
  .toLowerCase().replace(/[^\w\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "");

// ─── Icons ───
const Icon = ({ name, size = 14 }) => {
  const p = {
    search: "M11 11l4 4M12.5 7.5a5 5 0 11-10 0 5 5 0 0110 0z",
    copy:   "M6 6V4a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2h-2M4 6h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z",
    check:  "M3 10l5 5 10-10",
    play:   "M5 3l12 7-12 7V3z",
    note:   "M9 2a7 7 0 017 7c0 1.5-.5 2.5-1.5 3.5L13 14v3H5v-3l-1.5-1.5C2.5 11.5 2 10.5 2 9a7 7 0 017-7z",
    tip:    "M9 1v2M1 9h2M17 9h2M9 17v2M4 4l1.5 1.5M14.5 14.5L16 16M4 16l1.5-1.5M14.5 5.5L16 4M9 6a3 3 0 100 6 3 3 0 000-6z",
    warn:   "M9 1l8 15H1L9 1zM9 7v5M9 13v.5",
    arr:    "M3 9h12M11 5l4 4-4 4",
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={p}/>
    </svg>
  );
};

// ─── Reveal wrapper ───
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    // If already in viewport on mount, reveal immediately.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setTimeout(() => el.classList.add("in"), delay);
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { setTimeout(() => el.classList.add("in"), delay); io.disconnect(); }
      });
    }, { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <div ref={ref} className="reveal">{children}</div>;
}

// ─── Persistent language tab for code ───
const LANG_KEY = "dcp_docs_codelang";
function getInitialLang(tabs) {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved && tabs[saved]) return saved;
  const order = ["python", "node", "curl", "go", "json", "shell", "windows", "macos", "linux"];
  return order.find(k => tabs[k]) || Object.keys(tabs)[0];
}

// ─── Syntax highlight (tiny, lang-agnostic) ───
function highlight(src, lang) {
  if (!src) return src;
  let html = src.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  // comments
  if (lang === "python" || lang === "shell" || lang === "curl" || lang === "windows" || lang === "macos" || lang === "linux") {
    html = html.replace(/(#.*?)(\n|$)/g, '<span class="tok-c">$1</span>$2');
  }
  if (lang === "node" || lang === "go") {
    html = html.replace(/(\/\/.*?)(\n|$)/g, '<span class="tok-c">$1</span>$2');
  }
  // strings
  html = html.replace(/("([^"\\]|\\.)*")/g, '<span class="tok-s">$1</span>');
  html = html.replace(/('([^'\\]|\\.)*')/g, '<span class="tok-s">$1</span>');
  // keywords
  const kw = {
    python: /\b(from|import|def|class|return|if|else|elif|for|in|while|True|False|None|async|await|with|as|print)\b/g,
    node:   /\b(import|from|const|let|var|function|return|if|else|for|while|await|async|new|class|export|default|process)\b/g,
    go:     /\b(package|import|func|return|if|else|for|range|var|const|type|struct|interface|go|defer)\b/g,
    json:   /\b(true|false|null)\b/g,
    shell:  /\b(brew|curl|npm|pip|bash|export|cd)\b/g,
  };
  if (kw[lang]) html = html.replace(kw[lang], '<span class="tok-k">$1</span>');
  // flags for curl
  if (lang === "curl" || lang === "shell") {
    html = html.replace(/(^|\s)(-[A-Za-z]+)/g, '$1<span class="tok-n">$2</span>');
  }
  // function calls (very naive)
  html = html.replace(/(\b[a-zA-Z_][\w]*)(\s*\()/g, '<span class="tok-f">$1</span>$2');
  // $VARS
  html = html.replace(/\$[A-Z_][A-Z0-9_]*/g, m => `<span class="tok-n">${m}</span>`);
  return html;
}

// ─── Code block with tabs + copy ───
function CodeBlock({ tabs }) {
  const keys = Object.keys(tabs);
  const [active, setActive] = useState(() => getInitialLang(tabs));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (tabs[e.detail] && e.detail !== active) setActive(e.detail);
    };
    window.addEventListener("dcp_lang_change", handler);
    return () => window.removeEventListener("dcp_lang_change", handler);
  }, [tabs, active]);

  if (!tabs[active]) return null;

  const pick = (k) => {
    setActive(k);
    localStorage.setItem(LANG_KEY, k);
    window.dispatchEvent(new CustomEvent("dcp_lang_change", { detail: k }));
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(tabs[active]); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="codeblock">
      <div className="tabs">
        {keys.map(k =>
          <button key={k} className={k === active ? "on" : ""} onClick={() => pick(k)}>{k}</button>
        )}
        <span className="spacer"/>
        <button className={"copy" + (copied ? " ok" : "")} onClick={copy}>
          <Icon name={copied ? "check" : "copy"} size={12}/>
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre><code dangerouslySetInnerHTML={{ __html: highlight(tabs[active], active) }}/></pre>
    </div>
  );
}

// ─── Block renderer ───
function Block({ b }) {
  if (b.type === "p")   return <p>{b.text}</p>;
  if (b.type === "h2")  return <h2 id={slug(b.text)}>{b.text}</h2>;
  if (b.type === "h3")  return <h3 id={slug(b.text)}>{b.text}</h3>;
  if (b.type === "code") return <CodeBlock tabs={b.tabs}/>;
  if (b.type === "callout") {
    const icon = b.kind === "note" ? "note" : b.kind === "tip" ? "tip" : "warn";
    return (
      <div className={"callout " + (b.kind || "note")}>
        <div className="icon"><Icon name={icon} size={16}/></div>
        <div>
          {b.title && <div className="title">{b.title}</div>}
          <div className="body">{b.text}</div>
        </div>
      </div>
    );
  }
  if (b.type === "steps") {
    return (
      <ol className="steps">
        {b.items.map(([n, t], i) => <li key={i} data-n={n}>{t}</li>)}
      </ol>
    );
  }
  if (b.type === "table") {
    return (
      <div style={{overflowX:"auto"}}>
        <table className="docs-table">
          <thead><tr>{b.headers.map((h,i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {b.rows.map((r,i) => (
              <tr key={i}>{r.map((c,j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (b.type === "params") {
    return (
      <div className="params">
        {b.rows.map(([name, type, req, desc], i) => (
          <div className="param" key={i}>
            <div className="head">
              <span className="name">{name}</span>
              <span className="type">{type}</span>
              {req === "required" ? <span className="req">required</span> : <span className="opt">{req}</span>}
            </div>
            <div className="desc">{desc}</div>
          </div>
        ))}
      </div>
    );
  }
  if (b.type === "endpoint") {
    return (
      <div className="endpoint">
        <span className={"method " + b.method}>{b.method}</span>
        <span className="path">{b.path}</span>
      </div>
    );
  }
  if (b.type === "cards") {
    return (
      <div className="next-cards">
        {b.items.map(([t, d, href], i) => (
          <a key={i} href={"#/" + href} onClick={(e)=>{ e.preventDefault(); window.navigateDoc(href); }}>
            <div className="t">{t}</div>
            <div className="d">{d}</div>
            <div className="arr">→</div>
          </a>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Try-it live console ───
function TryIt() {
  const { t, lang } = useLang();
  const [model, setModel] = useState("ALLaM-7B-Instruct");
  const [prompt, setPrompt] = useState(lang === "ar" ? "اكتب مقدّمة موجزة عن الرياض." : "Write a short haiku about Riyadh.");
  const [out, setOut] = useState("");
  const [running, setRunning] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [latency, setLatency] = useState(0);
  const timerRef = useRef(null);

  const RESP = {
    "ALLaM-7B-Instruct": lang === "ar"
      ? "الرياض لا تنام، هي قلبٌ ينبض بالرمل والعمران، مدينةٌ تصعد نحو الغد بلا تردّد — من طوي النخلة إلى زجاج الأبراج، ومن صوت المؤذّن إلى طنين خوادم الذكاء الاصطناعي في أطرافها."
      : "Steel and sand entwine,\nRiyadh hums beneath the sun —\nfutures in her hands.",
    "Falcon-H1-40B": lang === "ar"
      ? "Falcon-H1 مصمّم للسياق الطويل حتى ‎128‎ ألف رمز. ممتاز للاستدلال متعدّد الخطوات والوثائق الضخمة."
      : "Falcon-H1 is tuned for 128K-token context windows, excelling at multi-step reasoning and very long document understanding.",
    "JAIS-13B-Chat": lang === "ar"
      ? "JAIS خبير في الكتابة الإبداعية والفصحى. استخدمه للشعر والنصوص الأدبية."
      : "JAIS is specialized for creative and literary Arabic writing.",
    "bge-m3": "[0.0142, -0.0831, 0.2104, 0.0572, -0.1109, 0.0093, … 1024 dim]",
  };

  const run = () => {
    setOut(""); setRunning(true); setTokens(0); setLatency(0);
    const target = RESP[model] || "";
    let i = 0;
    const start = performance.now();
    timerRef.current = setInterval(() => {
      i += Math.random() > 0.55 ? 2 : 1;
      setOut(target.slice(0, i));
      setTokens(Math.max(1, Math.round(i / 3.5)));
      if (i >= target.length) {
        clearInterval(timerRef.current);
        setRunning(false);
        setLatency(Math.round(performance.now() - start));
      }
    }, 26);
  };
  useEffect(() => () => clearInterval(timerRef.current), []);

  const isAr = /[\u0600-\u06FF]/.test(out);

  return (
    <div className="tryit">
      <div className="head">
        <span className="dot"/>
        <span className="t">{t.tryit_t}</span>
        <span className="sub">· {t.tryit_sub}</span>
      </div>
      <div className="body">
        <div className="req">
          <div className="label">{t.tryit_model}</div>
          <select value={model} onChange={e => setModel(e.target.value)}>
            <option value="ALLaM-7B-Instruct">ALLaM-7B-Instruct · SDAIA</option>
            <option value="Falcon-H1-40B">Falcon-H1-40B · TII</option>
            <option value="JAIS-13B-Chat">JAIS-13B-Chat · Inception</option>
            <option value="bge-m3">bge-m3 · BAAI (embedding)</option>
          </select>
          <div className="label" style={{marginTop:14}}>{t.tryit_prompt}</div>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            dir={/[\u0600-\u06FF]/.test(prompt) ? "rtl" : "ltr"}/>
          <div className="actions">
            <button className="run" onClick={run} disabled={running}>
              <Icon name="play" size={11}/> {t.tryit_run}
            </button>
            <div className="stats">
              <b>{tokens}</b> {t.tryit_tokens} · <b>{latency || 38}</b> {t.tryit_ms}
            </div>
          </div>
        </div>
        <div className="res">
          <div className="label">Response</div>
          <div className={"output" + (isAr ? " rtl" : "")}>
            {out}{running && <span className="cursor"/>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page header stats strip (overview only) ───
function HeroStrip() {
  return (
    <div className="docs-hero-strip">
      <div className="stat"><b>v1</b><span>API version</span></div>
      <div className="stat"><b>OpenAI</b><span>compatible</span></div>
      <div className="stat"><b>SAR / halala</b><span>native currency</span></div>
      <div className="stat"><b>38 ms</b><span>p50 first token</span></div>
      <div className="stat"><b>40+</b><span>providers · in-Kingdom</span></div>
    </div>
  );
}

// ─── Main page view ───
function PageView({ slug: pageSlug }) {
  const { lang, t } = useLang();
  const D = window.DCP_DOCS;
  const page = D.pages[pageSlug]?.[lang] || D.pages[pageSlug]?.en;
  const [activeHeading, setActiveHeading] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    // intersection observer for TOC active state
    const headings = document.querySelectorAll(".docs-content h3, .docs-content h2");
    if (!headings.length) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveHeading(e.target.id); });
    }, { rootMargin: "-10% 0px -70% 0px" });
    headings.forEach(h => io.observe(h));
    return () => io.disconnect();
  }, [pageSlug, lang]);

  if (!page) return <div className="docs-content"><h1>Not found</h1></div>;

  // Compute prev/next
  const flat = [];
  D.nav[lang].forEach(g => g.items.forEach(([s, title]) => flat.push([s, title])));
  const idx = flat.findIndex(([s]) => s === pageSlug);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx < flat.length - 1 ? flat[idx + 1] : null;

  const tocHeadings = page.blocks
    .filter(b => b.type === "h3" || b.type === "h2")
    .map(b => [b.text, slug(b.text)]);

  // Add try-it block on chat/embeddings/quickstart pages
  const showTry = ["quickstart", "chat", "embeddings"].includes(pageSlug);

  return (
    <>
      <main className="docs-content">
        <Reveal>
          <div className="kicker">{page.kicker}</div>
          <h1>{page.title}</h1>
          <p className="summary">{page.summary}</p>
        </Reveal>

        {pageSlug === "quickstart" && <HeroStrip/>}
        {showTry && <TryIt/>}

        {page.blocks.map((b, i) => <Block key={i} b={b}/>)}

        <div className="page-nav">
          {prev
            ? <a href={"#/" + prev[0]} onClick={(e)=>{e.preventDefault();window.navigateDoc(prev[0]);}}>
                <div className="dir">← {t.prev}</div>
                <div className="title">{prev[1]}</div>
              </a>
            : <span/>}
          {next
            ? <a className="next" href={"#/" + next[0]} onClick={(e)=>{e.preventDefault();window.navigateDoc(next[0]);}}>
                <div className="dir">{t.next} →</div>
                <div className="title">{next[1]}</div>
              </a>
            : <span/>}
        </div>
      </main>

      <aside className="docs-toc">
        <div className="label">{t.on_this_page}</div>
        <ul>
          {tocHeadings.map(([txt, s]) => (
            <li key={s}>
              <a href={"#" + s} className={activeHeading === s ? "on" : ""}>{txt}</a>
            </li>
          ))}
        </ul>
        <div className="helpful">
          <div className="q">{t.helpful}</div>
          <div className="btns">
            <button>{t.yes}</button>
            <button>{t.no}</button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Sidebar ───
function Sidebar({ current, onPick }) {
  const { lang } = useLang();
  const D = window.DCP_DOCS;
  return (
    <nav className="docs-sidebar">
      {D.nav[lang].map(group => (
        <div className="sb-group" key={group.title}>
          <h5>{group.title}</h5>
          <ul>
            {group.items.map(([s, title]) => (
              <li key={s}>
                <a href={"#/" + s} className={current === s ? "on" : ""}
                   onClick={(e)=>{e.preventDefault(); onPick(s);}}>{title}</a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// ─── Command palette (⌘K) ───
function Palette({ open, onClose, onPick }) {
  const { lang, t } = useLang();
  const D = window.DCP_DOCS;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 20);
    if (!open) { setQ(""); setSel(0); }
  }, [open]);

  const results = useMemo(() => {
    const all = [];
    D.nav[lang].forEach(g => g.items.forEach(([s, title]) => {
      const page = D.pages[s]?.[lang] || D.pages[s]?.en;
      all.push({ slug: s, group: g.title, title, snip: page?.summary || "" });
    }));
    if (!q.trim()) return all.slice(0, 12);
    const needle = q.toLowerCase();
    return all.filter(r =>
      r.title.toLowerCase().includes(needle) ||
      r.snip.toLowerCase().includes(needle) ||
      r.slug.includes(needle)
    ).slice(0, 12);
  }, [q, lang]);

  useEffect(() => { setSel(s => Math.min(s, Math.max(0, results.length - 1))); }, [results.length]);

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[sel]) { onPick(results[sel].slug); onClose(); }
    if (e.key === "Escape") onClose();
  };

  if (!open) return null;
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <div className="input">
          <Icon name="search" size={14}/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={onKey}
            placeholder={t.search_ph}/>
          <kbd>esc</kbd>
        </div>
        <div className="results">
          {results.length === 0 && (
            <div style={{padding:"24px 18px", color:"var(--ink-3)", fontSize:13}}>No results</div>
          )}
          {results.map((r, i) => (
            <div key={r.slug} className={"result" + (i === sel ? " on" : "")}
              onMouseEnter={() => setSel(i)}
              onClick={() => { onPick(r.slug); onClose(); }}>
              <div className="kicker">{r.group}</div>
              <div>
                <div className="title">{r.title}</div>
                {r.snip && <div className="snip">{r.snip.slice(0, 80)}…</div>}
              </div>
              <span className="arr">↵</span>
            </div>
          ))}
        </div>
        <div className="foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

// ─── Topbar ───
function Topbar({ lang, setLang, onSearch }) {
  const { t } = useLang();
  return (
    <header className="topbar">
      <a href="../DCP Redesign.html" className="brand">
        <span className="mark"><img src="../assets/dcp-logo-square.jpeg" alt="DCP"/></span>
        <span className="w">DCP</span>
        <span className="d">{t.brand}</span>
      </a>
      <nav>
        <a href="../DCP Redesign.html">{t.nav_home}</a>
        <a className="on">{t.nav_docs}</a>
        <a href="#/chat">{t.nav_api}</a>
        <a href="#/status">{t.nav_status}</a>
      </nav>
      <div className="right">
        <button className="search-trigger" onClick={onSearch}>
          <Icon name="search" size={13}/>
          <span className="grow">{t.search_ph}</span>
          <kbd>{t.search_kbd}</kbd>
        </button>
        <button className="lang-pill" onClick={() => setLang(lang === "en" ? "ar" : "en")}>
          {lang === "en" ? "العربية" : "EN"}
        </button>
      </div>
    </header>
  );
}

// ─── App root ───
function DocsApp() {
  const [lang, setLang] = useState(() => {
    const s = localStorage.getItem("dcp_lang");
    return (s === "en" || s === "ar") ? s : "en";
  });
  const [current, setCurrent] = useState(() => {
    const h = window.location.hash.replace(/^#\//, "");
    return window.DCP_DOCS.pages[h] ? h : "quickstart";
  });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("dcp_lang", lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }, [lang]);

  useEffect(() => {
    window.location.hash = "#/" + current;
  }, [current]);

  useEffect(() => {
    window.navigateDoc = (s) => setCurrent(s);
    const keyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, []);

  const t = DOCS_I18N[lang];

  return (
    <LangCtx.Provider value={{ lang, t }}>
      <Topbar lang={lang} setLang={setLang} onSearch={() => setPaletteOpen(true)}/>
      <div className="docs-layout">
        <Sidebar current={current} onPick={setCurrent}/>
        <PageView slug={current}/>
      </div>
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={setCurrent}/>
    </LangCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DocsApp/>);
