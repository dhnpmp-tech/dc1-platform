# Template Catalog: Buyer-Facing Copy & Positioning

**Classification:** Product/Marketing Copy
**Date:** 2026-03-23
**Audience:** Renters (AI developers, ML engineers, data scientists, enterprises)
**Use Case:** Marketplace UI template discovery, browsing, filtering, deployment

---

## Overview

DCP's template catalog offers 20 pre-configured containers for common AI workloads. This document provides:

1. **Buyer copy for each template** (what it does, who should use it, pricing positioning)
2. **Category structure** (how templates are grouped in the UI)
3. **Filter/browse messaging** (search facets and labels)
4. **Tooltips and help text** (brief explanations for the UI)
5. **One-click deployment messaging** (call-to-action copy)

---

## Template Categories & Structure

```
┌─ Arabic NLP
│  ├─ Arabic Embeddings (BGE-M3)
│  └─ Arabic Reranking (BGE-Reranker)
│
├─ Arabic Large Language Models
│  ├─ ALLaM 7B (Arabic-Native)
│  ├─ JAIS 13B (Gulf-Optimized)
│  ├─ Qwen 2.5 7B (Multilingual, Arabic)
│  ├─ Llama 3 8B (Multilingual fallback)
│  └─ Mistral 7B (Multilingual fallback)
│
├─ Vision & Image Generation
│  ├─ SDXL (Stable Diffusion XL)
│  └─ Stable Diffusion 3 (Fast image generation)
│
├─ Inference Serving
│  ├─ vLLM Serve (Fast LLM inference)
│  └─ Ollama (Lightweight model serving)
│
├─ Model Training & Fine-Tuning
│  ├─ PyTorch Base (GPU-enabled training)
│  ├─ PyTorch CUDA (NVIDIA-optimized training)
│  ├─ LoRA Fine-Tuning (Parameter-efficient LLM tuning)
│  └─ QLoRA Fine-Tuning (Memory-efficient LLM tuning)
│
├─ Development & Analysis
│  ├─ Jupyter Lab (Interactive notebooks)
│  ├─ Python Scientific Compute (NumPy, SciPy, scikit-learn)
│  └─ Custom Container (Bring your own image)
```

---

## Template Catalog Copy (Detailed)

### Category: Arabic NLP

---

#### **Template: Arabic Embeddings (BGE-M3)**

**Card Title:** Arabic Embeddings Model
**Short Description:** Convert Arabic text to semantic vectors. Perfect for search, retrieval, and clustering.

**Full Description:**
```
Arabic Embeddings powers semantic search, document similarity, and AI retrieval.

What it does:
- Converts Arabic documents into 768-dimensional semantic vectors
- Specialized for Arabic legal, government, medical, and financial text
- Enables similarity search, clustering, and recommendation engines

Who should use it:
- Law firms building contract search systems
- Government agencies processing legislative documents
- Banks detecting fraudulent patterns in Arabic financial text
- Healthcare systems searching patient records
- Any organization with large Arabic document archives

Performance:
- Throughput: 5,000-10,000 documents/hour (ingestion)
- Latency: 10-50ms per embedding (inference)
- Accuracy: 92%+ F1 on Arabic legal document retrieval

Typical workload: 4x RTX 4090 or 1x H100 (batch processing) / RTX 4090 (real-time)
Price: $0.12/hour (RTX 4090) | $0.18/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Arabic #Embeddings #NLP #PDPL-Safe
- **Pricing Label:** "From $0.12/hr"
- **Trust Badge:** "PDPL-Compliant | In-Kingdom Data"
- **CTA:** "Deploy Arabic Embeddings"
- **Learn More Link:** [Arabic RAG Guide]

**Tooltip (Hover):**
"Generate semantic vectors from Arabic text. Used in search engines, retrieval systems, and similarity analysis. Data stays in Saudi Arabia."

---

#### **Template: Arabic Reranking (BGE-Reranker)**

**Card Title:** Arabic Reranker
**Short Description:** Refine search results by semantic relevance. Used in RAG pipelines.

**Full Description:**
```
Arabic Reranker improves retrieval quality by re-scoring search results.

