# DCP-421 Research Pack: Docker-template LLM model inventory

Generated: 2026-03-21 UTC
Scope sources: `docker-templates/*.json`, `infra/config/arabic-portfolio.json`, `docs/model-cards.mdx`

## 1) Canonical model inventory + template mapping

| Canonical model | HF/Vendor repo | In docker templates | In arabic portfolio | In docs/model-cards |
|---|---|---|---|---|
| ALLaM 7B Instruct (preview) | `humain-ai/ALLaM-7B-Instruct-preview` (portfolio currently points to `ALLaM-AI/...` redirect) | - | `tier_a` (`allam-7b-instruct`) | yes |
| Falcon H1 7B Instruct | `tiiuae/Falcon-H1-7B-Instruct` | - | `tier_a` (`falcon-h1-arabic-7b`) | yes |
| JAIS 13B Chat | `inceptionai/jais-13b-chat` | - | `tier_b` (`jais-13b-chat`) | yes |
| Qwen2 7B Instruct | `Qwen/Qwen2-7B-Instruct` | - | `tier_a` (`qwen2-7b-instruct`) | yes |
| Qwen2 72B Instruct | `Qwen/Qwen2-72B-Instruct` | - | `tier_c` (`qwen2-72b-instruct`) | - |
| Llama 3 8B Instruct | `meta-llama/Meta-Llama-3-8B-Instruct` | `qlora-finetune` (base model default) | `tier_a` (`llama-3-8b-instruct`) | yes |
| Llama 3 70B Instruct | `meta-llama/Meta-Llama-3-70B-Instruct` | - | `tier_c` (`llama-3-70b-instruct`) | - |
| Mistral 7B Instruct v0.2 | `mistralai/Mistral-7B-Instruct-v0.2` | `vllm-serve`, `lora-finetune` | - | yes |
| TinyLlama 1.1B Chat v1.0 | `TinyLlama/TinyLlama-1.1B-Chat-v1.0` | `ollama` | - | - |
| BGE-M3 (embeddings) | `BAAI/bge-m3` | `arabic-embeddings` | `tier_b` (`bge-m3-embedding`) | - |
| BGE Reranker v2 M3 | `BAAI/bge-reranker-v2-m3` | `arabic-reranker` | `tier_b` (`reranker-v2-m3`) | - |
| Stable Diffusion v1.4 | `CompVis/stable-diffusion-v1-4` | `stable-diffusion` default | - | - |
| Stable Diffusion XL Base 1.0 | `stabilityai/stable-diffusion-xl-base-1.0` | `stable-diffusion` example IO | `tier_b` (`sdxl-base-1.0`) | - |
| Phi-3 Mini 4K Instruct | `microsoft/Phi-3-mini-4k-instruct` | - | - | yes (`Phi-3 Mini`) |
| DeepSeek R1 Distill Qwen 7B | `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` | - | - | yes (`DeepSeek R1 7B`) |

## 2) Table-ready payload for docs authors

Notes:
- `parameter_count` is taken from model card `Model size` when available.
- When exact parameter count is not explicitly published in model card metadata, field is set to `not_explicitly_published`.
- `practical_vram_gb_baseline` is DCP operational baseline from template/portfolio/docs feeds.

