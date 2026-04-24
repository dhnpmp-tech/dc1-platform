// ───────────────────────────────────────────────────────────────
// DCP Design Kit — v1
// Single consolidated primitive bundle. Every screen imports
// from here. No screen may invent new components; add them
// here first.
//
// Exports (all attached to window so sibling Babel <script>s
// can reference them):
//
//   Contexts / hooks
//     LangCtx, useLang, useTweaks, useJitter, useFeed,
//     useReveal, useCountUp
//   Formatting
//     fmt, fmtInt, fmtMoney
//   Icons
//     Arrow, Check, Play, Stop, Close, Search, Menu,
//     Sun, Moon, Plus, Minus, ChevronDown, Copy, External,
//     Download, Upload, Shield, Lock, Key, Zap, Cpu, Cloud,
//     Dot
//   Primitives
//     Reveal, MagneticButton, HeroMap, Sparkline
//   Chrome
//     Marquee, Brand, LangToggle, Nav, Footer,
//     SectionMeta, Eyebrow, Breadcrumb
//   Widgets
//     Badge, Callout, Stat, StatRow, Field, EmptyState,
//     Skeleton, Modal, Toast, TweaksPanel
//
// Depends on window.DCP_I18N and window.DCP_DATA.
// ───────────────────────────────────────────────────────────────

const { useState, useEffect, useMemo, useRef, useLayoutEffect, createContext, useContext } = React;

/* ═══ CONTEXT ═════════════════════════════════════════════════ */

const LangCtx = createContext({ lang: "en", t: (window.DCP_I18N && window.DCP_I18N.en) || {} });

function useLang() {
  const ctx = useContext(LangCtx);
  const t = ctx.t || (window.DCP_I18N && window.DCP_I18N.en) || {};
  return { lang: ctx.lang || "en", t };
}

/* ═══ FORMATTING ══════════════════════════════════════════════ */

function fmt(n, lang, opts = {}) {
  const loc = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(loc, opts).format(n);
}
function fmtInt(n, lang) { return fmt(Math.round(n), lang); }
function fmtMoney(n, lang, currency = "SAR") {
  const loc = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

/* ═══ ICONS — plain line icons, currentColor ══════════════════ */

const _icon = (d, { size = 14, fill = false, extra = null } = {}) =>
  React.createElement("svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: fill ? "currentColor" : "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" },
    typeof d === "string" ? React.createElement("path", { d }) : d,
    extra
  );

const Arrow = ({ size = 14, dir = "right" }) =>
  React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, style: { transform: dir === "left" ? "scaleX(-1)" : "" } },
    React.createElement("path", { d: "M5 12h14M13 6l6 6-6 6" }));
const Check    = ({ size = 14 }) => _icon("M5 13l4 4L19 7", { size });
const Play     = ({ size = 12 }) => _icon("M7 5v14l12-7z", { size, fill: true });
const Stop     = ({ size = 12 }) => React.createElement("svg", { width:size, height:size, viewBox:"0 0 24 24", fill:"currentColor" }, React.createElement("rect",{x:6,y:6,width:12,height:12}));
const Close    = ({ size = 14 }) => _icon("M6 6l12 12M18 6L6 18", { size });
const Search   = ({ size = 14 }) => _icon(React.createElement(React.Fragment, null,
  React.createElement("circle", { cx: 11, cy: 11, r: 6 }),
  React.createElement("path", { d: "M20 20l-4-4" })), { size });
const Menu     = ({ size = 16 }) => _icon("M4 7h16M4 12h16M4 17h16", { size });
const Plus     = ({ size = 14 }) => _icon("M12 5v14M5 12h14", { size });
const Minus    = ({ size = 14 }) => _icon("M5 12h14", { size });
const ChevronDown = ({ size = 14 }) => _icon("M6 9l6 6 6-6", { size });
const Copy     = ({ size = 14 }) => _icon(React.createElement(React.Fragment, null,
  React.createElement("rect", { x: 8, y: 8, width: 12, height: 12, rx: 1 }),
  React.createElement("path", { d: "M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" })), { size });
