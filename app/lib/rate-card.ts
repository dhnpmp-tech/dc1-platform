/**
 * DCP per-model rate card — DRAFT (P1, Mission Control 2026-05-13)
 *
 * Single source of truth for the per-token SAR/halala prices shown on:
 *   - /pricing            (public marketing page)
 *   - /marketplace        (public marketplace, "Per-Model Rate Card" section)
 *   - /renter/pricing     (authenticated renter pricing page)
 *
 * Currency
 * --------
 *   • SAR is the unit. 1 SAR = 100 halala.
 *   • All values below are halala per 1,000 tokens.
 *   • Display helpers convert to SAR or USD where useful.
 *
 * Calibration (anchors used for the DRAFT rates — see PR body for full memo)
 * ------------------------------------------------------------------------
 *   • Open-source baseline: OpenRouter "Together AI" / "DeepInfra" published
 *     rates for the same weights, converted SAR≈USD×3.75, May 2026.
 *   • DCP target: 30–50 % below those benchmarks. DCP's cost edge is
 *     Saudi-hosted electricity ($0.048–0.053/kWh) + sovereignty + no FX —
 *     we keep all of that and pass the rest through to the renter
 *     (per `feedback_cost_plus_pricing`).
 *   • Output tokens are priced ~3× input, matching the OR/Together split.
 *   • Embeddings/rerankers priced flat (no input/output distinction).
 *
 * !!! These rates are DRAFT. Edit this file to retune; nothing else
 *     hard-codes per-model halala numbers. The backend `cost_rates` table
 *     remains authoritative at runtime — this card is the published quote.
 */

export type RateCardCategory =
  | 'arabic'      // Arabic-first / sovereign
  | 'chat'        // general chat / instruct
  | 'reasoning'   // long-context / reasoning
  | 'code'        // code-tuned
  | 'multimodal'  // vision / image gen
  | 'embedding'   // retrieval

export interface RateCardEntry {
  /** Canonical model id, matches backend `model_registry.model_id` where possible */
  id: string
  /** Display name in English */
  name: string
  /** Display name in Arabic */
  nameAr: string
  /** Hugging-Face style repo or family marker (display only) */
  repo: string
  /** Category — drives badge + filter */
  category: RateCardCategory
  /** halala per 1,000 PROMPT tokens (input) */
  promptHalalaPer1k: number
  /** halala per 1,000 COMPLETION tokens (output) */
  completionHalalaPer1k: number
  /** Recommended GPU tier the provider needs to host this model */
  recommendedGpu: 'RTX 3060 Ti' | 'RTX 3090' | 'RTX 4080' | 'RTX 4090' | 'RTX 5090' | 'A100' | 'H100' | '2×H100' | '4×H100'
  /** Minimum VRAM in GB at fp16 (used to filter providers) */
  minVramGb: number
  /** Short note shown under the row (EN) */
  noteEn: string
  /** Short note shown under the row (AR) */
  noteAr: string
  /** OR/Together anchor rate in halala / 1K output tokens (calibration reference, display optional) */
  anchorHalalaPer1k: number
}

/**
 * Top-15 models for the published rate card.
 * Ordered by expected DCP demand (Arabic-first, then mid-size workhorses,
 * then heavy + multimodal).
 *
 * To retune a rate: edit `promptHalalaPer1k` / `completionHalalaPer1k` here.
 * Anchor numbers (`anchorHalalaPer1k`) are reference only — they do not bill.
 */
