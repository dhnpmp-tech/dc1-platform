# مرجع DC1 API — النسخة العربية

**الرابط الأساسي:** `https://api.dcp.sa`
**نوع المحتوى:** `application/json` لجميع طلبات POST/PATCH
**العملة:** جميع المبالغ بالهللة (1 ريال = 100 هللة) ما لم ينتهي اسم الحقل بـ `_sar`

---

## المصادقة (Authentication)

ثلاثة أنواع من المصادقة حسب دور المستخدم:

| الدور | الترويسة (Header) | معامل الاستعلام | مثال |
|-------|------------------|-----------------|------|
| مستأجر (Renter) | `x-renter-key: dc1-renter-...` | `?key=dc1-renter-...` | إرسال المهام، الرصيد |
| مزود (Provider) | `x-provider-key: dc1-...` | `?key=dc1-...` | نبضة القلب، الأرباح |
| مسؤول (Admin) | `x-admin-token: <token>` | — | إدارة المنصة |

---

## حدود معدل الطلبات

| نقطة النهاية | الحد |
|-------------|------|
| `POST /providers/register` | 5 / IP / ساعة |
| `POST /renters/register` | 5 / IP / ساعة |
| `POST /jobs/submit` | 30 / IP / دقيقة |
| جميع `/api/*` الأخرى | 300 / IP / دقيقة |

تجاوز الحد يُرجع `429 Too Many Requests`.

---

## نقاط نهاية المستأجر (Renter Endpoints)

### POST /api/renters/register

تسجيل حساب مستأجر جديد.

**المصادقة:** لا تحتاج

**جسم الطلب:**

```json
{
  "name": "نص (مطلوب)",
  "email": "نص (مطلوب، فريد)",
  "organization": "نص (اختياري)"
}
```

**الاستجابة 201:**

```json
{
  "success": true,
  "renter_id": 7,
  "api_key": "dc1-renter-a1b2c3d4...",
  "message": "مرحباً! احفظ مفتاح API الخاص بك — لن يُعرض مجدداً."
}
```

**الأخطاء:**

| الكود | السبب |
|-------|-------|
| 400 | حقل `name` أو `email` مفقود، أو صيغة البريد خاطئة |
| 409 | البريد الإلكتروني مسجل مسبقاً |

---

### GET /api/renters/me

جلب ملف المستأجر والمهام الأخيرة.

**المصادقة:** `?key=dc1-renter-...` أو ترويسة `x-renter-key`

**الاستجابة 200:**

```json
{
  "renter": {
    "id": 7,
    "name": "اسمك",
    "email": "you@example.com",
    "organization": "اسم الشركة",
    "balance_halala": 5000,
    "total_spent_halala": 1000,
    "total_jobs": 5,
    "created_at": "2026-03-19T10:00:00.000Z"
  },
  "recent_jobs": [
    {
      "id": 12,
      "job_id": "job-1710843200000-x7k2p",
      "job_type": "llm_inference",
      "status": "completed",
      "submitted_at": "2026-03-19T11:00:00.000Z",
      "completed_at": "2026-03-19T11:03:00.000Z",
      "actual_cost_halala": 45
    }
  ]
}
```

---

### GET /api/renters/balance

فحص الرصيد بسرعة.

**المصادقة:** ترويسة `x-renter-key` أو معامل `?key=`

**الاستجابة 200:**

```json
{
  "balance_halala": 5000,
  "balance_sar": 50.0,
  "held_halala": 75,
  "held_sar": 0.75,
  "available_halala": 5000,
  "total_spent_halala": 1000,
  "total_spent_sar": 10.0,
  "total_jobs": 5
}
```

`held_halala` هي الأموال المحجوزة للمهام الجارية. `available_halala` هو الرصيد القابل للإنفاق بعد خصم المحجوز.

---

### POST /api/renters/topup

إضافة رصيد لحساب المستأجر.

**المصادقة:** ترويسة `x-renter-key`

**جسم الطلب** (اختر أحدهما):

```json
{ "amount_halala": 5000 }
```

```json
{ "amount_sar": 50 }
```

الحد الأقصى 1,000 ريال (100,000 هللة) في المعاملة الواحدة.

**الاستجابة 200:**

```json
{
  "success": true,
  "topped_up_halala": 5000,
  "topped_up_sar": 50.0,
  "new_balance_halala": 6000,
  "new_balance_sar": 60.0
}
```

