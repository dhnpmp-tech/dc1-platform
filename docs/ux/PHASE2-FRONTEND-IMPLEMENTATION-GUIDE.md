# Phase 2 Frontend Implementation Guide

**Status:** Implementation-ready specification for Frontend Developer
**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Target Sprint:** Sprint 28 (parallel implementation of Phase 2.0 + Phase 2.2)
**Effort:** 30 hours total (15 hrs each feature)

---

## Executive Summary

This guide provides everything the Frontend Developer needs to implement Phase 2.0 (Quick-Redeploy) and Phase 2.2 (Arabic Personalization) simultaneously. Both features are critical for Phase 2 launch.

- **Phase 2.0 Impact:** +25-30% repeat job rate (renter retention)
- **Phase 2.2 Impact:** +40% Arab market acquisition
- **Combined Impact:** Major revenue drivers for growth phase

---

## Part 1: Phase 2.0 — Quick-Redeploy Feature

### Overview
Enable renters to quickly redeploy previous jobs with minimal friction. One-click access to job history + instant redeploy with pre-filled parameters.

### User Flow

```
[Renter Dashboard] → [Job History Tab] → [Click Redeploy] → [Modal Opens]
                                                                    ↓
                                            [Confirm Deployment Modal]
                                            - Job name + params summary
                                            - GPU/region selection
                                            - Cost estimate
                                                    ↓
                                            [Deploy Button] → Loading
                                                    ↓
                                            [Success/Error State]
```

### Components to Build

#### 1. Job History List Component
**Location:** `/app/components/dashboard/JobHistoryList.tsx`
**Purpose:** Display past 20 jobs with quick-redeploy action

```tsx
interface JobHistoryItem {
  id: string
  name: string
  template: string  // e.g., "vllm-serve"
  model: string     // e.g., "mistral-7b"
  gpuType: string   // e.g., "RTX 4090"
  region: string
  status: 'completed' | 'failed' | 'cancelled'
  createdAt: Date
  duration: number  // minutes
  cost: number      // USD
}

interface JobHistoryListProps {
  jobs: JobHistoryItem[]
  onRedeploy: (jobId: string) => void
  isLoading?: boolean
}
```

**Features:**
- Display jobs in reverse chronological order (newest first)
- Filter by status (all/completed/failed/cancelled)
- Sort by: Date, Template, Duration, Cost
- Mobile: Stacked cards, swipe for actions
- Desktop: Table view with action buttons

**Design Considerations:**
- Show job thumbnail/icon (template visual)
- Display cost and duration prominently
- Quick actions: Redeploy, View Details, Delete
- Hover state: Show full params, cost breakdown
- Empty state: "No jobs yet" with link to templates

#### 2. Quick-Redeploy Modal
**Location:** `/app/components/dashboard/QuickRedeployModal.tsx`
**Purpose:** 3-step flow: Review → Configure → Confirm

**Step 1: Review Job Details**
```tsx
interface ReviewJobStep {
  jobId: string
  jobName: string
  template: string
  model: string
  params: Record<string, unknown>  // Custom params from original job
  originalGpuType: string
  originalRegion: string
  originalDuration: number
  originalCost: number
}
```

Display:
- Original job summary (name, template, model, params)
- Execution history (duration, cost, status)
- "Next" button to configure GPU/region

**Step 2: Configure GPU & Region**
```tsx
interface ConfigureStep {
  selectedGpuType: string  // Allow change from original
  selectedRegion: string   // Allow change from original
  estimatedCost?: number   // Fetch from API
  estimatedDuration?: number
}
```

Display:
- GPU type dropdown (available options)
- Region dropdown (availability map)
- Cost estimate (call `/api/models/{id}/deploy/estimate`)
- Warning if unavailable: "GPU not available in selected region"
- "Calculate Estimate" button

**Step 3: Confirm & Deploy**
```tsx
interface ConfirmStep {
  readyToDeploy: boolean
  estimatedCost: number
  hasInsufficientBalance?: boolean
  deploymentInProgress?: boolean
}
```

Display:
- Final cost summary
- GPU/Region confirmation
- "Deploy Job" button (disabled if insufficient balance)
- Progress indicator during deployment
- Success message with job ID + details
- Error handling (see Error States section)

### Error Handling (6 Scenarios)

1. **GPU Unavailable**
   - Show: "This GPU is not available in {region}"
   - Action: Suggest alternative GPUs or regions
   - Button: "View Alternatives"

