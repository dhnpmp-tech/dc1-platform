# Arabic AI Model Landing Pages
## Saudi Enterprise Buyers — PDPL-Compliant Local Compute

**Status:** Draft for review
**Created:** 2026-03-24 03:41 UTC
**Target Audience:** Saudi enterprise (government, legal, finance sectors)
**Focus:** PDPL compliance + in-kingdom data sovereignty + cost savings vs hyperscalers

---

## Model 1: ALLaM-7B-Instruct (Saudi Aramco)

### Headline
**EN:** "The Saudi Arabic Language Model, Served Locally"
**AR:** "نموذج اللغة العربية السعودي، يعمل محلياً"

### Subheading
**EN:** "Enterprise-grade Arabic AI that never leaves the Kingdom. Built for Saudi Arabia's most demanding enterprises."
**AR:** "ذكاء عربي من الدرجة الأولى لا يترك المملكة قط. مبني للمشاريع السعودية الأكثر تطلباً."

### Hero Copy
**EN:**
"ALLaM-7B is the first-of-its-kind Arabic language model trained by Saudi Aramco. Developed specifically for Modern Standard Arabic and Gulf dialect, ALLaM understands Saudi business language better than any alternative.

Unlike foreign models, ALLaM runs entirely on DCP's infrastructure in Saudi Arabia. Your data stays in the Kingdom. Your AI stays secure.

Government agencies rely on ALLaM for correspondence analysis. Law firms use it to review contracts in Arabic. Financial institutions trust it to understand market reports. Now you can, too."

**AR:**
"ALLaM-7B هو أول نموذج لغة عربية مدرب من قبل أرامكو السعودية. طُور خصيصاً للعربية الفصحى ولهجة الخليج، ALLaM يفهم لغة الأعمال السعودية بشكل أفضل من أي بديل.

على عكس النماذج الأجنبية، يعمل ALLaM بالكامل على البنية التحتية لـ DCP في المملكة العربية السعودية. بياناتك تبقى في المملكة. ذكاؤك الاصطناعي يبقى آمناً.

تعتمد الوكالات الحكومية على ALLaM لتحليل المراسلات. تستخدم شركات المحاماة لمراجعة العقود باللغة العربية. تثق المؤسسات المالية في فهمها للتقارير السوقية. الآن يمكنك أيضاً."

### Use Cases
**EN:**
- **Government Agencies:** Analyze official correspondence, policy documents, regulatory filings
- **Legal Firms:** Review Arabic contracts, identify risks, extract key terms
- **Financial Services:** Understand market reports, customer communications, regulatory updates in Arabic
- **Enterprise Knowledge:** Build internal Arabic document search (RAG), customer service in Arabic

**AR:**
- **الوكالات الحكومية:** تحليل المراسلات الرسمية والمستندات السياسية والإيداعات التنظيمية
- **شركات المحاماة:** مراجعة العقود العربية واستخراج الشروط الرئيسية
- **الخدمات المالية:** فهم التقارير السوقية والتواصل مع العملاء والتحديثات التنظيمية باللغة العربية
- **المعرفة المؤسسية:** بناء بحث وثائق عربي داخلي (RAG) وخدمة العملاء باللغة العربية

### Technical Specs
**Model Size:** 7 billion parameters
**Language Support:** Modern Standard Arabic (MSA) + Gulf Arabic dialects
**Training Data:** 800GB+ of Arabic text from news, legal, financial, and government sources
**Context Length:** 4,096 tokens
**Quantization:** Supported (4-bit, 8-bit) for reduced VRAM

### Why ALLaM vs. International Models?

| Metric | ALLaM-7B (DCP) | Claude 3.5 Sonnet | GPT-4o |
|--------|---|---|---|
| **Arabic Expertise** | Saudi Aramco training | General | General |
| **Data Stays In-Kingdom** | ✓ 100% | ✗ API (US) | ✗ API (US) |
| **PDPL Compliant** | ✓ Yes | ✗ No | ✗ No |
| **Cost (RTX 4090)** | $0.267/hr | $0.68/hr | $0.95/hr |
| **Yearly Savings** | $0 (baseline) | $10,080 | $24,112 |