```json
[
  {
    "canonical_name": "ALLaM 7B Instruct (preview)",
    "repo": "humain-ai/ALLaM-7B-Instruct-preview",
    "origin_creator": "HUMAIN / SDAIA National Center for AI",
    "parameter_count": "7B",
    "architecture_family": "autoregressive transformer",
    "language_coverage": "Arabic + English",
    "license_commercial_notes": "Apache-2.0 on HF card; commercial use generally allowed under Apache-2.0 terms",
    "practical_vram_gb_baseline": 24,
    "dcp_mapping": {"portfolio": "tier_a/allam-7b-instruct", "docs_matrix": true},
    "sources": [
      "https://huggingface.co/humain-ai/ALLaM-7B-Instruct-preview",
      "infra/config/arabic-portfolio.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "Falcon H1 7B Instruct",
    "repo": "tiiuae/Falcon-H1-7B-Instruct",
    "origin_creator": "Technology Innovation Institute (TII)",
    "parameter_count": "8B (HF model-size metadata for this checkpoint)",
    "architecture_family": "Hybrid Transformer + Mamba (hybrid-head)",
    "language_coverage": "English + multilingual (18 languages tag)",
    "license_commercial_notes": "Falcon-LLM License (custom); commercial use requires checking Falcon license terms",
    "practical_vram_gb_baseline": 24,
    "dcp_mapping": {"portfolio": "tier_a/falcon-h1-arabic-7b", "docs_matrix": true},
    "sources": [
      "https://huggingface.co/tiiuae/Falcon-H1-7B-Instruct",
      "https://arxiv.org/abs/2507.22448",
      "infra/config/arabic-portfolio.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "JAIS 13B Chat",
    "repo": "inceptionai/jais-13b-chat",
    "origin_creator": "Inception + MBZUAI + Cerebras",
    "parameter_count": "13B",
    "architecture_family": "decoder-only causal LM",
    "language_coverage": "Arabic (MSA) + English",
    "license_commercial_notes": "Apache-2.0; model card explicitly mentions commercial use",
    "practical_vram_gb_baseline": 24,
    "dcp_mapping": {"portfolio": "tier_b/jais-13b-chat", "docs_matrix": true},
    "sources": [
      "https://huggingface.co/inceptionai/jais-13b-chat",
      "infra/config/arabic-portfolio.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "Qwen2 7B Instruct",
    "repo": "Qwen/Qwen2-7B-Instruct",
    "origin_creator": "Qwen team (Alibaba)",
    "parameter_count": "8B (HF model-size metadata)",
    "architecture_family": "Qwen2 decoder-only Transformer family",
    "language_coverage": "English tag + multilingual capabilities referenced in card intro",
    "license_commercial_notes": "Apache-2.0",
    "practical_vram_gb_baseline": 16,
    "dcp_mapping": {"portfolio": "tier_a/qwen2-7b-instruct", "docs_matrix": true},
    "sources": [
      "https://huggingface.co/Qwen/Qwen2-7B-Instruct",
      "infra/config/arabic-portfolio.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "Qwen2 72B Instruct",
    "repo": "Qwen/Qwen2-72B-Instruct",
    "origin_creator": "Qwen team (Alibaba)",
    "parameter_count": "73B (HF model-size metadata)",
    "architecture_family": "Qwen2 decoder-only Transformer family",
    "language_coverage": "English tag on card (multilingual details in report)",
    "license_commercial_notes": "Tongyi Qianwen custom license (review terms before commercial deployment)",
    "practical_vram_gb_baseline": 80,
    "dcp_mapping": {"portfolio": "tier_c/qwen2-72b-instruct"},
    "sources": [
      "https://huggingface.co/Qwen/Qwen2-72B-Instruct",
      "infra/config/arabic-portfolio.json"
    ]
  },
  {
    "canonical_name": "Meta Llama 3 8B Instruct",
    "repo": "meta-llama/Meta-Llama-3-8B-Instruct",
    "origin_creator": "Meta",
    "parameter_count": "8B",
    "architecture_family": "autoregressive optimized Transformer (GQA; SFT+RLHF tuned)",
    "language_coverage": "English intended use (fine-tuning to other languages allowed)",
    "license_commercial_notes": "Llama 3 community/custom commercial license; commercial use allowed with policy/license constraints",
    "practical_vram_gb_baseline": 16,
    "dcp_mapping": {"template": "qlora-finetune (base model default)", "portfolio": "tier_a/llama-3-8b-instruct", "docs_matrix": true},
    "sources": [
      "https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct",
      "https://llama.meta.com/llama3/license",
      "docker-templates/qlora-finetune.json",
      "infra/config/arabic-portfolio.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "Meta Llama 3 70B Instruct",
    "repo": "meta-llama/Meta-Llama-3-70B-Instruct",
    "origin_creator": "Meta",
    "parameter_count": "71B (HF model-size metadata)",
    "architecture_family": "autoregressive optimized Transformer (GQA; SFT+RLHF tuned)",
    "language_coverage": "English intended use",
    "license_commercial_notes": "Llama 3 community/custom commercial license",
    "practical_vram_gb_baseline": 80,
    "dcp_mapping": {"portfolio": "tier_c/llama-3-70b-instruct"},
    "sources": [
      "https://huggingface.co/meta-llama/Meta-Llama-3-70B-Instruct",
      "https://llama.meta.com/llama3/license",
      "infra/config/arabic-portfolio.json"
    ]
  },
  {
    "canonical_name": "Mistral 7B Instruct v0.2",
    "repo": "mistralai/Mistral-7B-Instruct-v0.2",
    "origin_creator": "Mistral AI",
    "parameter_count": "7B",
    "architecture_family": "Mistral decoder-only transformer family",
    "language_coverage": "general-purpose instruct model (card does not explicitly pin language scope)",
    "license_commercial_notes": "Apache-2.0",
    "practical_vram_gb_baseline": 16,
    "dcp_mapping": {"templates": ["vllm-serve", "lora-finetune"], "docs_matrix": true},
    "sources": [
      "https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2",
      "docker-templates/vllm-serve.json",
      "docker-templates/lora-finetune.json",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "TinyLlama 1.1B Chat v1.0",
    "repo": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
    "origin_creator": "TinyLlama community",
    "parameter_count": "1B (HF model-size metadata)",
    "architecture_family": "Llama-family decoder-only chat model",
    "language_coverage": "English tag",
    "license_commercial_notes": "Apache-2.0",
    "practical_vram_gb_baseline": 4,
    "dcp_mapping": {"template": "ollama"},
    "sources": [
      "https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0",
      "docker-templates/ollama.json"
    ]
  },
  {
    "canonical_name": "BGE-M3",
    "repo": "BAAI/bge-m3",
    "origin_creator": "BAAI",
    "parameter_count": "not_explicitly_published",
    "architecture_family": "XLM-RoBERTa-derived multilingual embedding model (dense+sparse+multi-vector)",
    "language_coverage": "multilingual (MIRACL/MKQA and model specs)",
    "license_commercial_notes": "MIT",
    "practical_vram_gb_baseline": 8,
    "dcp_mapping": {"template": "arabic-embeddings", "portfolio": "tier_b/bge-m3-embedding"},
    "sources": [
      "https://huggingface.co/BAAI/bge-m3",
      "docker-templates/arabic-embeddings.json",
      "infra/config/arabic-portfolio.json"
    ]
  },
  {
    "canonical_name": "BGE Reranker v2 M3",
    "repo": "BAAI/bge-reranker-v2-m3",
    "origin_creator": "BAAI",
    "parameter_count": "not_explicitly_published",
    "architecture_family": "XLM-RoBERTa-based cross-encoder reranker",
    "language_coverage": "multilingual",
    "license_commercial_notes": "Apache-2.0",
    "practical_vram_gb_baseline": 8,
    "dcp_mapping": {"template": "arabic-reranker", "portfolio": "tier_b/reranker-v2-m3"},
    "sources": [
      "https://huggingface.co/BAAI/bge-reranker-v2-m3",
      "docker-templates/arabic-reranker.json",
      "infra/config/arabic-portfolio.json"
    ]
  },
  {
    "canonical_name": "Stable Diffusion v1.4",
    "repo": "CompVis/stable-diffusion-v1-4",
    "origin_creator": "CompVis / Stability ecosystem",
    "parameter_count": "not_explicitly_published_in_card",
    "architecture_family": "latent diffusion text-to-image",
    "language_coverage": "text-prompt image generation (language is prompt dependent)",
    "license_commercial_notes": "CreativeML Open RAIL-M (review use restrictions)",
    "practical_vram_gb_baseline": 4,
    "dcp_mapping": {"template": "stable-diffusion"},
    "sources": [
      "https://huggingface.co/CompVis/stable-diffusion-v1-4",
      "docker-templates/stable-diffusion.json"
    ]
  },
  {
    "canonical_name": "Stable Diffusion XL Base 1.0",
    "repo": "stabilityai/stable-diffusion-xl-base-1.0",
    "origin_creator": "Stability AI",
    "parameter_count": "not_explicitly_published_in_card",
    "architecture_family": "latent diffusion (SDXL base + optional refiner pipeline)",
    "language_coverage": "text-prompt image generation",
    "license_commercial_notes": "OpenRAIL++ / CreativeML Open RAIL++-M (review restrictions)",
    "practical_vram_gb_baseline": 16,
    "dcp_mapping": {"template": "stable-diffusion example model", "portfolio": "tier_b/sdxl-base-1.0"},
    "sources": [
      "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0",
      "docker-templates/stable-diffusion.json",
      "infra/config/arabic-portfolio.json"
    ]
  },
  {
    "canonical_name": "Phi-3 Mini 4K Instruct",
    "repo": "microsoft/Phi-3-mini-4k-instruct",
    "origin_creator": "Microsoft",
    "parameter_count": "3.8B",
    "architecture_family": "dense decoder-only Transformer",
    "language_coverage": "primarily English",
    "license_commercial_notes": "MIT; card states broad commercial and research use",
    "practical_vram_gb_baseline": 6,
    "dcp_mapping": {"docs_matrix": true},
    "sources": [
      "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct",
      "docs/model-cards.mdx"
    ]
  },
  {
    "canonical_name": "DeepSeek R1 Distill Qwen 7B",
    "repo": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
    "origin_creator": "DeepSeek-AI",
    "parameter_count": "8B (HF model-size metadata)",
    "architecture_family": "Qwen2.5-based distilled reasoning model",
    "language_coverage": "general multilingual LLM usage; model card compares EN + CN benchmarks",
    "license_commercial_notes": "MIT; model card states commercial use support",
    "practical_vram_gb_baseline": 16,
    "dcp_mapping": {"docs_matrix": true},
    "sources": [
      "https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
      "docs/model-cards.mdx"
    ]
  }
]
```