const External = ({ size = 12 }) => _icon("M7 17L17 7M9 7h8v8", { size });
const Download = ({ size = 14 }) => _icon("M12 4v12m0 0l-4-4m4 4l4-4M4 20h16", { size });
const Upload   = ({ size = 14 }) => _icon("M12 20V8m0 0l-4 4m4-4l4 4M4 4h16", { size });
const Shield   = ({ size = 14 }) => _icon("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z", { size });
const Lock     = ({ size = 14 }) => _icon(React.createElement(React.Fragment, null,
  React.createElement("rect", { x: 5, y: 11, width: 14, height: 10, rx: 1 }),
  React.createElement("path", { d: "M8 11V7a4 4 0 1 1 8 0v4" })), { size });
const Key      = ({ size = 14 }) => _icon(React.createElement(React.Fragment, null,
  React.createElement("circle", { cx: 8, cy: 15, r: 4 }),
  React.createElement("path", { d: "M11 12l10-10M17 6l3 3M14 9l3 3" })), { size });
const Zap      = ({ size = 14 }) => _icon("M13 3L4 14h7l-1 7 9-11h-7l1-7z", { size });
const Cpu      = ({ size = 14 }) => _icon(React.createElement(React.Fragment, null,
  React.createElement("rect", { x: 5, y: 5, width: 14, height: 14, rx: 1 }),
  React.createElement("rect", { x: 9, y: 9, width: 6, height: 6 }),
  React.createElement("path", { d: "M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" })), { size });
const Cloud    = ({ size = 14 }) => _icon("M6 18a4 4 0 1 1 1-7.9A5 5 0 0 1 17 11a3.5 3.5 0 0 1 0 7H6z", { size });
const Dot      = ({ size = 6, color = "currentColor" }) =>
  React.createElement("span", { style: { display:"inline-block", width:size, height:size, borderRadius:"50%", background:color } });

/* ═══ HOOKS ═══════════════════════════════════════════════════ */

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useJitter(base, { range = 0.04, interval = 2200 } = {}) {
  const [v, setV] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      const d = (Math.random() - 0.5) * 2 * range;
      setV(base * (1 + d));
    }, interval);
    return () => clearInterval(id);
  }, [base, range, interval]);
  return v;
}

function useFeed() {
  const D = window.DCP_DATA;
  const [items, setItems] = useState(() => initial());
  function initial() { const out = []; for (let i = 0; i < 6; i++) out.push(make(i)); return out; }
  function make(i = 0) {
    const kinds = ["reserve","stream","settle","mint"];
    const k = kinds[Math.floor(Math.random()*kinds.length)];
    const gpu = D.marketplace[Math.floor(Math.random()*D.marketplace.length)];
    const model = D.models[Math.floor(Math.random()*D.models.length)];
    const sec = (i+1) * 3 + Math.floor(Math.random()*4);
    const t = `${sec}s`;
    if (k === "reserve") return { k, t, msg: `RESERVE · ${gpu.gpu.split("·")[0].trim()} · ${gpu.region}` };
    if (k === "stream")  return { k, t, msg: `STREAM · ${model.name} · ${Math.floor(200+Math.random()*1800)} tok/s` };
    if (k === "settle")  return { k, t, msg: `SETTLE · ${gpu.provider} · +${(Math.random()*14+2).toFixed(2)} SAR` };
    return { k, t, msg: `MINT · api_key · ${Math.random().toString(36).slice(2,10)}`};
  }
  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => [make(), ...prev.slice(0, 7)].map((it,i) => ({...it, t: `${(i*3)+2}s`})));
    }, 2600);
    return () => clearInterval(id);
  }, []);
  return items;
}

function useReveal(delay = 0) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion) { el.style.opacity = 1; el.style.transform = "none"; return; }
    el.style.opacity = 0;
    el.style.transform = "translateY(18px)";
    el.style.transition = `opacity .9s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .9s cubic-bezier(.2,.7,.2,1) ${delay}ms`;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.style.opacity = 1; el.style.transform = "none"; io.unobserve(el); }
    }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}