export const RATE_CARD: RateCardEntry[] = [
  // ── Arabic-first / sovereign ───────────────────────────────────────────
  {
    id: 'allam-7b-instruct',
    name: 'ALLaM 7B Instruct',
    nameAr: 'علام 7B إنستراكت',
    repo: 'ALLaM-AI/ALLaM-7B-Instruct-preview',
    category: 'arabic',
    promptHalalaPer1k: 12,
    completionHalalaPer1k: 36,
    recommendedGpu: 'RTX 4090',
    minVramGb: 16,
    noteEn: 'Arabic-first, SDAIA-trained, PDPL-compliant',
    noteAr: 'نموذج عربي أصيل من سدايا، متوافق مع نظام حماية البيانات',
    anchorHalalaPer1k: 75,
  },
  {
    id: 'jais-13b-chat',
    name: 'JAIS 13B Chat',
    nameAr: 'جايس 13B شات',
    repo: 'inceptionai/jais-13b-chat',
    category: 'arabic',
    promptHalalaPer1k: 22,
    completionHalalaPer1k: 66,
    recommendedGpu: '2×H100',
    minVramGb: 31,
    noteEn: 'Bilingual AR/EN, Inception/G42, strong Khaleeji dialect',
    noteAr: 'ثنائي اللغة عربي/إنجليزي، قوي في اللهجة الخليجية',
    anchorHalalaPer1k: 95,
  },
  {
    id: 'falcon-h1-arabic-7b',
    name: 'Falcon H1 7B (Arabic)',
    nameAr: 'فالكون H1 7B (عربي)',
    repo: 'tiiuae/Falcon-H1-7B-Instruct',
    category: 'arabic',
    promptHalalaPer1k: 12,
    completionHalalaPer1k: 36,
    recommendedGpu: 'RTX 4090',
    minVramGb: 16,
    noteEn: 'TII Abu Dhabi, hybrid attention, Arabic + EN fine-tune',
    noteAr: 'من معهد الابتكار التقني، انتباه هجين، مدرّب عربي وإنجليزي',
    anchorHalalaPer1k: 70,
  },

  // ── Chat / instruct workhorses ─────────────────────────────────────────
  {
    id: 'qwen25-7b-instruct',
    name: 'Qwen 2.5 7B Instruct',
    nameAr: 'كوين 2.5 7B إنستراكت',
    repo: 'Qwen/Qwen2.5-7B-Instruct',
    category: 'chat',
    promptHalalaPer1k: 10,
    completionHalalaPer1k: 30,
    recommendedGpu: 'RTX 4090',
    minVramGb: 18,
    noteEn: 'Strong multilingual, 128K context, LoRA-friendly',
    noteAr: 'متعدد اللغات، سياق 128 ألف رمز، يدعم LoRA',
    anchorHalalaPer1k: 60,
  },
  {
    id: 'llama-3-8b-instruct',
    name: 'Llama 3 8B Instruct',
    nameAr: 'لاما 3 8B إنستراكت',
    repo: 'meta-llama/Meta-Llama-3-8B-Instruct',
    category: 'chat',
    promptHalalaPer1k: 10,
    completionHalalaPer1k: 30,
    recommendedGpu: 'RTX 4090',
    minVramGb: 19,
    noteEn: 'Meta open-weights, broad ecosystem support',
    noteAr: 'أوزان مفتوحة من Meta، دعم واسع في الأدوات',
    anchorHalalaPer1k: 65,
  },
  {
    id: 'mistral-7b-instruct',
    name: 'Mistral 7B Instruct v0.2',
    nameAr: 'ميسترال 7B إنستراكت v0.2',
    repo: 'mistralai/Mistral-7B-Instruct-v0.2',
    category: 'chat',
    promptHalalaPer1k: 9,
    completionHalalaPer1k: 27,
    recommendedGpu: 'RTX 4090',
    minVramGb: 17,
    noteEn: 'Compact, fast, Apache-2.0',
    noteAr: 'مدمج وسريع، رخصة Apache 2.0',
    anchorHalalaPer1k: 55,
  },
  {
    id: 'nemotron-nano-4b',
    name: 'Nemotron Nano 4B',
    nameAr: 'نيموترون نانو 4B',
    repo: 'nvidia/Nemotron-Mini-4B-Instruct',
    category: 'chat',
    promptHalalaPer1k: 6,
    completionHalalaPer1k: 18,
    recommendedGpu: 'RTX 3060 Ti',
    minVramGb: 10,
    noteEn: 'Consumer-tier, instant cold-start (<4s), great for edge',
    noteAr: 'يعمل على GPU استهلاكي، بدء بارد <4 ثوانٍ',
    anchorHalalaPer1k: 30,
  },

  // ── Reasoning / long-context heavy ─────────────────────────────────────
  {
    id: 'qwen2-72b-instruct',
    name: 'Qwen 2 72B Instruct',
    nameAr: 'كوين 2 72B إنستراكت',
    repo: 'Qwen/Qwen2-72B-Instruct',
    category: 'reasoning',
    promptHalalaPer1k: 110,
    completionHalalaPer1k: 330,
    recommendedGpu: '4×H100',
    minVramGb: 175,
    noteEn: 'Flagship multilingual reasoning, 128K context',
    noteAr: 'نموذج تفكير متعدد اللغات، سياق 128 ألف رمز',
    anchorHalalaPer1k: 525,
  },
  {
    id: 'llama-3-70b-instruct',
    name: 'Llama 3 70B Instruct',
    nameAr: 'لاما 3 70B إنستراكت',
    repo: 'meta-llama/Meta-Llama-3-70B-Instruct',
    category: 'reasoning',
    promptHalalaPer1k: 105,
    completionHalalaPer1k: 315,
    recommendedGpu: '4×H100',
    minVramGb: 168,
    noteEn: 'GPT-3.5-class quality, fully open',
    noteAr: 'جودة بمستوى GPT-3.5، مفتوح بالكامل',
    anchorHalalaPer1k: 530,
  },
  {
    id: 'nemotron-super-70b',
    name: 'Nemotron Super 70B',
    nameAr: 'نيموترون سوبر 70B',
    repo: 'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
    category: 'reasoning',
    promptHalalaPer1k: 115,
    completionHalalaPer1k: 345,
    recommendedGpu: '4×H100',
    minVramGb: 168,
    noteEn: 'NVIDIA reasoning fine-tune, strong on code + math',
    noteAr: 'تحسين تفكير من NVIDIA، قوي في البرمجة والرياضيات',
    anchorHalalaPer1k: 560,
  },

  // ── Code ───────────────────────────────────────────────────────────────
  {
    id: 'qwen25-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    nameAr: 'كوين 2.5 كودر 7B',
    repo: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    category: 'code',
    promptHalalaPer1k: 10,
    completionHalalaPer1k: 30,
    recommendedGpu: 'RTX 4090',
    minVramGb: 18,
    noteEn: 'Code-tuned, 92+ languages, fill-in-middle',
    noteAr: 'مخصص للبرمجة، أكثر من 92 لغة برمجة',
    anchorHalalaPer1k: 60,
  },
  {
    id: 'deepseek-coder-v2-lite',
    name: 'DeepSeek Coder V2 Lite',
    nameAr: 'ديب سيك كودر V2 لايت',
    repo: 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct',
    category: 'code',
    promptHalalaPer1k: 11,
    completionHalalaPer1k: 33,
    recommendedGpu: 'RTX 4090',
    minVramGb: 20,
    noteEn: 'MoE 16B, 2.4B active params — fast code completion',
    noteAr: 'بنية MoE، 2.4 مليار معامل نشط، إكمال كود سريع',
    anchorHalalaPer1k: 65,
  },

  // ── Multimodal ─────────────────────────────────────────────────────────
  {
    id: 'sdxl-base-1.0',
    name: 'Stable Diffusion XL',
    nameAr: 'ستيبل ديفيوجن XL',
    repo: 'stabilityai/stable-diffusion-xl-base-1.0',
    category: 'multimodal',
    promptHalalaPer1k: 0,
    completionHalalaPer1k: 0,
    recommendedGpu: 'RTX 4080',
    minVramGb: 10,
    noteEn: 'Billed per image: 8 halala / 1024×1024 image (≈ SAR 0.08)',
    noteAr: 'تسعير بالصورة: 8 هللات لكل صورة 1024×1024 (~0.08 ريال)',
    anchorHalalaPer1k: 0,
  },

  // ── Embeddings / retrieval ─────────────────────────────────────────────
  {
    id: 'bge-m3-embedding',
    name: 'BGE-M3 Embeddings',
    nameAr: 'BGE-M3 تضمينات',
    repo: 'BAAI/bge-m3',
    category: 'embedding',
    promptHalalaPer1k: 3,
    completionHalalaPer1k: 0,
    recommendedGpu: 'RTX 3060 Ti',
    minVramGb: 2,
    noteEn: 'Multilingual, dense + sparse + colbert; ideal for Arabic RAG',
    noteAr: 'متعدد اللغات، يجمع التمثيلات الكثيفة والمتفرقة',
    anchorHalalaPer1k: 8,
  },
  {
    id: 'reranker-v2-m3',
    name: 'BGE Reranker v2-m3',
    nameAr: 'BGE معيد ترتيب v2-m3',
    repo: 'BAAI/bge-reranker-v2-m3',
    category: 'embedding',
    promptHalalaPer1k: 4,
    completionHalalaPer1k: 0,
    recommendedGpu: 'RTX 3060 Ti',
    minVramGb: 2,
    noteEn: 'Cross-encoder reranker; pairs with BGE-M3 for top-k',
    noteAr: 'معيد ترتيب لنتائج البحث الدلالي، يقترن مع BGE-M3',
    anchorHalalaPer1k: 12,
  },
]

