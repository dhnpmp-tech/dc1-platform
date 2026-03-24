# Renter First-Run Onboarding Flow — Design Specification

**Target User:** New renter signing up for the first time
**Goal:** Get from sign-up to first successful model deployment with clear guidance
**Success Metric:** 60%+ new renters complete onboarding within 24 hours
**Critical UX Principle:** Every step has a clear purpose and shows progress toward deployment

---

## Onboarding Journey Map

```
┌─────────────────┐
│  Sign Up        │  Email + password, agree to ToS
├─────────────────┤
│  Email Verify   │  Click link, verify account
├─────────────────┤
│  Profile Setup  │  Name, company, use case (optional)
├─────────────────┤
│  Wallet Setup   │  Add payment method (Saudi IBAN or card)
├─────────────────┤
│  Topup Credit   │  Fund initial balance (100-1000 SAR)
├─────────────────┤
│  Browse Models  │  View available templates, filter by use case
├─────────────────┤
│  Model Detail   │  Review pricing, estimated cost, requirements
├─────────────────┤
│  Deploy         │   1-click deploy, see deployment progress
├─────────────────┤
│  First Inference│  Run sample query, see result
├─────────────────┤
│  Success State  │  Celebration modal, show cost, next steps
└─────────────────┘
```

---

## Step-by-Step Specification

### STEP 1: Sign Up (New Account Creation)

**Page Title:** "Create Your DCP Account"
**URL:** `/onboarding/signup`

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  DCP Arabic RAG                        │
│  _________________________________      │
│                                        │
│  Create Your Account                   │
│                                        │
│  Email:                                │
│  [_____________________________]        │
│  * Required                            │
│                                        │
│  Password:                             │
│  [_____________________________] [👁]   │
│  Must be 10+ chars, 1 number, 1 symbol│
│                                        │
│  Confirm Password:                     │
│  [_____________________________] [👁]   │
│                                        │
│  [ ] I agree to Terms of Service       │
│      (link to /terms)                  │
│  [ ] I agree to Privacy Policy         │
│      (link to /privacy)                │
│                                        │
│  [Create Account]  [Already have one?] │
│                    [Sign In]           │
│                                        │
│  ─────────────────────────────────────│
│  Questions? Email support@dcp.sa      │
│                                        │
└────────────────────────────────────────┘
```

**Form Fields:**

| Field | Type | Validation | Error Message |
|-------|------|-----------|---------------|
| **Email** | email | Must be valid email, not already registered | "Email already in use" or "Invalid email address" |
| **Password** | password | Min 10 chars, 1 uppercase, 1 number, 1 symbol | "Password too weak. Add uppercase, number, or symbol." |
| **Confirm** | password | Must match Password field | "Passwords don't match" |
| **ToS Checkbox** | checkbox | Required | "Please accept Terms of Service" |
| **Privacy Checkbox** | checkbox | Required | "Please accept Privacy Policy" |

**Submit Behavior:**
- Button label: "Create Account"
- Loading state: "Creating..." (disabled button, spinner)
- Success: Redirect to `/onboarding/email-verify`
- Error: Show inline error message, keep form filled

**API Endpoint:**
```
POST /api/auth/signup
{
  "email": "renter@example.com",
  "password": "SecurePass123!",
  "timezone": "Asia/Riyadh"
}
→ { userId, sessionToken, nextStep: "email_verify" }
```

---

### STEP 2: Email Verification

**Page Title:** "Verify Your Email"
**URL:** `/onboarding/email-verify`
**Behavior:** Auto-proceed to Step 3 if link clicked in email

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  ✉️  Email Verification                │
│                                        │
│  We sent a verification link to:       │
│  renter@example.com                    │
│                                        │
│  Click the link in your email to       │
│  continue. Link expires in 24 hours.   │
│                                        │
│  [_] Already clicked? [Verify Code]    │
│                                        │
│  Didn't get the email?                 │
│  [Resend Link]                         │
│                                        │
│  ─────────────────────────────────────│
│  This might take 1-2 minutes.         │
│  Check spam folder if needed.         │
│                                        │
└────────────────────────────────────────┘
```

**Component Details:**