## 3) Required comparison notes

### Arabic model comparison: ALLaM 7B vs Falcon H1 7B vs JAIS 13B

- **Arabic specialization**:
  - `ALLaM 7B`: explicitly Arabic-first pretraining path and bilingual EN/AR support from the model card.
  - `JAIS 13B`: bilingual Arabic+English model card and Arabic-focused intended use.
  - `Falcon H1 7B`: multilingual architecture and language support, but not explicitly Arabic-first in the same way as ALLaM/JAIS.
- **Model class / architecture**:
  - `ALLaM`: autoregressive transformer.
  - `Falcon H1`: hybrid Transformer+Mamba (hybrid-head), intended for efficiency-performance tradeoffs.
  - `JAIS`: decoder-only causal LM.
- **Size + DCP infra implication**:
  - `ALLaM` and `Falcon H1` are both operationally in DCP `24 GB` tier in `arabic-portfolio`.
  - `JAIS 13B` is larger (13B-class) and also set to `24 GB` baseline in DCP portfolio/docs matrix.
- **Docs matrix snapshot (from `docs/model-cards.mdx`)**:
  - Arabic quality ranking in the current table: `JAIS` > `ALLaM` > `Falcon H1` on both Arabic MMLU and ArabicaQA.
  - Cost/latency in the current table: `Falcon H1` is cheaper/faster than `ALLaM`, while `JAIS` is highest quality but highest cost/latency among the three.

