# Earn SAR from Your Idle GPU — List on DCP

*DCP — Saudi Arabia's First Decentralized GPU Compute Marketplace*

---

## Your GPU Is Working Against You by Sitting Idle

If you own an NVIDIA GPU — a gaming rig, a mining machine, a workstation — it spends most of its time doing nothing. No AI workload, no render job, nothing. Just drawing standby power and returning zero SAR.

DCP changes that. We connect GPU owners with AI engineers, ML researchers, and Saudi startups that need compute power for LLM inference, image generation, and model training. You install a lightweight daemon, and your GPU starts earning SAR automatically — every hour a job runs.

---

## How Much Can You Earn?

Providers keep **75%** of every job. DCP takes a 25% platform fee.

| GPU Model | Your Earnings/Hour | Daily (100% load) | Monthly (100% load) |
|-----------|-------------------|-------------------|---------------------|
| RTX 3080  | ~8 SAR/hr         | ~192 SAR          | ~5,760 SAR          |
| RTX 3090  | ~11 SAR/hr        | ~264 SAR          | ~7,920 SAR          |
| RTX 4090  | **15 SAR/hr**     | **~360 SAR**      | **~10,800 SAR**     |
| A100 80GB | ~56 SAR/hr        | ~1,350 SAR        | ~40,500 SAR         |

*Conservative estimate at 50% utilization halves these numbers. Early providers on the platform see higher utilization as we grow.*

---

## Setup in Under 10 Minutes

### Step 1 — Register (2 minutes)