What it does:
- Takes top-K search results from embedding-based retrieval
- Re-ranks by semantic relevance (cross-encoder scoring)
- Dramatically improves RAG quality (top-1 accuracy +30%)

Who should use it:
- Building production RAG systems (retrieval + reranking + generation)
- Law firms, government, healthcare, finance with large document corpora
- Any organization that needs high-precision retrieval

Performance:
- Reranking latency: 50-200ms for top-100 results
- Throughput: 1,000-2,000 queries/hour
- Accuracy improvement: +30% top-1 accuracy vs embedding-only

Typical workload: 1x RTX 4090 (easily saturated)
Price: $0.12/hour (RTX 4090)
```

**UI Copy:**
- **Filter Tag:** #Arabic #Retrieval #RAG #NLP
- **Pricing Label:** "From $0.12/hr"
- **Trust Badge:** "PDPL-Compliant"
- **CTA:** "Deploy Reranker"
- **Bundle Suggestion:** "Pair with Arabic Embeddings for end-to-end RAG"

**Tooltip:**
"Improves search result quality by semantic re-ranking. Critical component of production RAG systems."

---

### Category: Arabic Large Language Models

---

#### **Template: ALLaM 7B (Arabic-Native LLM)**

**Card Title:** ALLaM 7B - Arabic-Native LLM
**Short Description:** Saudi-built LLM. Fluent in Arabic, trained on Arabic data. Best for Arabic-first workloads.

**Full Description:**
```
ALLaM is the first Arabic-native large language model.

What it does:
- Instruction-following Arabic LLM (chat, summarization, classification)
- Optimized for Arabic grammar, context, and cultural semantics
- Fine-tuned on Arabic datasets (literature, news, technical docs)

Who should use it:
- Arabic content generation (news, marketing, social media)
- Government/legal document analysis
- Arabic customer support chatbots
- Arabic-language research and summarization
- Arabic RAG systems (combined with embeddings + reranker)

Capabilities:
- Context length: 2,048 tokens
- Arabic fluency: 95%+ (native speaker evaluation)
- Latency: 50-100ms per token (single batch)
- Throughput: 500-1,000 tokens/second (H100 batch)

Typical workload: 1x RTX 4090 (real-time chat) | 4x H100 (high-throughput)
Price: $0.12/hour (RTX 4090) | $0.35/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Arabic #LLM #Chat #RAG
- **Pricing Label:** "From $0.12/hr"
- **Premium Badge:** "Saudi-Built | Arabic-First"
- **CTA:** "Deploy ALLaM 7B"
- **Popular Use Case:** "Arabic RAG systems, government analysis, cultural content"

**Tooltip:**
"Arabic-native language model. Best for Arabic-only or Arabic-first workloads. Understands Arabic idioms, legal terminology, and cultural context."

---

#### **Template: JAIS 13B (Gulf-Optimized LLM)**

**Card Title:** JAIS 13B - Gulf Arabic LLM
**Short Description:** UAE-optimized Arabic LLM. Understands Gulf dialects and business language.

**Full Description:**
```
JAIS is a Gulf Arabic LLM trained on UAE/Gulf data.

What it does:
- Instruction-following LLM optimized for Gulf Arabic dialect
- Trained on Gulf news, business, government documents
- Larger model (13B) than ALLaM, better reasoning

Who should use it:
- Gulf region organizations (UAE, Kuwait, Qatar, Saudi)
- Business Arabic (contracts, reports, correspondence)
- Government/finance systems in the Gulf
- Arabic RAG systems requiring stronger reasoning

Capabilities:
- Context length: 4,096 tokens (larger than ALLaM)
- Gulf Arabic expertise: 98%+
- Reasoning quality: Better for complex tasks
- Latency: 100-200ms per token

Typical workload: 2x H100 (real-time) | 4-8x H100 (high-throughput)
Price: $0.35/hour (H100 pair) | $0.70/hour (4x H100)
```