| Element | Behavior | Notes |
|---------|----------|-------|
| **Email Display** | Show masked email (renter@ex****le.com) | Security: partial email obfuscation |
| **Verify Code Input** | Optional fallback: enter 6-digit code from email | If email link doesn't work |
| **Resend Link Button** | Rate-limited: 1 per 60 seconds | After first click, show countdown timer |
| **Auto-redirect** | When email verified, silently redirect to Step 3 | Optionally show "Taking you to next step..." |

**Email Template:**
```
Subject: Verify your DCP account

Hi [First Name],

Welcome to DCP Arabic RAG!

Click below to verify your email:
[LINK: https://dcp.sa/verify?token=ABC123XYZ]

Or enter this code in the app: 123456

Link expires in 24 hours.

Questions? Reply to this email.

— DCP Team
```

---

### STEP 3: Profile Setup (Optional but Recommended)

**Page Title:** "Tell Us About You"
**URL:** `/onboarding/profile`
**Behavior:** Can skip, but shows "Step 3 of 8" progress. Skipping marks field as "Complete Later"

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  Step 3 of 8: Your Profile             │
│  ═══════════════                       │
│                                        │
│  First Name:                           │
│  [_____________________________]        │
│                                        │
│  Last Name:                            │
│  [_____________________________]        │
│                                        │
│  Company:                              │
│  [_____________________________]        │
│  (Ministry, Law Firm, Fintech, etc.)  │
│                                        │
│  What will you use DCP for?            │
│  ☐ Government policy analysis          │
│  ☐ Legal case research                 │
│  ☐ Financial compliance                │
│  ☐ Healthcare/Medical research         │
│  ☐ Other: [____________]               │
│                                        │
│  [Continue] [Skip for Now]             │
│                                        │
│  Progress: ███░░░░░░ (3/8)             │
│                                        │
└────────────────────────────────────────┘
```

**Form Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| **First Name** | text | No | Improves support personalization |
| **Last Name** | text | No | Same |
| **Company** | text | No | Helps with marketing segmentation |
| **Use Case (Multi-select)** | checkbox group | No | Government, Legal, Fintech, Healthcare, Other |

**Submit Behavior:**
- "Continue" → Save and go to Step 4 (Wallet Setup)
- "Skip for Now" → Mark complete, go to Step 4
- Progress bar: Shows "3 of 8" steps

**API Endpoint:**
```
POST /api/user/profile
{
  "firstName": "Ahmed",
  "lastName": "Al-Dosary",
  "company": "Ministry of Justice",
  "useCases": ["legal", "government"]
}
```

---

### STEP 4: Wallet Setup (Add Payment Method)

**Page Title:** "Add Payment Method"
**URL:** `/onboarding/wallet`
**Critical:** Must complete before step 5

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  Step 4 of 8: Payment Method           │
│  ═════════════════════════             │
│                                        │
│  Payment Options:                      │
│                                        │
│  ☑ Saudi IBAN (Bank Transfer)         │
│  ☐ Debit/Credit Card (Visa/MC)        │
│  ☐ Wallet (if already have balance)   │
│                                        │
│  ─────────────────────────────────────│
│  Saudi IBAN Details:                   │
│                                        │
│  Bank Name:                            │
│  [Dropdown: Al Rajhi | Al Ahli | ...]  │
│                                        │
│  IBAN:                                 │
│  SA__ [_________________________]      │
│  Format: SA + 22 digits                │
│                                        │
│  Account Holder Name:                  │
│  [_____________________________]        │
│                                        │
│  [ ] Save for future payments          │
│                                        │
│  [Continue] [Use Different Method]     │
│                                        │
│  Progress: ████░░░░░ (4/8)             │
│                                        │
│  Safe, encrypted, PCI-DSS compliant    │
│                                        │
└────────────────────────────────────────┘
```

**Payment Option Details:**

| Option | Field Requirements | Processing | Notes |
|--------|-------------------|------------|-------|
| **Saudi IBAN** | Bank, IBAN (SA22), Account Holder | ACH (24-48h) | Cheapest, preferred for Saudi users |
| **Card** | Card Number, Expiry, CVV, Cardholder | Stripe/2Checkout (instant) | Faster, 2% processing fee |
| **Wallet** | Select existing wallet | Instant | For returning users with balance |

**Form Validation:**

| Field | Validation | Error |
|-------|-----------|-------|
| **IBAN** | Must start with SA, 24 chars total, match checksum | "Invalid IBAN format" |
| **Account Holder** | Must match bank records (verified at topup time) | "Will verify during first deposit" |
| **Bank** | Must be active Saudi bank | "Bank not supported" |

