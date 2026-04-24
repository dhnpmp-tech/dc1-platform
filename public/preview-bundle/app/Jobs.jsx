/* eslint-disable */
/* Jobs — batch jobs list with filters + live progress + detail drawer */

const { useState, useEffect, useMemo } = React;
const OPS = window.DCP_OPS;

function fmtInt(n) { return n.toLocaleString(); }

/* Simulated log timeline for each job */
function buildLog(j) {
  const base = [
    { t: j.started.split(" · ")[1] || j.started, kind: "ok", e: `Job ${j.id} created by ${j.creator}` },
    { t: j.started.split(" · ")[1] || j.started, kind: "info", e: `Input validated — ${fmtInt(j.items_total)} items queued` },
  ];
  if (j.status === "queued") {
    base.push({ t: "—", kind: "info", e: "Waiting for available GPU capacity on bge-m3 pool…" });
  }
  if (j.status === "running") {
    base.push({ t: "08:12:04", kind: "ok", e: "Assigned 4× GPU workers · batch size 128" });
    base.push({ t: "08:14:18", kind: "info", e: `Checkpoint saved at ${fmtInt(Math.round(j.items_total * 0.2))} items` });
    base.push({ t: "08:32:51", kind: "info", e: `Checkpoint saved at ${fmtInt(Math.round(j.items_total * 0.5))} items` });
    base.push({ t: "NOW", kind: "info", e: `${fmtInt(j.items_done)} / ${fmtInt(j.items_total)} · ${(j.progress*100).toFixed(1)}%` });
  }
  if (j.status === "done") {
    base.push({ t: "— mid —", kind: "info", e: "Checkpoints saved throughout run" });
    base.push({ t: (j.finished||"").split(" · ")[1] || "", kind: "ok", e: `Completed · ${fmtInt(j.items_total)} items · output written` });
  }
  if (j.status === "failed") {
    base.push({ t: "22:32:08", kind: "info", e: `Processed ${fmtInt(j.items_done)} items before halt` });
    base.push({ t: (j.finished||"").split(" · ")[1] || "", kind: "err", e: j.failure_reason || "Job failed" });
  }
  return base;
}

function StatusBadge({ s }) {
  const label = { running: "◉ Running", queued: "◐ Queued", done: "● Done", failed: "✕ Failed" }[s];
  return <span className={"j-status " + s}><span className="d" />{label.slice(2)}</span>;
}

