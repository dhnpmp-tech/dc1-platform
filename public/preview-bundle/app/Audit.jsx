/* eslint-disable */
/* Audit — filterable event log */

const { useState, useMemo } = React;
const OPS = window.DCP_OPS;

function fmtInt(n) { return n.toLocaleString(); }

/* group events by day */
function groupByDay(events) {
  const groups = {};
  for (const e of events) {
    const day = e.t.split(" · ")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }
  return Object.entries(groups);
}

function relDay(day) {
  const today = "2026-04-22";
  const yd    = "2026-04-21";
  if (day === today) return "Today";
  if (day === yd)    return "Yesterday";
  const d = new Date(day);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/* Synthesise rich JSON payload for expanded row */
function eventJson(e) {
  return {
    event_id: "evt_" + Math.random().toString(36).slice(2, 14),
    timestamp: e.t.replace(" · ", "T") + ":00+03:00",
    organization: "org_nextwave_commerce",
    actor: { type: e.actor_kind, name: e.actor, ip: e.ip, user_agent: e.ua },
    action: e.action,
    target: e.target,
    metadata: e.meta,
    severity: e.sev,
    request_id: "req_" + Math.random().toString(36).slice(2, 18),
  };
}

function ExpandedRow({ e }) {
  const j = eventJson(e);
  return (
    <div className="au-exp-row">
      <div className="json">
        <span className="lb">EVENT_ID</span><span className="st">"{j.event_id}"</span>
        <span className="lb">TIMESTAMP</span><span className="st">"{j.timestamp}"</span>
        <span className="lb">ORGANIZATION</span><span className="st">"{j.organization}"</span>
        <span className="lb">ACTOR.TYPE</span><span className="k">{j.actor.type}</span>
        <span className="lb">ACTOR.NAME</span><span className="st">"{j.actor.name}"</span>
        <span className="lb">ACTOR.IP</span><span className="st">"{j.actor.ip}"</span>
        <span className="lb">ACTOR.UA</span><span className="st">"{j.actor.user_agent}"</span>
        <span className="lb">ACTION</span><span className="k">{j.action}</span>
        <span className="lb">TARGET</span><span className="st">"{j.target}"</span>
        <span className="lb">METADATA</span><span className="st">"{j.metadata}"</span>
        <span className="lb">SEVERITY</span><span className="k">{j.severity}</span>
        <span className="lb">REQUEST_ID</span><span className="st">"{j.request_id}"</span>
      </div>
    </div>
  );
}

function Audit() {
  const [actorKinds, setActorKinds] = useState({ user: true, key: true, sys: true });
  const [severities, setSeverities] = useState({ info: true, warn: true, error: true });
  const [actionCats, setActionCats] = useState({ auth: true, key: true, job: true, billing: true, inference: true, team: true, other: true });
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("30d");
  const [expanded, setExpanded] = useState(null);

  const actionCat = (a) => {
    if (a.startsWith("auth.")) return "auth";
    if (a.startsWith("key.")) return "key";
    if (a.startsWith("job.")) return "job";
    if (a.startsWith("billing.") || a === "invoice.download" || a === "budget.alert") return "billing";
    if (a.startsWith("inference.")) return "inference";
    if (a.startsWith("team.")) return "team";
    return "other";
  };

  const events = useMemo(() => OPS.audit.filter(e => {
    if (!actorKinds[e.actor_kind]) return false;
    if (!severities[e.sev]) return false;
    if (!actionCats[actionCat(e.action)]) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(e.actor + " " + e.action + " " + e.target + " " + e.meta).toLowerCase().includes(q)) return false;
    }
    return true;
  }), [actorKinds, severities, actionCats, query]);

  const days = groupByDay(events);

  const counts = {
    user: OPS.audit.filter(e => e.actor_kind === "user").length,
    key:  OPS.audit.filter(e => e.actor_kind === "key").length,
    sys:  OPS.audit.filter(e => e.actor_kind === "sys").length,
    info: OPS.audit.filter(e => e.sev === "info").length,
    warn: OPS.audit.filter(e => e.sev === "warn").length,
    error: OPS.audit.filter(e => e.sev === "error").length,
    auth: OPS.audit.filter(e => actionCat(e.action) === "auth").length,
    key_act: OPS.audit.filter(e => actionCat(e.action) === "key").length,
    job: OPS.audit.filter(e => actionCat(e.action) === "job").length,
    billing: OPS.audit.filter(e => actionCat(e.action) === "billing").length,
    inference: OPS.audit.filter(e => actionCat(e.action) === "inference").length,
    team: OPS.audit.filter(e => actionCat(e.action) === "team").length,
  };

  const sevCounts = {
    info: events.filter(e => e.sev === "info").length,
    warn: events.filter(e => e.sev === "warn").length,
    error: events.filter(e => e.sev === "error").length,
  };

  const actorLabel = { user: "Users", key: "API keys", sys: "System" };
  const sevLabel = { info: "Info", warn: "Warn", error: "Error" };
  const catLabel = { auth:"Authentication", key:"API keys", job:"Jobs", billing:"Billing", inference:"Inference", team:"Team", other:"Other" };

  const toggle = (setter, key) => setter(s => ({ ...s, [key]: !s[key] }));

  return (
    <AppFrame current="logs" crumb="AUDIT LOG" topbarRight={null}>
      <main className="main">
        <header className="page-head-2">
          <div className="eb">§ AUDIT · IMMUTABLE EVENT STREAM</div>
          <h1>Every action, <em>accounted for</em>.</h1>
          <p>A tamper-evident log of every request against your organisation. Retained for 13 months on the Scale plan. Export anytime to CSV or stream to S3 / SIEM.</p>
        </header>

        <div className="au-stats">
          <div className="s"><div className="k">Events · visible</div><div className="v"><em>{fmtInt(events.length)}</em></div><div className="sub">OF {fmtInt(OPS.audit.length)} TOTAL</div></div>
          <div className="s"><div className="k">Warnings</div><div className="v">{sevCounts.warn}</div><div className="sub">IN WINDOW</div></div>
          <div className="s"><div className="k">Errors</div><div className="v" style={{color: sevCounts.error > 0 ? "var(--err)" : "var(--ink)"}}>{sevCounts.error}</div><div className="sub err">INVESTIGATE</div></div>
          <div className="s"><div className="k">Retention</div><div className="v">13<span style={{fontSize:16, color:"var(--mut)"}}>mo</span></div><div className="sub">SCALE PLAN</div></div>
        </div>

        <div className="au-tool">
          <span className="k">§ SEARCH</span>
          <input className="q" placeholder="Filter by actor, action, target, IP…" value={query} onChange={e => setQuery(e.target.value)} />
          <span className="k">§ EXPORT</span>
          <button className="ex">CSV ↓</button>
          <button className="ex">JSON ↓</button>
          <button className="ex">STREAM ↗</button>
        </div>

        <div className="au-layout">

          {/* ── Filter rail ─────────────────────── */}
          <aside className="au-filters">
            <div className="grp">
              <div className="ttl">§ TIME RANGE</div>
              <div className="au-daterange">
                <input type="text" placeholder="FROM" defaultValue="2026-04-08" />
                <input type="text" placeholder="TO" defaultValue="2026-04-22" />
              </div>
              <div className="au-quick">
                {["1h", "24h", "7d", "30d", "90d"].map(r => (
                  <span key={r} className={"q " + (range === r ? "on" : "")} onClick={() => setRange(r)}>{r}</span>
                ))}
              </div>
            </div>

            <div className="grp">
              <div className="ttl">§ ACTOR</div>
              {Object.keys(actorKinds).map(k => (
                <div key={k} className={"op " + (actorKinds[k] ? "on" : "")} onClick={() => toggle(setActorKinds, k)}>
                  <span className="cb">{actorKinds[k] && "✓"}</span>
                  <span>{actorLabel[k]}</span>
                  <span className="n">{counts[k]}</span>
                </div>
              ))}
            </div>

            <div className="grp">
              <div className="ttl">§ SEVERITY</div>
              {Object.keys(severities).map(k => (
                <div key={k} className={"op " + (severities[k] ? "on" : "")} onClick={() => toggle(setSeverities, k)}>
                  <span className="cb">{severities[k] && "✓"}</span>
                  <span>{sevLabel[k]}</span>
                  <span className="n">{counts[k]}</span>
                </div>
              ))}
            </div>

            <div className="grp">
              <div className="ttl">§ ACTION</div>
              {Object.keys(actionCats).map(k => (
                <div key={k} className={"op " + (actionCats[k] ? "on" : "")} onClick={() => toggle(setActionCats, k)}>
                  <span className="cb">{actionCats[k] && "✓"}</span>
                  <span>{catLabel[k]}</span>
                  <span className="n">{k==="key" ? counts.key_act : (counts[k] ?? "")}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* ── Events table ────────────────────── */}
          <div className="au-table">
            <div className="au-head">
              <div>Timestamp</div>
              <div>Actor</div>
              <div>Action</div>
              <div>Target & metadata</div>
              <div style={{textAlign:"end"}}>Severity</div>
            </div>
            {days.length === 0 && (
              <div style={{padding:"60px 22px", textAlign:"center", color:"var(--mut)", fontSize:14}}>
                No events match the current filters.
              </div>
            )}
            {days.map(([day, list]) => (
              <React.Fragment key={day}>
                <div className="au-daysep">
                  <span>§ {relDay(day)} · {day}</span>
                  <span className="cnt">{list.length} {list.length === 1 ? "EVENT" : "EVENTS"}</span>
                </div>
                {list.map((e, i) => {
                  const id = day + ":" + i;
                  const exp = expanded === id;
                  return (
                    <React.Fragment key={id}>
                      <div className={"au-row " + (exp ? "exp" : "")} onClick={() => setExpanded(exp ? null : id)}>
                        <div className="t">{e.t.split(" · ")[1]}</div>
                        <div className={"actor " + e.actor_kind}>
                          <div className="av">{e.actor_kind === "sys" ? "⚙" : e.actor.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}</div>
                          <div style={{minWidth:0}}>
                            <div className="nm">{e.actor}</div>
                            <div className="ip">{e.ip === "—" ? "SYSTEM" : e.ip}</div>
                          </div>
                        </div>
                        <div><span className={"au-action " + (e.sev === "error" ? "err" : e.sev === "warn" ? "warn" : "")}>{e.action}</span></div>
                        <div className="au-tgt">
                          <div className="tg">{e.target}</div>
                          <div className="mt">{e.meta}</div>
                        </div>
                        <div style={{textAlign:"end"}}><span className={"au-sev " + e.sev}>{e.sev}</span></div>
                      </div>
                      {exp && <ExpandedRow e={e} />}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </main>
      <ReturnStrip />
    </AppFrame>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<Audit />);