**API Endpoint:**
```
POST /api/wallet/add-payment-method
{
  "type": "iban",
  "iban": "SA1234567890123456789012",
  "bankName": "Al Rajhi Bank",
  "accountHolder": "Ahmed Al-Dosary",
  "saveForFuture": true
}
→ { walletId, paymentMethodId, status: "pending_verification" }
```

---

### STEP 5: Topup Credit (Fund Account)

**Page Title:** "Fund Your Account"
**URL:** `/onboarding/topup`
**Amount Range:** 100-10,000 SAR (minimum 100 SAR to proceed)

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  Step 5 of 8: Fund Your Account        │
│  ═══════════════════════               │
│                                        │
│  Current Balance: 0 SAR                │
│                                        │
│  How Much Would You Like to Add?       │
│                                        │
│  Suggested Amounts:                    │
│  [100 SAR] [250 SAR] [500 SAR]        │
│                                        │
│  Or enter custom amount:               │
│  [_____________] SAR                   │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Cost Estimate:                        │
│  Model: ALLaM 7B + BGE-M3             │
│  Inference cost: ~0.05 SAR per query   │
│  Your 500 SAR = ~10,000 queries        │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Payment Method: Saudi IBAN            │
│  Al Rajhi Bank ending in ...6789       │
│  [Change]                              │
│                                        │
│  [Add Credit] [Skip for Later]         │
│                                        │
│  Progress: █████░░░░ (5/8)             │
│                                        │
│  Your balance will be transferred from │
│  your bank within 24-48 hours.        │
│                                        │
└────────────────────────────────────────┘
```

**Component Details:**

| Element | Behavior | Notes |
|---------|----------|-------|
| **Suggested Amounts** | Quick-select buttons | 100, 250, 500 SAR (most common) |
| **Custom Amount Input** | Min 100, max 10,000 SAR | Validates on blur |
| **Cost Estimate** | Show queries available based on balance | Uses API: `/api/pricing/estimate?amount={SAR}` |
| **Payment Method Display** | Show selected IBAN (masked) | User can change or add new |
| **Add Credit Button** | Initiates bank transfer, shows confirmation | Redirect to bank transfer instructions or in-app payment portal |

**Skip Behavior:**
- Can skip topup, but prompted to "Fund Later" when attempting to deploy
- Skipping is tracked as abandonment metric

**API Endpoint:**
```
POST /api/wallet/topup
{
  "amount": 500,
  "currency": "SAR",
  "paymentMethodId": "iban_123",
  "autoReplenish": false
}
→ {
  topupId: "top_456",
  status: "pending_transfer",
  estimatedDelivery: "2026-03-26T12:00:00Z",
  queriesAvailable: 10000
}
```

---

### STEP 6: Browse Templates (Model Catalog)

**Page Title:** "Choose Your First Model"
**URL:** `/onboarding/templates`
**Behavior:** Can filter by use case (if set in profile)

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  Step 6 of 8: Browse Models            │
│  ══════════════════════════            │
│                                        │
│  Your Use Case: Legal                  │
│  (Recommended models shown first)      │
│                                        │
│  Filters:                              │
│  Use Case: [Legal ▼] VRAM: [Any ▼]    │
│  Language: [Arabic ▼] Price: [Any ▼]   │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ 🏆 Arabic RAG Bundle             │  │
│  │                                  │  │
│  │ BGE-M3 + BGE-Reranker + ALLaM 7B │  │
│  │ Perfect for: Legal, Government   │  │
│  │ VRAM: 27GB | Monthly: 2,450 SAR │  │
│  │                                  │  │
│  │ "Most Popular" ⭐⭐⭐⭐⭐          │  │
│  │                                  │  │
│  │ [Learn More] [Deploy]            │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ ALLaM 7B (Standalone LLM)        │  │
│  │                                  │  │
│  │ Meta's instruction-tuned Arabic  │  │
│  │ Perfect for: Summarization, QA   │  │
│  │ VRAM: 16GB | Monthly: 1,200 SAR  │  │
│  │                                  │  │
│  │ [Learn More] [Deploy]            │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [View All Models] [Continue Without] │  │
│                                        │
│  Progress: ██████░░░ (6/8)            │
│                                        │
└────────────────────────────────────────┘
```

**Card Components:**

