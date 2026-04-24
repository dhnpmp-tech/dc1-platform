# DCP Design Kit — v1 Reference

Single source of truth for the DCP platform design language. Every screen across marketing, renter, provider, admin, and modals imports from **`assets/dcp-kit.css`** + **`assets/dcp-kit.jsx`** and uses only what is listed below.

If a screen needs something not in the kit, **add it here first** — never inline a new class.

---

## How to use

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/dcp-kit.css">

<script src="assets/i18n.js"></script>
<script src="assets/data.js"></script>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" ...></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" ...></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" ...></script>

<script type="text/babel" src="assets/dcp-kit.jsx"></script>
<script type="text/babel" src="path/to/YourScreen.jsx"></script>
```

**Root `<html>` must carry:**
- `lang="en"` or `lang="ar"`
- `dir="ltr"` or `dir="rtl"` (flips utility bars + magnetic directions)
- `data-lang="en"` | `data-lang="ar"` (flips font stacks)
- `data-palette="midnight"` (default) | `"paper"` | `"mono"`

---

## Design tokens (CSS vars)

### Color
| Token | Midnight | Paper | Mono | Role |
|---|---|---|---|---|
| `--bg`     | `#0a0b1a` | `#f4efe6` | `#ffffff` | Page |
| `--bg-2`   | `#10122a` | `#ece5d6` | `#f5f5f5` | Inset surface |
| `--paper`  | `#161834` | `#faf6ed` | `#ffffff` | Elevated surface |
| `--ink`    | `#f5f3ee` | `#0a0b1a` | `#0a0a0a` | Primary text |
| `--ink-2`  | `#c9c5bd` | `#2a2940` | `#1a1a1a` | Body text |
| `--mut`    | `#7b7a92` | `#645d7a` | `#555`    | Muted / mono label |
| `--dim`    | `#4e4d67` | `#8a8299` | `#888`    | Placeholder |
| `--line`   | `#272848` | `#0a0b1a` | `#0a0a0a` | Heavy border |
| `--hair`   | `#1f2040` | `#d8cfbe` | `#dcdcdc` | Thin rule |
| `--teal`   | `#2dd4b6` | `#0d9d87` | `#0a0a0a` | Brand accent / success |
| `--orange` | `#ee7a3c` | `#d85f22` | `#0a0a0a` | Brand accent / warn |

### Semantic (`+KIT` additions — same across palettes)
| Token | Value | Role |
|---|---|---|
| `--ok`   | `#2dd4b6` | Success / operational |
| `--warn` | `#ee7a3c` | Warning / attention |
| `--err`  | `#ef4062` | Error / destructive |
| `--info` | `#6fa8dc` | Neutral informational |

### Layout
| Token | Value |
|---|---|
| `--maxw` | `1280px` |

### Typography
| Token | Stack |
|---|---|
| `--sans`   | Inter, system-ui, sans-serif |
| `--serif`  | Instrument Serif, Times New Roman, serif |
| `--mono`   | JetBrains Mono, ui-monospace, Menlo, monospace |
| `--arabic` | Noto Naskh Arabic, serif |

### Gradient
`--grad` = teal → teal-mix → orange, used for emphasis text (`h1.hero-h em`, `h2.st em`, `.end-cta .big em`), active underlines, slider thumbs, and `.ticker-card::before` accent bar.

---

## Type system

| Usage | Class | Font | Size |
|---|---|---|---|
| Page-title hero | `h1.hero-h` | serif 400 | `clamp(54px, 8.4vw, 128px)` |
| Section title | `h2.st` | serif 400 | `clamp(40px, 5.6vw, 80px)` |
| Final CTA | `.end-cta .big` | serif 400 | `clamp(54px, 10vw, 150px)` |
| Stat value | `.tc-v` / `.stat-card .v` / `.calc-out .big` | serif 400 | 44–60px |
| Prose h2 | `.prose h2` | serif 400 | 42px |
| Prose h3 | `.prose h3` | serif 400 | 28px |
| App-shell h1 | `.app-hd h1` | serif 400 | `clamp(32px, 4.4vw, 54px)` |
| Eyebrow | `.eyebrow` | mono | 11.5px / `.16em` |
| Section meta | `.section-meta` | mono | 11px / `.14em` |
| Body copy | `.hero-sub` / `.ss` / `.prose p` | sans | 16.5–18.5px |
| Inline code | `code.inline` | mono | .88em |

