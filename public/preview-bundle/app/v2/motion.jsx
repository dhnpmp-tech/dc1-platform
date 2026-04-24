// Motion primitives — scroll reveal, number roll, magnetic hover, hero canvas.
// All respect prefers-reduced-motion.

const reducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ─── useReveal: fade+rise when element enters viewport ─── */
function useReveal(delay = 0) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion) { el.style.opacity = 1; el.style.transform = "none"; return; }
    el.style.opacity = 0;
    el.style.transform = "translateY(18px)";
    el.style.transition = `opacity .9s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .9s cubic-bezier(.2,.7,.2,1) ${delay}ms`;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        el.style.opacity = 1;
        el.style.transform = "none";
        io.unobserve(el);
      }
    }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}

function Reveal({ delay = 0, as = "div", children, ...rest }) {
  const ref = useReveal(delay);
  return React.createElement(as, { ref, ...rest }, children);
}

/* ─── useCountUp: rolls a number when scrolled into view ─── */
function useCountUp(target, { duration = 1400, decimals = 0, start = 0 } = {}) {
  const [val, setVal] = React.useState(start);
  const ref = React.useRef(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion) { setVal(target); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        const t0 = performance.now();
        const from = 0;
        function step(t) {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setVal(from + (target - from) * eased);
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [target, duration]);

  return [val, ref];
}

/* ─── MagneticButton: subtle pull toward cursor ─── */
function MagneticButton({ children, strength = 0.22, className = "", ...rest }) {
  const ref = React.useRef(null);
  function onMove(e) {
    if (reducedMotion) return;
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
  }
  function onLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = "";
  }
  return (
    <span className={"magnet " + className} onMouseMove={onMove} onMouseLeave={onLeave} ref={ref} {...rest}>
      {children}
    </span>
  );
}