**UI Copy:**
- **Filter Tag:** #Arabic #GulfDialect #LLM #Business
- **Pricing Label:** "From $0.35/hr"
- **Premium Badge:** "Gulf-Optimized | Larger Context"
- **CTA:** "Deploy JAIS 13B"
- **Use Case:** "Business Arabic, government contracts, Gulf financial services"

**Tooltip:**
"Gulf Arabic language model. Optimized for UAE, Saudi Arabia, Kuwait business use cases. Larger and more capable than ALLaM 7B."

---

#### **Template: Qwen 2.5 7B (Multilingual, Arabic)**

**Card Title:** Qwen 2.5 7B - Multilingual with Strong Arabic
**Short Description:** Multilingual LLM with strong Arabic support. English + Arabic + 20+ languages.

**Full Description:**
```
Qwen 2.5 is a multilingual LLM with excellent Arabic support.

What it does:
- Instruction-following LLM supporting 20+ languages including Arabic
- Balanced performance across all languages (no native-language preference)
- Strong for mixed-language workloads

Who should use it:
- Organizations operating in multiple languages (e.g., multinational Saudi companies)
- Projects requiring both Arabic and English fluency
- RAG systems needing language flexibility
- General-purpose LLM serving diverse users

Capabilities:
- Languages: Arabic, English, Chinese, French, Spanish, German, Japanese, etc.
- Arabic quality: 90%+ (multilingual tradeoff)
- Context length: 4,096 tokens
- Instruction following: Excellent

Typical workload: 1x H100 (real-time) | 4x H100 (high-throughput)
Price: $0.35/hour (H100) | $1.40/hour (4x H100)
```

**UI Copy:**
- **Filter Tag:** #Multilingual #Arabic #LLM #English
- **Pricing Label:** "From $0.35/hr"
- **CTA:** "Deploy Qwen 2.5 7B"
- **Use Case:** "Multilingual teams, international projects, mixed-language RAG"

**Tooltip:**
"Multilingual LLM with strong Arabic support. Best for organizations needing both Arabic and English (or other languages)."

---

#### **Template: Llama 3 8B (Multilingual Fallback)**

**Card Title:** Llama 3 8B - Multilingual Open LLM
**Short Description:** Meta's open-source LLM. Multilingual, community-tested, widely compatible.

**Full Description:**
```
Llama 3 is Meta's open-source multilingual language model.

What it does:
- General-purpose instruction-following LLM
- Supports 8+ languages including Arabic
- Widely compatible with existing LLM tooling and frameworks

Who should use it:
- Developers who want open-source LLM freedom
- Projects requiring compatibility with LLM frameworks (Ollama, llama.cpp, vLLM)
- Budget-conscious teams (no licensing concerns)
- English-primary workloads that need Arabic as secondary support

Capabilities:
- Languages: Primarily English, with Arabic/Chinese/Spanish/French support
- Arabic quality: 75-80% (secondary language)
- Context length: 8,192 tokens
- Open license: No proprietary restrictions

Typical workload: 1x H100 | 2x H100
Price: $0.35/hour (H100) | $0.70/hour (2x H100)
```

**UI Copy:**
- **Filter Tag:** #OpenSource #Multilingual #LLM #Community
- **Pricing Label:** "From $0.35/hr"
- **CTA:** "Deploy Llama 3 8B"
- **Note:** "Open-source. Widely compatible. Community-supported."

**Tooltip:**
"Meta's open-source LLM. Great for developers who want LLM flexibility and open-source benefits."

---

#### **Template: Mistral 7B (Lightweight Multilingual)**

**Card Title:** Mistral 7B - Lightweight Multilingual LLM
**Short Description:** Fast, lightweight multilingual LLM. Great for inference latency-sensitive workloads.