**Italic gradient emphasis** — wrap words in `<em>…</em>` inside `h1.hero-h`, `h2.st`, or `.end-cta .big`. Automatic gradient fill + italic style (neutralized in Arabic).

**Arabic** — when `html[data-lang="ar"]` is set, headline classes swap to `--arabic` at weight 700, `letter-spacing:0`, wider line-height. Numerals render Arabic-Indic via `fmt()` helpers.

---

## Layout primitives

| Class | Purpose |
|---|---|
| `.wrap` | Max-width 1280 + 32px gutter (18 on mobile). Use inside every `section`. |
| `section` | 110px vertical padding, 1px top border. |
| `.grid-2` | 1-1, collapses at 960. |
| `.grid-3` (+KIT) | 1-1-1, collapses at 960. |
| `.grid-4` (+KIT) | 4col, 2col <960, 1col <520. |
| `.two-col` (+KIT) | Prose + sticky TOC (280px). |
| `.app-shell` (+KIT) | Dashboard grid: `240px 1fr`, `.rail` + `.app-main`. |
| `.hero-body` | 1.5fr / 1fr content split for hero. |
| `.prov-wrap` | 1.1fr / 1fr for copy + calculator. |
| `.pg` | 1 / 1 for playground I/O. |
| `.models-grid` | 12-col grid; cards `span 3` → `span 4` → `span 6` → `span 12`. |
| `.trust-grid` | 4-col, bordered cells. |

---

## Components (complete list)

### Chrome

| Component | Signature | Notes |
|---|---|---|
| `<Marquee text?>` | Falls back to `t.marquee`. | Top ticker bar. |
| `<Brand href? compact?>` | — | Logo + wordmark. |
| `<LangToggle lang setLang>` | — | EN / ع pill. |
| `<Nav lang setLang links? active? status? right? ctaLabel? ctaHref?>` | `links=[{href,label,key}]`, `active="marketplace"`, `status={label}`, `right=ReactNode` overrides entire right slot. | Sticky, blurred. |
| `<Footer cols?>` | `cols=[[heading,[links…]], …]` | 4-column. |
| `<SectionMeta idx label right?>` | — | Mono section label row. |
| `<Eyebrow>children</Eyebrow>` | — | Teal mono kicker. |
| `<Breadcrumb items>` | `items=[{label,href?}]` | Mono crumb trail. |

### Motion

| Component / Hook | Signature |
|---|---|
| `<Reveal delay? as?>` | Fade+rise on intersect. Honors `prefers-reduced-motion`. |
| `<MagneticButton strength?>` | Cursor-pull wrapper. Disables in RM. |
| `<HeroMap>` | Animated Saudi GPU mesh canvas. Place inside `.hero-bg`. |
| `<Sparkline values color? height?>` | Mini line canvas. |
| `useReveal(delay)` | Returns ref. |
| `useCountUp(target, {duration})` | `[val, ref]`. |
| `useJitter(base, {range,interval})` | Live-jitter a number. |
| `useFeed()` | Activity feed array (reserve/stream/settle/mint). |

### Widgets (+KIT)

| Component | Signature |
|---|---|
| `<Badge tone? pulse?>` | `tone="ok" | "warn" | "err" | "info" | "default"`. |
| `<Callout tone? label?>` | `tone="info" | "warn" | "err"`. |
| `<Stat k v unit? delta? deltaDir? spark?>` | Single dashboard stat. |
| `<StatRow>` | 4-col bordered container. |
| `<Field label? hint? error?>` | Wraps `.input` / `.textarea` / `select.select`. |
| `<EmptyState title body? action?>` | Dashed-border empty placeholder. |
| `<Skeleton variant?>` | `"line"` (default) or `"block"`. |
| `<Modal open onClose title? footer?>` | Backdrop + midnight surface + ESC. |
| `<Toast tone?>` | Fixed-bottom badge + text. |
| `<TweaksPanel extra?>` | Palette switcher. |

### Hooks

```js
const { lang, t } = useLang();                        // i18n dictionary
const feed  = useFeed();                              // activity rows
const value = useJitter(100, { range:0.04 });         // live jitter
const [v, ref] = useCountUp(1234);                    // number roll
const ref   = useReveal(120);                         // fade-rise
const { open, state, setKey } = useTweaks();          // tweaks panel
```

### Formatting

```js
fmt(1234.56, lang, { minimumFractionDigits:2 })  // "1,234.56" / "١٬٢٣٤٫٥٦"
fmtInt(1234, lang)                               // "1,234"
fmtMoney(42, lang, "SAR")                        // "SAR 42.00"
```