### Embedding stack comparison: BGE-M3 vs BGE Reranker

- **Role split**:
  - `BGE-M3`: retrieval-stage embedding model (bi-encoder style outputs incl. dense/sparse/multi-vector support).
  - `BGE Reranker v2 M3`: second-stage cross-encoder reranker for improved final relevance ordering.
- **Operational pattern for DCP docs**:
  - Recommend documenting as a **two-stage stack**: retrieve with `bge-m3` then rerank top-k with `bge-reranker-v2-m3`.
- **DCP resource profile alignment**:
  - Both currently configured at `8 GB` practical baseline in templates/portfolio with warm cache policy, which matches low-latency RAG serving targets.

## 4) Primary source links index

- ALLaM: https://huggingface.co/humain-ai/ALLaM-7B-Instruct-preview
- Falcon H1: https://huggingface.co/tiiuae/Falcon-H1-7B-Instruct
- Falcon H1 paper: https://arxiv.org/abs/2507.22448
- JAIS: https://huggingface.co/inceptionai/jais-13b-chat
- Qwen2 7B: https://huggingface.co/Qwen/Qwen2-7B-Instruct
- Qwen2 72B: https://huggingface.co/Qwen/Qwen2-72B-Instruct
- Llama 3 8B: https://huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct
- Llama 3 70B: https://huggingface.co/meta-llama/Meta-Llama-3-70B-Instruct
- Llama 3 license: https://llama.meta.com/llama3/license
- Mistral 7B Instruct v0.2: https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2
- TinyLlama 1.1B Chat: https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0
- BGE-M3: https://huggingface.co/BAAI/bge-m3
- BGE Reranker v2 M3: https://huggingface.co/BAAI/bge-reranker-v2-m3
- Stable Diffusion v1.4: https://huggingface.co/CompVis/stable-diffusion-v1-4
- Stable Diffusion XL Base: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
- Phi-3 Mini 4K Instruct: https://huggingface.co/microsoft/Phi-3-mini-4k-instruct
- DeepSeek R1 Distill Qwen 7B: https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B