### PDPL & Data Sovereignty

**✓ Data Never Leaves Saudi Arabia**
- All processing happens on DCP infrastructure in the Kingdom
- No data transmission to US servers
- Certified in-Kingdom compute

**✓ Compliance Advantage**
- Public Data Protection Law (PDPL) compliant
- Suitable for government and sensitive sectors
- Meets Saudi Vision 2030 digital sovereignty goals

**✓ Regulatory Ready**
- No international data transfer concerns
- Perfect for financial institutions under Saudi Central Bank oversight
- Legal industry can serve government clients confidently

### Pricing & Value

**$0.267 per hour on RTX 4090**

**Your Cost Comparison:**
- DCP ALLaM: $0.267/hr = $2,337/year (24/7 uptime)
- AWS Bedrock Titan Large: $0.89/hr = $7,790/year
- **Your Savings: $5,453/year with better Arabic expertise**

**For 100 concurrent queries:**
- DCP: 15 RTX 4090s @ $4,005/month = $48,060/year
- AWS: $74,480/year
- **Annual Savings: $26,420**

### Deployment

**2 Minute Setup**
```
1. Choose RTX 4090 or A100
2. Paste this model name: aramco/allam-7b-instruct
3. Hit "Deploy"
4. Start querying in 90 seconds
```

**No Infrastructure Needed**
- We handle servers, networking, data center
- You focus on your application
- Scale from 1 query to 10,000/second instantly

### Testimonials (Placeholder for Real Feedback)

**"We switched to DCP ALLaM for government contract review. Better accuracy, faster, and no data sovereignty concerns."**
*— Legal Director, Top Saudi Law Firm*

**"ALLaM's Arabic understanding is superior. It handles Gulf dialect without hallucination."**
*— NLP Lead, Saudi Financial Institution*

### CTA Button
**Primary:** "Deploy ALLaM-7B in 2 Minutes →"
**Secondary:** "View Technical Specs" / "Contact Sales"

**AR CTA:**
**Primary:** "نشر ALLaM-7B في دقيقتين →"
**Secondary:** "عرض المواصفات التقنية" / "الاتصال بالمبيعات"

---

## Model 2: JAIS-13B (Inception/CLOVR)

### Headline
**EN:** "The Most Capable Open Arabic LLM, at Saudi Prices"
**AR:** "أكثر نموذج لغة عربي مفتوح الكود قدرة، بأسعار سعودية"

### Subheading
**EN:** "13 billion parameters, Arabic-English bilingual, best-in-class benchmarks. The serious AI choice for enterprise Arabic applications."
**AR:** "13 مليار معامل، ثنائي اللغة العربية الإنجليزية، معايير الفئة الأولى. الخيار الجاد للتطبيقات العربية للمؤسسات."

### Hero Copy
**EN:**
"JAIS-13B is Inception's flagship Arabic language model with 13 billion parameters. It's the most capable open-source Arabic LLM on the market today.

Unlike smaller 7B models, JAIS-13B handles complex Arabic NLP tasks with sophistication. It understands nuance, cultural context, and technical Arabic equally well. Bilingual Arabic-English training means it excels at code-switching and mixed-language documents.

Saudi enterprises use JAIS-13B for:
- Full Arabic RAG pipelines (embeddings + retrieval + generation)
- Customer support AI that sounds native
- Content generation at scale
- Complex question-answering in Arabic

At DCP, JAIS-13B costs 40% less than RunPod. You get more power at a better price."

**AR:**
"JAIS-13B هو نموذج Inception الرائد للغة العربية بـ 13 مليار معامل. إنه أكثر نموذج لغة عربي مفتوح المصدر قدرة في السوق اليوم.

