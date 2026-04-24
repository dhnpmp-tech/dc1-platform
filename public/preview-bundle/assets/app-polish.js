/* app-polish.js — premium polish for logged-in surfaces
 * - Preloader (brief brand splash, once per session)
 * - Number-roll on KPI values marked [data-roll]
 * - Magnetic hover on primary CTAs (.btn-prim, [data-magnetic])
 *
 * Deliberately no scroll-reveals — working surfaces must render instantly.
 * Opt-out per element: data-no-polish.
 */

(() => {
  "use strict";

  const SESSION_KEY = "dcp.loaded.v1";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ─────────────────────────────────────────────────────────
     1 · PRELOADER — once per session
     ───────────────────────────────────────────────────────── */
  function mountLoader() {
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;
    if (reduced) { sessionStorage.setItem(SESSION_KEY, "1"); return; }
    const css = document.createElement("style");
    css.textContent = `
      #dcp-loader {
        position: fixed; inset: 0; z-index: 99999;
        background: #0a0b1a; color: #f5f3ee;
        display: grid; place-items: center;
        transition: opacity .45s ease;
      }
      #dcp-loader.out { opacity: 0; pointer-events: none; }
      #dcp-loader .mk {
        width: 44px; height: 44px;
        background: linear-gradient(135deg, #ee7a3c 0%, #b84510 100%);
        margin-bottom: 20px;
        animation: dcpPulse 1.2s ease-in-out infinite;
      }
      @keyframes dcpPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(.92); opacity: .75; }
      }
      #dcp-loader .wm {
        font-family: 'Instrument Serif', serif; font-style: italic;
        font-size: 28px; color: #f5f3ee; letter-spacing: -.01em;
      }
      #dcp-loader .wm em { color: #ee7a3c; font-style: italic; }
      #dcp-loader .bar {
        width: 140px; height: 1px; background: rgba(245,243,238,.14);
        margin-top: 18px; overflow: hidden;
      }
      #dcp-loader .bar span {
        display: block; height: 100%; width: 0;
        background: #ee7a3c;
        animation: dcpDraw .85s ease-out forwards;
      }
      @keyframes dcpDraw { to { width: 100%; } }
      #dcp-loader .tag {
        font-family: 'JetBrains Mono', monospace; font-size: 9.5px;
        letter-spacing: .18em; color: rgba(245,243,238,.55);
        margin-top: 14px; text-transform: uppercase;
      }
    `;
    document.head.appendChild(css);
    const l = document.createElement("div");
    l.id = "dcp-loader";
    l.setAttribute("aria-hidden", "true");
    l.innerHTML = `
      <div style="text-align:center">
        <div class="mk"></div>
        <div class="wm">DCP <em>console</em></div>
        <div class="bar"><span></span></div>
        <div class="tag">§ Riyadh · sovereign</div>
      </div>
    `;
    document.body.appendChild(l);
    setTimeout(() => {
      l.classList.add("out");
      sessionStorage.setItem(SESSION_KEY, "1");
      setTimeout(() => l.remove(), 500);
    }, 850);
  }

  /* ─────────────────────────────────────────────────────────
     2 · NUMBER-ROLL
     Any element with [data-roll="123"] will animate 0 → 123.
     Auto-tagging: numeric KPI values inside .u-kpi .v, .kpi .v,
     .c-kpi .v get auto-rolled the first time they're seen.
     ───────────────────────────────────────────────────────── */
  function parseNum(txt) {
    const m = String(txt).match(/^([\-\u2212]?[\d,\.]+)([KMB]?)$/i);
    if (!m) return null;
    const base = parseFloat(m[1].replace(/,/g, ""));
    if (!isFinite(base)) return null;
    const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || "").toUpperCase()] || 1;
    return { base, mult, raw: txt };
  }

  function formatBack(n, raw) {
    // Preserve comma formatting + suffix from original
    const hasComma = /,/.test(raw);
    const suffix = (raw.match(/[KMB]$/i) || [""])[0];
    if (suffix) {
      const mult = { K: 1e3, M: 1e6, B: 1e9 }[suffix.toUpperCase()];
      const scaled = n / mult;
      return scaled.toFixed(scaled < 10 ? 2 : 1).replace(/\.?0+$/, "") + suffix;
    }
    if (Number.isInteger(n) || n > 100) {
      return hasComma ? Math.round(n).toLocaleString("en-US") : String(Math.round(n));
    }
    return n.toFixed(1);
  }

  function rollEl(el) {
    if (el.dataset.rolled === "1") return;
    const raw = el.textContent.trim();
    const p = parseNum(raw);
    if (!p) return;
    el.dataset.rolled = "1";
    const target = p.base;
    const dur = 800;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = target * eased;
      el.textContent = formatBack(cur, raw);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = raw; // pixel-perfect final
    };
    requestAnimationFrame(step);
  }

  function autoRollKPIs() {
    if (reduced) return;
    const sel = ".u-kpi .v, .c-kpi .v, .c-kpi-big .v, [data-roll]";
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          rollEl(e.target);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    const attach = () => document.querySelectorAll(sel).forEach(el => {
      if (!el.dataset.rollObserved) {
        el.dataset.rollObserved = "1";
        io.observe(el);
      }
    });
    attach();
    // Watch for React-mounted KPIs
    const mo = new MutationObserver(() => attach());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ─────────────────────────────────────────────────────────
     3 · MAGNETIC HOVER
     Primary CTAs subtly drift toward the cursor (max 6px).
     Opt-in: [data-magnetic] or class .btn-prim.
     ───────────────────────────────────────────────────────── */
  function wireMagnetic(el) {
    if (el.dataset.magBound === "1") return;
    el.dataset.magBound = "1";
    el.style.transition = "transform .2s ease";
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / r.width;
      const dy = (e.clientY - cy) / r.height;
      const max = 6;
      el.style.transform = `translate(${(dx * max).toFixed(1)}px, ${(dy * max).toFixed(1)}px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  }

  function autoMagnetic() {
    if (reduced) return;
    const sel = ".btn-prim, [data-magnetic]";
    const attach = () => document.querySelectorAll(sel).forEach(wireMagnetic);
    attach();
    const mo = new MutationObserver(() => attach());
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ─────────────────────────────────────────────────────────
     BOOT
     ───────────────────────────────────────────────────────── */
  function boot() {
    mountLoader();
    autoRollKPIs();
    autoMagnetic();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