function useCountUp(target, { duration = 1400, start = 0 } = {}) {
  const [val, setVal] = useState(start);
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion) { setVal(target); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        const t0 = performance.now();
        function step(t) {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(target * eased);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);
  return [val, ref];
}

function useTweaks() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(window.DCP_TWEAKS || {});
  useEffect(() => {
    function onMsg(e) {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode")   setOpen(true);
      if (d.type === "__deactivate_edit_mode") setOpen(false);
    }
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);
  function setKey(k, v) {
    setState(s => ({ ...s, [k]: v }));
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
    if (k === "palette") document.documentElement.setAttribute("data-palette", v);
  }
  useEffect(() => {
    if (state.palette) document.documentElement.setAttribute("data-palette", state.palette);
  }, []);
  return { open, state, setKey };
}

/* ═══ MOTION PRIMITIVES ═══════════════════════════════════════ */

function Reveal({ delay = 0, as = "div", children, ...rest }) {
  const ref = useReveal(delay);
  return React.createElement(as, { ref, ...rest }, children);
}

function MagneticButton({ children, strength = 0.22, className = "", ...rest }) {
  const ref = useRef(null);
  function onMove(e) {
    if (reducedMotion) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  }
  function onLeave() { const el = ref.current; if (el) el.style.transform = ""; }
  return (
    <span className={"magnet " + className} onMouseMove={onMove} onMouseLeave={onLeave} ref={ref} {...rest}>
      {children}
    </span>
  );
}