2. **Insufficient Balance**
   - Show: "Insufficient balance. Need ${amount}, have ${balance}"
   - Action: Link to add funds
   - Button: "Add Funds" (external link)

3. **Region Unavailable**
   - Show: "This region is currently offline"
   - Action: Show available regions
   - Button: "Select Different Region"

4. **Model Not Available**
   - Show: "Model is no longer available"
   - Action: Suggest similar models
   - Button: "Browse Models"

5. **Network Error**
   - Show: "Failed to estimate cost. Please try again."
   - Action: Retry button
   - Button: "Retry Estimate"

6. **Deployment Failed**
   - Show: "Deployment failed: {error message}"
   - Action: Show deployment logs if available
   - Buttons: "Retry Deployment" | "Contact Support"

### State Management

Use React Context or Zustand:

```tsx
interface QuickRedeployState {
  step: 1 | 2 | 3  // Review | Configure | Confirm
  selectedJobId: string | null
  selectedGpuType: string
  selectedRegion: string
  estimatedCost: number | null
  estimatedDuration: number | null
  isLoading: boolean
  error: string | null
  deploymentStatus: 'idle' | 'in_progress' | 'success' | 'error'
}

// Actions:
// - selectJob(jobId)
// - updateGpu(gpuType)
// - updateRegion(region)
// - calculateEstimate()
// - deployJob()
// - clearModal()
```

### API Integration

**Endpoints Used:**
1. `GET /api/jobs?limit=20` — Fetch job history
2. `GET /api/jobs/{jobId}` — Fetch job details
3. `GET /api/models/{id}/deploy/estimate` — Cost estimate
4. `POST /api/jobs/{jobId}/redeploy` — Deploy job

**Request/Response Examples:**

```bash
# Get job history
GET /api/jobs?limit=20
Response: {
  jobs: [
    {
      id: "job-123",
      name: "Arabic RAG Pipeline",
      template: "vllm-serve",
      model: "mistral-7b",
      gpuType: "RTX 4090",
      region: "saudi",
      status: "completed",
      createdAt: "2026-03-24T10:00:00Z",
      duration: 45,
      cost: 2.50
    }
  ],
  total: 15
}

# Get cost estimate
GET /api/models/mistral-7b/deploy/estimate?gpuType=RTX%204090&region=saudi
Response: {
  modelId: "mistral-7b",
  gpuType: "RTX 4090",
  region: "saudi",
  costPerHour: 0.267,
  estimatedDuration: 45,
  estimatedCost: 2.50
}

# Redeploy job
POST /api/jobs/job-123/redeploy
Body: {
  gpuType: "RTX 4090",
  region: "saudi",
  notify: true
}
Response: {
  jobId: "job-456",
  status: "queued",
  estimatedStartTime: "2026-03-24T10:15:00Z"
}
```

### Mobile Responsiveness

**Desktop (>768px):**
- Job History: Table view with inline actions
- Modal: Centered, 600px width, side-by-side layout
- Estimate displayed in real-time

**Tablet (768px-1024px):**
- Job History: Hybrid (cards + actions)
- Modal: Full-width minus margins, stacked layout
- Touch-optimized buttons (48px height)

**Mobile (<768px):**
- Job History: Full-width cards, swipe gestures for actions
- Modal: Bottom sheet or full-screen, 100vh height
- Large touch targets (56px buttons)
- Vertical layout: Review → Configure → Confirm

### Analytics

Track these metrics:

```tsx
// When user opens Job History
analytics.track('quick_redeploy.job_history_opened', {
  jobCount: 15,
  mostRecentTemplate: 'vllm-serve'
})

// When user starts redeploy flow
analytics.track('quick_redeploy.flow_started', {
  jobId: 'job-123',
  originalTemplate: 'vllm-serve',
  originalGpu: 'RTX 4090'
})

// When user changes GPU/Region
analytics.track('quick_redeploy.config_changed', {
  gpuTypeChanged: true,
  oldGpu: 'RTX 4090',
  newGpu: 'RTX 3090',
  regionChanged: false
})

// When user deploys
analytics.track('quick_redeploy.deployment_initiated', {
  jobId: 'job-456',
  estimatedCost: 2.50,
  gpuType: 'RTX 4090'
})

// On success
analytics.track('quick_redeploy.deployment_success', {
  newJobId: 'job-456',
  timeToFirstUpdate: 5  // seconds
})

// On error
analytics.track('quick_redeploy.deployment_error', {
  errorType: 'insufficient_balance',
  estimatedCost: 2.50,
  userBalance: 1.50
})
```