---

### GET /api/renters/available-providers

قائمة مزودي GPU المتاحين حالياً.

**المصادقة:** لا تحتاج (نقطة نهاية عامة)

**الاستجابة 200:**

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
  "total": 4
}
```

`is_live: true` يعني أن الداعم أرسل نبضة قلب خلال آخر دقيقتين. فضّل المزودين الأحياء. `cached_models` يُدرج النماذج المحمَّلة مسبقاً — المهام التي تستهدفها تبدأ أسرع.

---

## نقاط نهاية المهام (Job Endpoints)

### POST /api/jobs/submit

إرسال مهمة حوسبة إلى مزود.

**المصادقة:** ترويسة `x-renter-key` (مطلوبة)

**جسم الطلب:**

```json
{
  "provider_id": 3,
  "job_type": "llm_inference",
  "duration_minutes": 5,
  "params": {
    "model": "mistralai/Mistral-7B-Instruct-v0.2",
    "prompt": "اشرح الذكاء الاصطناعي لطالب مدرسة",
    "max_tokens": 256,
    "temperature": 0.7
  },
  "priority": 2,
  "gpu_requirements": {
    "min_vram_gb": 16
  }
}
```

**الحقول:**

| الحقل | النوع | مطلوب | الوصف |
|-------|-------|--------|-------|
| `provider_id` | عدد صحيح | نعم | معرف المزود من قائمة المتاحين |
| `job_type` | نص | نعم | انظر أنواع المهام أدناه |
| `duration_minutes` | رقم | نعم | المدة المقدرة — تُستخدم لخصم التكلفة مسبقاً |
| `params` | كائن | نعم (للمهام القالبية) | معاملات خاصة بنوع المهمة |
| `priority` | عدد صحيح | لا | 1=عالية، 2=عادية (افتراضي)، 3=منخفضة |
| `gpu_requirements` | كائن | لا | `{ "min_vram_gb": N }` |
| `max_duration_seconds` | عدد صحيح | لا | مهلة قصوى (الحد الأقصى 3600، الافتراضي 1800) |

**أنواع المهام المدعومة:**

| نوع المهمة | الوصف | المعاملات المطلوبة |
|-----------|-------|-------------------|
| `llm_inference` | توليد نص | `model`، `prompt`، `max_tokens`، `temperature` |
| `image_generation` | توليد صورة من نص | `prompt`، `model`، `steps`، `width`، `height` |
| `vllm_serve` | خادم استدلال متوافق مع OpenAI | `model`، `max_model_len`، `dtype` |
| `custom_container` | Docker + سكريبت مخصص | `image_override`، `script` |
| `training` | مهمة تدريب مخصصة | سكريبت Python خام |
| `rendering` | مهمة تصيير مخصصة | سكريبت Python خام |
| `benchmark` | قياس أداء GPU | لا توجد معاملات |

**النماذج المسموح بها لـ `llm_inference`:**

- `microsoft/phi-2`
- `microsoft/phi-1_5`
- `TinyLlama/TinyLlama-1.1B-Chat-v1.0`
- `google/gemma-2b`
- `mistralai/Mistral-7B-Instruct-v0.2`

**النماذج المسموح بها لـ `image_generation`:**

- `CompVis/stable-diffusion-v1-4`
- `stabilityai/stable-diffusion-2-1`
- `runwayml/stable-diffusion-v1-5`
- `stabilityai/stable-diffusion-xl-base-1.0`

**الاستجابة 201:**

```json
{
  "success": true,
  "job": {
    "id": 42,
    "job_id": "job-1710843200000-x7k2p",
    "provider_id": 3,
    "renter_id": 7,
    "job_type": "llm_inference",
    "status": "pending",
    "submitted_at": "2026-03-19T11:00:00.000Z",
    "duration_minutes": 5,
    "cost_halala": 75,
    "max_duration_seconds": 1800,
    "priority": 2,
    "queue_position": null
  }
}
```

إذا كان المزود مشغولاً، تكون الحالة `"queued"` ويُشير `queue_position` إلى موضعك في قائمة الانتظار.

**الأخطاء:**

| الكود | السبب |
|-------|-------|
| 400 | حقول مطلوبة مفقودة |
| 400 | `job_type` غير صالح |
| 400 | رُفض سكريبت Python خام — استخدم `params` بدلاً |
| 401 | مفتاح API المستأجر غير مُقدَّم |
| 402 | رصيد غير كافٍ — يتضمن `shortfall_halala` |
| 403 | مفتاح API غير صالح |
| 404 | المزود غير موجود |
| 400 | المزود غير متصل |

---

### GET /api/jobs/:job_id

جلب حالة المهمة والبيانات الوصفية.

**المصادقة:** ترويسة `x-renter-key`

`:job_id` يقبل المعرف الرقمي `id` أو المعرف النصي مثل `job-1710843200000-x7k2p`.

**الاستجابة 200:**

```json
{
  "job": {
    "id": 42,
    "job_id": "job-1710843200000-x7k2p",
    "job_type": "llm_inference",
    "status": "completed",
    "submitted_at": "2026-03-19T11:00:00.000Z",
    "started_at": "2026-03-19T11:00:05.000Z",
    "completed_at": "2026-03-19T11:03:00.000Z",
    "duration_minutes": 5,
    "actual_duration_minutes": 3,
    "cost_halala": 75,
    "actual_cost_halala": 45,
    "priority": 2
  }
}
```

**دورة حياة حالة المهمة:**

```
pending (بانتظار) → running (تنفيذ) → completed (اكتملت)
                         ↓
                      failed (فشلت)