/* HeroMap — animated Saudi GPU mesh (Riyadh-central) */
function HeroMap() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w, h;
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
    }
    resize();
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const nodes = [
      { id: "ruh", x: 0.52, y: 0.54, r: 5.4, label: "RUH", primary: true },
      { id: "jed", x: 0.26, y: 0.62, r: 3.8, label: "JED" },
      { id: "dmm", x: 0.74, y: 0.42, r: 3.4, label: "DMM" },
      { id: "med", x: 0.34, y: 0.48, r: 2.6, label: "MED" },
      { id: "tuu", x: 0.22, y: 0.28, r: 2.4, label: "TUU" },
      { id: "neo", x: 0.12, y: 0.20, r: 2.8, label: "NEOM" },
      { id: "auh", x: 0.38, y: 0.82, r: 2.4, label: "AHB" },
      { id: "hgr", x: 0.82, y: 0.60, r: 2.0, label: "HGR" },
      { id: "yun", x: 0.30, y: 0.38, r: 2.0, label: "YNB" },
      { id: "qsm", x: 0.47, y: 0.38, r: 2.2, label: "QSM" },
    ];
    const edges = [];
    for (const n of nodes) if (n.id !== "ruh") edges.push(["ruh", n.id]);
    edges.push(["jed","med"],["jed","yun"],["dmm","hgr"],["tuu","neo"],["qsm","ruh"]);
    const arcs = [];
    function spawn() {
      const to = nodes[1 + Math.floor(Math.random()*(nodes.length-1))];
      arcs.push({ from: nodes[0], to, t: 0, life: 1600 + Math.random()*800, hue: Math.random() < 0.55 ? "teal":"orange" });
      if (arcs.length > 8) arcs.shift();
    }
    let lastSpawn = 0, t0 = performance.now(), raf;
    const nx = n => n.x * w, ny = n => n.y * h;
    function frame(t) {
      const dt = t - t0; t0 = t;
      if (t - lastSpawn > 900) { spawn(); lastSpawn = t; }
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(120,160,180,0.10)";
      for (const [a,b] of edges) {
        const na = nodes.find(n=>n.id===a), nb = nodes.find(n=>n.id===b);
        ctx.beginPath(); ctx.moveTo(nx(na), ny(na)); ctx.lineTo(nx(nb), ny(nb)); ctx.stroke();
      }
      for (const n of nodes) {
        const x = nx(n), y = ny(n);
        ctx.fillStyle = n.primary ? "rgba(45,212,182,0.16)" : "rgba(200,200,220,0.08)";
        ctx.beginPath(); ctx.arc(x,y,n.r*3.2,0,Math.PI*2); ctx.fill();
        if (n.primary) {
          const p = ((t / 1800) % 1);
          ctx.strokeStyle = `rgba(45,212,182,${(1-p)*0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x,y,n.r + p*22,0,Math.PI*2); ctx.stroke();
        }
        ctx.fillStyle = n.primary ? "#2dd4b6" : "#e8e3d6";
        ctx.beginPath(); ctx.arc(x,y,n.r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(200,200,220,0.55)";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText(n.label, x + n.r + 6, y + 3);
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i]; a.t += dt;
        const p = a.t / a.life;
        if (p >= 1) { arcs.splice(i,1); continue; }
        const x1 = nx(a.from), y1 = ny(a.from), x2 = nx(a.to), y2 = ny(a.to);
        const cx = (x1+x2)/2, cy = Math.min(y1,y2) - Math.hypot(x2-x1,y2-y1)*0.22;
        ctx.strokeStyle = a.hue === "teal"
          ? `rgba(45,212,182,${0.18*(1-Math.abs(p-0.5)*2)})`
          : `rgba(238,122,60,${0.18*(1-Math.abs(p-0.5)*2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
        const it = 1-p;
        const tx = it*it*x1 + 2*it*p*cx + p*p*x2;
        const ty = it*it*y1 + 2*it*p*cy + p*p*y2;
        const g = ctx.createRadialGradient(tx,ty,0,tx,ty,12);
        const col = a.hue === "teal" ? "45,212,182" : "238,122,60";
        g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(tx,ty,12,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = a.hue === "teal" ? "#2dd4b6" : "#ee7a3c";
        ctx.beginPath(); ctx.arc(tx,ty,2,0,Math.PI*2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    if (!reducedMotion) raf = requestAnimationFrame(frame);
    else {
      ctx.clearRect(0,0,w,h);
      for (const n of nodes) {
        const x = nx(n), y = ny(n);
        ctx.fillStyle = n.primary ? "#2dd4b6" : "#e8e3d6";
        ctx.beginPath(); ctx.arc(x,y,n.r,0,Math.PI*2); ctx.fill();
      }
    }
    const onResize = () => { resize(); ctx.scale(dpr, dpr); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} className="hero-map-canvas" aria-hidden="true"/>;
}

function Sparkline({ values, color = "var(--teal)", height = 28 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = r.width * dpr; el.height = height * dpr;
    el.style.height = height + "px";
    const ctx = el.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = r.width, h = height;
    if (!values || !values.length) return;
    const min = Math.min(...values), max = Math.max(...values);
    const range = Math.max(0.0001, max - min);
    ctx.clearRect(0,0,w,h);
    ctx.lineWidth = 1.4;
    const stroke = getComputedStyle(document.documentElement).getPropertyValue("--teal") || "#2dd4b6";
    ctx.strokeStyle = color === "var(--teal)" ? stroke.trim() : color;
    ctx.beginPath();
    values.forEach((v,i) => {
      const x = (i/(values.length-1))*w;
      const y = h - 2 - ((v-min)/range)*(h-4);
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    const lx = w, ly = h - 2 - ((values[values.length-1]-min)/range)*(h-4);
    ctx.fillStyle = stroke.trim();
    ctx.beginPath(); ctx.arc(lx-2,ly,2.2,0,Math.PI*2); ctx.fill();
  }, [values, color, height]);
  return <canvas ref={ref} className="spark"/>;
}

/* ═══ CHROME ══════════════════════════════════════════════════ */

function Marquee({ text }) {
  const { t } = useLang();
  const source = text || t.marquee || "";
  const words = source.split(" — ");
  return (
    <div className="marquee">
      <div className="marquee-in">
        {words.map((w,i) => <span key={"a"+i}>{w}</span>)}
        {words.map((w,i) => <span key={"b"+i}>{w}</span>)}
      </div>
    </div>
  );
}

function Brand({ href = "#", compact = false }) {
  const src = (window.DCP_LOGO_SRC) || "assets/dcp-logo-square.jpeg";
  return (
    <a href={href} className="brand">
      <span className="brand-mark"><img src={src} alt="DCP"/></span>
      {!compact && <span className="brand-name">DCP<i>·sa</i></span>}
    </a>
  );
}

function LangToggle({ lang, setLang }) {
  return (
    <span className="lang-pill">
      <button className={lang==="en"?"on":""} onClick={()=>setLang("en")}>EN</button>
      <button className={lang==="ar"?"on":""} onClick={()=>setLang("ar")}>ع</button>
    </span>
  );
}

/**
 * Nav — shared top chrome.
 * Props:
 *   lang, setLang                — language state
 *   links    = [{href,label,on}] — nav link list; default pulls from i18n.nav
 *   active   = "marketplace" | "platform" | ... (matches key in t.nav)
 *   status   = { label, dot }    — right-side status chip; defaults to RUH · 38ms
 *   right    = ReactNode         — override right-side slot entirely
 *   ctaLabel, ctaHref            — primary CTA override
 */
function Nav({ lang, setLang, links, active, status, right, ctaLabel, ctaHref }) {
  const { t } = useLang();
  const nav = t.nav || {};
  const computedLinks = links || [
    { href:"#marketplace", label: nav.marketplace, key: "marketplace" },
    { href:"#api",         label: nav.platform,    key: "platform" },
    { href:"#models",      label: nav.models,      key: "models" },
    { href:"#providers",   label: nav.providers,   key: "providers" },
    { href:"#pricing",     label: nav.pricing,     key: "pricing" },
  ];
  const st = status === undefined ? { label: "RUH · 38ms" } : status;
  return (
    <header className="nav">
      <div className="nav-in">
        <Brand/>
        {computedLinks.length > 0 && (
          <nav className="nav-links">
            {computedLinks.map((l,i) =>
              <a key={i} href={l.href} className={active && l.key === active ? "on" : ""}>{l.label}</a>
            )}
          </nav>
        )}
        <div className="nav-right">
          {right || (<>
            {st && <span className="nav-status"><span className="d"/><span>{st.label}</span></span>}
            <LangToggle lang={lang} setLang={setLang}/>
            <a className="btn ghost small" href="#">{nav.signin || "Console login"}</a>
            <MagneticButton>
              <a className="btn primary small" href={ctaHref || "#"}>
                {ctaLabel || nav.start || "Start"} <Arrow size={12}/>
              </a>
            </MagneticButton>
          </>)}
        </div>
      </div>
    </header>
  );
}

/**
 * Footer — shared bottom chrome.
 * Props: cols = [[heading, [link, …]], …]
 */
function Footer({ cols }) {
  const { t } = useLang();
  const f = t.footer || {};
  const def = cols || [
    [f.product || "Platform",  ["Start Renting","Start Earning","Marketplace","Console Login"]],
    [f.dev     || "Resources", ["Docs","Build via API","Provider install help","Billing support"]],
    [f.company || "Support",   ["Support","Job failure support","Enterprise support","System status"]],
    [f.legal   || "Legal",     ["Terms of Service","Privacy Policy","Acceptable Use","System Status"]],
  ];
  return (
    <footer className="site foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Brand/>
            <p style={{marginTop:16, maxWidth:"36ch", color:"color-mix(in oklab, var(--bg) 75%, transparent)", fontSize:14, lineHeight:1.55}}>
              {f.tag || ""}
            </p>
            <div style={{marginTop:20, fontFamily:"var(--mono)", fontSize:11, letterSpacing:".1em", color:"var(--teal)"}}>
              ● {f.status || "All systems operational"}
            </div>
          </div>
          {def.map(([h, ls]) => (
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

function SectionMeta({ idx, label, right }) {
  return (
    <div className="section-meta">
      <span><span className="idx">{idx}</span> · {label}</span>
      {right ? <span>{right}</span> : null}
    </div>
  );
}

function Eyebrow({ children }) { return <span className="eyebrow">{children}</span>; }

function Breadcrumb({ items }) {
  return (
    <nav className="crumbs">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="sep">/</span>}
          {it.href
            ? <a href={it.href}>{it.label}</a>
            : <span style={{color:"var(--ink)"}}>{it.label}</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ═══ WIDGETS ═════════════════════════════════════════════════ */

function Badge({ tone = "default", pulse = false, children }) {
  const cls = "badge" + (tone !== "default" ? " " + tone : "");
  return (
    <span className={cls}>
      <span className={"d" + (pulse ? " pulse" : "")}/>
      {children}
    </span>
  );
}

function Callout({ tone = "info", label, children }) {
  const cls = "callout" + (tone === "warn" ? " warn" : tone === "err" ? " err" : "");
  return (
    <div className={cls}>
      {label && <b>{label}</b>}
      {children}
    </div>
  );
}

function Stat({ k, v, unit, delta, deltaDir = "up", spark }) {
  return (
    <div className="stat-card">
      <div className="k">{k}</div>
      <div className="v">{v}{unit && <span className="u">{unit}</span>}</div>
      {delta && <div className={"delta" + (deltaDir === "down" ? " down" : "")}>{deltaDir === "down" ? "↓ " : "↑ "}{delta}</div>}
      {spark && <Sparkline values={spark} height={36}/>}
    </div>
  );
}

function StatRow({ children }) { return <div className="stat-row">{children}</div>; }

function Field({ label, hint, error, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint  && <div className="field-hint">{hint}</div>}
      {error && <div className="field-err">{error}</div>}
    </label>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

function Skeleton({ variant = "line", style }) {
  return <div className={"skeleton " + variant} style={style}/>;
}

function Modal({ open, onClose, title, footer, children }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape" && onClose) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="backdrop" onClick={e => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        {title && (
          <div className="modal-hd">
            <h3>{title}</h3>
            <span className="close" onClick={onClose}>ESC</span>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

function Toast({ tone = "info", children }) {
  return (
    <div className="toast">
      <Badge tone={tone} pulse>{tone.toUpperCase()}</Badge>
      <span>{children}</span>
    </div>
  );
}

/**
 * TweaksPanel — design-system tweak surface. Currently exposes palette.
 * Screens can extend by rendering their own inside the same .tweaks shell.
 */
function TweaksPanel({ extra }) {
  const { open, state, setKey } = useTweaks();
  if (!open) return null;
  const palettes = ["midnight","paper","mono"];
  return (
    <div className="tweaks on">
      <h4>Tweaks</h4>
      <label>Palette</label>
      <div className="opts">
        {palettes.map(p => (
          <button key={p} className={"opt "+(state.palette===p?"on":"")} onClick={()=>setKey("palette", p)}>{p}</button>
        ))}
      </div>
      {extra}
    </div>
  );
}

/* ═══ EXPORTS ═════════════════════════════════════════════════ */

Object.assign(window, {
  // React re-exports (so screens don't need to re-destructure)
  useState, useEffect, useMemo, useRef, useLayoutEffect, createContext, useContext,
  // context
  LangCtx, useLang,
  // format
  fmt, fmtInt, fmtMoney,
  // hooks
  useJitter, useFeed, useReveal, useCountUp, useTweaks,
  // motion
  Reveal, MagneticButton, HeroMap, Sparkline, reducedMotion,
  // icons
  Arrow, Check, Play, Stop, Close, Search, Menu, Plus, Minus, ChevronDown,
  Copy, External, Download, Upload, Shield, Lock, Key, Zap, Cpu, Cloud, Dot,
  // chrome
  Marquee, Brand, LangToggle, Nav, Footer, SectionMeta, Eyebrow, Breadcrumb,
  // widgets
  Badge, Callout, Stat, StatRow, Field, EmptyState, Skeleton, Modal, Toast, TweaksPanel,
});