**Full Description:**
```
Mistral is a fast, lightweight multilingual LLM optimized for low latency.

What it does:
- Compact 7B model with minimal compute requirements
- Instruction-following across multiple languages
- Optimized for real-time latency (chat, live translation, rapid inference)

Who should use it:
- Real-time chat/conversational applications
- Live translation or multilingual search
- Edge deployment or latency-sensitive inference
- Cost-conscious inference (runs on single RTX 4090)

Capabilities:
- Latency: 20-50ms per token (fastest in category)
- Languages: Arabic, English, French, German, Spanish, Italian
- Context length: 32K tokens
- Model size: 7.3B parameters

Typical workload: 1x RTX 4090 (excellent throughput)
Price: $0.12/hour (RTX 4090)
```

**UI Copy:**
- **Filter Tag:** #FastInference #Multilingual #LLM #Latency-Optimized
- **Pricing Label:** "From $0.12/hr (Cheapest)"
- **CTA:** "Deploy Mistral 7B"
- **Highlight:** "Fastest inference on DCP. Best RTX 4090 throughput."

**Tooltip:**
"Lightweight and fast. Ideal for latency-sensitive real-time applications like chat, search, and live translation."

---

### Category: Vision & Image Generation

---

#### **Template: SDXL (Stable Diffusion XL)**

**Card Title:** SDXL - Stable Diffusion XL
**Short Description:** High-quality image generation. Text-to-image, style transfer, inpainting.

**Full Description:**
```
SDXL is the latest Stable Diffusion model for image generation.

What it does:
- Text-to-image generation (describe an image, SDXL creates it)
- Style transfer and artistic effects
- Inpainting (edit images) and outpainting
- High-quality output (1024x1024 native)

Who should use it:
- Content creators, designers, marketing teams
- Automated image generation pipelines
- Architectural visualization and prototyping
- Creative professionals requiring high-quality image synthesis

Performance:
- Image generation time: 20-40 seconds per 1024x1024 image
- Batch throughput: 2-5 images/minute
- Quality: SOTA image generation quality
- VRAM: 20-24GB (H100, RTX 4090)

Typical workload: 1x H100 or 2x RTX 4090
Price: $0.35/hour (H100) | $0.24/hour (2x RTX 4090)
```

**UI Copy:**
- **Filter Tag:** #Vision #ImageGeneration #Diffusion #Creative
- **Pricing Label:** "From $0.24/hr"
- **CTA:** "Deploy SDXL"
- **Use Case:** "Content creation, design, visualization, marketing"

**Tooltip:**
"Generate high-quality images from text descriptions. SOTA for image synthesis and creative workflows."

---

#### **Template: Stable Diffusion 3 (Fast Image Gen)**

**Card Title:** Stable Diffusion 3 - Fast Image Generation
**Short Description:** Latest Stable Diffusion. Faster, better quality, multi-language text support.

**Full Description:**
```
Stable Diffusion 3 is the newest image generation model.

What it does:
- Text-to-image generation with improved quality
- Better multi-language text (including Arabic)
- Faster inference than SDXL
- Improved compositional accuracy

Who should use it:
- Marketing and design teams
- Content creators needing Arabic text in images
- Organizations wanting fast image generation at scale
- Anyone using SDXL who wants better/faster results

Performance:
- Image generation: 15-30 seconds per 1024x1024 (faster than SDXL)
- Throughput: 3-8 images/minute
- Arabic text quality: Much improved
- VRAM: 16-20GB (RTX 4090)

Typical workload: 1x RTX 4090 or 1x H100
Price: $0.12/hour (RTX 4090) | $0.35/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Vision #ImageGeneration #FastInference #Arabic
- **Pricing Label:** "From $0.12/hr"
- **CTA:** "Deploy Stable Diffusion 3"
- **Highlight:** "Faster than SDXL. Better Arabic text support."

**Tooltip:**
"Latest image generation model. Faster, better quality, improved Arabic text support."

---

### Category: Inference Serving

---

#### **Template: vLLM Serve (Fast LLM Inference)**

**Card Title:** vLLM Inference Server
**Short Description:** High-throughput LLM inference engine. Perfect for RAG systems and API servers.

**Full Description:**
```
vLLM is an optimized inference server for large language models.

