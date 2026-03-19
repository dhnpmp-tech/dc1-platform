# دليل البدء السريع مع DC1 — أرسل أول مهمة GPU في 5 دقائق

DC1 هو أول سوق لحوسبة GPU اللامركزية في المملكة العربية السعودية. يُرسل المستأجرون مهام الحوسبة (استدلال نماذج اللغة، توليد الصور، التدريب) لتُنفَّذ على أجهزة مزودي GPU. تُحتسب الرسوم بالريال السعودي.

**الرابط الأساسي للـ API:** `http://76.13.179.86:8083`
**العملة:** جميع المبالغ بالهللة (1 ريال = 100 هللة) ما لم ينتهي اسم الحقل بـ `_sar`

---

## الخطوة 1 — إنشاء حساب مستأجر

```bash
curl -X POST http://76.13.179.86:8083/api/renters/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "اسمك هنا",
    "email": "you@example.com",
    "organization": "اسم الشركة"
  }'
```

**الاستجابة:**

```json
{
  "success": true,
  "renter_id": 7,
  "api_key": "dc1-renter-a1b2c3d4e5f6...",
  "message": "مرحباً! احفظ مفتاح API الخاص بك — لن يُعرض مجدداً."
}
```

**احفظ `api_key` فوراً.** يُعرض مرة واحدة فقط ولا يمكن استرجاعه.

---

## الخطوة 2 — شحن الرصيد

تبدأ الحسابات الجديدة برصيد 10 ريال (1000 هللة) مجاناً. لإضافة المزيد:

```bash
curl -X POST http://76.13.179.86:8083/api/renters/topup \
  -H "x-renter-key: dc1-renter-مفتاحك-هنا" \
  -H "Content-Type: application/json" \
  -d '{"amount_sar": 50}'
```

**الاستجابة:**

```json
{
  "success": true,
  "topped_up_sar": 50,
  "new_balance_sar": 60.0,
  "new_balance_halala": 6000
}
```

> الدفع يمر عبر بوابة **Moyasar** السعودية. في بيئة الإنتاج، يُعيد الطلب رابط `checkout_url` يُوجَّه إليه المستخدم لإتمام الدفع ببطاقة مدى أو فيزا.

---

## الخطوة 3 — اختر GPU متاح

```bash
curl http://76.13.179.86:8083/api/renters/available-providers
```

**الاستجابة:**

```json
{
  "providers": [
    {
      "id": 3,
      "name": "عقدة GPU الرياض A",
      "gpu_model": "NVIDIA RTX 4090",
      "vram_gb": 24,
      "gpu_count": 1,
      "status": "online",
      "is_live": true,
      "location": "SA",
      "reliability_score": 98,
      "cached_models": ["mistralai/Mistral-7B-Instruct-v0.2"]
    }
  ],
  "total": 1
}
```

استخدم قيمة `id` كـ `provider_id`. اختر مزوداً بـ `is_live: true` — يعني ذلك أن الداعم أرسل نبضة قلب خلال آخر دقيقتين. إذا كان النموذج الذي تحتاجه موجوداً في `cached_models`، فسيبدأ التنفيذ أسرع.

---

## الخطوة 4 — أرسل مهمة GPU

### مثال: استدلال نموذج لغوي (LLM)

```bash
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
  -H "x-renter-key: dc1-renter-مفتاحك-هنا" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 3,
    "job_type": "llm_inference",
    "duration_minutes": 5,
    "params": {
      "model": "mistralai/Mistral-7B-Instruct-v0.2",
      "prompt": "اشرح مفهوم رؤية 2030 في فقرة واحدة",
      "max_tokens": 512,
      "temperature": 0.7
    }
  }'
```

### مثال: توليد صورة

```bash
curl -X POST http://76.13.179.86:8083/api/jobs/submit \
  -H "x-renter-key: dc1-renter-مفتاحك-هنا" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": 3,
    "job_type": "image_generation",
    "duration_minutes": 10,
    "params": {
      "prompt": "مدينة رياض مستقبلية في ضوء الغروب، أسلوب سينمائي",
      "model": "stabilityai/stable-diffusion-xl-base-1.0",
      "steps": 30,
      "width": 1024,
      "height": 1024
    }
  }'
```

**الاستجابة:**

```json
{
  "success": true,
  "job": {
    "job_id": "job-1710843200000-x7k2p",
    "status": "pending",
    "job_type": "llm_inference",
    "cost_halala": 75,
    "duration_minutes": 5,
    "submitted_at": "2026-03-19T11:00:00.000Z"
  }
}
```

يُخصم `cost_halala` مسبقاً من رصيدك. عند اكتمال المهمة بوقت أقل، يُسترد الفرق تلقائياً.

---

## الخطوة 5 — تتبع حالة المهمة

```bash
curl "http://76.13.179.86:8083/api/jobs/job-1710843200000-x7k2p" \
  -H "x-renter-key: dc1-renter-مفتاحك-هنا"
```

**حالات المهمة:**

| الحالة | المعنى |
|--------|--------|
| `pending` | بانتظار استلام الداعم |
| `queued` | المزود مشغول — أنت في قائمة الانتظار |
| `running` | تنفذ الآن على GPU |
| `completed` | اكتملت — النتيجة متاحة |
| `failed` | فشل التنفيذ |
| `cancelled` | ألغيت قبل البدء |

---

## الخطوة 6 — استرجع النتيجة

```bash
curl "http://76.13.179.86:8083/api/jobs/job-1710843200000-x7k2p/output" \
  -H "x-renter-key: dc1-renter-مفتاحك-هنا"
```

**نتيجة LLM:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "status": "completed",
  "result": {
    "type": "text",
    "response": "رؤية 2030 هي خطة طموحة للمملكة العربية السعودية...",
    "tokens_generated": 387,
    "tokens_per_second": 24.3,
    "model": "mistralai/Mistral-7B-Instruct-v0.2"
  },
  "actual_cost_halala": 45,
  "actual_duration_minutes": 3
}
```

**نتيجة توليد الصور:** يحتوي حقل `result.image_base64` على الصورة بتنسيق PNG مشفرة بـ base64.

---

## مرجع سريع

```bash
# تحقق من رصيدك
curl "http://76.13.179.86:8083/api/renters/balance" \
  -H "x-renter-key: dc1-renter-مفتاحك"

# قائمة مهامك الأخيرة
curl "http://76.13.179.86:8083/api/renters/me?key=dc1-renter-مفتاحك"
```

## أسعار الحوسبة

| نوع المهمة | السعر |
|-----------|-------|
| `llm_inference` — استدلال نموذج لغوي | 0.15 ريال/دقيقة |
| `image_generation` — توليد صورة | 0.20 ريال/دقيقة |
| `vllm_serve` — خادم استدلال OpenAI | 0.20 ريال/دقيقة |
| `training` — تدريب | 0.25 ريال/دقيقة |
| `rendering` — تصيير | 0.20 ريال/دقيقة |
| `custom_container` — حاوية مخصصة | 0.10 ريال/دقيقة |

التكلفة **تُخصم مسبقاً** بناءً على `duration_minutes` المطلوبة. عند الاكتمال، يُحتسب الوقت الفعلي وأي مبلغ زائد يُسترد لرصيدك.

---

## الخطوات التالية

- [مرجع API الكامل (عربي)](./api-reference-ar.md) — جميع نقاط النهاية مع مخططات الطلب والاستجابة
- [دليل مزود GPU](./provider-guide.md) — اكسب ريالات بتوصيل GPU الخاص بك
- [أدلة SDK](./sdk-guides.md) — SDKs بايثون وجافاسكريبت