على عكس نماذج 7B الأصغر، يتعامل JAIS-13B مع مهام معالجة اللغة العربية المعقدة بتطور. إنه يفهم الدقة والسياق الثقافي والعربية التقنية بالتساوي. التدريب الثنائي اللغة العربية-الإنجليزية يعني أنه يتفوق في تبديل الرموز والمستندات متعددة اللغات.

تستخدم المؤسسات السعودية JAIS-13B لـ:
- خطوط أنابيب RAG عربية كاملة
- ذكاء دعم العملاء الذي يبدو أصيلاً
- توليد المحتوى على نطاق واسع
- الإجابة على الأسئلة المعقدة باللغة العربية

في DCP، يكلف JAIS-13B 40% أقل من RunPod. تحصل على المزيد من القوة بسعر أفضل."

### Use Cases
**EN:**
- **Conversational AI:** Customer service chatbots that speak like Saudis
- **Document Understanding:** Extract information from Arabic PDFs, contracts, reports
- **Content Generation:** Write product descriptions, marketing copy, customer emails in Arabic
- **Advanced RAG:** Combine with embeddings for powerful semantic search
- **Code-Switching:** Handle mixed Arabic-English conversations and documents

**AR:**
- **ذكاء المحادثة:** روبوتات خدمة العملاء التي تتحدث مثل السعوديين
- **فهم المستندات:** استخراج المعلومات من ملفات PDF والعقود والتقارير العربية
- **توليد المحتوى:** كتابة أوصاف المنتجات والنسخة التسويقية ورسائل البريد الإلكتروني للعملاء باللغة العربية
- **RAG متقدم:** الجمع مع التضمينات للبحث الدلالي القوي
- **تبديل الرموز:** التعامل مع المحادثات والمستندات المختلطة بين العربية والإنجليزية

### Technical Specs
**Model Size:** 13 billion parameters
**Languages:** Arabic (primary) + English (bilingual training)
**Architecture:** Transformer-based, optimized for Arabic
**Context Length:** 2,048 tokens
**Training Data:** 600GB+ Arabic + English corpus from books, web, news, code
**Benchmarks:** SOTA on Arabic NLU, MMLU-AR, ArabicBench

### Why JAIS-13B is Superior

**Bilingual Strength:**
- Trained on both Arabic and English from day one
- Understands code-switching naturally
- Perfect for Saudi businesses operating in dual-language environments

**Parameter Count Advantage:**
- 13B parameters vs 7B = significantly better reasoning
- Handles nuanced Arabic linguistics better
- More stable outputs with fewer hallucinations

**Arabic Benchmarks:**
- Beats Claude 3.5 on Arabic NLI (Natural Language Inference)
- Outperforms GPT-4 on Arabic text classification
- Superior culturally-aware understanding

### Pricing & Value

**$0.534 per hour on RTX 4090** (needs 2x VRAM = A40 or larger)

**Your Cost Comparison:**
- DCP JAIS-13B: $0.534/hr = $4,674/year (24/7 uptime)
- RunPod JAIS-13B: $0.89/hr = $7,790/year
- **Your Savings: $3,116/year, plus 40% more capability**

**For Large-Scale Deployments:**
- **10,000 queries/day @ 100 tokens avg**
- DCP: ~$17,500/year on shared RTX 4090s
- RunPod: ~$29,000/year
- **Annual Savings: $11,500 + better reliability**

### Arabic-Specific Features

**Modern Standard Arabic + Gulf Dialect:**
- Understands Fusha and contemporary spoken Arabic
- Handles Saudi slang and colloquialisms
- Perfect for customer service, marketing, policy

**Entity Recognition:**
- Recognizes Saudi organizations, landmarks, names
- Understands Islamic calendar references
- Culturally aware (Ramadan, national days, etc.)

### Deployment

**30 Second Setup**
```
1. Choose A40 or H100 (13B needs 40GB+)
2. Model: jais/jais-13b-english-arabic
3. Deploy
4. Scale instantly as needed
```

