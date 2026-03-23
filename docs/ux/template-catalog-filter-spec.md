# Filter & Search UX Spec — Sprint 27

> **Owner:** UI/UX Specialist
> **Date:** 2026-03-23
> **Deliverable:** Functional specification for template discovery

---

## EXECUTIVE SUMMARY

Renters need to quickly find templates by:
- **Category** (LLM, Embedding, Image, Training, Notebook)
- **GPU Requirements** (VRAM tier: 8GB, 24GB, 40GB+)
- **Arabic Capability** (Arabic-native vs Arabic-capable vs English-only)
- **Deployment Speed** (Instant tier vs Cached vs On-Demand)
- **Search** (fuzzy match on template name, description, model name)

---

## 1. FILTER PANEL LAYOUT

### Desktop (Left Sidebar, 260px)
```
┌─ Filter & Search ──────────┐
│                            │
│ [Search box - fuzzy match] │
│                            │
│ ╔ Category ════════════════╗ ← Collapsible
│ ☑ All Templates (20)      │
│ ☐ LLM / Inference (8)     │
│ ☐ Embeddings & RAG (3)    │
│ ☐ Image Generation (2)    │
│ ☐ Training & Fine-tune (4)│
│ ☐ Notebooks & Dev (3)     │
│ ╚════════════════════════╝ │
│                            │
│ ╔ GPU VRAM ════════════════╗ ← Collapsible
│ ☐ 8 GB (RTX 4090/4080)    │
│ ☐ 24 GB (RTX 4090)        │
│ ☐ 40+ GB (A100/H100)      │
│ ╚════════════════════════╝ │
│                            │
│ ╔ Arabic Capability ═══════╗ ← Collapsible
│ ☐ Arabic-native (5)       │
│ ☐ Arabic-capable (4)      │
│ ☐ All languages (20)      │
│ ╚════════════════════════╝ │
│                            │
│ ╔ Deployment Speed ════════╗ ← Collapsible
│ ☐ Instant (⚡, 0-2s)      │
│ ☐ Cached (🚀, 2-10s)      │
│ ☐ On-Demand (⏱, 10s+)     │
│ ╚════════════════════════╝ │
│                            │
│ [Reset Filters] [Show (X)] │
└────────────────────────────┘
```

### Mobile (Horizontal Scroll + Modal)
- Filter button: "⚙️ Filters (n active)"
- Click opens modal with all filters
- Tabs: Category / GPU / Arabic / Speed
- Each tab shows options with count
- "Apply" button at bottom

---

## 2. SEARCH BEHAVIOR

### Fuzzy Matching
- Match on template **name**, **description**, **model_id**, **tags**
- Case-insensitive
- Typo tolerance (e.g., "nemotron" finds "Nemotron Nano")
- Order by: exact match > prefix match > substring match

### Examples
- "qwen" → finds "Qwen 2.5 7B"
- "embedding" → finds "Arabic Embeddings API", "BGE Reranker"
- "instant" → finds templates with tier='instant'
- "8gb" → finds templates with min_vram_gb=8
- "arabic rag" → finds "Arabic RAG Complete" (multi-word)

---

## 3. FILTER COMBINATIONS

All filters **work together** (AND logic):

```
Category: LLM
+ Arabic: Arabic-native
+ VRAM: 8GB
+ Speed: Instant

Result: [Nemotron Nano, JAIS-ish] ← Arabic LLMs that fit in 8GB instant
```

### Smart Defaults
- **On page load:** "All Templates" category selected
- **After category selection:** Clear VRAM filter (each category has different hardware needs)
- **Arabic filter:** Default to "All languages" (don't exclude English-only templates)
- **Speed filter:** Default to all speeds (user decides tradeoff)

---

## 4. FILTER STATE PERSISTENCE

- **URL params:** `?category=llm&vram=8&arabic=native&speed=instant`
- **Browser back button:** Restores filter state
- **Shareable links:** Filters preserved when user shares URL

---

## 5. MOBILE RESPONSIVENESS

### Mobile Layout (<768px)
- **Filter button:** Top-right corner, sticky
- **Active filter count:** Badge on button (e.g., "Filters (2)")
- **Search bar:** Full width, below header
- **Template grid:** Single column
- **Filter modal:** Full-screen overlay, swipe-to-close
- **Touch targets:** 48px minimum for checkboxes

---

## 6. RESULT FEEDBACK

### Empty State
"No templates match your filters.  
[Clear filters] to see all available templates."

### Count Display
"Showing 4 of 20 templates"  
"Showing all 20 templates" (when no filters active)

### Loading
Skeleton cards (8-12) with fade-in on complete

---

## 7. ACCESSIBILITY

- **Keyboard nav:** Tab through filters, Enter to toggle, Escape to close modal
- **ARIA labels:** FilterPanel role, FilterGroup role, SearchBox aria-label
- **Announced changes:** When results update, announce "Showing X templates"
- **Color + text:** Not relying on color alone for checkbox states (use ✓ checkmarks)

---

## 8. ANALYTICS

Track:
- Most-used filters (category > vram > arabic > speed)
- Search queries (top searches, no-result searches)
- Filter abandonment (users who open filters but don't use)
- CTR per filter combination (which combos drive most deploys?)

---

## Implementation Notes

- **Library:** No external library needed, native React state
- **Debounce search:** 300ms to avoid re-renders on every keystroke
- **Memoization:** FilterPanel and TemplateGrid should be separate components
- **Tests:** Unit test filter logic, integration test URL params
