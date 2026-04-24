/* eslint-disable */
/* About — manifesto, timeline, team, investors */

const {
  LangCtx, useLang, MagneticButton, Reveal, Badge, Callout, SectionMeta,
  Eyebrow, Breadcrumb,
  Arrow,
  fmt, fmtInt,
  PageShell,
} = window;

const A = window.DCP_PUBLIC.about;

function Hero() {
  return (
    <section className="ab-hero">
      <div className="wrap">
        <Breadcrumb items={[{label:"DCP", href:"../DCP Redesign.html"},{label:"About"}]} />
        <Eyebrow style={{marginTop:40, display:"block"}}>§ about · who we are</Eyebrow>
        <h1>
          GPU rented<br/>
          by the hour,<br/>
          <em>billed in riyals.</em>
        </h1>
        <div className="manifesto">
          <p>
            DCP started with an argument. A research team in Riyadh needed 8 H100s for three days to finetune an Arabic model; the only way to get them was a 14-month enterprise contract with a US hyperscaler, billed in USD to a Delaware entity, with data egressing through Frankfurt.
          </p>
          <p>
            We thought this was <strong>absurd</strong>. A GPU marketplace priced in SAR, residency in-Kingdom, payout to Saudi IBANs, should not require a venture round to exist. It required a weekend, a group of friends, and a working knowledge of Cloudflare Tunnel.
          </p>
          <p>
            Three years later we are 42 providers, 346 GPUs live, 18 million SAR processed, and — according to the SAMA compliance officer who audited us last month — somehow still fully legal.
          </p>
        </div>

        <div className="nums">
          {A.numbers.map(n => (
            <div key={n.k} className="n">
              <div className="k">{n.k}</div>
              <div className="v">{n.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Timeline() {
  return (
    <section style={{padding:"120px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap" style={{maxWidth:1120}}>
        <SectionMeta idx="§01" label="TIMELINE" right="FOUR YEARS · FOUR MOMENTS" />
        <h2 className="st" style={{marginTop:12, marginBottom:48}}>How we got here.</h2>
        {A.story.map(s => (
          <Reveal key={s.year}><div className="tl">
            <div className="y">{s.year}</div>
            <div className="body">
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          </div></Reveal>
        ))}
      </div>
    </section>
  );
}

function Quote() {
  return (
    <section className="bigq">
      <div className="wrap">
        <blockquote>
          "We price GPU compute the same way Uber prices a ride.<br/>
          By the <em>minute</em>, in the <em>local currency</em>, to whoever <em>needs it</em>."
        </blockquote>
        <div className="cite">— Faisal Al-Qahtani · CEO · interview, Asharq Business, Feb 2026</div>
      </div>
    </section>
  );
}

function Team() {
  const initials = n => n.split(" ").filter(Boolean).slice(0,2).map(w => w[0]).join("");
  return (
    <section style={{padding:"120px 0"}}>
      <div className="wrap">
        <SectionMeta idx="§02" label="TEAM" right="FOUNDERS + LEADS" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>The people running it.</h2>
        <p style={{color:"var(--ink-2)", fontSize:17, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          We hire engineers who've shipped infra that's had the ASDF logo on its dashboard at least once. Everyone below has.
        </p>
        <div className="team-grid">
          {A.team.map(m => (
            <div key={m.name} className="card">
              <div className="avatar">{initials(m.name)}</div>
              <div className="name">{m.name}</div>
              <div className="role">{m.role}</div>
              <div className="bio">{m.bio}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Investors() {
  return (
    <section style={{padding:"110px 0", borderTop:"1px solid var(--hair)"}}>
      <div className="wrap">
        <SectionMeta idx="§03" label="INVESTORS" right="SERIES A · SAR 42M · JANUARY 2026" />
        <h2 className="st" style={{marginTop:12, marginBottom:8}}>Our backers.</h2>
        <p style={{color:"var(--ink-2)", fontSize:17, lineHeight:1.55, maxWidth:"62ch", margin:0}}>
          We chose Saudi-led capital on purpose. The market is here, the customers are here, the board should be here.
        </p>
        <div className="inv">
          {A.investors.map(i => (<div key={i} className="i">{i}</div>))}
        </div>
      </div>
    </section>
  );
}

function EndCTA() {
  return (
    <section className="end-cta">
      <div className="wrap" style={{textAlign:"center"}}>
        <div className="big">We'd rather show, not tell.</div>
        <p className="ss" style={{margin:"32px auto 40px", maxWidth:"52ch"}}>
          Spin up an account. Free tier gives you 100K tokens. No credit card, no call from sales.
        </p>
        <div className="ctas">
          <MagneticButton><a className="btn primary lg" href="#">Get an API key</a></MagneticButton>
          <a className="btn ghost lg" href="./Contact.html">Talk to us</a>
        </div>
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <PageShell active="about">
      <Hero />
      <Timeline />
      <Quote />
      <Team />
      <Investors />
      <EndCTA />
    </PageShell>
  );
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<AboutPage />);