| Element | Content | Behavior |
|---------|---------|----------|
| **Card Title** | Model name (Arabic RAG Bundle, ALLaM 7B) | Link to model detail page |
| **Badge** | "Popular", "Recommended" (if matches use case) | Green background |
| **Description** | Short use case (Legal, Government, Summarization) | 1-2 sentences |
| **Specs** | VRAM requirement, monthly cost | Bold text, highlight cost |
| **Rating** | Star count (5 stars for popular) | Indicate community preference |
| **CTAs** | "Learn More" (detail page) + "Deploy" (step 7) | "Learn More" in outline, "Deploy" in blue |

**Filtering Logic:**
- **By Use Case:** If user selected "Legal" in profile, show Legal-optimized models first
- **By VRAM:** Filter by minimum GPU memory available
- **By Price:** Show cost range, sort by ascending cost
- **By Language:** Show Arabic-first models

**Empty State (if no topup):**
```
┌────────────────────────────────────────┐
│  😢 No Balance to Deploy                │
│                                        │
│  You need to add credit before         │
│  deploying a model.                   │
│                                        │
│  [Go Back and Fund Account] [Skip]    │
│                                        │
└────────────────────────────────────────┘
```

**API Endpoint:**
```
GET /api/templates?useCase=legal&vram=any&language=ar
→ [
  {
    id: "tpl_001",
    name: "Arabic RAG Bundle",
    description: "BGE-M3 + BGE-Reranker + ALLaM 7B",
    vramRequired: 27,
    monthlyCost: 2450,
    rating: 5,
    tags: ["legal", "government", "arabic"]
  },
  ...
]
```

---

### STEP 7: Model Detail & Deploy

**Page Title:** "Deploy [Model Name]"
**URL:** `/onboarding/deploy?templateId=tpl_001`
**Behavior:** Shows pricing, requirements, 1-click deploy button

**Visual Layout:**
```
┌────────────────────────────────────────┐
│  ◀ Back to Models                      │
│                                        │
│  Step 7 of 8: Deploy Your Model        │
│  ═══════════════════════════════       │
│                                        │
│  Arabic RAG Bundle                     │
│  ⭐⭐⭐⭐⭐ (1,243 reviews)             │
│                                        │
│  ─────────────────────────────────────│
│  THE STACK                             │
│                                        │
│  📄 Embedding: BGE-M3 (Arabic-native) │
│  🔍 Ranking: BGE-Reranker             │
│  💬 LLM: ALLaM 7B (Arabic)             │
│                                        │
│  ─────────────────────────────────────│
│  REQUIREMENTS & COSTS                  │
│                                        │
│  GPU: RTX 4090                         │
│  VRAM: 27 GB                           │
│  Monthly Cost @ 70% utilization:       │
│  ╔════════════════════════════╗        │
│  ║ 2,450 SAR / month          ║        │
│  ║ = 0.034 SAR per query      ║        │
│  ║ Your balance: 500 SAR      ║        │
│  ║ Estimated queries: 14,706  ║        │
│  ╚════════════════════════════╝        │
│                                        │
│  Billing: Auto-deduct weekly or        │
│  monthly based on actual usage         │
│                                        │
│  ─────────────────────────────────────│
│  COMPLIANCE                            │
│                                        │
│  ✓ PDPL Compliant (Data stays in KSA) │
│  ✓ Audit-ready by design              │
│  ✓ No external API calls               │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  [ ] I understand the monthly cost    │
│  [ ] I understand billing terms       │
│  [ ] I agree to Model License (link)  │
│                                        │
│  [Deploy Now] [Cancel]                │
│                                        │
│  Progress: ███████░░ (7/8)            │
│                                        │
└────────────────────────────────────────┘
```

**Component Details:**

| Section | Content | Interactivity |
|---------|---------|---------------|
| **Model Header** | Title, rating, review count | Scroll to reviews on click |
| **Stack** | Embedding, Ranking, LLM with icons | Tooltip on hover shows VRAM, latency |
| **Requirements** | GPU, VRAM, monthly cost calculation | Costcalculator interactive (adjust utilization) |
| **Balance Box** | Current balance, estimated queries available | Shows "Insufficient balance" if needed |
| **Compliance** | Checkmarks for PDPL, audit-ready, no external APIs | Links to compliance documentation |
| **Checkboxes** | Acknowledge cost, billing, license | All must be checked to enable Deploy button |