---

## Part 2: Phase 2.2 — Arabic Personalization Feature

### Overview
Enable Arabic-speaking renters to use the platform in Arabic with localized models and pricing. Language toggle + Arabic UI + Featured Arabic Models.

### User Journey

```
[User Lands on DCP]
         ↓
[Language Detection (Location)]
- Saudi Arabia / UAE / Egypt → Default to العربية
- Others → Default to English
         ↓
[Header Toggle: English ↔ عربي]
         ↓
[If Arabic Selected]
- All UI strings → Modern Standard Arabic (MSA)
- Featured Arabic Models carousel
- SAR pricing option
- RTL layout enabled
         ↓
[Browse Models → Deploy]
- All Arabic models visible + highlighted
- Pricing in SAR
- "Arabic-Safe" badge on compliant models
```

### Components to Build

#### 1. Language Preference Onboarding
**Location:** `/app/components/onboarding/LanguagePreferenceModal.tsx`
**Trigger:** First visit + no language preference saved

```tsx
interface LanguagePreferenceProps {
  detectedCountry?: string  // From geolocation
  onComplete: (language: 'en' | 'ar') => void
}

interface LanguagePref {
  language: 'en' | 'ar'
  region: 'sa' | 'ae' | 'eg' | 'global'
  currency: 'USD' | 'SAR' | 'AED' | 'EGP'
  savedAt: Date
}
```

**Features:**
- Geolocation detection (optional)
- Clear Arabic/English options
- Currency selector (SAR if Arabic)
- "Remember my preference" checkbox
- Save to localStorage + user profile

**Design:**
- Clean, minimal: 2 large buttons
- Flag icons (🇸🇦 | 🇺🇸) for visual clarity
- Arabic text in display: "اختر اللغة"
- Default to detected country's language

#### 2. Header Language Toggle
**Location:** `/app/components/layout/Header.tsx` (modify existing)

```tsx
interface LanguageToggleProps {
  currentLanguage: 'en' | 'ar'
  onLanguageChange: (language: 'en' | 'ar') => void
}
```

**Implementation:**
- Location: Top-right corner of header (after user menu)
- Visual: Toggle button or dropdown
- Desktop: "English | عربي" clickable text
- Mobile: Globe icon + dropdown
- On change: Update localStorage, reload page with new language

**Persistence:**
```tsx
// Save to localStorage
localStorage.setItem('language', 'ar')
localStorage.setItem('currency', 'SAR')

// Load on app boot
const savedLanguage = localStorage.getItem('language') || 'en'
```

#### 3. Featured Arabic Models Carousel
**Location:** `/app/components/marketplace/FeaturedArabicModels.tsx`
**Trigger:** Visible when language is set to Arabic

```tsx
interface ArabicModel {
  id: string
  name: string  // ALLaM 7B, Falcon H1 7B, etc.
  description: string  // MSA description
  language: 'ar'
  vram: number
  costPerHour: number  // USD
  costPerHourSAR: number
  useCase: string  // 'nlp' | 'embedding' | 'vision' | etc.
  arabicCapability: 'native' | 'fine-tuned' | 'compatible'
}

interface FeaturedArabicModelsProps {
  models: ArabicModel[]
  onSelectModel: (modelId: string) => void
  language: 'en' | 'ar'
}
```

**Tier A Models (Pre-warmed):**
- ALLaM 7B (512 MB VRAM, $0.18/hr)
- Falcon H1 7B (512 MB VRAM, $0.19/hr)
- Qwen 2.5 7B (512 MB VRAM, $0.17/hr)
- Llama 3 8B (768 MB VRAM, $0.21/hr)
- Mistral 7B (512 MB VRAM, $0.15/hr)
- Nemotron Nano 4B (256 MB VRAM, $0.12/hr)

**Carousel Design:**
- 6 model cards in horizontal scroll (mobile) / grid (desktop)
- Card content:
  - Model icon/thumbnail
  - Name (Arabic + English)
  - Arabic capability badge
  - VRAM requirement
  - Cost (USD + SAR toggle)
  - "Deploy Now" button
  - Stars/rating if available

