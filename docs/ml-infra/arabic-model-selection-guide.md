# Arabic Model Selection Guide

## Overview

This guide helps developers and renters choose the right Arabic model from DCP's Tier A portfolio. Each model has distinct strengths, limitations, and ideal use cases.

**Quick Decision Tree:**
- Need formal/legal Arabic? → **ALLaM 7B**
- Need conversational/chatbot? → **Falcon H1 7B**
- Need technical + Arabic + customization? → **Qwen 2.5 7B**
- Need best overall balance? → **Llama 3 8B**
- Need fastest response? → **Mistral 7B**
- Need instant response (edge/mobile)? → **Nemotron 4B**

---

## 1. ALLaM 7B Instruct

### Model Info
- **Developer:** Technology Innovation Institute (TII), UAE
- **Parameters:** 7 billion (7B)
- **VRAM:** 16 GB minimum, 22 GB recommended
- **Tokenizer:** SentencePiece (Arabic-optimized)
- **Training Data:** Primarily Arabic (government, legal, technical documents)

### Strengths
✅ **Best Arabic Language Quality**
- Trained on 500B+ Arabic tokens from government, legal, and technical sources
- >95% accuracy on formal Arabic tasks (government circulars, legal contracts)
- Excellent at understanding context-dependent Arabic grammar

✅ **Government & Legal Documents**
- Specialized in policy documents, ministerial circulars, contract language
- Understands formal Arabic (Fusha) with legal/administrative terminology
- Low hallucination rate on factual legal documents

✅ **Entity Recognition**
- Excellent at extracting names, dates, monetary amounts in Arabic
- Accurate on organizational structure and hierarchies in Arabic text

### Limitations
❌ **Slower Performance**
- 6.2s cold start (longer than Mistral, Falcon)
- 145 tok/s throughput (moderate for 7B model)
- Not suitable for real-time latency-sensitive applications

❌ **Limited Dialect Support**
- Primarily trained on formal Arabic (Fusha)
- Less capable with colloquial/dialectal Arabic (Egyptian, Saudi, Levantine)
- May struggle with modern slang or social media Arabic

❌ **No Built-in Multilingual**
- Primarily Arabic; limited English/multilingual support compared to others

### Recommended Use Cases
1. **Government Document Processing**
   - Extract info from ministerial decisions, policy documents
   - Classify documents by topic/urgency
   - Generate policy summaries

2. **Legal Contract Analysis**
   - Extract terms, obligations, dates from contracts
   - Identify risky clauses
   - Generate contract summaries

3. **Financial Reporting**
   - Analyze financial statements in Arabic
   - Extract key metrics and ratios
   - Generate executive summaries

4. **Enterprise Knowledge Management**
   - Index and search organizational documents (internal policies, guidelines)
   - Generate documentation from specifications
   - Answer policy questions (chatbot backend)

### Example Prompts

**Government Classification:**
```
Prompt: "حدد نوع الوثيقة وأهميتها: [Government circular text]"
Expected: "نوع: قرار إداري، الأهمية: عالية، المجال: الموارد البشرية"
```

**Legal Extraction:**
```
Prompt: "استخرج الأطراف والمدة والقيمة من العقد التالي: [Contract text]"
Expected: JSON with party_a, party_b, duration, value
```

### When NOT to Use
- Real-time applications (cold start 6.2s is too slow)
- Conversational chatbots (not optimized for dialogue)
- Colloquial/dialect Arabic tasks
- Highly multilingual (English-heavy) content

---

## 2. Falcon H1 7B Instruct (Arabic)

### Model Info
- **Developer:** Technology Innovation Institute (TII), UAE
- **Parameters:** 7 billion
- **VRAM:** 16 GB minimum, 22 GB recommended
- **Tokenizer:** BPE (multilingual)
- **Training Data:** 500B multilingual tokens with Arabic focus

### Strengths
✅ **Optimized for Dialogue**
- Architecture designed for multi-turn conversations
- Lower latency in conversation flows (5.9s cold start)
- Excellent at maintaining context across long conversations