**Insufficient Balance State:**
```
⚠️  Your balance (500 SAR) is below the first
   month's cost (2,450 SAR).

   [Add Credit Now] [Try Smaller Model]
```

**Deploy Button Behavior:**
- Button disabled until all checkboxes checked
- Click → Show "Deploying..." spinner
- Backend: Provision GPU, initialize model, start inference server
- Success: Redirect to Step 8 (First Inference)

**API Endpoint:**
```
POST /api/deployments
{
  "templateId": "tpl_001",
  "rentersUserId": "user_123"
}
→ {
  deploymentId: "dep_456",
  status: "provisioning",
  estimatedReady: "2026-03-24T11:30:00Z",
  monthlyBudget: 2450,
  queriesAvailable: 14706
}
```

---

### STEP 8: First Inference (Test the Model)

**Page Title:** "Try Your New Model"
**URL:** `/onboarding/first-inference?deploymentId=dep_456`
**Behavior:** Show deployment status, then allow user to run sample query

**Visual Layout (Provisioning):**
```
┌────────────────────────────────────────┐
│  Step 8 of 8: First Query              │
│  ══════════════════════════            │
│                                        │
│  🚀 Your Model is Starting Up...       │
│                                        │
│  Status:                               │
│  ✓ GPU Allocated (RTX 4090)            │
│  ✓ Models Downloading (BGE-M3)         │
│  ⏳ Models Loading (ALLaM 7B)         │
│  ○ Ready for Queries                   │
│                                        │
│  This takes 2-5 minutes. Get coffee... │
│  (Auto-refresh in 5s)                  │
│                                        │
│  [Refresh] [Go Back]                   │
│                                        │
└────────────────────────────────────────┘
```

**Visual Layout (Ready):**
```
┌────────────────────────────────────────┐
│  Step 8 of 8: First Query              │
│  ══════════════════════════            │
│                                        │
│  ✓ Your Model is Ready!                │
│                                        │
│  Status:                               │
│  ✓ GPU Allocated (RTX 4090)            │
│  ✓ Models Downloaded (BGE-M3, ALLaM)   │
│  ✓ Inference Server Ready              │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Try a Sample Query:                   │
│                                        │
│  Sample Document:                      │
│  ┌────────────────────────────────────┐│
│  │ [Sample government regulation      ││
│  │ text about e-commerce taxes...]     ││
│  │                                    ││
│  │ [Upload Your Own Document] [Clear] ││
│  └────────────────────────────────────┘│
│                                        │
│  Your Query (in Arabic):               │
│  ┌────────────────────────────────────┐│
│  │ ما هي اللوائح الحديثة المتعلقة    ││
│  │ بالضرائب على التجارة الإلكترونية؟ ││
│  │                                    ││
│  │ [Example Queries] [Use My Query]    ││
│  └────────────────────────────────────┘│
│                                        │
│  [Run Query] [Try Different Doc]       │
│                                        │
│  Progress: ████████░ (8/8 — Almost)   │
│                                        │
└────────────────────────────────────────┘
```

**Component Details:**

| State | Display | Content |
|-------|---------|---------|
| **Provisioning** | Status spinner, progress bar | Show each step (GPU, download, load) with timestamps |
| **Ready** | Green checkmark, "Ready!" message | Show sample document upload + query input |
| **Sample Document** | Pre-loaded Arabic regulation excerpt | Can be replaced with user's own PDF/text |
| **Query Input** | Arabic text input, RTL-enabled | Placeholder: "Enter your question in Arabic..." |
| **Example Queries** | Link to common queries for this use case | "What are the new e-commerce tax regulations?" etc. |
| **Run Query Button** | Submit button | Disabled until query entered |

**Query Loading State:**
```
⏳ Analyzing document... (1-3 seconds)
   Embedding: [████░░░░░░] 40%
   Ranking: [██░░░░░░░░] 20%
   Generating: [████████░░] 80%
```

**Query Result Display:**
```
┌────────────────────────────────────────┐
│  ✓ Query Complete! (2.3 seconds)       │
│                                        │
│  Question:                             │
│  "ما هي اللوائح الحديثة..."            │
│                                        │
│  Answer:                               │
│  "التجارة الإلكترونية الحديثة تخضع    │
│   لضريبة القيمة المضافة بنسبة 15%...  │
│                                        │
│   اقرأ التفاصيل: [قرار وزير المالية   │
│   2026/03/15]"                         │
│                                        │
│  Cost This Query: 0.034 SAR             │
│  Remaining Balance: 499.97 SAR          │
│                                        │
│  [Try Another Query] [Continue to       │
│   Dashboard]                           │
│                                        │
└────────────────────────────────────────┘
```

