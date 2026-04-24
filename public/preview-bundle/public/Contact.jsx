/* eslint-disable */
/* Contact — channels, office, form */

const {
  LangCtx, useLang, MagneticButton, Reveal, Badge, Callout, SectionMeta,
  Eyebrow, Breadcrumb,
  Arrow, Copy, Check,
  PageShell,
} = window;

const C = window.DCP_PUBLIC.contact;

function Hero() {
  return (
    <section className="c-hero">
      <div className="wrap">
        <Breadcrumb items={[{label:"DCP", href:"../DCP Redesign.html"},{label:"Contact"}]} />
        <Eyebrow style={{marginTop:32, display:"block"}}>§ contact · talk to a person</Eyebrow>
        <h1>Pick a <em>channel.</em><br/>We answer within a <em>day.</em></h1>
      </div>
    </section>
  );
}

function CopyLink({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className={"copy-btn " + (copied ? "copied" : "")}
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(()=>setCopied(false), 1500); }}>
      {copied ? <>✓ COPIED</> : <>⧉ COPY</>}
    </button>
  );
}

function Split() {
  const [reason, setReason] = useState("sales");
  const [size, setSize]     = useState("startup");
  const [sent, setSent]     = useState(false);

  const reasons = [
    { id:"sales",    label:"Sales · pricing" },
    { id:"support",  label:"Support · incident" },
    { id:"partner",  label:"Partnership · DC" },
    { id:"press",    label:"Press · analyst" },
    { id:"other",    label:"Other" },
  ];
  const sizes = [
    { id:"solo",      label:"Just me" },
    { id:"startup",   label:"Startup · <20" },
    { id:"midmarket", label:"Mid · 20–500" },
    { id:"enterprise",label:"Enterprise · 500+" },
  ];

  return (
    <section className="c-split">
      <div className="left">
        <div className="eyebrow">§01 · CHANNELS</div>
        <h2>Direct lines.</h2>
        <div className="ch-list">
          {C.channels.map(c => (
            <div key={c.k} className="ch">
              <div className="k">{c.k}</div>
              <div>
                <a className="v" href={"mailto:" + c.v}>{c.v}</a>
                <div className="sub">{c.sub}</div>
              </div>
              <CopyLink value={c.v} />
            </div>
          ))}
        </div>

        <div className="office">
          <div className="oh">§ HQ · RIYADH</div>
          <div className="name">{C.office.name}</div>
          <p className="addr">
            {C.office.street}<br/>
            {C.office.city}
          </p>
          <div className="meta">
            <span>{C.office.cr}</span>
            <span>{C.office.vat}</span>
          </div>
        </div>
      </div>

      <div className="right">
        <div className="eyebrow">§02 · WRITE US</div>
        <h2>Or just leave a note.</h2>

        {sent ? (
          <div className="success">
            <div className="k">▸ SENT</div>
            <h3>Message received.</h3>
            <p>A real human on our team has it in their inbox. Expect a reply within one business day (Sun–Thu, Riyadh time).</p>
            <p style={{marginTop:24}}>
              <button className="btn" onClick={() => setSent(false)}>Send another <Arrow size={12}/></button>
            </p>
          </div>
        ) : (
          <form className="c-form" onSubmit={e => { e.preventDefault(); setSent(true); window.scrollTo({top:0, behavior:"smooth"}); }}>
            <div>
              <label>Full name</label>
              <input className="input" placeholder="Faisal Al-Qahtani" required/>
            </div>
            <div>
              <label>Work email</label>
              <input className="input" type="email" placeholder="faisal@company.sa" required/>
            </div>
            <div>
              <label>Company</label>
              <input className="input" placeholder="Company name"/>
            </div>
            <div>
              <label>Phone · optional</label>
              <input className="input" placeholder="+966 50 000 0000"/>
            </div>

            <div className="f-full">
              <label>Reason</label>
              <div className="pick">
                {reasons.map(r => (
                  <button key={r.id} type="button" className={reason===r.id?"on":""} onClick={()=>setReason(r.id)}>{r.label}</button>
                ))}
              </div>
            </div>

            <div className="f-full">
              <label>Company size</label>
              <div className="pick">
                {sizes.map(s => (
                  <button key={s.id} type="button" className={size===s.id?"on":""} onClick={()=>setSize(s.id)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="f-full">
              <label>Tell us what you need</label>
              <textarea className="input" placeholder="We're building a customer support product for Saudi merchants, and we need 40k requests/day of Arabic chat inference with under 40ms p95. Can we schedule a call?" required/>
              <div className="note" style={{marginTop:8}}>The more specific you are, the better the reply.</div>
            </div>

            <div className="submit-row">
              <div className="priv">By sending this you agree to our Privacy Policy. We don't add you to any list; we only reply to you.</div>
              <MagneticButton><button className="btn primary lg" type="submit">Send message <Arrow size={14}/></button></MagneticButton>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function Offices() {
  const offices = [
    { code:"RUH", city:"Riyadh · HQ", addr:"Olaya Towers, Tower B · 12th floor\nKing Fahd Road, Olaya\nRiyadh 12333", hours:"SUN–THU · 09:00–18:00 AST" },
    { code:"JED", city:"Jeddah",      addr:"Al Shatea District\nKing Abdulaziz Road\nJeddah 23413",                    hours:"SUN–THU · 10:00–18:00 AST" },
    { code:"DMM", city:"Dammam",      addr:"Aramco Innovation Hub\nDhahran Techno Valley\nDhahran 34464",              hours:"BY APPOINTMENT" },
  ];
  return (
    <section>
      <div className="wrap">
        <div className="offices">
          {offices.map(o => (
            <div key={o.code} className="o">
              <div className="code">§ {o.code}</div>
              <div className="city">{o.city}</div>
              <div className="addr">
                {o.addr.split("\n").map((l,i) => <div key={i}>{l}</div>)}
              </div>
              <div className="hours">{o.hours}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactPage() {
  return (
    <PageShell active="contact">
      <Hero />
      <Split />
      <Offices />
    </PageShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<ContactPage />);
