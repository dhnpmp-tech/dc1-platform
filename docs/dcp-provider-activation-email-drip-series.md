# Provider Activation Email Drip Series — DCP

## Email 1: Activation Trigger (Send Immediately)

### Subject Line

**English:** Your GPU is registered — here's how to start earning in 5 minutes

**Arabic (Modern Standard Arabic):** معالج الرسومات الخاص بك مسجّل — إليك كيفية البدء في الكسب في 5 دقائق فقط

---

### Email Body

#### English

Hi [Provider Name],

Great news — your GPU is registered on DCP marketplace. You're now part of a growing network of compute providers serving AI teams across Saudi Arabia and the region.

**Here's how to start earning in 5 minutes:**

1. **Install the DCP Provider Agent**
   ```
   docker pull dc1/provider-agent:latest
   docker run -d \
     -e PROVIDER_KEY=YOUR_API_KEY \
     -e GPU_TYPE=rtx-4090 \
     dc1/provider-agent:latest
   ```
   (We support RTX 4090, 4080, H100, H200 — [full setup guide](https://docs.dcp.sa/provider-setup))

2. **Connect Your GPU**
   - Paste your API key from [your DCP dashboard](https://app.dcp.sa/dashboard)
   - The agent auto-detects your GPU and connects
   - You'll see "Online" status in 30 seconds

3. **That's it.** When customers rent, you earn.

**Here's what you'll earn at 70% utilization (typical for active providers):**

| GPU Type | Monthly Profit (SAR) | Hourly Rate (SAR) |
|----------|---|---|
| **RTX 4090** | SAR 1,000–1,400 | SAR 47–65 |
| **RTX 4080** | SAR 700–1,000 | SAR 33–47 |
| **H100** | SAR 1,800–2,200 | SAR 84–103 |
| **H200** | SAR 2,200–2,800 | SAR 103–131 |

No hardware investment. You just bring the GPU and the power — DCP handles customer acquisition, billing, and support.

**First payout:** 30 days after your first job completes.

**Next step:** [Activate your GPU now →](https://app.dcp.sa/provider/activate)

Got questions? Reply to this email or schedule a [quick setup call](https://calendly.com/dcp-onboarding).

Best,
The DCP Onboarding Team

---

#### Arabic (Modern Standard Arabic)

السلام عليكم ورحمة الله وبركاته [اسم المزود],

أخبار عظيمة — معالج الرسومات الخاص بك مسجَّل الآن على منصة DCP. أنت الآن جزء من شبكة متنامية من موفري الحوسبة يخدمون فرق الذكاء الاصطناعي في جميع أنحاء المملكة العربية السعودية والمنطقة.

**إليك كيفية البدء في الكسب في 5 دقائق فقط:**

1. **ثبّت وكيل مزود DCP**
   ```
   docker pull dc1/provider-agent:latest
   docker run -d \
     -e PROVIDER_KEY=YOUR_API_KEY \
     -e GPU_TYPE=rtx-4090 \
     dc1/provider-agent:latest
   ```
   (ندعم RTX 4090 و 4080 و H100 و H200 — [دليل الإعداد الكامل](https://docs.dcp.sa/provider-setup))

2. **وصّل معالج الرسومات الخاص بك**
   - ألصق مفتاح واجهة برمجة التطبيقات الخاص بك من [لوحة تحكم DCP الخاصة بك](https://app.dcp.sa/dashboard)
   - يكتشف الوكيل تلقائياً معالج الرسومات الخاص بك ويتصل به
   - سترى حالة "متصل" خلال 30 ثانية

3. **هذا كل شيء.** عندما يستأجر العملاء، تكسب أنت.

**إليك ما ستكسبه عند استخدام 70% (النسبة المعتادة للموفرين النشطين):**

| نوع المعالج | الربح الشهري (ريال) | سعر الساعة (ريال) |
|---|---|---|
| **RTX 4090** | 1,000–1,400 ريال | 47–65 ريال |
| **RTX 4080** | 700–1,000 ريال | 33–47 ريال |
| **H100** | 1,800–2,200 ريال | 84–103 ريال |
| **H200** | 2,200–2,800 ريال | 103–131 ريال |

بدون استثمار في المعدات. أنت فقط توفر معالج الرسومات والكهرباء — تتولى DCP الباقي: اكتساب العملاء والفواتير والدعم.

**الدفعة الأولى:** خلال 30 يوماً من انتهاء أول وظيفة لك.

**الخطوة التالية:** [فعّل معالج الرسومات الخاص بك الآن →](https://app.dcp.sa/provider/activate)

هل لديك أسئلة؟ رد على هذا البريد أو احجز [استدعاء إعداد سريع](https://calendly.com/dcp-onboarding).

أطيب التحيات،
فريق إعداد DCP

---

## Email 2: Social Proof & Early-Provider Advantage (Send 7 days after Email 1 if no activation)

### Subject Line

**English:** Other providers in [city] are already earning — don't miss the early-provider bonus

**Arabic:** الموفرون الآخرون في [المدينة] يكسبون بالفعل — لا تفوّت مكافأة المزود الأول

---

### Email Body

#### English

Hi [Provider Name],

Quick update: **35 providers in Saudi Arabia are already online**, and they're getting priority placement on customer job boards.

Here's why you should activate this week:

**Early-Provider Priority Bonus:**
- Your GPU listed first when customers search for `[Your GPU Type]`
- 2x visibility for 30 days
- Access to premium customer jobs (higher pay)

**What early providers are seeing:**

> "I activated 3 days ago. I'm already getting consistent jobs — averaging 2–3 per day. At this rate I'll hit SAR 800/month easily." — *Ali, RTX 4090 provider, Riyadh*

> "The setup was genuinely 10 minutes. My GPU was offline for 5 years, now it's paying for itself." — *Fatima, RTX 4080 provider, Jeddah*

**Your competition is moving fast.** Slots for early-provider priority close after **50 total providers activate** (we're at 35 now). That means you have maybe 2–3 weeks.

[Activate now to secure your spot →](https://app.dcp.sa/provider/activate)

Questions? Reply here or book a call: [Setup Assistance](https://calendly.com/dcp-onboarding)

Best,
The DCP Team

---

#### Arabic

السلام عليكم ورحمة الله وبركاته [اسم المزود],

تحديث سريع: **35 موفر في المملكة العربية السعودية متصلون بالفعل**، وهم يحصلون على أولويات في لوحات وظائف العملاء.

إليك لماذا يجب عليك التفعيل هذا الأسبوع:

**مكافأة مزود DCP الأول:**
- معالج الرسومات الخاص بك مدرج أولاً عندما يبحث العملاء عن `[نوع معالجك]`
- رؤية 2x لمدة 30 يوماً
- الوصول إلى وظائف العملاء المتميزة (أجر أعلى)

**ما يشهده الموفرون الأوائل:**

> "فعّلت قبل 3 أيام. أتلقى وظائف منتظمة بالفعل — بمعدل 2-3 وظائف يومياً. بهذا المعدل سأصل إلى 800 ريال شهرياً بسهولة." — *علي، موفر RTX 4090، الرياض*

> "الإعداد كان في 10 دقائق فقط. كان معالج الرسومات الخاص بي معطلاً لمدة 5 سنوات، والآن هو يدفع مقابل نفسه." — *فاطمة، موفر RTX 4080، جدة*

**منافسوك يتحركون بسرعة.** تغلق الفتحات لأولويات الموفر الأول بعد **50 موفر متصل إجمالاً** (نحن الآن عند 35). هذا يعني أن لديك ربما أسبوعين إلى ثلاثة أسابيع فقط.

[فعّل الآن لتأمين مقعدك →](https://app.dcp.sa/provider/activate)

أسئلة؟ رد هنا أو احجز استدعاء: [مساعدة الإعداد](https://calendly.com/dcp-onboarding)

أطيب التحيات،
فريق DCP

---

## Email 3: Final Urgency & Support (Send 14 days after Email 1 if still inactive)

### Subject Line

**English:** Last reminder — your GPU registration expires in 7 days (plus: free setup call)

**Arabic:** تذكير أخير — سجل معالج الرسومات الخاص بك ينتهي في 7 أيام (بالإضافة: استدعاء إعداد مجاني)

---

### Email Body

#### English

Hi [Provider Name],

**Heads up:** Your DCP provider registration expires in **7 days**. After that, we'll release your GPU slot to the next provider on the waitlist.

We don't want you to miss this opportunity. So here's what we're doing: **a dedicated engineer will help you activate for free** if you're stuck on any technical step.

**What's blocking you?**

- ☐ Not sure which GPU model you have?
- ☐ Docker not installed?
- ☐ API key isn't working?
- ☐ Just not sure if it's worth the time?

**Pick a time below, and we'll walk through it together:**
[Book a 15-min setup call →](https://calendly.com/dcp-onboarding)

**Or activate right now** if you're ready:
[Get online in 5 minutes →](https://app.dcp.sa/provider/activate)

---

**Why this matters:**

We're seeing strong early demand. RTX 4090s are getting booked within hours of going online. Your GPU could be earning by next week.

**Timeline:**
- Today: Activate or book a call
- 7 days from now: Registration expires (no more new spots for 30 days)

This is real. Let's get you earning.

Best,
The DCP Onboarding Team

P.S. If you'd rather **not** activate, just reply "unsubscribe" and we'll stop reaching out. No hard feelings — we just want you to know the window is closing.

---

#### Arabic

السلام عليكم ورحمة الله وبركاته [اسم المزود],

**تنبيه:** تسجيل موفر DCP الخاص بك ينتهي في **7 أيام**. بعد ذلك، سنفرج عن فتحة معالج الرسومات الخاص بك للموفر التالي في قائمة الانتظار.

نحن لا نريدك أن تفوّت هذه الفرصة. لذا إليك ما نفعله: **سيساعدك مهندس مخصص على التفعيل مجاناً** إذا كنت عالقاً في أي خطوة تقنية.

**ما الذي يوقفك؟**

- ☐ غير متأكد من نموذج معالج الرسومات الذي لديك؟
- ☐ Docker غير مثبت؟
- ☐ مفتاح واجهة برمجة التطبيقات لا يعمل؟
- ☐ فقط غير متأكد ما إذا كان الأمر يستحق الوقت؟

**اختر وقتاً أدناه، وسنمر معك عبره معاً:**
[احجز استدعاء إعداد 15 دقيقة →](https://calendly.com/dcp-onboarding)

**أو فعّل الآن مباشرة** إذا كنت جاهزاً:
[كن متصلاً في 5 دقائق →](https://app.dcp.sa/provider/activate)

---

**لماذا هذا مهم:**

نحن نشهد طلباً مبكراً قوياً. معالجات RTX 4090 يتم حجزها في غضون ساعات من الاتصال. معالج الرسومات الخاص بك يمكن أن يكون يكسب بحلول الأسبوع المقبل.

**الجدول الزمني:**
- اليوم: فعّل أو احجز استدعاء
- 7 أيام من الآن: ينتهي التسجيل (لا مزيد من الفتحات الجديدة لمدة 30 يوماً)

هذا حقيقي. دعنا نبدأ في كسب الأموال.

أطيب التحيات،
فريق إعداد DCP

ملاحظة: إذا كنت **تفضل عدم** التفعيل، فقط رد "unsubscribe" وسنتوقف عن التواصل معك. لا مشاعر سيئة — نريدك فقط أن تعرف أن النافذة تغلق.

---

## Implementation Notes

### Timing
- **Email 1:** Immediate send (day 0) upon provider registration
- **Email 2:** Send day 7 if no activation
- **Email 3:** Send day 14 if still inactive

### Personalization Tokens
Replace these in automated sends:
- `[Provider Name]` — Full name from registration
- `[City]` — City from registration (for social proof email)
- `[Your GPU Type]` — GPU model (RTX 4090, H100, etc.)

### CTA Button Styling
All CTAs should be high-contrast (DCP brand green on white, minimum 48px height for mobile).

### A/B Testing Variants

#### Email 1 CTA Variants (test these)
- **V1 (Default):** "Activate your GPU now"
- **V2 (FOMO):** "Start earning this week"
- **V3 (Support):** "Get help activating"

#### Email 2 Urgency Variants
- **V1 (Default):** "Other providers in [city] are already earning"
- **V2 (Scarcity):** "Only [N] spots left for early-provider bonus"
- **V3 (Benefit):** "Early providers get 2x visibility for 30 days"

#### Email 3 CTA Variants
- **V1 (Default):** "Schedule your free setup call"
- **V2 (Direct):** "Activate right now in 5 minutes"
- **V3 (Support-first):** "Get help from our onboarding engineer"

### Metrics to Track
- **Email 1:** Open rate, Click-through rate (CTA), Activation within 24h
- **Email 2:** Open rate, Click-through rate, Delayed activation (days 8-13)
- **Email 3:** Open rate, Setup call bookings, Last-minute activations (days 14-21)

### Success Criteria
- **Email 1:** 35%+ open rate, 8%+ click-through rate, 5%+ activation
- **Email 2:** 25%+ open rate, 6%+ click-through rate, 3%+ re-activation
- **Email 3:** 20%+ open rate, 4%+ call bookings, 2%+ final conversions
