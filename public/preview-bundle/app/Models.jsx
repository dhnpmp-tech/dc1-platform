/* eslint-disable */
/* Models — catalog index + detail view (hash-routed #id) */

const { useState, useEffect, useMemo } = React;
const OPS = window.DCP_OPS;
const { Copy, External, Arrow } = window;

function useHashRoute() {
  const [hash, setHash] = useState(location.hash.slice(1));
  useEffect(() => {
    const h = () => setHash(location.hash.slice(1));
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return [hash, (h) => { location.hash = h; }];
}

/* ── Index view ─────────────────────────────────────── */
function ModelsIndex() {
  const [filter, setFilter] = useState("all");
  const list = useMemo(() => {
    if (filter === "all") return OPS.models;
    if (filter === "chat") return OPS.models.filter(m => m.kind === "Chat");
    if (filter === "emb") return OPS.models.filter(m => m.kind === "Embeddings");
    if (filter === "arabic") return OPS.models.filter(m => m.tags.some(t => t.includes("arabic")));
    if (filter === "preview") return OPS.models.filter(m => m.status === "preview");
    return OPS.models;
  }, [filter]);

  return (
    <main className="main">
      <header className="page-head-2">
        <div className="eb">§ MODELS · CATALOG</div>
        <h1>Sovereign models, <em>tuned</em> for the region.</h1>
        <p>Every model is hosted inside Saudi Arabia. Data never leaves the kingdom. Pricing is in riyals, billing in riyals, latency measured live against the Riyadh edge.</p>
      </header>

      <div className="m-filter">
        <span className="lb">§ FILTER</span>
        {[
          {k:"all", l:"All models"},
          {k:"chat", l:"Chat"},
          {k:"emb", l:"Embeddings"},
          {k:"arabic", l:"Arabic-tuned"},
          {k:"preview", l:"Preview"},
        ].map(f => (
          <span key={f.k} className={"chip " + (filter === f.k ? "on" : "")} onClick={() => setFilter(f.k)}>{f.l}</span>
        ))}
        <span className="spacer" />
        <span className="count">{list.length} of {OPS.models.length} models</span>
      </div>

      <div className="m-grid">
        {list.map(m => (
          <a key={m.id} className="m-card" href={"#" + m.id}>
            <div className="top">
              <div style={{minWidth:0}}>
                <h3>{m.family}{m.id === "allam-7b" ? <em> · 7B</em> : ""}</h3>
                <div className="vendor">{m.vendor} · {m.display.replace(m.family + " · ", "").replace(m.family, "")}</div>
              </div>
              <span className={"status-pill " + m.status}>{m.status === "ga" ? "● GA" : "◐ Preview"}</span>
            </div>
            <p className="blurb">{m.blurb}</p>
            <div className="tags">
              {m.tags.slice(0,3).map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <div className="specs">
              <div className="s"><div className="k">Kind</div><div className="v">{m.kind === "Embeddings" ? "Embed" : "Chat"}</div></div>
              <div className="s"><div className="k">Ctx</div><div className="v">{Math.round(m.ctx/1024)}<span className="u">K</span></div></div>
              <div className="s"><div className="k">p50</div><div className="v">{m.p50_ms}<span className="u">ms</span></div></div>
              <div className="s"><div className="k">In · SAR/M</div><div className="v" style={{color:"var(--orange)"}}>{m.price_in_sar.toFixed(2)}</div></div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}

/* ── Detail view ────────────────────────────────────── */
function ModelDetail({ id, back }) {
  const m = OPS.models.find(x => x.id === id);
  if (!m) {
    return (
      <main className="main">
        <a className="md-back" href="#" onClick={e => {e.preventDefault(); back();}}>← BACK TO CATALOG</a>
        <div style={{padding:40, border:"1px solid var(--hair)", textAlign:"center", color:"var(--mut)"}}>Model not found.</div>
      </main>
    );
  }

  const maxBench = Math.max(...m.benchmarks.flatMap(b => [b.our, b.ref]));
  const [tokensIn, setTokensIn] = useState(500_000);
  const [tokensOut, setTokensOut] = useState(200_000);
  const costIn = (tokensIn * m.price_in_sar) / 1_000_000;
  const costOut = (tokensOut * m.price_out_sar) / 1_000_000;
  const totalCost = costIn + costOut;

  const snippet = `curl https://api.dcp.sa/v1/chat/completions \\
  -H "Authorization: Bearer $DCP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${m.id}",
    "messages": [{"role":"user","content":"مرحبا"}],
    "temperature": 0.3
  }'`;

  return (
    <main className="main">
      <a className="md-back" href="#" onClick={e => {e.preventDefault(); back();}}>← ALL MODELS</a>

      <div className="md-head">
        <div>
          <div className="mo">§ {m.vendor.toUpperCase()} · {m.status === "ga" ? "GENERALLY AVAILABLE" : "PREVIEW"}</div>
          <h1>{m.family}
            <span className="lo">{m.display.replace(m.family + " · ", "")}</span>
          </h1>
          <p>{m.blurb}</p>
          <div className="chips">
            {m.tags.map(t => <span key={t} className="chip">{t}</span>)}
          </div>
        </div>
        <div className="act">
          <a className="btn-primary" href="./Playground.html">▶ TRY IN PLAYGROUND</a>
          <a className="btn-secondary" href="../docs/DCP Docs.html">READ DOCS ↗</a>
          <div style={{fontFamily:"var(--mono)", fontSize:10, letterSpacing:".1em", color:"var(--mut)", textTransform:"uppercase", textAlign:"end"}}>
            Released · {m.release}
          </div>
        </div>
      </div>

      {/* Key stats row */}
      <div className="md-stats">
        <div className="s">
          <div className="k">Context</div>
          <div className="v"><em>{Math.round(m.ctx/1024)}K</em></div>
          <div className="sub">{m.ctx.toLocaleString()} tokens</div>
        </div>
        <div className="s">
          <div className="k">Throughput</div>
          <div className="v">{m.throughput_tps}</div>
          <div className="sub">TOK/SEC · P50</div>
        </div>
        <div className="s">
          <div className="k">Latency</div>
          <div className="v">{m.p50_ms}<span style={{fontSize:18, color:"var(--mut)"}}>/{m.p95_ms}</span></div>
          <div className="sub">P50 / P95 · MS · FIRST TOKEN</div>
        </div>
        <div className="s">
          <div className="k">Price · In</div>
          <div className="v"><em>{m.price_in_sar.toFixed(2)}</em></div>
          <div className="sub">SAR / 1M TOKENS</div>
        </div>
        <div className="s">
          <div className="k">Price · Out</div>
          <div className="v"><em>{m.price_out_sar.toFixed(2)}</em></div>
          <div className="sub">SAR / 1M TOKENS</div>
        </div>
      </div>

      {/* Benchmarks + Pricing */}
      <div className="md-row">
        <div className="panel">
          <div className="panel-hd">
            <div>
              <h3>Benchmarks</h3>
              <span className="sub">VS. {m.benchmarks[0].ref_name.toUpperCase()}</span>
            </div>
            <span className="more" style={{cursor:"default"}}>METHODOLOGY ↗</span>
          </div>
          <div className="bench-list">
            {m.benchmarks.map(b => {
              const delta = b.our - b.ref;
              const ourPct = (b.our / maxBench) * 100;
              const refPct = (b.ref / maxBench) * 100;
              return (
                <div key={b.k} className="bench-row">
                  <div className="n">{b.k}</div>
                  <div className="bars">
                    <div className="bar ours">
                      <div className="t"><div className="fill" style={{width: ourPct + "%"}} /><span className="lbl">DCP</span></div>
                      <span className="v">{b.our.toFixed(1)}</span>
                    </div>
                    <div className="bar ref">
                      <div className="t"><div className="fill" style={{width: refPct + "%"}} /><span className="lbl">{b.ref_name}</span></div>
                      <span className="v">{b.ref.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className={"delta " + (delta >= 0 ? "pos" : "neg")}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}</div>
                </div>
              );
            })}
          </div>
          <div className="bench-legend">
            <span className="sw"><span className="c" style={{background:"var(--orange)"}} /> DCP · {m.family}</span>
            <span className="sw"><span className="c" style={{background:"var(--ink)", opacity:.55}} /> Reference</span>
            <span style={{marginInlineStart:"auto"}}>EVALUATED · APR 2026</span>
          </div>
        </div>

        <div className="panel md-price">
          <div className="panel-hd">
            <div><h3>Pricing</h3><span className="sub">PER 1M TOKENS · SAR</span></div>
          </div>
          <div className="row"><span className="k">Input</span><span className="v"><em>{m.price_in_sar.toFixed(2)}</em><span className="u">/M</span></span></div>
          <div className="row"><span className="k">Output</span><span className="v"><em>{m.price_out_sar.toFixed(2)}</em><span className="u">/M</span></span></div>
          <div className="row"><span className="k">Region</span><span className="v" style={{fontFamily:"var(--mono)", fontSize:13}}>{m.region}</span></div>

          <div className="calc">
            <div style={{marginBottom:10, color:"var(--ink)", fontSize:12, letterSpacing:".1em", textTransform:"uppercase"}}>§ ESTIMATE</div>
            <div className="line"><span>Input tokens</span>
              <input type="range" min={10000} max={5_000_000} step={10000} value={tokensIn} onChange={e => setTokensIn(+e.target.value)}
                style={{width:120, accentColor:"var(--orange)"}} />
            </div>
            <div className="line"><span style={{color:"var(--mut)"}}>{(tokensIn/1000).toFixed(0)}K tokens</span><span>{costIn.toFixed(2)} SAR</span></div>

            <div className="line" style={{marginTop:10}}><span>Output tokens</span>
              <input type="range" min={10000} max={2_000_000} step={10000} value={tokensOut} onChange={e => setTokensOut(+e.target.value)}
                style={{width:120, accentColor:"var(--orange)"}} />
            </div>
            <div className="line"><span style={{color:"var(--mut)"}}>{(tokensOut/1000).toFixed(0)}K tokens</span><span>{costOut.toFixed(2)} SAR</span></div>

            <div className="line total"><span>Total</span><span><em>{totalCost.toFixed(2)}</em> SAR</span></div>
          </div>
        </div>
      </div>

      {/* Code snippet + details */}
      <div className="md-row" style={{gridTemplateColumns:"1fr 1fr"}}>
        <div className="panel">
          <div className="panel-hd">
            <div><h3>Quickstart</h3><span className="sub">CURL · COPY & RUN</span></div>
            <span className="more" style={{cursor:"pointer"}} onClick={() => navigator.clipboard?.writeText(snippet)}>⎘ COPY</span>
          </div>
          <pre className="md-code"><code>
            <span className="k">curl</span> https://api.dcp.sa/v1/chat/completions \<br/>
            {"  "}-H <span className="s">"Authorization: Bearer $DCP_API_KEY"</span> \<br/>
            {"  "}-H <span className="s">"Content-Type: application/json"</span> \<br/>
            {"  "}-d <span className="s">{"'{"}</span><br/>
            {"    "}<span className="s">"model": "{m.id}"</span>,<br/>
            {"    "}<span className="s">"messages"</span>: [{"{"}<span className="s">"role":"user"</span>, <span className="s">"content":"مرحبا"</span>{"}"}],<br/>
            {"    "}<span className="s">"temperature"</span>: 0.3<br/>
            {"  "}<span className="s">{"}'"}</span>
          </code></pre>
        </div>

        <div className="panel">
          <div className="panel-hd">
            <div><h3>Specifications</h3><span className="sub">TECHNICAL DETAILS</span></div>
          </div>
          <div className="md-details">
            <div className="row"><span className="k">Model ID</span><span className="v mono">{m.id}</span></div>
            <div className="row"><span className="k">Parameters</span><span className="v">{m.params_b < 1 ? (m.params_b * 1000).toFixed(0) + "M" : m.params_b + "B"}</span></div>
            <div className="row"><span className="k">Modality</span><span className="v">{m.modality}</span></div>
            <div className="row"><span className="k">Languages</span>
              <div className="lang-list">{m.languages.map(l => <span key={l} className="l">{l}</span>)}</div>
            </div>
            <div className="row"><span className="k">Region</span><span className="v">{m.region}</span></div>
            <div className="row"><span className="k">Residency</span><span className="v">Data processed and stored within the Kingdom of Saudi Arabia. Never leaves DCP-operated infrastructure.</span></div>
            <div className="row"><span className="k">Fine-tuning</span><span className="v">{m.id === "allam-7b" || m.id === "llama-3.1-70b" ? "Supported · LoRA adapters, PEFT" : "Not available"}</span></div>
          </div>
        </div>
      </div>

    </main>
  );
}

/* ── Shell + router ────────────────────────────────── */
function Models() {
  const [hash, setHash] = useHashRoute();

  const detail = OPS.models.find(m => m.id === hash);
  const crumb = detail ? "MODELS / " + detail.family.toUpperCase() : "MODELS";

  return (
    <AppFrame current="models" crumb={crumb}>
      {detail
        ? <ModelDetail id={hash} back={() => setHash("")} />
        : <ModelsIndex />}
      <ReturnStrip />
    </AppFrame>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Models />);