---

## Class reference

### Buttons
- `.btn` — base
- `.btn.primary` — filled, gradient hover
- `.btn.ghost` — outlined
- `.btn.small`, `.btn.lg` — size variants
- `.btn.danger`, `.btn.danger.primary` — destructive (+KIT)
- `.btn[disabled]` / `.btn.disabled` — dimmed

### Links / chrome
- `header.nav`, `.nav-in`, `.nav-links`, `.nav-right`, `.nav-status`, `.nav-links a.on`
- `.brand`, `.brand-mark`, `.brand-name`, `.infinity-chip`
- `.lang-pill`, `.lang-pill button.on`
- `.magnet`
- `.crumbs`, `.crumbs .sep`

### Typography
- `.eyebrow`, `h1.hero-h`, `h2.st`, `.ss`, `.hero-sub`
- `.prose`, `.prose p`, `.prose h2`, `.prose h3`, `.prose ul`, `.prose ol`, `.prose blockquote`
- `.mono`, `.serif`, `.muted`, `.center`, `.nowrap`, `.truncate`

### Surfaces (+KIT)
- `.surface`, `.surface.inset`, `.surface.flush`
- `.surface-hd`, `.surface-hd b`

### Stats (+KIT)
- `.stat-card`, `.stat-card .k`, `.stat-card .v`, `.stat-card .v .u`, `.stat-card .delta`, `.stat-card .delta.down`, `.stat-card .spark`
- `.stat-row` — bordered 4-up container

### Tables
- `.mk-controls`, `.mk-search`, `.chip`, `.chip.on`, `.chip .n`
- `.mk-wrap` (+KIT) — scroll container
- `.mk-table`, `.mk-table thead th`, `.mk-table tbody td`
- `.mk-table .gpu-cell`, `.mk-table .region`, `.mk-table .region .pin`, `.mk-table .provider`
- `.util-cell`, `.util-bar`, `.util-bar span`, `.util-val`
- `.price`, `.price.usd`, `.rel`, `.perf`, `.perf .bar`, `.perf .bar.on`
- `.mk-foot`

### Forms (+KIT)
- `.input`, `.textarea`, `.select`, `.prompt`, `.slider`
- `.field`, `.field-label`, `.field-hint`, `.field-err`
- `.checkbox`, `.radio`

### Badges / callouts (+KIT)
- `.badge`, `.badge.ok | .warn | .err | .info`
- `.badge .d`, `.badge .d.pulse`
- `.callout`, `.callout.warn`, `.callout.err`, `.callout b`

### Sidebar (+KIT)
- `.app-shell`, `.app-shell .rail`
- `.rail-group`, `.rail-group h5`
- `.rail a`, `.rail a.on`, `.rail a .n`
- `.app-main`, `.app-hd`, `.app-hd h1`, `.app-hd .actions`

### Empty / loading (+KIT)
- `.empty-state`, `.empty-state h3`, `.empty-state p`
- `.skeleton`, `.skeleton.line`, `.skeleton.block`

### Modal / toast / widgets (+KIT)
- `.backdrop`, `.modal`, `.modal-hd`, `.modal-hd h3`, `.modal-hd .close`, `.modal-body`, `.modal-ft`
- `.toast`
- `.fab`
- `.popover`, `.popover-hd`, `.popover-body`
- `.consent-bar`, `.consent-bar .actions`

### Marketplace extras
- `.demand`, `.demand-left`, `.demand-label`, `.demand-label b`, `.demand-bar`, `.demand-bar span`, `.demand-right`, `.demand-right .k`

### Playground extras
- `.pg`, `.pg-pane`, `.pg-label`, `.pg-actions`, `.pg-meta`, `.pg-meta b`
- `.pg-response`, `.pg-response.empty`, `.pg-response.rtl-out`, `.pg-response .cursor`
- `.tabs`, `.tabs button.on`
- `pre.code`, `pre.code .k|.s|.c|.n|.f`
- `code.inline` (+KIT)
- `.token-ribbon`, `.tok-chip`

### Ticker (hero right card)
- `.ticker-card`, `.ticker-card.feat`
- `.tc-hd`, `.tc-hd .live`, `.tc-hd .live .d`
- `.tc-stats`, `.tc-stat`, `.tc-k`, `.tc-v`, `.tc-v .u`, `.tc-delta`, `.tc-delta.down`
- `.feat-list`, `.feat-list .n`, `.feat-list .k`, `.feat-list .v`
- `.feed-card`, `.feed-row`, `.feed-row .arrow`, `.feed-row .m`, `.feed-row .r`