✅ **Conversational Arabic**
- Good at modern, everyday Arabic language
- Better than ALLaM at casual conversation and customer service
- Handles some dialects reasonably well (Gulf Arabic)

✅ **Batch Processing**
- vLLM batch size: 8 concurrent conversations
- Throughput: 152 tok/s (optimized for parallel inference)
- Good for multi-user chatbot systems

### Limitations
❌ **Lower Formal Arabic Quality**
- Not as specialized as ALLaM in legal/government documents
- May hallucinate on factual legal terminology
- <85% accuracy on formal Arabic legal tasks

❌ **Limited Technical Knowledge**
- Not trained on technical Arabic (engineering docs, scientific papers)
- Less reliable for technical translation

### Recommended Use Cases
1. **Customer Service Chatbots**
   - Multi-turn support conversations
   - FAQ answering in Arabic
   - Complaint classification and routing

2. **Conversational AI**
   - Virtual assistants for Arabic users
   - Dialogue-based information retrieval
   - Customer engagement chatbots

3. **Translation (English ↔ Arabic)**
   - Document translation with reasonable quality
   - Real-time chat translation
   - Subtitle generation

4. **Content Generation**
   - Blog post generation (casual tone)
   - Social media content creation
   - Email draft generation

### Example Prompts

**Customer Support:**
```
Prompt: "أنا عميل محبط من الخدمة. كيف يمكنك مساعدتي؟"
Expected: Empathetic, conversational response with next steps
```

**Translation:**
```
Prompt: "ترجم إلى العربية: [English text]"
Expected: Natural Arabic translation (better than ALLaM for conversational)
```

### When NOT to Use
- Legal/government document analysis (use ALLaM)
- Formal business writing
- Technical/scientific content
- Long-form formal documents (>5K tokens)

---

## 3. Qwen 2.5 7B Instruct

### Model Info
- **Developer:** Alibaba Qwen Team
- **Parameters:** 7 billion
- **VRAM:** 18 GB minimum, 24 GB recommended
- **Tokenizer:** Qwen tokenizer (efficient multilingual)
- **Training Data:** 15T tokens (multilingual: Arabic, Chinese, English, many others)
- **Special Feature:** Native LoRA adapter support

### Strengths
✅ **Strongest Multilingual Capability**
- Trained on 15T diverse tokens
- Excellent for multilingual documents (English + Arabic mixed)
- Best performance on technical + Arabic content

✅ **Customization via LoRA**
- Supports Low-Rank Adaptation (LoRA) fine-tuning
- Renter can customize without retraining full model
- Example: fine-tune on proprietary industry terminology, legal clauses

✅ **Long Context (8K tokens)**
- Supports up to 8,192 token context window
- Excellent for Retrieval-Augmented Generation (RAG)
- Can process entire documents at once

✅ **Technical Arabic**
- Good at technical documents (engineering specs, scientific papers)
- Reliable on code-mixed Arabic-English content
- Understands modern technology terms in Arabic

### Limitations
❌ **Slower Load Time**
- 6.8s cold start (slower than Mistral/Falcon)
- May require LoRA adapter loading (additional 0.8s)
- Not ideal for instant-response requirements