What it does:
- Runs any HuggingFace-compatible LLM with optimized throughput
- Serves LLM inference via REST API (OpenAI-compatible)
- Batches requests for maximum GPU utilization
- Supports thousands of concurrent requests

Who should use it:
- Building production RAG systems (behind the scenes)
- Running LLM APIs for applications
- Batch processing (document summarization, classification)
- Any workload requiring high-throughput LLM inference

Performance:
- Throughput: 1,000-10,000 tokens/second (depends on model, GPU)
- Latency: 50-500ms per request (batch-dependent)
- Supports: Any HuggingFace model (ALLaM, Qwen, Llama, Mistral, etc.)
- Concurrency: 100s of simultaneous requests

Typical workload: Varies by model and throughput requirement
Price: Model-dependent (e.g., $0.35/hr for H100)
```

**UI Copy:**
- **Filter Tag:** #Inference #API #LLM #HighThroughput
- **Pricing Label:** "Model-Dependent"
- **CTA:** "Deploy vLLM Server"
- **Use Case:** "Production RAG, LLM APIs, batch inference"

**Tooltip:**
"Optimized LLM inference engine. Used behind-the-scenes in production RAG and LLM API systems. Extremely high throughput."

---

#### **Template: Ollama (Lightweight Model Serving)**

**Card Title:** Ollama - Easy Model Serving
**Short Description:** Lightweight model server. Perfect for running models locally or in containers.

**Full Description:**
```
Ollama is a lightweight model serving tool.

What it does:
- Serves LLMs, embedding models, and other ML models
- Simple command-line interface
- Built-in support for popular models (Llama, Mistral, Qwen, etc.)
- Compatible with major LLM frameworks

Who should use it:
- Developers experimenting with LLMs
- Local development/testing before production deployment
- Organizations wanting a simple model server (no complex infrastructure)
- Quick prototyping and POCs

Performance:
- Easy to use, minimal configuration
- Lower throughput than vLLM (not optimized for production scale)
- Great for learning and experimentation
- Good for moderate-scale inference

Typical workload: 1x RTX 4090
Price: $0.12/hour (RTX 4090)
```

**UI Copy:**
- **Filter Tag:** #Inference #EasyToUse #Development #LLM
- **Pricing Label:** "From $0.12/hr"
- **CTA:** "Deploy Ollama"
- **Note:** "Best for development and experimentation."

**Tooltip:**
"Simple, lightweight model server. Great for learning, development, and quick POCs."

---

### Category: Model Training & Fine-Tuning

---

#### **Template: PyTorch Base (GPU-Enabled Training)**

**Card Title:** PyTorch - GPU Training Environment
**Short Description:** PyTorch with CUDA support. For model training, fine-tuning, and ML research.

**Full Description:**
```
PyTorch GPU training environment with all dependencies pre-installed.

What it does:
- Runs PyTorch code with GPU acceleration
- Includes: CUDA, cuDNN, PyTorch, NumPy, SciPy, Jupyter
- Pre-built with common dependencies for ML research

Who should use it:
- Training custom models
- Fine-tuning foundation models (LLMs, vision models)
- ML research and experimentation
- Deep learning workloads of any kind

Performance:
- Depends on your code and GPU
- GPUs: RTX 4090, H100, H200 (choose based on model size)
- Multi-GPU support (if needed)

Typical workload: Model-dependent (1x-8x H100 for large models)
Price: GPU-dependent (e.g., $0.35/hour for H100)
```

**UI Copy:**
- **Filter Tag:** #Training #PyTorch #Research #Development
- **Pricing Label:** "GPU-Dependent"
- **CTA:** "Deploy PyTorch"
- **Use Case:** "Model training, fine-tuning, ML research"

**Tooltip:**
"PyTorch training environment with GPU support. Bring your own training code."

---

#### **Template: PyTorch CUDA (NVIDIA-Optimized Training)**

**Card Title:** PyTorch CUDA - NVIDIA-Optimized
**Short Description:** PyTorch with NVIDIA CUDA libraries and optimizations.

**Full Description:**
```
PyTorch CUDA with NVIDIA optimizations for maximum GPU performance.