**Arabic Text Examples:**
```
Card 1:
العنوان: أليما 7 بت
الوصف: نموذج لغة عربية متقدم للمهام النصية
الإمكانيات: معالجة النصوص • الترجمة • الإجابة على الأسئلة
السعر: $0.18/ساعة | ر.س 0.68/ساعة
```

#### 4. Model Filtering & Display (Arabic-aware)
**Location:** Modify `/app/components/marketplace/ModelCatalog.tsx`

```tsx
interface ModelFilterOptions {
  language?: 'ar' | 'en' | 'all'  // Filter by Arabic capability
  vramMin?: number
  vramMax?: number
  region?: string
  useCase?: string
}

interface EnhancedModel {
  // ... existing fields
  arabicCapability: 'native' | 'fine-tuned' | 'compatible' | 'not_available'
  arabicName?: string  // اللاما 3
  arabicUseCase?: string
  arabicBadge?: boolean  // Show special "Arabic-Ready" badge
}
```

**Filter Panel Changes:**
- Add "Arabic Capability" filter
  - Options: "Native" | "Fine-tuned" | "Compatible"
  - Visual: Toggle or checkboxes
- Add language selector in model display
- Show both English and Arabic descriptions

**Model Card Changes (Arabic layout):**
```tsx
// If language === 'ar'
<div dir="rtl">
  <h3>{arabicName}</h3>  // Right-aligned
  <p>{arabicDescription}</p>
  <Badge>{arabicCapability}</Badge>
  <Price currency="SAR">{costSAR}</Price>
  <Button>نشر الآن</Button>  // "Deploy Now" in Arabic
</div>
```

#### 5. Settings Page - Language & Currency
**Location:** `/app/components/settings/LanguageAndRegion.tsx`
**Purpose:** Allow users to change language + currency preferences

```tsx
interface LanguageAndRegionSettings {
  language: 'en' | 'ar'
  currency: 'USD' | 'SAR' | 'AED' | 'EGP'
  region: 'sa' | 'ae' | 'eg' | 'global'
  autoDetectLocation: boolean
}
```

**Options:**
- Language: Dropdown (English | العربية)
- Currency: Dropdown (USD | SAR | AED | EGP)
- Auto-detect location: Toggle
- Save button
- Reset to defaults link

### RTL (Right-to-Left) Layout

**CSS Implementation:**
```css
/* When language === 'ar' */
html[lang="ar"] {
  direction: rtl;
  text-align: right;
}

html[lang="ar"] .header {
  padding-right: 24px;
  padding-left: 0;
  flex-direction: row-reverse;  /* Reverse button order */
}

html[lang="ar"] .sidebar {
  right: 0;
  left: auto;
  border-right: none;
  border-left: 1px solid #eee;
}

html[lang="ar"] .modal {
  text-align: right;
  margin-right: auto;
  margin-left: auto;
}

/* Margin/padding flip */
html[lang="ar"] .ml-4 {
  margin-left: 0;
  margin-right: 1rem;
}

html[lang="ar"] .pr-8 {
  padding-right: 0;
  padding-left: 2rem;
}
```

**Tailwind Approach:**
- Use Tailwind's RTL support: `dir="rtl"` on root element
- Classes like `mr-4` (margin-right) automatically flip in RTL context
- Test with Firefox's RTL testing tools

### Localization Strategy

**Translation Scope:** 50+ UI strings

**Examples:**
```
English → Arabic (Modern Standard Arabic)
"Deploy" → "نشر"
"Model Catalog" → "كتالوج النماذج"
"Arabic-Ready" → "جاهز للعربية"
"Featured Models" → "النماذج المميزة"
"GPU Type" → "نوع معالج الرسومات"
"Estimated Cost" → "التكلفة المتوقعة"
"Insufficient Balance" → "رصيد غير كافي"
"Region Unavailable" → "المنطقة غير متاحة"
"Deploy Now" → "نشر الآن"
"Cancel" → "إلغاء"
"Back" → "رجوع"
"Next" → "التالي"
```

**Implementation:**
1. Use i18n library (`next-i18n-router`, `i18next`)
2. Store translations in JSON:
   - `/public/locales/en/common.json`
   - `/public/locales/ar/common.json`
3. Load language on app boot from localStorage
4. Use hook: `const t = useTranslation()`

### State Management

