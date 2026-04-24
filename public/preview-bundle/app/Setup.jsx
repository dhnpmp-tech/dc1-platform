/* ──────────────────────────────────────────────────────────
   /setup — canonical provider onboarding (6 steps)
   Pre-auth-capable. Orange-accent provider shell anchor.
   ────────────────────────────────────────────────────────── */
const { useState, useEffect, useRef, useMemo } = React;

/* ═══ STEP MODEL ══════════════════════════════════════════ */
const STEPS = [
  { n: 1, key: "welcome",  title: "Welcome",     sub: "What you'll do, how you earn",   minutes: 1 },
  { n: 2, key: "detect",   title: "Detect GPU",  sub: "Installer finds your hardware",  minutes: 1 },
  { n: 3, key: "download", title: "Download",    sub: "4 MB daemon for your OS",        minutes: 1 },
  { n: 4, key: "pair",     title: "Pair",        sub: "First heartbeat from your rig",  minutes: 2 },
  { n: 5, key: "rate",     title: "Set rate",    sub: "Your rate, your hours",          minutes: 1 },
  { n: 6, key: "golive",   title: "Go live",     sub: "First job within ~30 seconds",   minutes: 0 },
];

/* ═══ ROOT ════════════════════════════════════════════════ */
function Setup() {
  const [cur, setCur] = useState(1);
  const [data, setData] = useState({
    os: null,             // 'win' | 'mac' | 'linux'
    gpu: null,            // detected gpu descriptor
    paired: false,
    rate: 38,             // SAR / hr
    hoursOn: 24,          // 8 | 16 | 24
    autoAccept: true,
    payoutMode: "sar",    // 'sar' | 'usdc'
  });
  const goto = n => setCur(Math.max(1, Math.min(6, n)));
  const patch = p => setData(d => ({ ...d, ...p }));

  return (
    <>
      <SetupHeader />
      <main className="setup-root">
        <SetupIntro current={cur} />
        <Stepper current={cur} goto={goto} />
        <div className="setup-stage">
          {cur === 1 && <StepWelcome data={data} patch={patch} next={() => goto(2)} />}
          {cur === 2 && <StepDetect data={data} patch={patch} next={() => goto(3)} back={() => goto(1)} />}
          {cur === 3 && <StepDownload data={data} patch={patch} next={() => goto(4)} back={() => goto(2)} />}
          {cur === 4 && <StepPair data={data} patch={patch} next={() => goto(5)} back={() => goto(3)} />}
          {cur === 5 && <StepRate data={data} patch={patch} next={() => goto(6)} back={() => goto(4)} />}
          {cur === 6 && <StepGoLive data={data} back={() => goto(5)} />}
        </div>
        <SetupFoot />
      </main>
    </>
  );
}

/* ═══ HEADER + STEPPER ════════════════════════════════════ */
function SetupHeader() {
  return (
    <header className="setup-hdr">
      <div className="setup-hdr-in">
        <div className="brand">
          <div className="brand-mark"><img src="../assets/dcp-logo-square.jpeg" alt="DCP" /></div>
          <div className="brand-name">DCP<i>setup</i></div>
        </div>
        <div className="setup-hdr-right">
          <div className="setup-route">provider · /setup</div>
          <a className="setup-help" href="Earn.html">Not a provider? <u>Rent compute instead</u></a>
        </div>
      </div>
    </header>
  );
}

function SetupIntro({ current }) {
  const step = STEPS[current - 1];
  const total = STEPS.reduce((a, s) => a + s.minutes, 0);
  return (
    <section className="setup-intro">
      <div className="setup-eb">Provider onboarding · ~{total} minutes end-to-end</div>
      <h1 className="setup-h1">
        Turn your GPU into <em>SAR.</em>
      </h1>
      <p className="setup-lede">
        Six steps. Four megabytes. Real earnings within the hour. Every job stays in Saudi Arabia; your GPU stays at home.
      </p>
      <div className="setup-meta">
        <div>Now on <b>{String(current).padStart(2, "0")} · {step.title}</b></div>
        <div>Takes <b>~{step.minutes || "<1"} min</b></div>
        <div>Pre-auth <b>No account required until Step 4</b></div>
        <div>Support <b>support@dcp.sa</b></div>
      </div>
    </section>
  );
}