What it does:
- Same as PyTorch Base, but with NVIDIA optimization libraries
- Includes: CUDA, cuDNN, TensorRT, NCCL for multi-GPU training
- Optimized for NVIDIA GPUs (RTX, H100, H200)

Who should use it:
- Large-scale model training
- Multi-GPU training (across GPUs/nodes)
- Organizations requiring maximum GPU throughput
- Deep learning at scale

Performance:
- 10-30% faster than stock PyTorch (depends on optimization usage)
- Multi-GPU training: Near-linear scaling
- Supports distributed training

Typical workload: Multi-GPU large model training (4x-8x H100)
Price: GPU-dependent
```

**UI Copy:**
- **Filter Tag:** #Training #PyTorch #CUDA #MultiGPU
- **Pricing Label:** "GPU-Dependent"
- **CTA:** "Deploy PyTorch CUDA"
- **Highlight:** "NVIDIA-optimized. For large-scale training."

**Tooltip:**
"NVIDIA-optimized PyTorch. Best for large-scale and multi-GPU training."

---

#### **Template: LoRA Fine-Tuning (Parameter-Efficient LLM Tuning)**

**Card Title:** LoRA Fine-Tuning
**Short Description:** Fine-tune language models with 10-50x fewer parameters. Efficient and cost-effective.

**Full Description:**
```
LoRA (Low-Rank Adaptation) enables efficient LLM fine-tuning.

What it does:
- Fine-tune any LLM (LLaMA, Qwen, ALLaM, Mistral, etc.) on your data
- Uses 10-50x fewer parameters than full fine-tuning
- Much faster and cheaper than traditional fine-tuning

Who should use it:
- Customizing language models on domain-specific data
- Fine-tuning for specific tasks (classification, extraction, summarization)
- Organizations with limited training budgets
- Rapid iteration on model variants

Performance:
- Training time: Hours to days (vs weeks for full fine-tuning)
- GPU requirement: Single GPU (RTX 4090 or H100)
- Quality: 95%+ of full fine-tuning, 50x cheaper

Typical workload: 1x H100 (1-4 days training for large LLMs)
Price: $0.35/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Training #LLM #Efficient #DomainAdaptation
- **Pricing Label:** "From $0.35/hr"
- **CTA:** "Deploy LoRA Fine-Tuning"
- **Highlight:** "50x cheaper and faster than full fine-tuning."

**Tooltip:**
"Parameter-efficient fine-tuning. Fine-tune LLMs on your data for a fraction of the cost."

---

#### **Template: QLoRA Fine-Tuning (Memory-Efficient LLM Tuning)**

**Card Title:** QLoRA Fine-Tuning
**Short Description:** Ultra-efficient LLM fine-tuning with 4-bit quantization. Fit huge models on single GPU.

**Full Description:**
```
QLoRA (Quantized LoRA) combines quantization with LoRA for extreme efficiency.

What it does:
- Fine-tune even the largest models (70B+) on a single GPU
- 4-bit quantization reduces memory 75%
- LoRA reduces trainable parameters 99%+
- Combined: Fit 70B model in 24GB VRAM

Who should use it:
- Fine-tuning very large LLMs
- Budget-constrained teams (can use single RTX 4090)
- Rapid iteration on large model variants
- Custom models on small budgets

Performance:
- Training time: 1-3 days for 70B models (on H100)
- GPU requirement: Single RTX 4090 can train 30B models
- Quality: 90-95% of full fine-tuning
- Cost: ~50x cheaper than full fine-tuning of large models

Typical workload: 1x RTX 4090 (for 30B models) or 1x H100 (for 70B models)
Price: $0.12/hour (RTX 4090) | $0.35/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Training #LLM #MemoryEfficient #QuantizedLoRA
- **Pricing Label:** "From $0.12/hr"
- **CTA:** "Deploy QLoRA Fine-Tuning"
- **Highlight:** "Fine-tune 70B models on single GPU. Ultra-efficient."

**Tooltip:**
"Extreme efficiency LLM fine-tuning. Fit and train massive models on single GPU."

---

### Category: Development & Analysis

---

#### **Template: Jupyter Lab (Interactive Notebooks)**

**Card Title:** Jupyter Lab with GPU Support
**Short Description:** Interactive Python notebooks with GPU. Perfect for ML development and exploration.

**Full Description:**
```
Jupyter Lab with GPU-accelerated Python environment.

