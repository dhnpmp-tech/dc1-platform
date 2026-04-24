/* eslint-disable */
/* Usage — analytics drilldown: stacked timeseries, model/key splits, hour-of-day heatmap, budget pacing */

const { useState, useMemo, useRef, useEffect } = React;
const APP = window.DCP_APP;
const OPS = window.DCP_OPS;

/* ─── formatting helpers ───────────────────────────────────── */
const fmtInt = n => n.toLocaleString("en-US");
const fmtK   = n => n >= 1_000_000 ? (n/1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + "M"
                   : n >= 1000     ? (n/1000).toFixed(n >= 10_000 ? 0 : 1) + "k"
                   : String(n);
const fmtSAR = n => "SAR " + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtSAR2 = n => "SAR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── model-colour palette — brand-aligned ─────────────────── */
const MODEL_META = {
  allam:  { label: "ALLaM · 7B",       color: "var(--orange)",        faint: "#e8a472" },
  llama:  { label: "Llama · 3.1 · 70B", color: "var(--teal)",          faint: "#6fc3b3" },
  bge:    { label: "BGE · M3 embed",    color: "#6b6da0",              faint: "#4a4c78" },
  falcon: { label: "Falcon · H1 · 34B", color: "#c9a57a",              faint: "#8a7052" },
};

/* ─── metric options ───────────────────────────────────────── */
const METRICS = [
  { k: "req",    label: "Requests",      unit: "",         fmt: fmtK,  fmtFull: fmtInt },
  { k: "tok_in", label: "Tokens in",     unit: "",         fmt: fmtK,  fmtFull: fmtInt },
  { k: "tok_out",label: "Tokens out",    unit: "",         fmt: fmtK,  fmtFull: fmtInt },
  { k: "spend",  label: "Spend",         unit: "SAR",      fmt: n => "SAR " + fmtK(n), fmtFull: fmtSAR2 },
];

/* Derive 30-day series for all 4 metrics, per model.
   usage_30d gives requests. We scale for tokens + spend using model ratios. */
const MODEL_RATIO = {
  // input tokens per request (rough):
  allam:  { tpi: 85, tpo: 22, sar_per_req: 0.0149 },
  llama:  { tpi: 70, tpo: 31, sar_per_req: 0.0131 },
  bge:    { tpi: 120, tpo: 0,  sar_per_req: 0.00444 },
  falcon: { tpi: 18, tpo: 37, sar_per_req: 0.0164 },
};

function buildSeries(range) {
  /* range: "30d" | "7d" | "24h" — we only have 30d, so slice/aggregate. */
  const raw = OPS.usage_30d;
  let rows;
  if (range === "7d")  rows = raw.slice(-7);
  else                 rows = raw.slice();

  return rows.map((r, i) => {
    const req = { allam: r.allam, llama: r.llama, bge: r.bge, falcon: r.falcon };
    const toki = {}, toko = {}, spend = {};
    for (const m of ["allam","llama","bge","falcon"]) {
      const rm = MODEL_RATIO[m];
      toki[m]  = Math.round(req[m] * rm.tpi);
      toko[m]  = Math.round(req[m] * rm.tpo);
      spend[m] = +(req[m] * rm.sar_per_req).toFixed(2);
    }
    /* label day offset */
    const totalDays = raw.length;
    const offset = totalDays - (raw.length - (raw.indexOf(r) + 1));
    const dayN = raw.indexOf(r) + 1;
    return { i, dayN, req, tok_in: toki, tok_out: toko, spend };
  });
}

/* 24×7 heatmap — deterministic from usage_30d.
   Peak: Sun–Wed 09:00–17:00 Riyadh. Trough: Fri 03:00–05:00. */
function buildHeatmap() {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const out = [];
  let max = 0;
  for (let di = 0; di < 7; di++) {
    const row = [];
    const workday = di < 4;                  // Sun–Wed peak
    const thu     = di === 4;
    const fri     = di === 5;
    for (let h = 0; h < 24; h++) {
      const business = h >= 8 && h <= 18;
      let base;
      if (workday && business)      base = 380 + (h === 11 || h === 14 ? 120 : 0);
      else if (workday)             base = 60  + (h >= 20 ? 80 : 30);
      else if (thu && business)     base = 260;
      else if (thu)                 base = 70;
      else if (fri && h >= 14)      base = 140;
      else if (fri)                 base = 18;
      else /* sat */                base = business ? 210 : 55;
      const jitter = ((di * 31 + h * 7) % 11) * 9 - 40;
      const v = Math.max(4, base + jitter);
      row.push(v);
      if (v > max) max = v;
    }
    out.push({ day: days[di], row });
  }
  return { grid: out, max };
}

/* Derive per-API-key share from OPS.audit inference events — fallback to static weights */
const KEY_WEIGHTS = [
  { id: "key_1", name: "prod-edge-gateway",  env: "production", share: 0.612 },
  { id: "key_2", name: "analytics-batch",    env: "production", share: 0.258 },
  { id: "key_3", name: "staging-qa",         env: "staging",    share: 0.074 },
  { id: "key_4", name: "lina-local-dev",     env: "staging",    share: 0.038 },
  { id: "key_5", name: "ci-runner",          env: "staging",    share: 0.018 },
];

/* ════════════════════════════════════════════════════════════ */
/*  Toolbar — metric / range / export                           */
/* ════════════════════════════════════════════════════════════ */
function Toolbar({ metric, setMetric, range, setRange }) {
  return (
    <div className="u-toolbar">
      <span className="k">§ METRIC</span>
      {METRICS.map(m => (
        <span key={m.k} className={"chip " + (metric === m.k ? "on" : "")} onClick={() => setMetric(m.k)}>{m.label}</span>
      ))}
      <span style={{width: 14}} />
      <span className="k">§ RANGE</span>
      {[["24h","24 h"], ["7d","7 d"], ["30d","30 d"]].map(([k,l]) => (
        <span key={k} className={"chip " + (range === k ? "on" : "")} onClick={() => setRange(k)}>{l}</span>
      ))}
      <span className="spacer" />
      <select defaultValue="all">
        <option value="all">ALL ENVIRONMENTS</option>
        <option value="prod">PRODUCTION</option>
        <option value="stage">STAGING</option>
      </select>
      <button className="ex">CSV ↓</button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  KPI strip                                                   */
/* ════════════════════════════════════════════════════════════ */
function KpiStrip({ series, metric }) {
  const totals = useMemo(() => {
    const sum = { req: 0, tok_in: 0, tok_out: 0, spend: 0 };
    for (const p of series) {
      for (const m of ["allam","llama","bge","falcon"]) {
        sum.req     += p.req[m];
        sum.tok_in  += p.tok_in[m];
        sum.tok_out += p.tok_out[m];
        sum.spend   += p.spend[m];
      }
    }
    return sum;
  }, [series]);

  /* compare to prior period — we fake +16% / +11% / -4% */
  const delta = { req: +16.4, tok_in: +18.2, tok_out: +11.7, spend: +14.1, lat: -3.8 };

  const u = APP.usage;

  return (
    <div className="u-kpi">
      <div className="s">
        <div className="k">Requests · window</div>
        <div className="v"><em>{fmtInt(totals.req)}</em></div>
        <div className="sub pos">▲ {delta.req}% VS PRIOR</div>
      </div>
      <div className="s">
        <div className="k">Tokens · in</div>
        <div className="v">{fmtK(totals.tok_in)}</div>
        <div className="sub pos">▲ {delta.tok_in}%</div>
      </div>
      <div className="s">
        <div className="k">Tokens · out</div>
        <div className="v">{fmtK(totals.tok_out)}</div>
        <div className="sub pos">▲ {delta.tok_out}%</div>
      </div>
      <div className="s">
        <div className="k">Spend · window</div>
        <div className="v"><em>{fmtSAR(Math.round(totals.spend))}</em></div>
        <div className="sub pos">▲ {delta.spend}% · SAR</div>
      </div>
      <div className="s">
        <div className="k">p95 latency</div>
        <div className="v">{u.p95_ms}<span className="u">ms</span></div>
        <div className="sub pos">▼ {Math.abs(delta.lat)}% FASTER</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  Stacked area chart — SVG, hover tooltip                     */
/* ════════════════════════════════════════════════════════════ */
function StackedChart({ series, metric, visibleModels, toggleModel }) {
  const wrap = useRef(null);
  const [hover, setHover] = useState(null); // {x, i, vals}

  const metricKey = metric === "req" ? "req" : metric;
  const metricDef = METRICS.find(m => m.k === metric);

  const W = 1200, H = 340, PL = 56, PR = 20, PT = 20, PB = 38;
  const innerW = W - PL - PR, innerH = H - PT - PB;

  const models = ["allam", "llama", "bge", "falcon"].filter(m => visibleModels[m]);

  /* compute stack totals per point */
  const stacks = series.map((p, i) => {
    let cum = 0;
    const bands = models.map(m => {
      const v = p[metricKey][m];
      const band = { m, v, y0: cum, y1: cum + v };
      cum += v;
      return band;
    });
    return { i, total: cum, bands, raw: p };
  });

  const maxY = Math.max(...stacks.map(s => s.total)) * 1.05;
  const nX = stacks.length;

  const xOf = i => PL + (i / Math.max(1, nX - 1)) * innerW;
  const yOf = v => PT + innerH - (v / maxY) * innerH;

  /* build area paths per model */
  const paths = models.map((m, bi) => {
    let top = "", bottom = "";
    for (let i = 0; i < stacks.length; i++) {
      const band = stacks[i].bands.find(b => b.m === m);
      top += (i === 0 ? "M " : "L ") + xOf(i).toFixed(2) + " " + yOf(band.y1).toFixed(2) + " ";
    }
    for (let i = stacks.length - 1; i >= 0; i--) {
      const band = stacks[i].bands.find(b => b.m === m);
      bottom += "L " + xOf(i).toFixed(2) + " " + yOf(band.y0).toFixed(2) + " ";
    }
    return { m, d: top + bottom + "Z" };
  });

  /* tick days — every 5 for 30d, every 1 for 7d */
  const tickStep = series.length > 12 ? 5 : 1;

  const onMove = (evt) => {
    const rect = wrap.current.getBoundingClientRect();
    const px = evt.clientX - rect.left;
    const pct = (px - (PL / W) * rect.width) / ((innerW / W) * rect.width);
    const i = Math.max(0, Math.min(nX - 1, Math.round(pct * (nX - 1))));
    setHover({ i, x: xOf(i), y: yOf(stacks[i].total) });
  };

  /* y-axis ticks */
  const ticks = 4;
  const yTicks = [];
  for (let t = 0; t <= ticks; t++) {
    const v = (maxY * t) / ticks;
    yTicks.push({ v, y: yOf(v) });
  }

  const totalWindow = stacks.reduce((a, s) => a + s.total, 0);

  return (
    <div className="u-chart-wrap">
      <div className="u-chart-legend">
        {["allam","llama","bge","falcon"].map(m => (
          <span key={m} className={"sw " + (visibleModels[m] ? "" : "off")} onClick={() => toggleModel(m)}>
            <span className="c" style={{background: MODEL_META[m].color}} />
            <span>{MODEL_META[m].label}</span>
          </span>
        ))}
        <span className="spacer" />
        <span className="tot">WINDOW · {metricDef.fmtFull(totalWindow)}{metricDef.k === "spend" ? "" : ""}</span>
      </div>

      <div className="u-chart" ref={wrap} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{height: 340}}>
          {/* grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="var(--hair)" strokeWidth="1" shapeRendering="crispEdges" />
              <text x={PL - 8} y={t.y + 4} fill="var(--mut)" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">
                {metric === "spend" ? "SAR " + fmtK(Math.round(t.v)) : fmtK(Math.round(t.v))}
              </text>
            </g>
          ))}
          {/* stacked paths (draw bottom-to-top so top is on top) */}
          {paths.slice().reverse().map(p => (
            <path key={p.m} d={p.d} fill={MODEL_META[p.m].color} fillOpacity="0.85" stroke={MODEL_META[p.m].color} strokeWidth="1" />
          ))}
          {/* x ticks */}
          {stacks.map((s, i) => (
            (i % tickStep === 0 || i === nX - 1) && (
              <text key={i} x={xOf(i)} y={H - 14} fill="var(--mut)" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono">
                D{s.raw.dayN}
              </text>
            )
          ))}
          {/* axes */}
          <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="var(--ink)" strokeWidth="1" shapeRendering="crispEdges" />
          {/* hover */}
          {hover && (
            <g>
              <line x1={hover.x} x2={hover.x} y1={PT} y2={H - PB} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3,3" />
              {stacks[hover.i].bands.map(b => (
                <circle key={b.m} cx={hover.x} cy={yOf(b.y1)} r="3.5" fill={MODEL_META[b.m].color} stroke="var(--paper)" strokeWidth="1.5" />
              ))}
            </g>
          )}
        </svg>
        {hover && (
          <div className="tooltip" style={{
            left: (hover.x / W * 100) + "%",
            top: (hover.y / H * 100) + "%",
          }}>
            <div className="d">§ DAY {stacks[hover.i].raw.dayN} · TOTAL {metricDef.fmtFull(stacks[hover.i].total)}</div>
            {stacks[hover.i].bands.slice().reverse().map(b => (
              <div key={b.m} className="r">
                <span><span className="dot" style={{background: MODEL_META[b.m].color}} />{MODEL_META[b.m].label}</span>
                <span>{metricDef.fmtFull(b.v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  Breakdown card (model / key)                                */
/* ════════════════════════════════════════════════════════════ */
function BreakdownModels({ series, metric }) {
  const metricDef = METRICS.find(m => m.k === metric);
  const totals = {};
  let grand = 0;
  for (const m of ["allam","llama","bge","falcon"]) {
    totals[m] = series.reduce((a, p) => a + p[metric][m], 0);
    grand += totals[m];
  }
  const sorted = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  return (
    <div className="u-bd">
      <div className="u-bd-hd">
        <h3>By model</h3>
        <span className="sub">{metricDef.label.toUpperCase()}</span>
      </div>
      {sorted.map(([m, v], idx) => {
        const pct = (v / grand) * 100;
        const model = OPS.models.find(x => x.id === m + (m === "allam" ? "-7b" : m === "llama" ? "-3.1-70b" : m === "bge" ? "-m3" : "-h1-34b"))
                      || { display: MODEL_META[m].label };
        return (
          <div key={m} className="u-bd-row">
            <div className="nm">
              {MODEL_META[m].label}
              <span className="sub">{model.vendor || (m === "falcon" ? "TII" : m === "bge" ? "BAAI" : "")} · {model.region || "RUH"}</span>
            </div>
            <div className="pc">{pct.toFixed(1)}%</div>
            <div className="val">{metricDef.fmtFull(Math.round(v))}</div>
            <div className="bar"><div className={"f " + (idx === 1 ? "c2" : idx === 2 ? "c3" : idx === 3 ? "c4" : "")} style={{width: pct + "%", background: MODEL_META[m].color}} /></div>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownKeys({ series, metric }) {
  const metricDef = METRICS.find(m => m.k === metric);
  const grand = series.reduce((a, p) => {
    for (const m of ["allam","llama","bge","falcon"]) a += p[metric][m];
    return a;
  }, 0);

  return (
    <div className="u-bd">
      <div className="u-bd-hd">
        <h3>By API key</h3>
        <span className="sub">TOP 5 OF {APP.keys.length}</span>
      </div>
      {KEY_WEIGHTS.map((k, idx) => {
        const v = grand * k.share;
        const pct = k.share * 100;
        return (
          <div key={k.id} className="u-bd-row">
            <div className="nm">
              {k.name}
              <span className="sub">{k.env.toUpperCase()} · dcp_{k.env === "production" ? "live" : "test"}_••••</span>
            </div>
            <div className="pc">{pct.toFixed(1)}%</div>
            <div className="val">{metricDef.fmtFull(Math.round(v))}</div>
            <div className="bar"><div className={"f " + (idx === 0 ? "" : idx === 1 ? "c2" : idx === 2 ? "c3" : "c4")} style={{width: pct + "%"}} /></div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  Hour-of-day heatmap                                         */
/* ════════════════════════════════════════════════════════════ */
function Heatmap() {
  const { grid, max } = useMemo(buildHeatmap, []);
  const [hover, setHover] = useState(null);
  const cellColor = (v) => {
    const t = v / max;
    // paper palette: light cream → teal → orange for peaks
    if (t < 0.05) return "#ece5d6";
    if (t < 0.15) return "#d8e9e3";
    if (t < 0.35) return "#9cd1c2";
    if (t < 0.55) return "#5dba9f";
    if (t < 0.75) return "var(--teal)";
    if (t < 0.90) return "#e89762";
    return "var(--orange)";
  };
  const stops = [0, 0.15, 0.35, 0.55, 0.75, 1];
  return (
    <div className="u-heat-wrap">
      <div className="u-sec-hd" style={{margin: 0, marginBottom: 8}}>
        <h2>When does your traffic <em>actually</em> come in?</h2>
        <span className="eb">§ HOUR-OF-DAY · 7-DAY AVG · Asia/Riyadh</span>
      </div>
      <p style={{fontFamily: "var(--mono)", fontSize: 11, color: "var(--mut)", letterSpacing: ".04em", lineHeight: 1.7, margin: "4px 0 14px", maxWidth: 720}}>
        Aggregated across all keys and models. Peaks on Sun–Wed business hours, a long Thursday-afternoon tail, and the expected Friday trough. Use this to size batch jobs around your live traffic.
      </p>
      <div className="u-heat">
        <div />
        {[...Array(24)].map((_, h) => null)}
        {grid.map(row => (
          <React.Fragment key={row.day}>
            <div className="day-label">{row.day}</div>
            {row.row.map((v, h) => (
              <div
                key={h}
                className="cell"
                style={{background: cellColor(v)}}
                onMouseEnter={() => setHover({day: row.day, h, v})}
                onMouseLeave={() => setHover(null)}
                title={`${row.day} · ${String(h).padStart(2,"0")}:00 · ${fmtInt(v)} req`}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="u-heat-hours">
        <div />
        {[...Array(24)].map((_, h) => (
          <div key={h} className="hr">{h % 3 === 0 ? String(h).padStart(2,"0") : ""}</div>
        ))}
      </div>
      <div className="u-heat-legend">
        <span>LOW</span>
        <div className="scale">
          {stops.map((s,i) => <div key={i} className="c" style={{background: cellColor(s * max)}} />)}
        </div>
        <span>HIGH</span>
        <span style={{marginInlineStart: "auto", color: "var(--ink-2)"}}>
          {hover
            ? `${hover.day.toUpperCase()} · ${String(hover.h).padStart(2,"0")}:00 — ${fmtInt(hover.v)} REQ / HR`
            : `PEAK · TUE 14:00 — ~${fmtInt(max)} REQ / HR`}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  Budget pacing                                               */
/* ════════════════════════════════════════════════════════════ */
function BudgetPacing() {
  const u = APP.usage;
  const spent = u.spend_sar, budget = u.budget_sar;
  const pct = (spent / budget) * 100;
  // April has 30 days; today = 22nd → 73.3% of month elapsed
  const dayOfMonth = 22, daysInMonth = 30;
  const pace = (dayOfMonth / daysInMonth) * 100;
  const proj = Math.round(spent / dayOfMonth * daysInMonth);
  const projPct = (proj / budget) * 100;
  const overUnder = proj - budget;

  return (
    <div className="u-budget">
      <div className="info">
        <div className="k">§ APRIL 2026 · SPEND</div>
        <div className="v"><em>{fmtSAR(Math.round(spent))}</em><span className="of">/ {fmtSAR(budget)}</span></div>
        <div className="s">
          {pct.toFixed(1)}% of monthly budget used · day {dayOfMonth} of {daysInMonth} ({pace.toFixed(0)}% elapsed)<br/>
          PROJECTED MONTH-END: <strong style={{color: "var(--ink)", letterSpacing: ".04em"}}>{fmtSAR(proj)}</strong>
          <span className="hi"> · {overUnder > 0 ? "+" : ""}{fmtSAR(overUnder)} {overUnder > 0 ? "over" : "under"} cap</span><br/>
          Alerts configured at 50 / 75 / 90% · last fired 74% (3h ago).
        </div>
      </div>
      <div className="u-meter">
        <div className="bar">
          <div className="fill" style={{width: pct + "%"}} />
          <div className="pace" style={{left: pace + "%"}} />
        </div>
        <div className="ticks">
          <span>0</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
        <div style={{marginTop: 18, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mut)", letterSpacing: ".08em", lineHeight: 1.7}}>
          <div>§ ACTUAL &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {fmtSAR(Math.round(spent)).padEnd(12)} &nbsp; {pct.toFixed(1)}%</div>
          <div>§ PACE LINE &nbsp;&nbsp; {fmtSAR(Math.round(budget * pace / 100)).padEnd(12)} &nbsp; {pace.toFixed(1)}%</div>
          <div>§ PROJECTED &nbsp;&nbsp; <span style={{color: "var(--ink)"}}>{fmtSAR(proj).padEnd(12)}</span> &nbsp; <span style={{color: projPct > 100 ? "var(--err)" : "var(--ok)"}}>{projPct.toFixed(1)}%</span></div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════ */
/*  Main                                                         */
/* ════════════════════════════════════════════════════════════ */
function Usage() {
  const [metric, setMetric] = useState("req");
  const [range, setRange]   = useState("30d");
  const [visibleModels, setVisibleModels] = useState({ allam: true, llama: true, bge: true, falcon: true });

  const series = useMemo(() => buildSeries(range), [range]);
  const toggleModel = (m) => setVisibleModels(v => ({ ...v, [m]: !v[m] }));

  return (
    <AppFrame current="usage" crumb="USAGE" topbarRight={null}>
      <main className="main">
        <header className="page-head-2">
          <div className="eb">§ USAGE · ANALYTICS</div>
          <h1>Where every <em>token</em> went.</h1>
          <p>Requests, tokens, spend — broken down by model, API key, and hour of day. All timestamps in Asia/Riyadh. Prior-period comparison rolls at midnight.</p>
        </header>

        <Toolbar metric={metric} setMetric={setMetric} range={range} setRange={setRange} />

        <KpiStrip series={series} metric={metric} />

        <div className="u-sec-hd">
          <h2>Trend · <em>{METRICS.find(m => m.k === metric).label.toLowerCase()}</em>, stacked by model</h2>
          <span className="eb">§ {range === "7d" ? "7 DAYS" : "30 DAYS"} · STACKED AREA</span>
        </div>
        <StackedChart series={series} metric={metric} visibleModels={visibleModels} toggleModel={toggleModel} />

        <div className="u-sec-hd">
          <h2>How the <em>pie</em> is sliced.</h2>
          <span className="eb">§ ATTRIBUTION · WINDOW TOTAL</span>
        </div>
        <div className="u-grid-2">
          <BreakdownModels series={series} metric={metric} />
          <BreakdownKeys series={series} metric={metric} />
        </div>

        <Heatmap />

        <div className="u-sec-hd">
          <h2>Are we <em>on pace</em>?</h2>
          <span className="eb">§ BUDGET · {APP.usage.month_label.toUpperCase()}</span>
        </div>
        <BudgetPacing />

      </main>
      <ReturnStrip />
    </AppFrame>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Usage />);