**API Endpoint:**
```
GET /api/deployments/{deploymentId}/status
→ { status: "ready", readyAt: "2026-03-24T11:15:00Z" }

POST /api/inference
{
  "deploymentId": "dep_456",
  "document": "...[base64 pdf or text]...",
  "query": "ما هي اللوائح الحديثة..."
}
→ {
  answer: "التجارة الإلكترونية...",
  latency: 2300,
  costSAR: 0.034,
  sourceDocument: "قرار وزير المالية..."
}
```

---

### STEP 9: Success State & Onboarding Complete

**Page Title:** "Congrats! You're All Set"
**URL:** `/onboarding/success`
**Behavior:** Final celebration screen with next steps

**Visual Layout:**
```
┌────────────────────────────────────────┐
│                                        │
│           🎉 Success! 🎉               │
│                                        │
│  You're Ready to Use Arabic RAG        │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  What You Accomplished:                │
│  ✓ Created account                     │
│  ✓ Added payment method                │
│  ✓ Funded balance (500 SAR)            │
│  ✓ Deployed Arabic RAG model           │
│  ✓ Ran your first query                │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Your Current Balance:                 │
│  ╔════════════════════════════╗        │
│  ║ 499.97 SAR                 ║        │
│  ║ ≈ 14,705 remaining queries ║        │
│  ║ Monthly budget: 2,450 SAR  ║        │
│  ╚════════════════════════════╝        │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Next Steps:                           │
│  1. Customize your document upload     │
│  2. Set up bulk query automation       │
│  3. Join our Slack community           │
│  4. Check out advanced templates       │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Resources:                            │
│  [📚 Docs] [🚀 Roadmap] [💬 Support]   │
│                                        │
│  [Go to Dashboard] [Try Another Model] │
│                                        │
│  Progress: ████████████ (Complete!)    │
│                                        │
│  (Confetti animation in background)    │
│                                        │
└────────────────────────────────────────┘
```

**Component Details:**

| Element | Content | CTA |
|---------|---------|-----|
| **Celebration** | Animated confetti, "Success!" message | Visual delight, builds user confidence |
| **Accomplishments** | Checklist of completed steps | Shows journey progression |
| **Balance Summary** | Current balance, remaining queries, monthly budget | Quick reference for user |
| **Next Steps** | 4 suggested actions (customize, automation, community, advanced) | Guidance on what to do next |
| **Resource Links** | Docs, Roadmap, Support Slack | Easy access to help |
| **Primary CTA** | "Go to Dashboard" (blue button) | Takes to `/dashboard` |
| **Secondary CTA** | "Try Another Model" (outline button) | Takes to `/templates` |

**Email Sent to User:**
```
Subject: Welcome to DCP Arabic RAG! 🎉

Hi Ahmed,

Congrats on completing your first deployment!

Your Arabic RAG model is now live and ready to process documents.
You have 499.97 SAR of credit remaining (≈14,705 queries).

Quick start:
1. Upload your first document: [LINK]
2. Browse other models: [LINK]
3. Read the docs: [LINK]
4. Join Slack community: [LINK]

Questions? Reply to this email or visit support.dcp.sa

— The DCP Team
```

---

## Empty States & Error Handling

### Empty State: No Balance
**When:** User reaches Step 6 (Browse Models) without funding
**Display:**
```
😢 Oops, No Balance

To deploy a model, you need to add credit.

[Go Back and Fund Account] [Add Credit Now]
```

### Error State: Deployment Failed
**When:** GPU allocation fails, model download fails, etc.
**Display:**
```
❌ Deployment Failed

Something went wrong while setting up your model.

Error: "No H100 GPUs available (RTX 4090 only)"

Options:
[Retry] [Try Smaller Model] [Contact Support]
```

### Error State: Insufficient Balance
**When:** User tries to deploy but balance < monthly cost
**Display:**
```
⚠️  Insufficient Balance

Your balance (500 SAR) is below the monthly cost (2,450 SAR).
You'll need to add credit to deploy this model.

Your options:
[Add Credit] [Choose Smaller Model] [Skip for Later]
```