What it does:
- Interactive Jupyter notebooks with GPU access
- Pre-installed: NumPy, Pandas, Scikit-learn, Matplotlib, PyTorch, TensorFlow
- GPU acceleration for computationally intensive work
- Perfect for ML development, data analysis, visualization

Who should use it:
- ML engineers and data scientists
- Anyone developing ML code interactively
- Exploratory data analysis
- Prototyping before moving to production

Typical workload: 1x RTX 4090 or 1x H100
Price: $0.12/hour (RTX 4090) | $0.35/hour (H100)
```

**UI Copy:**
- **Filter Tag:** #Development #Jupyter #InteractiveNotebooks #GPU
- **Pricing Label:** "From $0.12/hr"
- **CTA:** "Deploy Jupyter Lab"
- **Use Case:** "Data analysis, ML development, prototyping"

**Tooltip:**
"Interactive Jupyter notebooks with GPU support. Perfect for exploring data and developing ML code."

---

#### **Template: Python Scientific Compute**

**Card Title:** Python Scientific Computing Stack
**Short Description:** NumPy, SciPy, scikit-learn, Pandas. For numerical computing and data science.

**Full Description:**
```
Complete Python scientific computing environment.

What it does:
- Pre-installed: NumPy, SciPy, Pandas, scikit-learn, Matplotlib, Plotly
- GPU acceleration (CUDA-enabled libraries where applicable)
- Optimized for numerical computing, data analysis, statistics

Who should use it:
- Data science work
- Statistical analysis
- Numerical simulations
- Machine learning preprocessing and feature engineering

Typical workload: 1x RTX 4090
Price: $0.12/hour (RTX 4090)
```

**UI Copy:**
- **Filter Tag:** #DataScience #ScientificComputing #Analysis
- **Pricing Label:** "From $0.12/hr"
- **CTA:** "Deploy Python Scientific Compute"
- **Use Case:** "Data analysis, preprocessing, statistical work"

**Tooltip:**
"Scientific Python stack (NumPy, Pandas, scikit-learn). For data science and numerical analysis."

---

#### **Template: Custom Container (Bring Your Own)**

**Card Title:** Custom Container
**Short Description:** Deploy any Docker image. For advanced users and custom workflows.

**Full Description:**
```
Deploy any Docker container image on DCP GPU.

What it does:
- Run your own Docker image with GPU support
- Access to any software stack
- Full control over environment

Who should use it:
- Advanced users with custom requirements
- Proprietary software
- Legacy systems
- Anything not covered by our pre-built templates

Typical workload: User-defined
Price: GPU-dependent (e.g., $0.35/hour for H100)
```

**UI Copy:**
- **Filter Tag:** #Custom #Docker #Advanced #FlexibleEnvironment
- **Pricing Label:** "GPU-Dependent"
- **CTA:** "Deploy Custom Container"
- **Note:** "Advanced users only. Bring your own Docker image."

**Tooltip:**
"Deploy any Docker container. For custom requirements and proprietary software."

---

## UI/UX Copy & Messaging

### Filter Labels & Facets

```
Language Support:
  [ ] Arabic
  [ ] Multilingual
  [ ] English