❌ **Less Specialized than ALLaM**
- Good but not the best at legal/formal Arabic
- <90% accuracy on pure formal Arabic tasks (vs ALLaM's >95%)

### Recommended Use Cases
1. **Retrieval-Augmented Generation (RAG)**
   - Arabic document retrieval system (e.g., legal knowledge base)
   - Government document Q&A
   - Technical documentation search

2. **Custom Industry Models (with LoRA)**
   - Healthcare: Fine-tune on medical Arabic terminology
   - Finance: Fine-tune on banking/insurance Arabic
   - Legal: Fine-tune on firm-specific clauses and practices

3. **Code-Mixed Content**
   - Technical documentation with mixed English + Arabic
   - Product documentation for bilingual companies
   - Social media analysis (multilingual user posts)

4. **Multilingual Retrieval**
   - Search across Arabic, English, Chinese documents
   - Multilingual customer support (route to right language model)

### Example Use Case: LoRA Customization

**Step 1: Fine-tune on proprietary data**
```
Example: Fine-tune on company's internal legal templates
Data: 100 contract examples with clause annotations
Training time: 2-4 hours on H100
LoRA size: 50-100 MB

Step 2: Deploy with LoRA
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --enable-lora \
  --lora-modules custom_contracts=/path/to/lora/adapter
```

**Step 3: Use custom model**
```
Prompt: "استخرج الشروط من العقد: [custom contract]"
Response: Uses fine-tuned knowledge of company's templates
```

### When NOT to Use
- Pure formal Arabic legal documents (use ALLaM)
- Single-language-only applications
- Instant-response requirements (use Mistral/Nemotron)

---

## 4. Llama 3 8B Instruct

### Model Info
- **Developer:** Meta
- **Parameters:** 8 billion (largest Tier A model)
- **VRAM:** 19 GB minimum, 26 GB recommended
- **Tokenizer:** BPE (efficient, multilingual)
- **Training Data:** 15T tokens (balanced multilingual)
- **Special Feature:** Instruction-following optimized

### Strengths
✅ **Best Overall Arabic Quality**
- Largest Tier A model (8B > 7B)
- Trained on high-quality instruction-following data
- ~92% accuracy on formal Arabic (between ALLaM's 95% and Falcon's 85%)

✅ **Excellent Instruction Following**
- Better at understanding complex, multi-step Arabic instructions
- Reliable at following specific output formats (JSON, XML, tables)
- Good for structured data extraction

✅ **Consistent Performance**
- Most predictable results across diverse tasks
- Lowest variation (P95 latency only 900ms vs others at 650-850ms)
- Reliable for production systems

✅ **Long Context (8K tokens)**
- Supports 8K token context like Qwen
- Good for RAG and document analysis

### Limitations
❌ **Slowest Load Time**
- 7.1s cold start (slowest Tier A)
- Largest model (8B) means longer weight loading
- Not suitable for latency-critical applications

❌ **Higher VRAM Requirements**
- 26 GB recommended (vs 22 GB for 7B models)
- Doesn't fit as comfortably on RTX 4080 (12 GB)
- Requires RTX 4090+ for optimal performance

### Recommended Use Cases
1. **Batch Processing Systems**
   - Document analysis pipelines (cost is amortized over batch)
   - Content moderation systems
   - Sentiment analysis at scale

2. **Complex Task Pipelines**
   - Extract information, then classify, then summarize (multi-step)
   - Structured data extraction with complex rules
   - Question-answering systems

3. **Production Workloads**
   - Where consistency and reliability > raw speed
   - Mission-critical applications (legal review, compliance)
   - Where cold start happens infrequently (warm GPU)

4. **Arabic + Multilingual Content**
   - Process mixed-language documents
   - Maintain quality across languages
   - Translate and analyze in pipeline

### Example Prompts

**Complex Task:**
```
Prompt: "بدءً من العقد التالي:
1. استخرج الأطراف والمدة والقيمة
2. صنف المخاطر (عالية/متوسطة/منخفضة)
3. اقترح تعديلات أمنية بصيغة JSON"

Response: Structured JSON with extracted, classified, and recommended data
```

### When NOT to Use
- Real-time applications (7.1s is too slow)
- Latency-sensitive APIs
- Applications with small individual inference requests
- Systems with limited VRAM (RTX 4080)

---

## 5. Mistral 7B Instruct v0.2

### Model Info
- **Developer:** Mistral AI
- **Parameters:** 7 billion
- **VRAM:** 17 GB minimum, 24 GB recommended
- **Tokenizer:** BPE (efficient)
- **Training Data:** Mix of high-quality diverse data
- **Specialization:** Speed-optimized instruction following

### Strengths
✅ **Fastest Performance**
- Lowest cold start: 5.5s
- Highest throughput: 158 tok/s
- **Best for real-time applications**

✅ **Excellent Instruction Following**
- Trained specifically for instruction-tuned tasks
- Good output structure compliance (JSON, XML, etc.)
- Reliable at following formatting requirements

✅ **Real-Time API Potential**
- Streaming architecture optimized for low-latency inference
- Good for chatbots requiring sub-1s token latency
- Excellent for live translation/transcription

✅ **Cost-Effective**
- Fastest = lowest cost for same task
- 5.5s cold start saves $0.00090 per request vs slower models
- Scales well for high-volume, latency-sensitive workloads

### Limitations
❌ **Lower Arabic Quality**
- Good but not specialized like ALLaM
- ~82% accuracy on formal Arabic (lowest Tier A)
- Not recommended for pure Arabic formal documents

❌ **Limited Domain Specialization**
- General-purpose; not optimized for Arabic-specific tasks
- Less domain knowledge (legal, government, etc.)

### Recommended Use Cases
1. **Real-Time Chatbots**
   - Instant response requirement (<1s per token)
   - Streaming chat interface
   - Live customer support

2. **API Services**
   - Text generation API (fast responses)
   - Summarization API
   - Translation API (English + Arabic mix)

3. **Live Translation**
   - Real-time subtitle generation
   - Live chat translation
   - Simultaneous interpretation (Arabic-English)

4. **High-Volume, Latency-Sensitive**
   - Content recommendation systems
   - Fast document classification
   - Real-time sentiment analysis

### Example Use Case: Live Chatbot

```
User: "مرحبا، أحتاج مساعدة في طلبي"
System: Sends to Mistral
API latency: 5.5s cold start, then <100ms per token
Streaming response: First token at 5.6s, subsequent tokens at 6.3ms each

User experience: Perceives instant response, sees streaming output
```

### When NOT to Use
- Formal legal/government document analysis (use ALLaM)
- Accuracy-critical applications (use Llama 3)
- Long-form, detailed content generation
- When response quality > response speed

---

## 6. Nemotron Mini 4B Instruct

### Model Info
- **Developer:** NVIDIA
- **Parameters:** 4 billion (smallest Tier A)
- **VRAM:** 10 GB minimum, 14 GB recommended
- **Tokenizer:** Qwen tokenizer (efficient)
- **Training Data:** Instruction-following optimized
- **Special Feature:** Instant-tier candidate (pre-baked into image)

### Strengths
✅ **Smallest Footprint**
- Only 10 GB minimum VRAM
- Fits on RTX 4070 (with headroom)
- Can run on edge devices with GPU

✅ **Fastest Cold Start**
- 3.1s load time (40% faster than any other Tier A)
- Instant-tier perception for users
- Ideal for on-demand, infrequent use

✅ **Pre-Bakedable (Instant Tier)**
- 4 GB model can be embedded in Docker image
- Zero cold-start if provider pre-builds
- Sub-1s latency from job submission to response

✅ **Highest Throughput per Parameter**
- 180 tok/s on RTX 4090 (vs 140 tok/s for larger models)
- Best efficiency (tok/s per model parameter)
- Excellent for cost-conscious renters

### Limitations
❌ **Lowest Arabic Capability**
- Only 4B parameters; less capacity for Arabic knowledge
- ~75% accuracy on formal Arabic (vs ALLaM's 95%)
- May hallucinate on facts, figures, dates

❌ **Lower Context Quality**
- 4K token context (vs 8K for larger models)
- Struggles with long documents
- Context memory less robust

❌ **Lowest Absolute Quality**
- Across all tasks, quality is lowest among Tier A
- Not suitable for mission-critical applications

### Recommended Use Cases
1. **Instant-Tier Services (Pre-baked)**
   - One-click, zero-wait deployments
   - Perfect for marketing: "Deploy in 0.5s"
   - Instant language identification, fast classification

2. **Edge/Mobile Inference**
   - Small form factor GPU servers
   - Bandwidth-limited environments
   - On-device processing

3. **Cost-Optimized Workloads**
   - Renter wants cheapest possible option
   - Task doesn't require high accuracy
   - Volume-based (scale with multiple instances)

4. **Fast Prototyping**
   - Proof-of-concept development
   - Quick experimentation
   - "Good enough" MVP

### Example Use Case: Instant-Tier Marketing

**Provider Marketing:**
```
"Instant Arabic AI on GPU
Deploy in 0.5s, no loading time
RTX 4090 + Nemotron 4B = $0.15/hour"
```

**Renter Experience:**
- Click "Deploy Nemotron 4B"
- Job queued: t=0.0s
- Model ready: t=0.5s (if image pre-baked)
- First token: t=0.8s
- Streaming inference: 180 tok/s thereafter

### When NOT to Use
- Any accuracy-critical task
- Formal/legal document processing
- Long-form content (>4K tokens)
- When quality > cost/speed

---

## Comparison Matrix

### Quick Comparison
| Factor | ALLaM | Falcon H1 | Qwen 2.5 | Llama 3 | Mistral | Nemotron |
|--------|-------|-----------|---------|---------|---------|----------|
| Arabic Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Speed | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost | $ | $ | $ | $$ | $ | $ |
| Best For | Legal/Gov | Chatbot | RAG/Custom | Batch | Real-time | Instant |

### Decision Tree (Simplified)

```
Question 1: How important is Arabic accuracy?
  → Critical (legal, government) → ALLaM 7B
  → High (formal business) → Llama 3 8B
  → Moderate (conversational) → Falcon H1 7B or Qwen 2.5 7B
  → Low (fast response) → Mistral 7B

Question 2: What is the response latency requirement?
  → <1s (real-time API) → Mistral 7B or Nemotron 4B
  → <5s (chatbot) → Falcon H1 7B or Nemotron 4B
  → <10s (batch processing) → ALLaM 7B or Llama 3 8B
  → No requirement (batch) → Llama 3 8B (best quality)

Question 3: Do you need customization (LoRA fine-tuning)?
  → Yes → Qwen 2.5 7B (native support)
  → No → Choose based on other factors
```

---

## Renter Decision Flowchart

```
START: "I want to deploy an Arabic AI model"
  ↓
"What's my use case?"
  ├─ Document analysis/Search (RAG) → Qwen 2.5 7B or Llama 3 8B
  ├─ Customer support chatbot → Falcon H1 7B
  ├─ Real-time API/Translation → Mistral 7B
  ├─ Legal/Government processing → ALLaM 7B
  ├─ Ultra-low budget + basic task → Nemotron 4B
  └─ Batch processing → Llama 3 8B
```

---

## Cost Analysis (RTX 4090, $0.267/hour pricing)

### Typical Task: Process 10 Documents (500 tokens each)

| Model | Cold Start | Per-Doc | Total Time | Total Cost |
|-------|-----------|---------|-----------|-----------|
| Nemotron 4B | 3.1s | 4.0s | 43.1s | $0.0032 |
| Mistral 7B | 5.5s | 4.0s | 45.5s | $0.0034 |
| Falcon H1 | 5.9s | 4.2s | 47.9s | $0.0036 |
| ALLaM 7B | 6.2s | 4.3s | 49.2s | $0.0037 |
| Qwen 2.5 7B | 6.8s | 4.3s | 49.8s | $0.0037 |
| Llama 3 8B | 7.1s | 4.5s | 52.1s | $0.0039 |

**Key Insight:** Cost variation is small (~20%) for single batch tasks. Choice should prioritize quality/fit over marginal cost differences.

---

## Getting Started

1. **Evaluate your task:** Legal/formal? Conversational? Real-time? Batch?
2. **Match to model:** Use decision tree above
3. **Deploy model:** Use `vllm serve` commands in vllm-config-reference.md
4. **Measure latency:** Test cold/warm start and throughput
5. **Iterate:** Try different models to find best fit for your use case

