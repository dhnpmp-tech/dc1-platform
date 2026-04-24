/* eslint-disable */
/* Auth — 4 variants on a canvas: Signup / Login / OTP / Forgot */

const {
  useState, useEffect, useRef,
  MagneticButton, Badge, Callout,
  Arrow, Check, Shield, Lock, Key, External,
} = window;

/* Shared chrome inside an artboard */
function AuthShell({ children, page }) {
  return (
    <div className="auth-board">
      <div className="auth-top">
        <div className="brand-mark">DCP</div>
        <div style={{display:"flex", alignItems:"center", gap:20}}>
          <span>§ {page}</span>
          <span className="lang"><span className="on">EN</span><span>·</span><span>ع</span></span>
        </div>
      </div>
      <div className="auth-wrap">
        <div className="auth-card">{children}</div>
      </div>
      <div className="auth-foot">
        <span>§ DCP · RIYADH</span>
        <span>SAMA · WATHQ · NAFATH</span>
      </div>
    </div>
  );
}

/* ═══ SIGNUP ═══════════════════════════════════════════════ */

function Signup() {
  return (
    <AuthShell page="SIGNUP · 01 / 03">
      <div className="auth-eyebrow">§ NEW ACCOUNT</div>
      <h1>Start in <em>thirty seconds.</em></h1>
      <p className="blurb">
        Free tier includes 100,000 tokens and 5 GPU-hours. No credit card. No sales call. Nafath finishes KYC in one tap.
      </p>

      <button className="sso-btn nafath">Continue with Nafath · نفاذ</button>

      <div className="auth-divider">OR WITH EMAIL</div>

      <div className="field-group">
        <div className="fg-stack">
          <div><label className="fg-label">First name</label><input className="input" placeholder="Faisal" /></div>
          <div><label className="fg-label">Last name</label><input className="input" placeholder="Al-Qahtani" /></div>
        </div>
        <div><label className="fg-label">Work email</label><input className="input" type="email" placeholder="you@company.sa" /></div>
        <div><label className="fg-label">Password</label><input className="input" type="password" placeholder="At least 10 characters" /></div>
      </div>

      <MagneticButton><button className="btn primary block">Create account <Arrow size={14}/></button></MagneticButton>

      <div className="sig-benefits">
        <div className="b"><span className="mk">✓</span><span>100K tokens + 5 GPU-hours, free forever</span></div>
        <div className="b"><span className="mk">✓</span><span>Data residency in KSA · no egress to US or EU</span></div>
        <div className="b"><span className="mk">✓</span><span>SAR billing · Mada + STC Pay supported</span></div>
      </div>

      <div className="tos">
        By creating an account you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>. We're a SAMA-licensed payment processor.
      </div>

      <div className="alt-link">
        Already have an account? <a href="#">Sign in →</a>
      </div>
    </AuthShell>
  );
}

/* ═══ LOGIN ═══════════════════════════════════════════════ */

function Login() {
  return (
    <AuthShell page="SIGN IN">
      <div className="auth-eyebrow">§ WELCOME BACK</div>
      <h1>Sign in to <em>your</em> org.</h1>
      <p className="blurb">Use Nafath for the fastest sign-in, or email + password. We'll send a one-time code if MFA is on.</p>

      <button className="sso-btn nafath">Continue with Nafath · نفاذ</button>
      <div className="sso-row" style={{marginTop:10}}>
        <button className="sso-btn">Google</button>
        <button className="sso-btn">Microsoft</button>
      </div>

      <div className="auth-divider">OR EMAIL</div>

      <div className="field-group">
        <div><label className="fg-label">Email</label><input className="input" placeholder="you@company.sa" /></div>
        <div><label className="fg-label">Password</label><input className="input" type="password" placeholder="••••••••••" /></div>
      </div>

      <div className="remember-row">
        <label className="chk"><input type="checkbox" defaultChecked/> REMEMBER THIS DEVICE · 30D</label>
        <a href="#">FORGOT?</a>
      </div>

      <MagneticButton><button className="btn primary block">Sign in <Arrow size={14}/></button></MagneticButton>

      <div className="alt-link">
        New here? <a href="#">Create an account →</a>
      </div>
    </AuthShell>
  );
}