/* ─── HeroMap: animated Saudi map + node pulses + arcs ─── */
function HeroMap() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w, h;
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
    }
    resize();
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    // Node set — Riyadh central, then Jeddah, Dammam, Tabuk, Abha, NEOM, Madinah
    const nodes = [
      { id: "ruh", x: 0.52, y: 0.54, r: 5.4, label: "RUH", primary: true },
      { id: "jed", x: 0.26, y: 0.62, r: 3.8, label: "JED" },
      { id: "dmm", x: 0.74, y: 0.42, r: 3.4, label: "DMM" },
      { id: "med", x: 0.34, y: 0.48, r: 2.6, label: "MED" },
      { id: "tuu", x: 0.22, y: 0.28, r: 2.4, label: "TUU" },
      { id: "neo", x: 0.12, y: 0.20, r: 2.8, label: "NEOM" },
      { id: "auh", x: 0.38, y: 0.82, r: 2.4, label: "AHB" },
      { id: "hgr", x: 0.82, y: 0.60, r: 2.0, label: "HGR" },
      { id: "yun", x: 0.30, y: 0.38, r: 2.0, label: "YNB" },
      { id: "qsm", x: 0.47, y: 0.38, r: 2.2, label: "QSM" },
    ];
    // Latent graph edges (subtle triangulation from Riyadh)
    const edges = [];
    for (const n of nodes) if (n.id !== "ruh") edges.push(["ruh", n.id]);
    edges.push(["jed", "med"], ["jed", "yun"], ["dmm", "hgr"], ["tuu", "neo"], ["qsm", "ruh"]);

    // Active arcs — "jobs" flowing Riyadh → X
    const arcs = [];
    function spawnArc() {
      const to = nodes[1 + Math.floor(Math.random() * (nodes.length - 1))];
      const from = nodes[0];
      arcs.push({ from, to, t: 0, life: 1600 + Math.random() * 800, hue: Math.random() < 0.55 ? "teal" : "orange" });
      if (arcs.length > 8) arcs.shift();
    }
    let lastSpawn = 0;
    let t0 = performance.now();
    let raf;

    function nx(n) { return n.x * w; }
    function ny(n) { return n.y * h; }

    function frame(t) {
      const dt = t - t0; t0 = t;
      if (t - lastSpawn > 900) { spawnArc(); lastSpawn = t; }
      ctx.clearRect(0, 0, w, h);

      // Latent edges — very faint
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(120, 160, 180, 0.10)";
      for (const [a, b] of edges) {
        const na = nodes.find(n => n.id === a);
        const nb = nodes.find(n => n.id === b);
        ctx.beginPath(); ctx.moveTo(nx(na), ny(na)); ctx.lineTo(nx(nb), ny(nb)); ctx.stroke();
      }

      // Nodes — base + halo
      for (const n of nodes) {
        const x = nx(n), y = ny(n);
        // Halo
        ctx.fillStyle = n.primary ? "rgba(45,212,182,0.16)" : "rgba(200,200,220,0.08)";
        ctx.beginPath(); ctx.arc(x, y, n.r * 3.2, 0, Math.PI * 2); ctx.fill();
        // Ping (primary only, every ~1.8s)
        if (n.primary) {
          const pingT = ((t / 1800) % 1);
          ctx.strokeStyle = `rgba(45,212,182,${(1 - pingT) * 0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, n.r + pingT * 22, 0, Math.PI * 2); ctx.stroke();
        }
        // Core
        ctx.fillStyle = n.primary ? "#2dd4b6" : "#e8e3d6";
        ctx.beginPath(); ctx.arc(x, y, n.r, 0, Math.PI * 2); ctx.fill();
        // Label
        ctx.fillStyle = "rgba(200, 200, 220, 0.55)";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText(n.label, x + n.r + 6, y + 3);
      }

      // Arcs — animated bezier travelers Riyadh → X
      for (let i = arcs.length - 1; i >= 0; i--) {
        const a = arcs[i];
        a.t += dt;
        const p = a.t / a.life;
        if (p >= 1) { arcs.splice(i, 1); continue; }
        const x1 = nx(a.from), y1 = ny(a.from);
        const x2 = nx(a.to), y2 = ny(a.to);
        // Control point lifted upward for curve
        const cx = (x1 + x2) / 2;
        const cy = Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * 0.22;

        // Full curve — faint
        ctx.strokeStyle = a.hue === "teal"
          ? `rgba(45,212,182,${0.18 * (1 - Math.abs(p - 0.5) * 2)})`
          : `rgba(238,122,60,${0.18 * (1 - Math.abs(p - 0.5) * 2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();

        // Traveling dot
        const tp = p;
        const it = (1 - tp);
        const tx = it*it*x1 + 2*it*tp*cx + tp*tp*x2;
        const ty = it*it*y1 + 2*it*tp*cy + tp*tp*y2;
        const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, 12);
        const col = a.hue === "teal" ? "45,212,182" : "238,122,60";
        g.addColorStop(0, `rgba(${col}, 0.95)`);
        g.addColorStop(1, `rgba(${col}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = a.hue === "teal" ? "#2dd4b6" : "#ee7a3c";
        ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI * 2); ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }

    if (!reducedMotion) raf = requestAnimationFrame(frame);
    else {
      // Draw once, static
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        const x = nx(n), y = ny(n);
        ctx.fillStyle = n.primary ? "#2dd4b6" : "#e8e3d6";
        ctx.beginPath(); ctx.arc(x, y, n.r, 0, Math.PI * 2); ctx.fill();
      }
    }

    const onResize = () => { resize(); ctx.scale(dpr, dpr); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return <canvas ref={canvasRef} className="hero-map-canvas" aria-hidden="true"/>;
}

/* ─── Sparkline: tiny canvas sparkline from an array of numbers ─── */
function Sparkline({ values, color = "var(--teal)", height = 28 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = r.width * dpr; el.height = height * dpr;
    el.style.height = height + "px";
    const ctx = el.getContext("2d");
    ctx.scale(dpr, dpr);
    const w = r.width, h = height;
    if (!values || !values.length) return;
    const min = Math.min(...values), max = Math.max(...values);
    const range = Math.max(0.0001, max - min);
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.4;
    const stroke = getComputedStyle(document.documentElement).getPropertyValue("--teal") || "#2dd4b6";
    ctx.strokeStyle = color === "var(--teal)" ? stroke.trim() : color;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Last-point dot
    const lx = w;
    const ly = h - 2 - ((values[values.length-1] - min) / range) * (h - 4);
    ctx.fillStyle = stroke.trim();
    ctx.beginPath(); ctx.arc(lx - 2, ly, 2.2, 0, Math.PI*2); ctx.fill();
  }, [values, color, height]);
  return <canvas ref={ref} className="spark"/>;
}

Object.assign(window, { useReveal, Reveal, useCountUp, MagneticButton, HeroMap, Sparkline, reducedMotion });