// ── Helpers ────────────────────────────────────────────────────────────

/** halala / 1K tokens → SAR / 1M tokens (2-decimals) */
export function halalaPer1kToSarPerMillion(halalaPer1k: number): string {
  return ((halalaPer1k * 1000) / 100).toFixed(2)
}

/** halala / 1K tokens → SAR / 1K tokens (4-decimals) */
export function halalaPer1kToSarPer1k(halalaPer1k: number): string {
  return (halalaPer1k / 100).toFixed(4)
}

/** Discount vs anchor benchmark, percent (negative = cheaper) */
export function discountVsAnchor(entry: RateCardEntry): number {
  if (!entry.anchorHalalaPer1k) return 0
  return Math.round(
    ((entry.completionHalalaPer1k - entry.anchorHalalaPer1k) / entry.anchorHalalaPer1k) * 100,
  )
}

export const RATE_CARD_LAST_UPDATED = '2026-05-13'
export const RATE_CARD_FX_NOTE_EN = 'Anchored against OpenRouter / Together AI / DeepInfra published rates, May 2026. Conversion at SAR/USD = 3.75.'
export const RATE_CARD_FX_NOTE_AR = 'مرجعنا أسعار OpenRouter و Together AI و DeepInfra المنشورة في مايو 2026. سعر الصرف ريال/دولار = 3.75.'