/* ── Drawer ─────────────────────────────────────── */
function JobDrawer({ job, onClose }) {
  if (!job) return null;
  const model = OPS.models.find(m => m.id === job.model);
  const pct = (job.progress * 100).toFixed(1);
  const log = useMemo(() => buildLog(job), [job.id]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-hd">
          <div style={{minWidth:0, flex:1}}>
            <div className="eb">§ JOB · {job.kind.toUpperCase()} · {model?.family.toUpperCase()}</div>
            <h2>{job.name}</h2>
            <div className="id">{job.id} · created by {job.creator}</div>
          </div>
          <span className="x" onClick={onClose}>✕ CLOSE</span>
        </div>

        <div className="drawer-body">
          {/* Progress section */}
          <div className="drawer-sec">
            <div className="ttl">§ PROGRESS</div>
            <div className="drawer-big-progress">
              <div className="v"><em>{pct}</em>%<span className="of">of {fmtInt(job.items_total)}</span></div>
              <div className="eta">{job.eta}</div>
            </div>
            <div className={"drawer-progress-bar " + job.status}>
              <div className="f" style={{width: pct + "%"}} />
            </div>
            <div style={{display:"flex", justifyContent:"space-between", fontFamily:"var(--mono)", fontSize:10, letterSpacing:".06em", color:"var(--mut)", textTransform:"uppercase"}}>
              <span>{fmtInt(job.items_done)} done</span>
              <StatusBadge s={job.status} />
              <span>{fmtInt(job.items_total - job.items_done)} remaining</span>
            </div>
          </div>

          {/* Failure note if failed */}
          {job.status === "failed" && job.failure_reason && (
            <div className="drawer-sec">
              <div className="ttl">§ FAILURE</div>
              <div className="failure-note">
                <span className="x">✕</span>{job.failure_reason}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="drawer-sec">
            <div className="ttl">§ DETAILS</div>
            <div className="drawer-kv">
              <span className="k">Model</span><span className="v">{model?.display || job.model}</span>
              <span className="k">Kind</span><span className="v">{job.kind}</span>
              <span className="k">Started</span><span className="v mono">{job.started}</span>
              {job.finished && <><span className="k">Finished</span><span className="v mono">{job.finished}</span></>}
              <span className="k">Input</span><span className="v mono">{job.input}</span>
              <span className="k">Output</span><span className="v mono">{job.output}</span>
              <span className="k">Items</span><span className="v">{fmtInt(job.items_total)} total · {fmtInt(job.items_done)} processed</span>
              <span className="k">Cost · est.</span><span className="v"><span style={{fontFamily:"var(--serif)", fontSize:20, color:"var(--orange)", fontStyle:"italic"}}>{fmtInt(job.est_cost_sar)}</span> <span style={{color:"var(--mut)", fontFamily:"var(--mono)", fontSize:11}}>SAR</span></span>
            </div>
          </div>

          {/* Timeline */}
          <div className="drawer-sec">
            <div className="ttl">§ TIMELINE</div>
            <div className="log-tl">
              {log.map((r, i) => (
                <div key={i} className={"r " + r.kind}>
                  <span className="t">{r.t}</span>
                  <span className="e">{r.e}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="drawer-actions">
          {job.status === "running" && <button className="btn danger">■ CANCEL JOB</button>}
          {job.status === "queued" && <button className="btn danger">✕ DEQUEUE</button>}
          {(job.status === "done" || job.status === "failed") && <button className="btn">⎘ CLONE</button>}
          {job.status === "failed" && <button className="btn primary">↻ RETRY</button>}
          {job.status === "done" && <button className="btn primary">↓ DOWNLOAD OUTPUT</button>}
        </div>
      </aside>
    </>
  );
}

/* ── Main ───────────────────────────────────────── */
function Jobs() {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  /* live-tick running jobs for visual life */
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1800);
    return () => clearInterval(t);
  }, []);

  const jobs = useMemo(() => OPS.jobs.map(j => {
    if (j.status !== "running") return j;
    const bump = Math.min(1, j.progress + (tick * 0.0022));
    return { ...j, progress: bump, items_done: Math.round(j.items_total * bump) };
  }), [tick]);

  const counts = {
    all: jobs.length,
    running: jobs.filter(j => j.status === "running").length,
    queued: jobs.filter(j => j.status === "queued").length,
    done: jobs.filter(j => j.status === "done").length,
    failed: jobs.filter(j => j.status === "failed").length,
  };

  const list = filter === "all" ? jobs : jobs.filter(j => j.status === filter);
  const sel = selected ? jobs.find(j => j.id === selected) : null;

  const totalSpend = jobs.filter(j => j.status === "done").reduce((a,b) => a + b.est_cost_sar, 0);
  const itemsProcessed = jobs.reduce((a,b) => a + b.items_done, 0);

  return (
    <AppFrame current="jobs" crumb="BATCH JOBS" topbarRight={null}>
      <main className="main">
        <header className="page-head-2">
          <div className="eb">§ BATCH · ASYNC OPERATIONS</div>
          <h1>Batch jobs, <em>queued</em> and clocked.</h1>
          <p>Large offline runs against DCP models — embed a catalog, triage a million tickets, translate a product corpus. Watch them tick.</p>
        </header>

        <div className="j-stats">
          <div className="s"><div className="k">Active now</div><div className="v"><em>{counts.running}</em></div><div className="sub warn">● PROCESSING</div></div>
          <div className="s"><div className="k">In queue</div><div className="v">{counts.queued}</div><div className="sub">AWAITING GPU</div></div>
          <div className="s"><div className="k">Completed · 30d</div><div className="v">{counts.done}</div><div className="sub ok">● FINISHED</div></div>
          <div className="s"><div className="k">Items processed</div><div className="v">{(itemsProcessed/1000).toFixed(0)}K</div><div className="sub">ACROSS ALL JOBS</div></div>
          <div className="s"><div className="k">Spent · 30d</div><div className="v"><em>{fmtInt(totalSpend)}</em></div><div className="sub">SAR · COMPLETED JOBS</div></div>
        </div>

        <div className="j-bar">
          <span className="lb">§ FILTER</span>
          {[
            {k:"all", l:"All"},
            {k:"running", l:"Running"},
            {k:"queued", l:"Queued"},
            {k:"done", l:"Done"},
            {k:"failed", l:"Failed"},
          ].map(f => (
            <span key={f.k} className={"chip " + (filter === f.k ? "on" : "")} onClick={() => setFilter(f.k)}>
              {f.l}<span className="n">{counts[f.k]}</span>
            </span>
          ))}
          <span className="spacer" />
          <button className="new">＋ NEW BATCH JOB</button>
        </div>

        <div className="j-table">
          <div className="j-head">
            <div>Name</div>
            <div>Model</div>
            <div>Status</div>
            <div>Progress</div>
            <div>Started</div>
            <div style={{textAlign:"end"}}>Cost · SAR</div>
          </div>
          {list.length === 0 && (
            <div style={{padding:"60px 22px", textAlign:"center", color:"var(--mut)", fontSize:14}}>
              No jobs match this filter.
            </div>
          )}
          {list.map(j => {
            const model = OPS.models.find(m => m.id === j.model);
            const pct = (j.progress * 100).toFixed(j.status === "running" ? 1 : 0);
            return (
              <div key={j.id} className={"j-row " + j.status + (j.id === selected ? " on" : "")}
                   onClick={() => setSelected(j.id)}>
                <div className="name-col">
                  <div className="nm">{j.name}</div>
                  <div className="id">{j.id} · {j.creator}</div>
                </div>
                <div className="kind-col">
                  <span className="mo">◎</span>{model?.family || j.model}
                </div>
                <div><StatusBadge s={j.status} /></div>
                <div className="progress">
                  <div className="bar"><div className="f" style={{width: pct + "%"}} /></div>
                  <div className="pct">{pct}%</div>
                  <div className="meta">{fmtInt(j.items_done)} / {fmtInt(j.items_total)} · {j.eta}</div>
                </div>
                <div style={{fontFamily:"var(--mono)", fontSize:10.5, letterSpacing:".04em", color:"var(--ink-2)", textTransform:"uppercase"}}>
                  {j.started === "—" ? "—" : j.started.replace("2026-", "").replace(" · ", " · ")}
                </div>
                <div className="cost">{fmtInt(j.est_cost_sar)}<span className="u">SAR</span></div>
              </div>
            );
          })}
        </div>

        <JobDrawer job={sel} onClose={() => setSelected(null)} />
      </main>
      <ReturnStrip />
    </AppFrame>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Jobs />);
