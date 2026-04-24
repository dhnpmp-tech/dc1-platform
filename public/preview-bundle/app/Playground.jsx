/* eslint-disable */
/* Playground — model chat with streaming, params, code view */

const { useState, useEffect, useRef, useMemo } = React;
const OPS = window.DCP_OPS;
const D = window.DCP_APP;
const { Copy, External, Plus, Arrow, Check } = window;

/* ── Model picker dropdown ──────────────────────────── */
function ModelPick({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const m = OPS.models.find(x => x.id === value) || OPS.models[0];
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);
  return (
    <div ref={ref} style={{position:"relative"}}>
      <div className="model-pick" onClick={e => { e.stopPropagation(); setOpen(o=>!o); }}>
        <span className="dot" />
        <span className="txt">{m.display}</span>
        <span className="ch">▾</span>
      </div>
      {open && (
        <div style={{position:"absolute", top:"calc(100% + 4px)", insetInlineStart:0, background:"var(--paper)", border:"1px solid var(--hair)", minWidth:320, zIndex:100, boxShadow:"0 8px 24px rgba(0,0,0,.08)"}}>
          {OPS.models.map(x => (
            <div key={x.id} onClick={() => { onChange(x.id); setOpen(false); }}
              style={{padding:"12px 16px", borderTop:"1px solid var(--hair)", cursor:"pointer", display:"grid", gap:4}}
              onMouseEnter={e => e.currentTarget.style.background="var(--bg-2)"}
              onMouseLeave={e => e.currentTarget.style.background=""}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12}}>
                <span style={{fontSize:13, color:"var(--ink)"}}>{x.display}</span>
                {x.status === "preview" && <span style={{fontFamily:"var(--mono)", fontSize:9, letterSpacing:".1em", color:"var(--orange)", textTransform:"uppercase"}}>Preview</span>}
              </div>
              <div style={{fontFamily:"var(--mono)", fontSize:10, letterSpacing:".06em", color:"var(--mut)", textTransform:"uppercase"}}>
                {x.kind} · ctx {Math.round(x.ctx/1024)}K · {x.price_in_sar.toFixed(2)}/{x.price_out_sar.toFixed(2)} SAR/M
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Param slider ───────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange, hint, fmt }) {
  return (
    <div className="param">
      <div className="lb">
        <span>{label}</span>
        <span className="v">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/* ── Toggle ─────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return <div className={"tog " + (on ? "on" : "")} onClick={() => onChange(!on)}><div className="kn" /></div>;
}

/* ── Conversation message ──────────────────────────── */
function Msg({ role, content, streaming, rtl }) {
  const roleMap = { system: "S", user: "U", asst: "AI" };
  const roleLabel = { system: "System prompt", user: "You", asst: "Assistant · ALLaM-7B" };
  return (
    <div className={"msg " + role} dir={rtl ? "rtl" : "ltr"}>
      <div className="av">{roleMap[role]}</div>
      <div>
        <div className="role">
          <span>{roleLabel[role]}</span>
          {role === "asst" && !streaming && <span className="rb">· 482 tok · 1.28s · 377 tok/s</span>}
          {role === "asst" && streaming && <span className="rb" style={{color:"var(--orange)"}}>· streaming…</span>}
        </div>
        <div className="body">
          {content}
          {streaming && <span className="cursor" />}
        </div>
      </div>
    </div>
  );
}

/* ── Code view modal ───────────────────────────────── */
function CodeView({ messages, params, modelId, onClose }) {
  const [tab, setTab] = useState("curl");
  const body = {
    model: modelId,
    messages: messages.filter(m => m.role !== "asst-stream").map(m => ({
      role: m.role === "asst" ? "assistant" : m.role,
      content: m.content,
    })),
    temperature: params.temp,
    max_tokens: params.max_tokens,
    top_p: params.top_p,
    stream: params.stream,
  };

  const curl = `curl https://api.dcp.sa/v1/chat/completions \\
  -H "Authorization: Bearer $DCP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}'`;

  const py = `from dcp import DCP

client = DCP(api_key="$DCP_API_KEY")

response = client.chat.completions.create(
    model="${modelId}",
    messages=${JSON.stringify(body.messages, null, 4).replace(/\n/g, "\n    ")},
    temperature=${params.temp},
    max_tokens=${params.max_tokens},
    top_p=${params.top_p},
    stream=${params.stream ? "True" : "False"},
)`;

  const js = `import { DCP } from "@dcp/sdk";

const client = new DCP({ apiKey: process.env.DCP_API_KEY });

const response = await client.chat.completions.create({
  model: "${modelId}",
  messages: ${JSON.stringify(body.messages, null, 2).replace(/\n/g, "\n  ")},
  temperature: ${params.temp},
  max_tokens: ${params.max_tokens},
  top_p: ${params.top_p},
  stream: ${params.stream},
});`;

  const code = { curl, py, js }[tab];
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="code-view" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="hd">
          <h3>Export code</h3>
          <span style={{fontFamily:"var(--mono)", fontSize:10, letterSpacing:".1em", color:"var(--mut)", textTransform:"uppercase"}}>Copy & paste into your app</span>
          <span className="x" onClick={onClose}>✕ CLOSE</span>
        </div>
        <div className="tabs">
          {["curl", "py", "js"].map(t => (
            <div key={t} className={"tab " + (tab === t ? "on" : "")} onClick={() => setTab(t)}>
              {t === "py" ? "Python" : t === "js" ? "TypeScript" : "cURL"}
            </div>
          ))}
          <div style={{marginInlineStart:"auto", padding:"10px 14px", fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".08em", color: copied ? "var(--ok)" : "var(--mut)", cursor:"pointer", textTransform:"uppercase"}} onClick={copyCode}>
            {copied ? "✓ COPIED" : "⎘ COPY"}
          </div>
        </div>
        <pre>{code}</pre>
      </div>
    </div>
  );
}

/* ── Main Playground ──────────────────────────────── */
function Playground() {
  const [preset, setPreset] = useState(OPS.presets[0].id);
  const [modelId, setModelId] = useState(OPS.presets[0].model);
  const [system, setSystem] = useState(OPS.presets[0].system);
  const [input, setInput] = useState(OPS.presets[0].user);
  const [messages, setMessages] = useState([]);  // [{role, content}]
  const [streaming, setStreaming] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [runStats, setRunStats] = useState(null);  // {inTok, outTok, firstMs, totalMs, costSar}
  const convRef = useRef(null);

  const [params, setParams] = useState({
    temp: 0.3, max_tokens: 400, top_p: 0.95, freq_pen: 0, pres_pen: 0,
    stream: true, json_mode: false, safety: true,
  });

  const [stops, setStops] = useState(["<|end|>"]);

  const model = OPS.models.find(m => m.id === modelId) || OPS.models[0];
  const rtlInput = /[\u0600-\u06ff]/.test(input);

  /* load preset */
  function loadPreset(id) {
    const p = OPS.presets.find(x => x.id === id);
    if (!p) return;
    setPreset(id);
    setModelId(p.model);
    setSystem(p.system);
    setInput(p.user);
    setMessages([]);
    setRunStats(null);
    setParams(x => ({...x, temp: p.temp, max_tokens: p.max_tokens}));
  }

  /* scroll to bottom on new content */
  useEffect(() => {
    if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight;
  }, [messages]);

  /* stream a completion */
  const abortRef = useRef(false);
  async function run() {
    if (streaming) { abortRef.current = true; setStreaming(false); return; }
    abortRef.current = false;

    // push system + user
    const base = [];
    if (system) base.push({ role:"system", content: system });
    base.push({ role:"user", content: input });
    base.push({ role:"asst", content: "" });
    setMessages(base);
    setInput("");
    setStreaming(true);
    setRunStats(null);

    const startT = performance.now();
    let firstMs = null;
    let tokens = 0;
    for (const chunk of OPS.demo_completion) {
      if (abortRef.current) break;
      await new Promise(r => setTimeout(r, chunk.d));
      if (firstMs === null) firstMs = performance.now() - startT;
      tokens++;
      setMessages(m => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, content: last.content + chunk.t };
        return copy;
      });
    }
    const totalMs = performance.now() - startT;
    const inTok = Math.round((system.length + input.length) / 4);
    const outTok = Math.round(messages[messages.length-1]?.content?.length / 4) || tokens * 2;
    const costSar = (inTok * model.price_in_sar + outTok * model.price_out_sar) / 1_000_000;
    setRunStats({ inTok, outTok: tokens * 2, firstMs, totalMs, costSar });
    setStreaming(false);
  }

  function clearConv() {
    setMessages([]);
    setRunStats(null);
  }

  function removeStop(s) { setStops(x => x.filter(y => y !== s)); }

  const sarFmt = (n) => n < 1 ? "< 0.01 SAR" : n.toFixed(3) + " SAR";
  const msgRtl = (m) => /[\u0600-\u06ff]/.test(m.content);

  return (
    <AppFrame current="playground" crumb="PLAYGROUND" topbarRight={
      <button className="tb-act" title="Share" style={{width:"auto", padding:"0 12px", fontSize:10, letterSpacing:".1em"}}>↗ SHARE</button>
    }>
      <main className="main">
        <div className="pg">

          {/* ── Left: Presets ────────────────────────── */}
          <aside className="pg-presets">
            <div className="hd">
              <div className="eb">§ PRESETS</div>
              <h2>Start with a <em style={{color:"var(--orange)"}}>recipe</em></h2>
              <p>Pre-built prompts tuned for DCP models. Loading swaps model + params too.</p>
            </div>
            <div className="preset-list">
              {OPS.presets.map(p => (
                <div key={p.id} className={"preset-item " + (p.id === preset ? "on" : "")}
                     onClick={() => loadPreset(p.id)}>
                  <div className="nm">{p.name}</div>
                  <div className="mt">
                    <span className="mm">{OPS.models.find(m => m.id === p.model).family}</span>
                    <span>temp {p.temp}</span>
                    <span>{p.max_tokens} tok</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="ft">
              <button className="btn-ghost">＋ NEW PROMPT</button>
            </div>
          </aside>

          {/* ── Center: Conversation ─────────────────── */}
          <div className="pg-conv">
            <div className="pg-toolbar">
              <ModelPick value={modelId} onChange={setModelId} />
              <span className="region-chip">◎ RIYADH · {model.p50_ms}ms p50</span>
              <div className="spacer" />
              <button className="icon" onClick={clearConv} title="Clear conversation">⟲</button>
              <button className="icon" onClick={() => setShowCode(true)} title="View code">&lt;/&gt;</button>
            </div>

            <div className="conv" ref={convRef}>
              {messages.length === 0 ? (
                <div style={{padding:"80px 0", textAlign:"center"}}>
                  <div style={{fontFamily:"var(--serif)", fontSize:42, color:"var(--ink)", lineHeight:1.1, letterSpacing:"-.01em"}}>
                    Prompt. Stream. <em style={{color:"var(--orange)", fontStyle:"italic"}}>Ship.</em>
                  </div>
                  <p style={{color:"var(--ink-2)", fontSize:14.5, maxWidth:440, margin:"14px auto 0", lineHeight:1.55}}>
                    Pick a recipe on the left, tune parameters on the right, then hit <span style={{fontFamily:"var(--mono)", fontSize:11, background:"var(--paper)", border:"1px solid var(--hair)", padding:"1px 6px"}}>⌘ ↵</span>.
                    Latency is measured live against the Riyadh edge.
                  </p>
                  {system && (
                    <div style={{marginTop:40, textAlign:"start"}}>
                      <Msg role="system" content={system} rtl={/[\u0600-\u06ff]/.test(system)} />
                    </div>
                  )}
                </div>
              ) : (
                messages.map((m, i) => (
                  <Msg key={i} role={m.role} content={m.content}
                       streaming={i === messages.length-1 && m.role === "asst" && streaming}
                       rtl={msgRtl(m)} />
                ))
              )}
            </div>

            <div className="composer">
              <div className="input-wrap">
                <textarea dir={rtlInput ? "rtl" : "ltr"}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } }}
                  placeholder="Type a message — Arabic, English, or mixed. ⌘↵ to send." />
                <button className={"send " + (streaming ? "stop" : "")} onClick={run}>
                  {streaming ? "■ STOP" : "▶ RUN"}
                </button>
              </div>
              <div className="foot">
                <span>{input.length} chars · ~{Math.round(input.length/4)} tok</span>
                <span className="k">⌘ ↵ TO SEND · ESC TO CLEAR</span>
              </div>
            </div>
          </div>

          {/* ── Right: Parameters ────────────────────── */}
          <aside className="pg-params">
            <div className="sec">
              <div className="ttl">§ SYSTEM PROMPT</div>
              <textarea value={system} onChange={e => setSystem(e.target.value)}
                dir={/[\u0600-\u06ff]/.test(system) ? "rtl" : "ltr"}
                style={{width:"100%", minHeight:88, padding:"10px 12px", border:"1px solid var(--hair)", background:"var(--bg)", fontFamily:"var(--sans)", fontSize:12.5, color:"var(--ink)", lineHeight:1.5, outline:"none", resize:"vertical", boxSizing:"border-box"}} />
            </div>

            <div className="sec">
              <div className="ttl">§ SAMPLING</div>
              <Slider label="Temperature" value={params.temp} min={0} max={2} step={0.05}
                onChange={v => setParams(p => ({...p, temp: v}))}
                fmt={v => v.toFixed(2)}
                hint="0 = deterministic. Raise above 1 for creative/divergent output." />
              <Slider label="Top-p" value={params.top_p} min={0} max={1} step={0.01}
                onChange={v => setParams(p => ({...p, top_p: v}))}
                fmt={v => v.toFixed(2)}
                hint="Nucleus sampling cut-off. 1.0 = disabled." />
              <Slider label="Max output tokens" value={params.max_tokens} min={16} max={Math.min(8192, model.ctx)} step={16}
                onChange={v => setParams(p => ({...p, max_tokens: v}))}
                hint={"Caps response. Model context window: " + Math.round(model.ctx/1024) + "K tokens."} />
              <Slider label="Frequency penalty" value={params.freq_pen} min={-2} max={2} step={0.1}
                onChange={v => setParams(p => ({...p, freq_pen: v}))}
                fmt={v => v.toFixed(1)} />
              <Slider label="Presence penalty" value={params.pres_pen} min={-2} max={2} step={0.1}
                onChange={v => setParams(p => ({...p, pres_pen: v}))}
                fmt={v => v.toFixed(1)} />
            </div>

            <div className="sec">
              <div className="ttl">§ OUTPUT</div>
              <div className="param-row">
                <span>Stream tokens</span>
                <Toggle on={params.stream} onChange={v => setParams(p => ({...p, stream: v}))} />
              </div>
              <div className="param-row">
                <span>JSON mode</span>
                <Toggle on={params.json_mode} onChange={v => setParams(p => ({...p, json_mode: v}))} />
              </div>
              <div className="param-row">
                <span>Safety filter</span>
                <Toggle on={params.safety} onChange={v => setParams(p => ({...p, safety: v}))} />
              </div>

              <div style={{marginTop: 14}}>
                <div className="lb" style={{fontSize:12.5, color:"var(--ink)", marginBottom:8}}>Stop sequences</div>
                <div className="stops">
                  {stops.map(s => <span key={s} className="chip">{s}<span className="x" onClick={() => removeStop(s)}>✕</span></span>)}
                  <span className="chip" style={{color:"var(--mut)", cursor:"pointer"}}>＋ add</span>
                </div>
              </div>
            </div>

            {runStats && (
              <div className="sec">
                <div className="ttl">§ LAST RUN</div>
                <div className="run-stats">
                  <div className="st"><div className="k">Input</div><div className="v">{runStats.inTok}<span className="u">tok</span></div></div>
                  <div className="st"><div className="k">Output</div><div className="v">{runStats.outTok}<span className="u">tok</span></div></div>
                  <div className="st"><div className="k">TTFT</div><div className="v">{(runStats.firstMs/1000).toFixed(2)}<span className="u">s</span></div></div>
                  <div className="st"><div className="k">Total</div><div className="v">{(runStats.totalMs/1000).toFixed(2)}<span className="u">s</span></div></div>
                  <div className="st" style={{gridColumn:"1 / -1"}}><div className="k">Cost</div><div className="v" style={{color:"var(--orange)"}}>{sarFmt(runStats.costSar)}</div></div>
                </div>
              </div>
            )}

            <div className="sec">
              <div className="ttl">§ PRICING · {model.family.toUpperCase()}</div>
              <div style={{fontFamily:"var(--mono)", fontSize:11.5, color:"var(--ink-2)", lineHeight:1.8, letterSpacing:".02em"}}>
                <div><span style={{color:"var(--mut)"}}>IN &nbsp;·</span> {model.price_in_sar.toFixed(2)} SAR / 1M tok</div>
                <div><span style={{color:"var(--mut)"}}>OUT ·</span> {model.price_out_sar.toFixed(2)} SAR / 1M tok</div>
                <div style={{marginTop:6}}><span style={{color:"var(--mut)"}}>REG ·</span> {model.region}</div>
              </div>
            </div>
          </aside>
        </div>

        {showCode && (
          <CodeView modelId={modelId} messages={messages.length ? messages : [{role:"system", content: system}, {role:"user", content: input}]} params={params} onClose={() => setShowCode(false)} />
        )}
      </main>
      <ReturnStrip />
    </AppFrame>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Playground />);