---

## Progress Indicators & Completion Tracking

**Visual Progress Bar:**
```
Step 1 (Sign Up)       ████████████░░░░░░░░░░░░░░░░░░ 13%
Step 2 (Email Verify)  ██████████████████░░░░░░░░░░░░ 25%
Step 3 (Profile)       ██████████████████████░░░░░░░░ 38%
Step 4 (Wallet)        ████████████████████████░░░░░░ 50%
Step 5 (Topup)         ██████████████████████████░░░░ 63%
Step 6 (Browse)        ████████████████████████████░░ 75%
Step 7 (Deploy)        ██████████████████████████████ 88%
Step 8 (First Query)   ████████████████████████████████ 100%
```

**Metrics Tracked:**
- Time spent on each step
- Abandonment rate per step (identify friction)
- Completion rate (% reaching Step 9)
- Total onboarding duration
- Cost for first deployment

---

## Mobile Responsiveness

**Mobile Breakpoint (375px):**
- Form inputs: full width (90vw)
- Cards/buttons: stack vertically
- Progress bar: horizontal scroll or hide step names
- Model cards: 1-column layout
- Pricing box: simplified, key costs only

**Tablet Breakpoint (768px):**
- 2-column layout for cards
- Larger touch targets (48x48px minimum)
- Full-width inputs

---

## Accessibility & Performance

### Accessibility Checklist
- [ ] Form labels associated with inputs (id/for)
- [ ] Error messages linked to form fields (aria-invalid, aria-describedby)
- [ ] Keyboard navigation: tab through all inputs, buttons, links
- [ ] Screen reader support: alt text for icons, semantic HTML (button, input, form)
- [ ] Color contrast: text vs background meets WCAG AA (4.5:1 minimum)
- [ ] Arabic RTL: content flows right-to-left, direction: rtl applied

### Performance Targets
- [ ] First Contentful Paint: <1.5s
- [ ] Largest Contentful Paint: <3s
- [ ] Cumulative Layout Shift: <0.1
- [ ] Page load time: <3s on 4G

---

## Branch & PR Checklist

- [ ] Create feature branch: `ui-ux/sprint28-arabic-rag-landing`
- [ ] Commit spec to branch (this document)
- [ ] Create PR for code review
- [ ] Tag Frontend Developer for implementation
- [ ] Validate Arabic RTL rendering on all steps
- [ ] Test all error states and empty states

---

## Next Steps for Frontend Developer

1. **Figma Design:** Create high-fidelity mockups for all 9 steps
   - Desktop (1920px), Tablet (768px), Mobile (375px)
   - RTL variant for each step
   - Interactive states: focus, hover, disabled, loading

2. **Implementation:** Build React components
   - Form validation with error display
   - Multi-step flow with progress tracking
   - Payment method integration (Stripe, ACH)
   - Deployment status polling
   - Inference result display

3. **Backend Integration:**
   - `/api/auth/signup` — user creation
   - `/api/wallet/add-payment-method` — payment setup
   - `/api/wallet/topup` — fund account
   - `/api/templates` — model catalog
   - `/api/deployments` — create deployment, check status
   - `/api/inference` — run query

4. **QA Testing:**
   - All form validations work
   - Progress bar updates correctly
   - Deployment status polling works
   - First inference completes successfully
   - Mobile layout responsive
   - Arabic RTL working on all steps
   - Error states display correctly

---

## Design System References

Use the same color palette and typography as the landing page spec:

- **Colors:** Primary Blue (#0066cc), Dark Blue (#003d7a), Accent Green (#27ae60), Charcoal (#333), Light Gray (#f5f5f5)
- **Typography:** "Inter" or "Open Sans" for headings/body
- **Spacing:** 8px base unit
- **Shadows:** Subtle (2px 4px 8px) on cards, moderate (0 10px 25px) on modals

---

## Success Metrics

**Target KPIs:**
- **Signup-to-Deployment Rate:** 60%+ complete onboarding within 24 hours
- **Average Onboarding Time:** <15 minutes (when user has topup ready)
- **Step Abandonment:** <10% per step (identify friction points)
- **First-Week Retention:** 70%+ renters who deploy, return within 7 days
- **NPS Score:** Target 50+ (strong product adoption indicator)