### Models
- `.models-grid`, `.m-card`, `.m-card .org`, `.m-card .mname`, `.m-card .mtag`, `.m-card .mrow`, `.m-card .hot`

### Providers / calc
- `.prov-wrap`, `.prov-list`, `.prov-list .mk`, `.prov-list .tx`
- `.calc-card`, `.calc-field`, `.calc-row`, `.calc-out`, `.calc-out .big`, `.calc-out .big .u`, `.calc-out .sub`

### Bill rows
- `.bill-list`, `.bill-row`, `.bill-row .n`, `.bill-row .t`, `.bill-row .d`

### Enterprise
- `.ent`, `.ent-cta`, `.ent-bg`, `.ent .btn.primary`, `.ent .btn.ghost`

### Trust grid
- `.trust-grid`, `.tr`, `.tr .n`, `.tr h3`, `.tr p`

### End CTA
- `.end-cta`, `.end-cta .big`, `.end-cta .big em`, `.end-cta .ss`, `.end-cta .ctas`

### Footer
- `footer.site`, `.foot-grid`, `.foot h4`, `.foot ul`, `.foot a`, `.foot-bottom`

### Marquee
- `.marquee`, `.marquee-in`

### Hero
- `.hero`, `.hero-bg`, `.hero-map-canvas`, `.hero-meta`, `.hero-meta .dot`, `.hero-meta .left`
- `.hero-ctas`, `.hero-trusted`, `.customer-strip`

### Section
- `section`, `.section-meta`, `.section-meta .idx`

### Docs / prose (+KIT)
- `.two-col`, `.toc`, `.toc h5`, `.toc a`, `.toc a.on`
- `.callout`

### Tweaks panel
- `.tweaks`, `.tweaks.on`, `.tweaks h4`, `.tweaks label`, `.tweaks .opts`, `.tweaks .opt`, `.tweaks .opt.on`

### Utilities
- `.row`, `.col`, `.grow`
- `.hr`, `.hr.dash`

---

## Keyframes

`marq` (marquee scroll) · `pulse` (dot) · `sheen` (gradient sheen on `h1.hero-h em`) · `blink` (cursor) · `tokIn` (token-ribbon chip entry) · `skel` (skeleton shimmer)

All gated behind `@media (prefers-reduced-motion: reduce)` where appropriate.

---

## RTL support

- Root: set `dir="rtl"` and `data-lang="ar"` on `<html>`
- `.demand-bar span`, `.util-bar span` — flip `transform-origin:right`
- `.toast` — centered transform flipped
- Arabic font stack auto-applies on body, headlines, `.prompt`, `.m-card .mname`, `.tc-v`, `.calc-out .big`, `.end-cta .big`, `.bill-row .t`, `.stat-card .v`, `.app-hd h1`, `.empty-state h3`, `.modal-hd h3`, `.prose h2`, `.prose h3`, `.prose blockquote`
- Numerals: always render via `fmt()` / `fmtInt()` / `fmtMoney()` for Arabic-Indic

---

## Language dictionary (`assets/i18n.js`)

Top-level shape:
```
DCP_I18N.en = {
  nav, topline, hero, marquee, stats, platform,
  market, playground, models, billing, providers,
  enterprise, trust, cta_block, footer
}
DCP_I18N.ar = { … same keys … }
```

New screens add their own key under each locale — e.g. `dashboard`, `register`, `jobs`. Do not collide with existing keys.

## Data (`assets/data.js`)

`DCP_DATA = { marketplace, models, demoPrompts, regions, customers }`

Shapes:
- **marketplace row** — `{ id, gpu, vram, region, provider, sarhr, usd, util, perf, reliability, arabic }`
- **model** — `{ id, name, org, kind, arabic, ctx, in, out, tag, hot }`
- **region** — `{ id, name, code, provider, lat, lon, count }`

Per-screen mock data lives in `assets/data-<batch>.js` (added in batches 1–5).

---

## Rules

1. **No invented classes** — if something is missing, add to kit first
2. **No invented tokens** — use palette vars
3. **No emoji** — mono icons or text only
4. **No external icon libraries** — use icons exported from kit
5. **All screens support EN + AR + RTL**
6. **All numbers go through `fmt`/`fmtInt`/`fmtMoney`**
7. **All motion respects `prefers-reduced-motion`**
8. **One `<h1>` per screen**, using `h1.hero-h` (marketing) or `.app-hd h1` (app)