queued (انتظار) → pending
```

---

### GET /api/jobs/:job_id/output

جلب نتيجة مهمة مكتملة.

**المصادقة:** ترويسة `x-renter-key`

**الاستجابة 200 (استدلال LLM):**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "status": "completed",
  "result": {
    "type": "text",
    "response": "رؤية 2030 هي استراتيجية طموحة...",
    "tokens_generated": 215,
    "tokens_per_second": 22.1,
    "model": "mistralai/Mistral-7B-Instruct-v0.2"
  },
  "actual_cost_halala": 45,
  "actual_duration_minutes": 3
}
```

**الاستجابة 200 (توليد صورة):**

```json
{
  "job_id": "job-1710843200000-abc123",
  "status": "completed",
  "result": {
    "type": "image",
    "image_base64": "/9j/4AAQ...",
    "format": "png",
    "width": 1024,
    "height": 1024,
    "model": "stabilityai/stable-diffusion-xl-base-1.0"
  }
}
```

---

### GET /api/jobs/:job_id/logs

جلب سجلات التنفيذ من داعم GPU.

**المصادقة:** ترويسة `x-renter-key`

**الاستجابة 200:**

```json
{
  "job_id": "job-1710843200000-x7k2p",
  "logs": [
    "[dc1] تحميل النموذج: mistralai/Mistral-7B-Instruct-v0.2",
    "[dc1] تم تحميل النموذج في 8.3 ثانية على cuda",
    "[dc1] تم توليد 215 رمزاً في 9.7 ثانية"
  ]
}
```

---

### POST /api/jobs/:job_id/cancel

إلغاء مهمة قيد الانتظار. يُسترد المبلغ المدفوع مسبقاً.

**المصادقة:** ترويسة `x-renter-key`

**الاستجابة 200:**

```json
{
  "success": true,
  "job_id": "job-1710843200000-x7k2p",
  "status": "cancelled",
  "refunded_halala": 75
}
```

---

## صيغة الخطأ

جميع الأخطاء تتبع صيغة موحدة:

```json
{
  "error": "رسالة خطأ واضحة للإنسان",
  "code": "كود_الخطأ_الاختياري"
}
```

رموز HTTP الشائعة:

| الكود | المعنى |
|-------|--------|
| 400 | طلب خاطئ — معاملات أو جسم غير صالح |
| 401 | بيانات اعتماد المصادقة مفقودة |
| 402 | رصيد غير كافٍ |
| 403 | بيانات اعتماد غير صالحة أو محظور |
| 404 | المورد غير موجود |
| 409 | تعارض (بريد إلكتروني مكرر، إلخ) |
| 429 | تجاوز حد معدل الطلبات |
| 500 | خطأ في الخادم |

---

## روابط مفيدة

- [دليل البدء السريع (عربي)](./quickstart-ar.md)
- [مرجع API الكامل (إنجليزي)](./api-reference.md)
- [دليل المزود](./provider-guide.md)
- [أدلة SDK](./sdk-guides.md)