function Stepper({ current, goto }) {
  return (
    <ol className="stepper" aria-label="Onboarding progress">
      {STEPS.map(s => {
        const state = s.n < current ? "done" : s.n === current ? "now" : "next";
        return (
          <li key={s.n} className={`stepper-item ${state}`} onClick={() => s.n <= current && goto(s.n)}>
            <div className="stepper-n">{String(s.n).padStart(2, "0")}</div>
            <div className="stepper-body">
              <div className="stepper-title">{s.title}</div>
              <div className="stepper-sub">{s.sub}</div>
            </div>
            <div className="stepper-mark">{state === "done" ? "✓" : state === "now" ? "●" : ""}</div>
          </li>
        );
      })}
    </ol>
  );
}

/* ═══ STEP 1 — WELCOME ════════════════════════════════════ */
function StepWelcome({ next }) {
  return (
    <Step n={1} title="Welcome to the marketplace." subtitle="Your rig · their workloads · SAR in your wallet.">
      <div className="w-grid">
        <div className="w-card">
          <div className="w-k">01</div>
          <div className="w-t">Install the daemon.</div>
          <div className="w-d">4 MB. Auto-detects your GPU, installs Ollama (Linux/Windows) or MLX (macOS), downloads a base model. No config.</div>
        </div>
        <div className="w-card">
          <div className="w-k">02</div>
          <div className="w-t">Pair your rig.</div>
          <div className="w-d">Cloudflare Tunnel — no port forwarding. First heartbeat pairs you to your wallet.</div>
        </div>
        <div className="w-card">
          <div className="w-k">03</div>
          <div className="w-t">Earn per job.</div>
          <div className="w-d"><b>75% / 25%</b> provider / platform split. Settlement is runtime-based, not estimated. Unused estimate holds return automatically.</div>
        </div>
      </div>
      <div className="w-calc">
        <div className="w-calc-hd">
          <div className="setup-eb">Indicative earnings · Riyadh residential tariff</div>
          <div className="w-calc-note">Real earnings depend on demand, model mix, and uptime.</div>
        </div>
        <div className="w-calc-row">
          <EarnCard gpu="RTX 3060 Ti" tok="100-140" sarHr="14-22" monthly="820-1,280" />
          <EarnCard gpu="RTX 4080" tok="180-230" sarHr="28-42" monthly="1,620-2,420" hot />
          <EarnCard gpu="RTX 4090" tok="220-270" sarHr="38-55" monthly="2,200-3,100" />
          <EarnCard gpu="M3 Max 64 GB" tok="140-190" sarHr="22-34" monthly="1,280-1,940" />
        </div>
      </div>
      <StepFoot right={<button className="btn primary lg" onClick={next}>Begin setup →</button>} />
    </Step>
  );
}

function EarnCard({ gpu, tok, sarHr, monthly, hot }) {
  return (
    <div className={`earn-card ${hot ? "hot" : ""}`}>
      <div className="earn-gpu">{gpu}</div>
      <div className="earn-row"><span>Throughput</span><b>{tok} tok/s</b></div>
      <div className="earn-row"><span>Peak rate</span><b>SAR {sarHr}/hr</b></div>
      <div className="earn-row big"><span>Est. monthly</span><b>SAR {monthly}</b></div>
    </div>
  );
}