Task Category:
  [ ] Text Generation
  [ ] Search & Retrieval
  [ ] Image Generation
  [ ] Model Training
  [ ] Data Analysis
  [ ] Development

GPU Size:
  [ ] RTX 4090 ($0.12/hr)
  [ ] H100 ($0.35/hr)
  [ ] H200 ($0.50/hr)
  [ ] Multiple GPUs

Performance:
  [ ] Real-time (<100ms latency)
  [ ] High-throughput (>1000 tokens/sec)
  [ ] Cost-optimized
  [ ] Memory-efficient

Compliance:
  [x] PDPL-Compliant
  [ ] Open-source
  [ ] Commercial

Use Case:
  [ ] Enterprise
  [ ] Research
  [ ] Production
  [ ] Development/Learning
```

### Browse/Search Messaging

**Category Descriptions:**

- **Arabic NLP:** "Search, embed, and understand Arabic text. Purpose-built for Arabic language tasks."
- **Arabic LLMs:** "Chat, write, and reason in Arabic. Choose from Arabic-native or multilingual models."
- **Vision & Images:** "Generate, edit, and analyze images. Text-to-image generation and visual AI."
- **Inference Serving:** "Serve LLMs and models as APIs. High-throughput, low-latency inference."
- **Training:** "Fine-tune and train models. From parameter-efficient LoRA to full training."
- **Development:** "Notebooks, data analysis, custom containers. Tools for AI development."

### Call-to-Action Copy

**Primary CTA:**
```
"Deploy [Template Name]"
```

**Secondary CTAs:**
```
"Learn More"
"View Benchmarks"
"Check Pricing"
"Request Custom Config"
"Bundle with [Related Template]"
```

### Deployment Messaging

**After Selecting a Template:**

```
Selected: [Template Name]

1. Choose GPU:
   - RTX 4090: $0.12/hr (Good for low-to-medium throughput)
   - H100: $0.35/hr (Best for production inference)
   - H200: $0.50/hr (Maximum throughput, largest models)

2. Set Duration:
   - Hourly (pay-as-you-go)
   - Daily pass ($2/hr → $48/day)
   - Weekly pass ($2/hr → $336/week)
   - Monthly pass ($2/hr → $1,440/month)

3. Advanced Options:
   - [ ] Multiple GPUs (if supported)
   - [ ] Data persistence (attach storage)
   - [ ] Custom configuration
   - [ ] Support tier upgrade

[Deploy] [Save as Preset] [Talk to Expert]
```

### Success & Confirmation

**After Deployment:**

```
✅ Your [Template Name] is running!

Access URL: https://your-notebook.dcp.sa
Status: ✅ Ready (100%)
GPU: H100 | Session Time: 1h 23m remaining
Cost: $0.35/hour

Quick Links:
- View Logs
- Stop Instance
- Extend Time
- Change GPU Tier
- Get Support
```

---

## Notes for Product/UI Team

### Wireframe Integration

- **Browse Page:** Show 20 templates in grid or list view
- **Template Card:** Title, short description, pricing, key stats (GPU, throughput), CTA
- **Detail Page:** Full description, performance benchmarks, similar templates, CTA
- **Filter Sidebar:** Category, language, GPU, task type, use case
- **Search:** Full-text search across template names, descriptions, use cases

### Copy Maintenance

- All template pricing should reference current GPU pricing (update quarterly)
- Performance benchmarks should be validated by ML Infra team
- Use case descriptions should be validated by Sales team
- Arabic content should be reviewed by Arabic language specialist (if translations added)

### Localization Notes

- Primary language: English (US)
- Secondary: Arabic (future)
- Current version: English only
- All Arabic references (e.g., "Arabic Embeddings," "Arabic RAG") are product names in English

### Version Control

- Version 1.0 committed 2026-03-23
- Future updates should be tracked in git with date stamps

---

**Version:** 1.0
**Last Updated:** 2026-03-23
**Author:** Copywriter (DCP)
**Distribution:** Product, Marketing, Sales, UI/UX Team