/* ═══ OTP ═══════════════════════════════════════════════ */

function OTP() {
  const [code, setCode] = useState(["3","7","2","","",""]);
  const [sec, setSec] = useState(42);
  useEffect(() => { const id = setInterval(()=>setSec(s=>s>0?s-1:0), 1000); return () => clearInterval(id); }, []);

  return (
    <AuthShell page="VERIFY · OTP">
      <div className="otp-shell">
        <div className="auth-eyebrow">§ MFA · STEP 2 / 2</div>
        <h1 style={{marginBottom:8}}>Check <em>your phone.</em></h1>
        <p className="blurb" style={{margin:"0 auto 0", maxWidth:"38ch"}}>
          We sent a 6-digit code by SMS. It's good for 10 minutes.
        </p>

        <div className="sent-to">SMS · +966 54 •••• 4721</div>

        <div className="otp-boxes">
          {code.map((d,i) => {
            const active = i === 3;
            const filled = !!d;
            return (
              <div key={i} className={"box " + (filled ? "on " : "") + (active ? "active" : "")}>
                {d || (active ? <span className="c">|</span> : "")}
              </div>
            );
          })}
        </div>

        <div className="otp-timer">CODE EXPIRES IN <span className="t">{String(Math.floor(sec/60)).padStart(2,"0")}:{String(sec%60).padStart(2,"0")}</span></div>

        <MagneticButton><button className="btn primary block">Verify & continue <Arrow size={14}/></button></MagneticButton>

        <div className={"otp-resend " + (sec === 0 ? "active" : "")}>
          Didn't get it? {sec === 0
            ? <a href="#">Resend code</a>
            : <span style={{color:"var(--mut)"}}>Resend in {sec}s</span>}
          <span style={{margin:"0 10px"}}>·</span>
          <a href="#">Use another method</a>
        </div>
      </div>
    </AuthShell>
  );
}

/* ═══ FORGOT ═══════════════════════════════════════════════ */

function Forgot() {
  return (
    <AuthShell page="RECOVER · PASSWORD">
      <div className="auth-eyebrow">§ FORGOT PASSWORD</div>
      <h1>Let's <em>get you</em> back in.</h1>
      <p className="blurb">
        Enter the email on your DCP account. We'll send a recovery link. It expires in 30 minutes and can only be used once.
      </p>

      <div className="field-group">
        <div><label className="fg-label">Email on your account</label><input className="input" type="email" placeholder="you@company.sa" /></div>
      </div>

      <MagneticButton><button className="btn primary block">Send recovery link <Arrow size={14}/></button></MagneticButton>

      <div className="forgot-steps">
        <span className="n">§01</span><span className="t">We send a recovery link to your email.</span>
        <span className="n">§02</span><span className="t">You click the link — it opens a reset page.</span>
        <span className="n">§03</span><span className="t">You set a new password. MFA stays enabled.</span>
      </div>

      <Callout tone="info" label="SECURITY NOTE">
        If you don't see the email in 5 minutes, check spam or write to help@dcp.sa. We never ask for your password by email.
      </Callout>

      <div className="alt-link">
        Remembered it? <a href="#">Back to sign-in →</a>
      </div>
    </AuthShell>
  );
}

/* ═══ CANVAS ═══════════════════════════════════════════════ */

function App() {
  return (
    <DesignCanvas>
      <DCSection id="auth" title="Authentication" subtitle="Four variants · shared shell">
        <DCArtboard id="signup" label="A · Signup"        width={640} height={860}><Signup /></DCArtboard>
        <DCArtboard id="login"  label="B · Sign in"       width={640} height={860}><Login /></DCArtboard>
        <DCArtboard id="otp"    label="C · Verify · OTP"  width={640} height={860}><OTP /></DCArtboard>
        <DCArtboard id="forgot" label="D · Recover"       width={640} height={860}><Forgot /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);