/* ═══ STEP 2 — DETECT ═════════════════════════════════════ */
function StepDetect({ data, patch, next, back }) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(!!data.gpu);

  const runScan = () => {
    setScanning(true);
    setTimeout(() => {
      patch({
        gpu: { model: "NVIDIA RTX 4090", vram: 24, driver: "550.90.07", cuda: "12.4", engine: "Ollama 0.1.45", platform: "Linux · Ubuntu 22.04" },
        os: "linux",
      });
      setScanning(false); setScanned(true);
    }, 2200);
  };

  return (
    <Step n={2} title="Detect your GPU." subtitle="The installer does this on your machine. We'll simulate it here so you can see what passes.">
      <div className="detect-grid">
        <div className="detect-left">
          <div className="detect-card">
            <div className="setup-eb">Scan simulation</div>
            <div className="detect-canvas">
              {!scanned && !scanning && (
                <div className="detect-empty">
                  <div className="detect-ring"><span></span><span></span><span></span></div>
                  <div className="detect-empty-msg">Ready to scan.</div>
                  <button className="btn primary" onClick={runScan}>Start scan</button>
                </div>
              )}
              {scanning && (
                <div className="detect-scan">
                  <div className="detect-radar"><span></span><span></span><span></span><span></span></div>
                  <div className="detect-scan-msg">Scanning PCI bus…</div>
                  <div className="detect-scan-log">
                    <div>→ Probing /dev/nvidia*</div>
                    <div>→ Reading VBIOS</div>
                    <div>→ Querying CUDA runtime</div>
                    <div className="muted">→ Checking containerd…</div>
                  </div>
                </div>
              )}
              {scanned && !scanning && <DetectFound gpu={data.gpu} />}
            </div>
          </div>
        </div>
        <div className="detect-right">
          <div className="setup-eb">Minimum requirements</div>
          <dl className="req-list">
            <dt>GPU</dt><dd>NVIDIA with 8 GB+ VRAM, <em>or</em> Apple Silicon M1–M4</dd>
            <dt>OS</dt><dd>Ubuntu 20.04+ · Windows 10/11 · macOS 12+</dd>
            <dt>Disk</dt><dd>40 GB free (models cached locally)</dd>
            <dt>Network</dt><dd>25 Mbps up · stable · no carrier-grade NAT</dd>
            <dt>Docker</dt><dd>20.10+ with NVIDIA Container Toolkit (Linux/Win)</dd>
          </dl>
          <div className="req-foot">Don't meet one of these? <a href="mailto:support@dcp.sa">Talk to us</a> — exceptions happen.</div>
        </div>
      </div>
      <StepFoot
        left={<button className="btn ghost" onClick={back}>← Back</button>}
        right={<button className={`btn primary ${!scanned ? "disabled" : ""}`} disabled={!scanned} onClick={next}>Continue →</button>}
      />
    </Step>
  );
}