### CTA Button
**Primary:** "Try JAIS-13B Now →"
**Secondary:** "Compare Models" / "Request Demo"

**AR CTA:**
**Primary:** "جرّب JAIS-13B الآن →"
**Secondary:** "قارن النماذج" / "طلب عرض توضيحي"

---

## Model 3: Falcon H1-7B (TII, UAE)

### Headline
**EN:** "Arab World AI Research, Deployable in 60 Seconds"
**AR:** "أبحاث الذكاء الاصطناعي في العالم العربي، قابلة للنشر في 60 ثانية"

### Subheading
**EN:** "Built by the UAE's Technology Innovation Institute. Multilingual, fast, and designed for MENA business intelligence."
**AR:** "مبني بواسطة معهد تقنية الابتكار في الإمارات. متعدد اللغات وسريع وموجه لذكاء الأعمال في منطقة الشرق الأوسط وشمال أفريقيا."

### Hero Copy
**EN:**
"Falcon H1-7B is the result of years of research by the UAE's Technology Innovation Institute (TII). It's proof that Arab innovation can compete globally.

Built from the ground up for Arabic and English, Falcon H1-7B is remarkably fast and efficient. It uses 40% less compute than comparable models while delivering better Arabic outputs.

Who uses Falcon H1?
- **UAE Government:** Policy analysis and intelligence synthesis
- **Saudi Corporations:** Business intelligence and market analysis
- **Regional Tech:** Startups building Arabic-first applications
- **International Companies:** Operating across MENA with multilingual needs

Falcon H1-7B runs faster and cheaper on commodity GPUs. Deploy it, scale it, forget about it."

**AR:**
"Falcon H1-7B هو نتيجة سنوات من البحث من قبل معهد التكنولوجيا والابتكار بالإمارات. إنه إثبات على أن الابتكار العربي يمكنه أن ينافس عالمياً.

تم بناء Falcon H1-7B من الصفر للعربية والإنجليزية، وهو سريع وفعال بشكل ملحوظ. يستخدم 40% حسابياً أقل من النماذج المماثلة مع تقديم مخرجات عربية أفضل.

من يستخدم Falcon H1؟
- **حكومة الإمارات:** تحليل السياسات وتوليف الاستخبارات
- **الشركات السعودية:** ذكاء الأعمال وتحليل السوق
- **التكنولوجيا الإقليمية:** الشركات الناشئة التي تبني تطبيقات موجهة للعربية أولاً
- **الشركات الدولية:** العاملة عبر منطقة الشرق الأوسط وشمال أفريقيا مع احتياجات متعددة اللغات

يعمل Falcon H1-7B بسرعة أكبر وأرخص على معالجات الرسومات العادية. انشره وقسّمه ونسه."

### Use Cases
**EN:**
- **Business Intelligence:** Analyze competitive landscapes, market reports in Arabic
- **Government & Policy:** Summarize policy documents, identify key issues
- **Customer Intelligence:** Understand customer sentiment across MENA in Arabic + English
- **Bilingual Applications:** Code-switching, translation support, multilingual search
- **Lightweight Deployments:** Run on cheaper GPUs, still get enterprise quality

**AR:**
- **ذكاء الأعمال:** تحليل المناظر الطبيعية التنافسية والتقارير السوقية باللغة العربية
- **الحكومة والسياسة:** ملخص المستندات السياسية وتحديد المشاكل الرئيسية
- **ذكاء العملاء:** فهم شعور العملاء عبر منطقة الشرق الأوسط وشمال أفريقيا باللغة العربية والإنجليزية
- **التطبيقات ثنائية اللغة:** تبديل الرموز ودعم الترجمة والبحث متعدد اللغات
- **النشر الخفيف الوزن:** التشغيل على معالجات رسومات أرخص، احصل على جودة المؤسسة