```tsx
interface ArabicPersonalizationState {
  language: 'en' | 'ar'
  currency: 'USD' | 'SAR' | 'AED' | 'EGP'
  region: 'sa' | 'ae' | 'eg' | 'global'
  featuredArabicModelsVisible: boolean
  arabicFiltersEnabled: boolean
}

// Global Context or Zustand store
// Persist to localStorage + user profile
```

### API Integration

**Endpoints:**
1. `GET /api/models?language=ar` — Fetch Arabic-capable models
2. `GET /api/models?arabicCapability=native` — Filter by Arabic capability
3. `GET /api/pricing?currency=SAR` — Get SAR pricing
4. `POST /api/users/preferences` — Save language preference

**Example Request:**
```bash
GET /api/models?language=ar&limit=50
Response: {
  models: [
    {
      id: "allam-7b",
      name: "ALLaM 7B",
      arabicName: "أليما 7 بت",
      arabicCapability: "native",
      costPerHour: 0.18,
      costPerHourSAR: 0.68,
      ...
    }
  ]
}
```

### Analytics

Track Arabic user behavior:

```tsx
// When user selects Arabic
analytics.track('arabic_personalization.language_selected', {
  language: 'ar',
  detectedCountry: 'SA'
})

// When user views Featured Arabic Models
analytics.track('arabic_personalization.featured_models_viewed', {
  modelCount: 6,
  language: 'ar'
})

// When user deploys Arabic model
analytics.track('arabic_personalization.model_deployed', {
  modelId: 'allam-7b',
  language: 'ar',
  costSAR: 0.68
})

// When user changes currency
analytics.track('arabic_personalization.currency_changed', {
  oldCurrency: 'USD',
  newCurrency: 'SAR'
})

// Weekly Arab user cohort metrics
analytics.track('arab_users.weekly_metrics', {
  arabicUsersCount: 250,
  arabicMRR: 2500,  // SAR
  mostPopularModel: 'mistral-7b'
})
```

---

## Part 3: Technical Implementation Details

### Technology Stack

**Frontend:**
- Framework: Next.js 14+ (React 18+)
- Language: TypeScript 5+
- Styling: Tailwind CSS + custom CSS (RTL support)
- State Management: React Context API or Zustand
- HTTP Client: `fetch` or `axios`
- Localization: `next-i18n-router` or `i18next`
- Analytics: Segment or custom tracking

**Key Libraries:**
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "zustand": "^4.4.0",
    "next-i18n-router": "^4.2.0"
  }
}
```

### Component Structure

```
app/
├── components/
│   ├── dashboard/
│   │   ├── JobHistoryList.tsx
│   │   ├── QuickRedeployModal.tsx
│   │   └── QuickRedeployModal.module.css
│   ├── marketplace/
│   │   ├── FeaturedArabicModels.tsx
│   │   ├── ModelCatalog.tsx (modified)
│   │   └── ArabicModelCard.tsx
│   ├── onboarding/
│   │   └── LanguagePreferenceModal.tsx
│   ├── settings/
│   │   └── LanguageAndRegion.tsx
│   └── layout/
│       └── Header.tsx (modified)
├── hooks/
│   ├── useQuickRedeploy.ts
│   ├── useLanguagePreference.ts
│   └── useJobHistory.ts
├── lib/
│   ├── api.ts
│   ├── constants.ts
│   └── translations.ts
├── context/
│   ├── LanguageContext.tsx
│   └── QuickRedeployContext.tsx
└── styles/
    ├── rtl.css
    └── theme.css