function DetectFound({ gpu }) {
  return (
    <div className="detect-found">
      <div className="df-hd">
        <div className="df-ok">✓ Detected</div>
        <div className="df-model">{gpu.model}</div>
      </div>
      <div className="df-grid">
        <div><span>VRAM</span><b>{gpu.vram} GB</b></div>
        <div><span>Driver</span><b>{gpu.driver}</b></div>
        <div><span>CUDA</span><b>{gpu.cuda}</b></div>
        <div><span>Engine</span><b>{gpu.engine}</b></div>
        <div className="df-full"><span>Platform</span><b>{gpu.platform}</b></div>
      </div>
      <div className="df-eligible">
        <div className="df-eligible-k">Eligible for</div>
        <div className="df-tags">
          <span className="df-tag">ALLaM-7B</span>
          <span className="df-tag">JAIS-13B</span>
          <span className="df-tag">Falcon-H1</span>
          <span className="df-tag">BGE-M3</span>
          <span className="df-tag">Llama-3-8B</span>
          <span className="df-tag">SDXL</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ STEP 3 — DOWNLOAD ═══════════════════════════════════ */
function StepDownload({ data, patch, next, back }) {
  const options = [
    { key: "win",   os: "Windows",  sub: "10 / 11 · RTX GPUs",    size: "4.1 MB", cmd: "dcp-provider-setup.exe" },
    { key: "mac",   os: "macOS",    sub: "Apple Silicon · MLX",   size: "3.8 MB", cmd: "curl -sSL https://api.dcp.sa/install | bash -s -- YOUR_KEY" },
    { key: "linux", os: "Linux",    sub: "Ubuntu · NVIDIA · Ollama", size: "4.2 MB", cmd: "curl -sSL https://api.dcp.sa/install | bash -s -- YOUR_KEY" },
  ];
  const os = data.os || "linux";
  const selected = options.find(o => o.key === os);

  return (
    <Step n={3} title="Download the daemon." subtitle="4 MB. No Electron bloat. It will detect the GPU it just ran a scan on.">
      <div className="dl-pills">
        {options.map(o => (
          <button key={o.key} className={`dl-pill ${os === o.key ? "on" : ""}`} onClick={() => patch({ os: o.key })}>
            <div className="dl-pill-os">{o.os}</div>
            <div className="dl-pill-sub">{o.sub}</div>
            <div className="dl-pill-size">{o.size}</div>
          </button>
        ))}
      </div>

      <div className="dl-panel">
        <div className="dl-panel-hd">
          <div className="setup-eb">Install · {selected.os}</div>
          <div className="dl-hash">sha256 a1b9…c42f · signed DCP Platform Co.</div>
        </div>

        {os === "win" ? (
          <div className="dl-win">
            <button className="btn primary lg magnet">Download {selected.cmd}</button>
            <div className="dl-note">Double-click to launch. First run requests admin for NVIDIA runtime setup.</div>
          </div>
        ) : (
          <div className="dl-unix">
            <div className="dl-code">
              <div className="dl-code-lbl">Paste into terminal</div>
              <pre><code>{selected.cmd}</code></pre>
            </div>
            <div className="dl-note">YOUR_KEY is generated after pairing in Step 4. The installer is idempotent — safe to re-run.</div>
          </div>
        )}

        <div className="dl-phases">
          <div className="phase"><b>·01</b> Verify signature</div>
          <div className="phase"><b>·02</b> Install inference engine ({os === "mac" ? "MLX" : "Ollama"})</div>
          <div className="phase"><b>·03</b> Download ALLaM-7B (≈ 4.2 GB)</div>
          <div className="phase"><b>·04</b> Open Cloudflare Tunnel</div>
          <div className="phase"><b>·05</b> Register rig · wait for pairing</div>
        </div>
      </div>

      <StepFoot
        left={<button className="btn ghost" onClick={back}>← Back</button>}
        right={<button className="btn primary" onClick={next}>I've installed it →</button>}
      />
    </Step>
  );
}

/* ═══ STEP 4 — PAIR ═══════════════════════════════════════ */
function StepPair({ data, patch, next, back }) {
  const [status, setStatus] = useState("waiting"); // waiting | first | healthy
  const [log, setLog] = useState([
    "[t+0.0s] Waiting for first heartbeat from daemon…",
  ]);
  useEffect(() => {
    const t1 = setTimeout(() => {
      setLog(l => [...l, "[t+2.1s] TLS handshake OK (rig → api.dcp.sa)"]);
    }, 1400);
    const t2 = setTimeout(() => {
      setLog(l => [...l, "[t+2.9s] Device fingerprint accepted", "[t+3.0s] First heartbeat received · pairing to wallet…"]);
      setStatus("first");
    }, 2600);
    const t3 = setTimeout(() => {
      setLog(l => [...l, "[t+4.4s] Wallet bound · allam-7b served · status=healthy"]);
      setStatus("healthy");
      patch({ paired: true });
    }, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Step n={4} title="Pair your rig." subtitle="Your daemon is calling home. When it lands we pair the rig to your wallet.">
      <div className="pair-grid">
        <div className="pair-card">
          <div className="pair-stage">
            <div className="pair-rig">
              <div className="pair-box">
                <div className="pair-box-lbl">your rig</div>
                <div className="pair-box-gpu">{data.gpu?.model || "GPU"}</div>
                <div className="pair-box-ip">192.168.1.84</div>
              </div>
              <div className="pair-wire">
                <div className={`pair-pkt ${status !== "waiting" ? "on" : ""}`}></div>
                <div className={`pair-pkt d2 ${status !== "waiting" ? "on" : ""}`}></div>
                <div className={`pair-pkt d3 ${status === "healthy" ? "on" : ""}`}></div>
                <div className="pair-wire-lbl">cloudflared · TLS 1.3</div>
              </div>
              <div className={`pair-box api ${status === "healthy" ? "healthy" : ""}`}>
                <div className="pair-box-lbl">api.dcp.sa</div>
                <div className="pair-box-gpu">Riyadh · Edge-01</div>
                <div className={`pair-pulse ${status === "healthy" ? "on" : ""}`}>●</div>
              </div>
            </div>
            <div className="pair-state">
              <div className={`pair-chip ${status === "waiting" ? "on" : ""}`}>01 · Waiting</div>
              <div className={`pair-chip ${status === "first" ? "on" : ""}`}>02 · First heartbeat</div>
              <div className={`pair-chip ${status === "healthy" ? "on" : ""}`}>03 · Healthy</div>
            </div>
          </div>
          <div className="pair-log">
            {log.map((l, i) => <div key={i} className="pair-log-l">{l}</div>)}
          </div>
        </div>

        <div className="pair-side">
          <div className="setup-eb">While you wait</div>
          <h3 className="pair-side-h">Pick a handle for this rig.</h3>
          <p className="pair-side-d">Shows up in your dashboard and in renter-visible marketplace listings if you allow public browsing.</p>
          <input className="pair-input" type="text" placeholder="e.g. riyadh-studio-01" defaultValue="riyadh-studio-01" />

          <div className="pair-divider" />

          <div className="setup-eb">Safety</div>
          <ul className="pair-safety">
            <li><b>Container isolation</b> — every job runs in an approved Docker image with GPU passthrough. Never bare-metal.</li>
            <li><b>No home IP leak</b> — Cloudflare Tunnel terminates at the edge; your IP is never exposed.</li>
            <li><b>Kill switch</b> — pause from the tray menu. Current job finishes; nothing new routes to you.</li>
          </ul>
        </div>
      </div>
      <StepFoot
        left={<button className="btn ghost" onClick={back}>← Back</button>}
        right={<button className={`btn primary ${status !== "healthy" ? "disabled" : ""}`} disabled={status !== "healthy"} onClick={next}>Continue →</button>}
        status={status === "healthy" ? <>✓ Rig paired · <b>healthy</b></> : status === "first" ? <>→ First heartbeat received</> : <>… Waiting for daemon</>}
      />
    </Step>
  );
}

/* ═══ STEP 5 — RATE ═══════════════════════════════════════ */
function StepRate({ data, patch, next, back }) {
  const { rate, hoursOn, autoAccept, payoutMode } = data;
  const floor = 22, ceil = 62;
  const market = 41;
  const pct = (v, lo, hi) => ((v - lo) / (hi - lo)) * 100;
  const band = rate < market - 4 ? "under" : rate > market + 8 ? "over" : "in";
  const daily = Math.round(rate * (hoursOn * 0.72)); // rough fill assumption
  const monthly = Math.round(daily * 28);

  return (
    <Step n={5} title="Set your rate." subtitle="Rate, hours, payout mode. Change anytime from the dashboard.">
      <div className="rate-grid">
        <div className="rate-main">
          <div className="rate-hd">
            <div className="setup-eb">Your rate · SAR per hour</div>
            <div className="rate-now">SAR <b>{rate}</b><span>/hr</span></div>
            <div className={`rate-band ${band}`}>
              {band === "under" && "Below market — expect constant fill"}
              {band === "in" && "Market rate — healthy fill"}
              {band === "over" && "Above market — selective fill"}
            </div>
          </div>

          <div className="rate-slider">
            <div className="rate-scale">
              <div className="rate-range">
                <div className="rate-market" style={{ left: pct(market, floor, ceil) + "%" }}><span>market · {market}</span></div>
                <div className="rate-thumb" style={{ left: pct(rate, floor, ceil) + "%" }} />
                <div className="rate-fill" style={{ width: pct(rate, floor, ceil) + "%" }} />
              </div>
              <input type="range" min={floor} max={ceil} value={rate} onChange={e => patch({ rate: +e.target.value })} />
              <div className="rate-ticks">
                <span>SAR {floor}</span><span>SAR {market}</span><span>SAR {ceil}</span>
              </div>
            </div>
          </div>

          <div className="rate-hours">
            <div className="setup-eb">Hours online per day</div>
            <div className="hours-seg">
              {[8, 16, 24].map(h => (
                <button key={h} className={`hours-opt ${hoursOn === h ? "on" : ""}`} onClick={() => patch({ hoursOn: h })}>
                  <div className="hours-n">{h}<i>/24</i></div>
                  <div className="hours-l">
                    {h === 8 && "Evenings only"}
                    {h === 16 && "Off at night"}
                    {h === 24 && "Always on"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rate-auto">
            <label className="switch">
              <input type="checkbox" checked={autoAccept} onChange={e => patch({ autoAccept: e.target.checked })} />
              <span className="sw"></span>
              <div>
                <div className="switch-t">Auto-accept compatible jobs</div>
                <div className="switch-s">Queue fills automatically within capacity. Turn off to review each job — lower fill rate.</div>
              </div>
            </label>
          </div>
        </div>

        <div className="rate-side">
          <div className="setup-eb">Indicative earnings</div>
          <div className="forecast">
            <div className="fcast-row"><span>Per hour</span><b>SAR {rate}</b></div>
            <div className="fcast-row"><span>Per day · {hoursOn}h</span><b>SAR {daily}</b></div>
            <div className="fcast-row big"><span>Per month · est.</span><b>SAR {monthly.toLocaleString()}</b></div>
            <div className="fcast-note">Estimate assumes 72% fill at current rate. Actuals depend on demand. Provider share is 75% of gross.</div>
          </div>

          <div className="rate-divider" />

          <div className="setup-eb">Payout mode</div>
          <div className="payout">
            <button className={`payout-opt ${payoutMode === "sar" ? "on" : ""}`} onClick={() => patch({ payoutMode: "sar" })}>
              <div className="po-k">SAR</div>
              <div className="po-t">Saudi Riyal</div>
              <div className="po-d">Moyasar to local IBAN. Weekly. No FX.</div>
            </button>
            <button className={`payout-opt ${payoutMode === "usdc" ? "on" : ""}`} onClick={() => patch({ payoutMode: "usdc" })}>
              <div className="po-k">USDC</div>
              <div className="po-t">On-chain escrow</div>
              <div className="po-d">Base L2 · claim on demand · 75/25 split via EIP-712.</div>
            </button>
          </div>
        </div>
      </div>
      <StepFoot
        left={<button className="btn ghost" onClick={back}>← Back</button>}
        right={<button className="btn primary" onClick={next}>Go live →</button>}
      />
    </Step>
  );
}

/* ═══ STEP 6 — GO LIVE ════════════════════════════════════ */
function StepGoLive({ data, back }) {
  const [queued, setQueued] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setQueued(q => (q < 3 ? q + 1 : q)), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <Step n={6} title="You're live." subtitle="Rig paired, rate set, the routing engine sees you. First job within about 30 seconds.">
      <div className="live-grid">
        <div className="live-main">
          <div className="live-hero">
            <div className="live-hero-eb">Status</div>
            <div className="live-hero-t">Earning.</div>
            <div className="live-hero-s">Bronze tier · visible to all routed renters</div>
            <div className="live-dots">
              <span className="d on" /><span className="d on" /><span className="d on" /><span className="d" /><span className="d" />
              <div className="live-dots-l">Tier progress · Bronze → Silver at 50 completed jobs</div>
            </div>
          </div>

          <div className="live-feed">
            <div className="live-feed-hd">
              <div className="setup-eb">Incoming job feed · live</div>
              <div className="live-feed-ct">{queued} queued</div>
            </div>
            <div className="live-feed-list">
              <LiveRow t="t+00:03" kind="heartbeat" detail="daemon healthy · 47°C · 14% util" tone="ok" />
              <LiveRow t="t+00:07" kind="match" detail="candidate: ALLaM-7B · renter r_0xA34 · 128 tok" tone="mut" show={queued >= 1} />
              <LiveRow t="t+00:09" kind="accepted" detail="job j_ac81 started · est. 42 s · SAR 0.38 hold" tone="hot" show={queued >= 2} />
              <LiveRow t="t+00:22" kind="settled" detail="j_ac81 complete · 38 s actual · SAR 0.34 credited · hold returned" tone="ok" show={queued >= 3} />
            </div>
          </div>
        </div>

        <div className="live-side">
          <div className="setup-eb">Your setup · summary</div>
          <div className="sum">
            <div className="sum-row"><span>GPU</span><b>{data.gpu?.model}</b></div>
            <div className="sum-row"><span>Engine</span><b>{data.gpu?.engine}</b></div>
            <div className="sum-row"><span>Rate</span><b>SAR {data.rate}/hr</b></div>
            <div className="sum-row"><span>Hours online</span><b>{data.hoursOn}h / day</b></div>
            <div className="sum-row"><span>Auto-accept</span><b>{data.autoAccept ? "on" : "off"}</b></div>
            <div className="sum-row"><span>Payout</span><b>{data.payoutMode.toUpperCase()}</b></div>
          </div>

          <div className="rate-divider" />

          <div className="setup-eb">Next</div>
          <ul className="next-list">
            <li><a href="Provider Dashboard.html"><b>→ Open dashboard</b> · live earnings, temp, queue depth</a></li>
            <li><a href="Provider Earnings.html">→ Earnings page · withdraw, tier, invoices</a></li>
            <li><a href="../Docs v2.html">→ Provider guide · fine-tuning jobs, custom images</a></li>
            <li><a href="mailto:support@dcp.sa">→ Something off? Email support</a></li>
          </ul>
        </div>
      </div>
      <StepFoot left={<button className="btn ghost" onClick={back}>← Back</button>}
                right={<a className="btn primary lg magnet" href="Provider Dashboard.html">Open dashboard →</a>} />
    </Step>
  );
}

function LiveRow({ t, kind, detail, tone = "mut", show = true }) {
  return (
    <div className={`live-row ${tone} ${show ? "in" : "hide"}`}>
      <div className="live-row-t">{t}</div>
      <div className={`live-row-k ${tone}`}>{kind}</div>
      <div className="live-row-d">{detail}</div>
    </div>
  );
}

/* ═══ SHARED STEP FRAME ═══════════════════════════════════ */
function Step({ n, title, subtitle, children }) {
  return (
    <section className="step" data-step={n}>
      <div className="step-hd">
        <div className="step-n">{String(n).padStart(2, "0")}</div>
        <div>
          <h2 className="step-t">{title}</h2>
          <div className="step-s">{subtitle}</div>
        </div>
      </div>
      <div className="step-body">{children}</div>
    </section>
  );
}
function StepFoot({ left, right, status }) {
  return (
    <div className="step-foot">
      <div className="sf-left">{left}</div>
      <div className="sf-status">{status}</div>
      <div className="sf-right">{right}</div>
    </div>
  );
}

function SetupFoot() {
  return (
    <footer className="setup-footer">
      <div>DCP · /setup · v1</div>
      <div>Every byte of your workload stays in the Kingdom.</div>
      <div><a href="../Docs v2.html">Provider docs</a> · <a href="mailto:support@dcp.sa">support@dcp.sa</a></div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Setup />);