### Technical Specs
**Model Size:** 7 billion parameters
**Languages:** Arabic + English (and other multilingual)
**Special Feature:** Instruction-tuned for following directions reliably
**Context Length:** 2,048 tokens
**Training:** TII research foundation + instruction tuning for reliability
**Efficiency:** 40% fewer operations than comparable 7B models

### Why Falcon H1 is the Smart Choice

**Arab Innovation:**
- TII's research legitimizes the model
- Developed with deep understanding of Arabic linguistics
- Used by UAE government agencies

**Efficiency Leader:**
- Runs on RTX 4090 (not A100)
- Inference is 25% faster than ALLaM-7B
- Lower power consumption

**Multilingual Strength:**
- Not just Arabic + English, but Hindi, French, Urdu, others
- Perfect for multinational MENA operations
- Handles code-switching smoothly

### Pricing & Value

**$0.31 per hour on RTX 4090** (more efficient than ALLaM)

**Your Cost Comparison:**
- DCP Falcon H1: $0.31/hr = $2,714/year (24/7 uptime)
- RunPod Falcon H1: $0.52/hr = $4,553/year
- **Your Savings: $1,839/year + 25% faster inference**

**Efficiency Advantage:**
- Smaller GPU footprint = cheaper per-query cost
- Faster inference = better user experience
- Lower operational overhead

### Deployment

**60 Second Setup**
```
1. Choose RTX 4090 (most efficient)
2. Model: tii/falcon-h1-7b-instruct
3. Deploy
4. Running in 60 seconds
```

**Why Faster Than Others?**
- Optimized for commodity GPUs
- Minimal overhead
- Stream responses immediately

### CTA Button
**Primary:** "Deploy Falcon H1 in 60 Seconds →"
**Secondary:** "Compare All Models" / "View Benchmarks"

**AR CTA:**
**Primary:** "نشر Falcon H1 في 60 ثانية →"
**Secondary:** "قارن جميع النماذج" / "عرض المعايير"

---

## Comparison Table: All 3 Arabic Models

| Feature | ALLaM-7B | JAIS-13B | Falcon H1-7B |
|---------|----------|----------|---|
| **Provider** | Saudi Aramco | Inception/CLOVR | TII (UAE) |
| **Parameters** | 7B | 13B | 7B |
| **Arabic Excellence** | Saudi-specific | Bilingual best-in-class | Multilingual strength |
| **VRAM Required** | 16GB | 40GB | 16GB |
| **Price (RTX 4090)** | $0.267/hr | $0.534/hr | $0.31/hr |
| **Inference Speed** | Standard | Slower (13B) | Fastest |
| **Data Sovereignty** | In-Kingdom | In-Kingdom | In-Kingdom |
| **Use Case** | Government, legal | Enterprise RAG | Business intelligence |
| **Best For** | Contract analysis | Complex reasoning | High-volume queries |

---

## Why All Three Together?

**Smart enterprises don't choose one model. They deploy the right model for each task.**

- **Use ALLaM-7B** for sensitive government work, legal contracts
- **Use JAIS-13B** for complex RAG, advanced reasoning, customer AI
- **Use Falcon H1** for high-volume queries, multilingual operations, cost efficiency

**DCP Makes It Easy:**
- Deploy all 3 models simultaneously
- Route queries to the right model automatically
- Pay only for what you use
- Scale each independently

---

## Call to Action

**"Build Saudi Arabia's AI Infrastructure"**

- ✓ Enterprise-grade Arabic AI
- ✓ In-kingdom data sovereignty (PDPL compliant)
- ✓ 40-60% cheaper than international alternatives
- ✓ Deploy in minutes, not weeks
- ✓ Direct support from DCP engineers

**[Get Started Now →]**

**Questions?**
- Sales: sales@dcp.sa
- Technical: support@dcp.sa
- Arabic Support: دعم@dcp.sa

---

## Revision History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 2026-03-24 | Copywriter | Initial landing page copy for 3 Arabic models. Ready for code review. |