```

### API Layer

**File:** `/app/lib/api.ts`

```typescript
export const api = {
  // Job History
  getJobHistory: async (limit = 20) => {
    return fetch(`/api/jobs?limit=${limit}`).then(r => r.json())
  },
  getJobById: async (jobId: string) => {
    return fetch(`/api/jobs/${jobId}`).then(r => r.json())
  },

  // Cost Estimation
  estimateDeploymentCost: async (modelId: string, gpuType: string, region: string) => {
    return fetch(`/api/models/${modelId}/deploy/estimate?gpuType=${gpuType}&region=${region}`)
      .then(r => r.json())
  },

  // Deployment
  redeployJob: async (jobId: string, config: { gpuType: string, region: string }) => {
    return fetch(`/api/jobs/${jobId}/redeploy`, {
      method: 'POST',
      body: JSON.stringify(config)
    }).then(r => r.json())
  },

  // Models
  getArabicModels: async () => {
    return fetch('/api/models?language=ar').then(r => r.json())
  },

  // User Preferences
  saveLanguagePreference: async (pref: LanguagePref) => {
    return fetch('/api/users/preferences', {
      method: 'POST',
      body: JSON.stringify(pref)
    }).then(r => r.json())
  }
}
```

### Custom Hooks

**File:** `/app/hooks/useQuickRedeploy.ts`

```typescript
export const useQuickRedeploy = () => {
  const [jobs, setJobs] = useState<JobHistoryItem[]>([])
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobHistory = async () => {
    setIsLoading(true)
    try {
      const data = await api.getJobHistory()
      setJobs(data.jobs)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const redeploy = async (jobId: string, config: any) => {
    setIsLoading(true)
    try {
      const result = await api.redeployJob(jobId, config)
      return result
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setIsLoading(false)
    }
  }

  return { jobs, selectedJob, isLoading, error, fetchJobHistory, redeploy }
}
```

### Styling Approach

**CSS Modules for Phase 2.0:**

```css
/* QuickRedeployModal.module.css */
.modal {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 600px;
  max-width: 90vw;
}

.header {
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.body {
  padding: 24px;
  max-height: 60vh;
  overflow-y: auto;
}

.footer {
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.button {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.buttonPrimary {
  background: #2563eb;
  color: white;
}

.buttonPrimary:hover {
  background: #1d4ed8;
}

.buttonSecondary {
  background: #f3f4f6;
  color: #374151;
}

.buttonSecondary:hover {
  background: #e5e7eb;
}

.errorState {
  border-left: 4px solid #dc2626;
  padding: 12px;
  background: #fee2e2;
  border-radius: 4px;
  color: #991b1b;
}

/* Mobile */
@media (max-width: 768px) {
  .modal {
    width: 100%;
    border-radius: 0;
  }

  .footer {
    flex-direction: column;
    justify-content: stretch;
  }

  .button {
    flex: 1;
  }
}
```

**Tailwind for Phase 2.2 (RTL):**

Use Tailwind's built-in RTL support with `dir="rtl"` on HTML element.

---

## Part 4: Testing Strategy

### Unit Tests (Phase 2.0)

```typescript
// JobHistoryList.test.tsx
describe('JobHistoryList', () => {
  it('renders job list correctly', () => {
    const jobs = [
      { id: '1', name: 'Test Job', template: 'vllm-serve', ... }
    ]
    const { getByText } = render(<JobHistoryList jobs={jobs} />)
    expect(getByText('Test Job')).toBeInTheDocument()
  })

  it('calls onRedeploy when Redeploy button clicked', () => {
    const onRedeploy = jest.fn()
    const { getByRole } = render(
      <JobHistoryList jobs={jobs} onRedeploy={onRedeploy} />
    )
    fireEvent.click(getByRole('button', { name: /redeploy/i }))
    expect(onRedeploy).toHaveBeenCalled()
  })
})
```

### E2E Tests (Phase 2.0 + 2.2)

```typescript
// redeploy.e2e.test.ts
describe('Quick Redeploy E2E', () => {
  it('user can redeploy a previous job', async () => {
    await page.goto('/dashboard')

    // Click on first job's redeploy button
    await page.click('[data-testid="job-redeploy-0"]')

    // Modal opens
    expect(await page.$('[role="dialog"]')).toBeTruthy()

    // Change GPU type
    await page.select('[name="gpuType"]', 'RTX 3090')

    // Cost estimate updates
    await page.waitForSelector('[data-testid="estimated-cost"]')
    const cost = await page.$eval('[data-testid="estimated-cost"]', el => el.textContent)
    expect(cost).toContain('$')

    // Deploy
    await page.click('[data-testid="deploy-button"]')

    // Success message
    expect(await page.$('[data-testid="success-message"]')).toBeTruthy()
  })
})

describe('Arabic Personalization E2E', () => {
  it('user can switch to Arabic and deploy Arabic model', async () => {
    await page.goto('/')

    // Switch language to Arabic
    await page.click('[data-testid="language-toggle"]')
    await page.click('[data-testid="language-ar"]')

    // Page content in Arabic
    const heading = await page.$eval('h1', el => el.textContent)
    expect(heading).toContain('كتالوج')  // "Catalog" in Arabic

    // Featured Arabic Models visible
    expect(await page.$('[data-testid="featured-arabic-models"]')).toBeTruthy()

    // Click on ALLaM model
    await page.click('[data-testid="model-allam-7b"]')

    // Deploy
    await page.click('[data-testid="deploy-button"]')

    // Verify deployment
    expect(await page.$('[data-testid="success-message"]')).toBeTruthy()
  })
})
```

### Accessibility Tests

```typescript
// a11y.test.ts
describe('Phase 2 Accessibility', () => {
  it('Quick-Redeploy modal has proper ARIA labels', () => {
    const { container } = render(<QuickRedeployModal />)
    const modal = container.querySelector('[role="dialog"]')
    expect(modal).toHaveAttribute('aria-labelledby')
  })

  it('Arabic language toggle is accessible', () => {
    const { getByRole } = render(<Header />)
    const toggle = getByRole('button', { name: /عربي/i })
    expect(toggle).not.toBeDisabled()
  })

  it('Color contrast meets WCAG AA', () => {
    // Use axe-core or similar
    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})
```

---

## Part 5: Deployment & Launch Checklist

### Pre-Launch (Sprint 28)

- [ ] Phase 2.0 code review approved
- [ ] Phase 2.2 code review approved
- [ ] All unit tests passing (>80% coverage)
- [ ] E2E tests passing on staging
- [ ] Mobile responsiveness tested (iOS + Android)
- [ ] RTL layout tested (Arabic text rendering, icon alignment)
- [ ] API endpoints verified (/api/jobs, /api/models/{id}/deploy/estimate)
- [ ] Cost estimation accuracy validated
- [ ] Analytics events firing correctly
- [ ] Error messages user-tested
- [ ] Performance: Modal opens < 500ms
- [ ] Performance: Cost estimate API response < 2s
- [ ] Accessibility audit passed (WCAG 2.1 AA)

### Launch Day

- [ ] Feature flags enabled for both Phase 2.0 + 2.2
- [ ] Monitor error rates (dashboard)
- [ ] Monitor API latency (cost estimation)
- [ ] Monitor feature adoption (analytics)
- [ ] Customer support on standby

### Post-Launch (Week 1)

- [ ] Analyze adoption metrics
- [ ] Collect user feedback (feedback form + surveys)
- [ ] Measure impact:
  - Quick-Redeploy: +25-30% repeat job rate
  - Arabic Personalization: +40% Arab market acquisition
- [ ] Identify improvements for Phase 2.1
- [ ] Plan localization expansion (French, Spanish, etc.)

---

## Part 6: Success Metrics

### Phase 2.0 (Quick-Redeploy)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Repeat Job Rate | +25-30% | Jobs redeployed / Total jobs |
| Feature Adoption | >40% of active renters | Users who used redeploy / Active users |
| Modal Conversion | >70% | Deployments / Modal opens |
| Error Rate | <5% | Failed deployments / Attempted deployments |
| Average Time to Deploy | <2 minutes | Clock time from modal open to deployment success |

### Phase 2.2 (Arabic Personalization)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Arab Market Acquisition | +40% | New Arabic-speaking users (week post-launch vs. baseline) |
| Arabic User Retention | >60% | 30-day retention of Arabic-language users |
| Featured Model Clicks | >50% | Clicks on Featured Arabic Models carousel |
| Language Toggle Usage | >80% | Users who toggle to/from Arabic |
| Model Deployment (Arabic) | >300/month | Arabic model deployments in Month 1 |
| Arab User MRR | $1,200+ | Monthly revenue from Arabic-speaking users |

---

## Questions & Next Steps

**For Frontend Developer:**
1. Can you confirm Node.js version and Next.js version?
2. Do you have preference for Zustand vs. Context API?
3. What's your preferred i18n library?
4. Should we use CSS Modules or Tailwind for styling?
5. Do you have existing API client setup?

**For Backend Engineer:**
1. Can you confirm `/api/jobs` endpoint returns required fields?
2. Can you estimate `/api/models/{id}/deploy/estimate` latency?
3. Do you have `/api/users/preferences` endpoint for language prefs?
4. What's the production deployment timeline?

**For QA:**
1. Can you write E2E tests once code review passes?
2. Can you test Arabic text rendering on various browsers?
3. Can you validate RTL layout on iOS Safari?

---

**Status:** ✅ Implementation-ready
**Prepared:** 2026-03-24
**Effort:** 30 hours total (15 hrs Phase 2.0 + 15 hrs Phase 2.2)
**Timeline:** Both features can launch simultaneously in Sprint 28
