// Core: hooks, language context, number formatting, icons

const { useState, useEffect, useMemo, useRef, createContext, useContext } = React;

const LangCtx = createContext({ lang: "en", t: window.DCP_I18N.en });

function useLang() {
  const ctx = useContext(LangCtx);
  return { lang: ctx.lang || "en", t: ctx.t || window.DCP_I18N.en };
}

// Number formatting — Arabic-Indic when lang=ar
function fmt(n, lang, opts = {}) {
  const loc = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(loc, opts).format(n);
}
function fmtInt(n, lang) { return fmt(Math.round(n), lang); }
function fmtMoney(n, lang, currency) {
  const loc = lang === "ar" ? "ar-SA" : "en-US";
  return new Intl.NumberFormat(loc, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

// Tiny inline icons (no SVG scene-drawing, just symbols)
const Arrow = ({size=14, dir="right"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    style={{transform: dir==="left"?"scaleX(-1)":""}}>
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>
);
const Check = ({size=14}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 13l4 4L19 7"/>
  </svg>
);
const Play = ({size=12}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>
);
const Stop = ({size=12}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
);

// Persistent + animated value (jitters around base)
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

// Activity feed generator
function useFeed() {
  const D = window.DCP_DATA;
  const [items, setItems] = useState(() => initialFeed());
  function initialFeed() {
    const out = [];
    for (let i = 0; i < 6; i++) out.push(makeEvent(i));
    return out;
  }
  function makeEvent(i=0) {
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
      setItems(prev => [makeEvent(), ...prev.slice(0, 7)].map((it,i) => ({...it, t: `${(i*3)+2}s`})));
    }, 2600);
    return () => clearInterval(id);
  }, []);
  return items;
}

// Tweaks — minimal panel, host-aware
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
    document.documentElement.setAttribute("data-palette", k === "palette" ? v : state.palette || "paper");
    if (k === "accent") document.documentElement.setAttribute("data-accent", v);
  }
  useEffect(() => {
    document.documentElement.setAttribute("data-palette", state.palette || "paper");
    if (state.accent) document.documentElement.setAttribute("data-accent", state.accent);
  }, []);
  return { open, state, setKey };
}

Object.assign(window, { useState, useEffect, useMemo, useRef, LangCtx, useLang,
  fmt, fmtInt, fmtMoney, Arrow, Check, Play, Stop, useJitter, useFeed, useTweaks });