Go to **[dcp.sa/provider/register](https://dcp.sa/provider/register)**. Enter your name, email, and GPU model. You'll receive your Provider API Key instantly.

### Step 2 — Install the Daemon (5 minutes)

The DCP daemon is a lightweight Python script. It runs silently in the background, sends a heartbeat every 30 seconds, and executes jobs inside isolated Docker containers on your GPU.

**Linux / macOS:**
```bash
curl -fsSL https://dcp.sa/api/providers/download/daemon?key=YOUR_KEY -o dc1_daemon.py
python3 dc1_daemon.py
```

**Windows — one click:**
Download the `.exe` installer from [dcp.sa/provider/download](https://dcp.sa/provider/download). It handles Python, the daemon, and auto-start on login. No command line required.

### Step 3 — Go Live

Within 2 minutes of starting the daemon, your machine appears as **online** in your [provider dashboard](https://dcp.sa/provider). Jobs arrive automatically. You don't need to do anything else.

---

## Your Machine Stays Safe

Every job runs inside an isolated Docker container. Renters get GPU compute only — they cannot:

- Open a shell on your machine
- Access your files or home directory
- See your other running processes
- Access your local network

When a job completes, the container is destroyed. Your machine, your data — always yours.

DCP complies with Saudi data protection regulations (PDPL). All job data is processed within Saudi Arabia.

---

## Getting Paid

- Earnings accumulate in real time in your **provider wallet**
- View your balance and full job history at [dcp.sa/provider](https://dcp.sa/provider)
- Payouts processed **weekly** via IBAN to your Saudi bank account
- Minimum withdrawal: **50 SAR**
- **SAR only** — no crypto, no PayPal, no friction

---

## Who Should Register?

- Gamers with RTX 3080 / 3090 / 4090 machines that are idle at night
- Former crypto miners looking to repurpose their rigs profitably
- IT teams with spare GPU workstations
- Businesses with server hardware sitting underutilized

If your NVIDIA GPU has ≥ 8 GB VRAM and you have a stable internet connection (100 Mbps+), you qualify.

---

## Register Now

**[dcp.sa/provider/register](https://dcp.sa/provider/register)**

Questions? Email **support@dcp.sa** or find us on [Hsoub.com](https://hsoub.com).

---
---

# اكسب ريالات سعودية من بطاقتك الرسومية الخاملة — سجّل في DCP

*DCP — أول سوق لامركزي للحوسبة الرسومية في المملكة العربية السعودية*

<div dir="rtl">

---

## بطاقتك الرسومية تخسر المال كل يوم وهي خاملة

إذا كنت تمتلك بطاقة NVIDIA — سواء كانت في جهاز الألعاب، أو منصة التعدين، أو محطة العمل — فهي تقضي معظم وقتها دون عمل. لا مهام ذكاء اصطناعي، لا تصيير، لا شيء. فقط تستهلك الكهرباء وتعود عليك بصفر ريال.

DCP يغيّر هذا. نربط أصحاب بطاقات GPU بمهندسي الذكاء الاصطناعي والباحثين والشركات الناشئة السعودية التي تحتاج قوة حوسبة لتشغيل نماذج اللغة الكبيرة وتوليد الصور وتدريب النماذج. تثبّت برنامجاً خفيفاً، وتبدأ بطاقتك في كسب الريالات السعودية تلقائياً — كل ساعة تُنجز فيها مهمة.

---

## كم يمكنك أن تكسب؟

المزوّد يحتفظ بـ **75%** من كل مهمة. DCP تأخذ 25% عمولة المنصة.

| نوع البطاقة | أرباحك بالساعة | يومياً (100% إشغال) | شهرياً (100% إشغال) |
|-------------|---------------|---------------------|---------------------|
| RTX 3080    | ~8 ريال/ساعة  | ~192 ريال           | ~5,760 ريال         |
| RTX 3090    | ~11 ريال/ساعة | ~264 ريال           | ~7,920 ريال         |
| RTX 4090    | **15 ريال/ساعة** | **~360 ريال**    | **~10,800 ريال**    |
| A100 80GB   | ~56 ريال/ساعة | ~1,350 ريال         | ~40,500 ريال        |

*التقدير المحافظ عند 50% إشغال يُنصّف هذه الأرقام. المزوّدون الأوائل على المنصة يستفيدون من معدلات إشغال أعلى مع نمونا.*

---

## الإعداد في أقل من 10 دقائق

### الخطوة 1 — التسجيل (دقيقتان)

اذهب إلى **[dcp.sa/provider/register](https://dcp.sa/provider/register)**. أدخل اسمك وبريدك الإلكتروني ونوع بطاقتك الرسومية. ستحصل على مفتاح API الخاص بك فوراً.

### الخطوة 2 — تثبيت البرنامج (5 دقائق)

برنامج DCP عبارة عن سكريبت Python خفيف. يعمل بصمت في الخلفية، يرسل إشارة نبض كل 30 ثانية، وينفّذ المهام داخل حاويات Docker معزولة على بطاقتك الرسومية.

**Linux / macOS:**
```bash
curl -fsSL https://dcp.sa/api/providers/download/daemon?key=YOUR_KEY -o dc1_daemon.py
python3 dc1_daemon.py
```

**ويندوز — بنقرة واحدة:**
حمّل ملف `.exe` من [dcp.sa/provider/download](https://dcp.sa/provider/download). يتولى كل شيء: Python والبرنامج والتشغيل التلقائي عند تشغيل الجهاز. لا حاجة لسطر الأوامر.

### الخطوة 3 — ابدأ بالكسب

خلال دقيقتين من تشغيل البرنامج، يظهر جهازك بحالة **أونلاين** في [لوحة تحكم المزوّد](https://dcp.sa/provider). تصل المهام تلقائياً. لا تحتاج أن تفعل شيئاً آخر.

---

## جهازك يبقى آمناً

كل مهمة تعمل داخل حاوية Docker معزولة. المستأجر يحصل على قوة الحوسبة فقط — لا يستطيع:

- فتح terminal على جهازك
- الوصول إلى ملفاتك أو مجلداتك
- رؤية باقي العمليات الجارية
- الوصول إلى شبكتك المحلية

عند اكتمال المهمة، تُحذف الحاوية تلقائياً. جهازك وبياناتك — ملكك دائماً.

DCP يلتزم بأنظمة حماية البيانات السعودية (نظام PDPL). جميع بيانات المهام تُعالَج داخل المملكة العربية السعودية.

---

## كيف تستلم أرباحك؟

- تتراكم الأرباح في الوقت الفعلي في **محفظة المزوّد** الخاصة بك
- تابع رصيدك وسجل مهامك الكامل من [dcp.sa/provider](https://dcp.sa/provider)
- المدفوعات أسبوعياً عبر **تحويل IBAN** إلى حسابك البنكي السعودي
- الحد الأدنى للسحب: **50 ريال**
- **ريال سعودي فقط** — لا عملات رقمية، لا PayPal، لا تعقيدات

---

## من يجب أن يسجّل؟

- اللاعبون الذين يمتلكون أجهزة RTX 3080 / 3090 / 4090 خاملة في الليل
- المعدّنون السابقون الراغبون في إعادة توظيف منصاتهم بشكل مربح
- فرق تقنية المعلومات التي تمتلك محطات عمل رسومية احتياطية
- الشركات التي لديها أجهزة خوادم غير مُستغلة بكامل طاقتها

إذا كانت بطاقتك NVIDIA تحتوي على ≥ 8 جيجابايت VRAM ولديك اتصال إنترنت ثابت (100 ميجابت/ثانية فأعلى)، فأنت مؤهّل.

---

## سجّل الآن

**[dcp.sa/provider/register](https://dcp.sa/provider/register)**

لديك أسئلة؟ راسلنا على **support@dcp.sa** أو تفضّل بزيارتنا على [Hsoub.com](https://hsoub.com).

</div>
