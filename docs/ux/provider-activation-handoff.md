# Provider Activation Implementation Handoff

**Issue:** DCP-791
**For:** Frontend Developer (Sprint 28)
**Date:** 2026-03-24
**Status:** Implementation Ready

---

## Overview

This document bridges the DCP-679 UX spec (3-screen provider activation flow) to implementation. It contains exact component props, API integrations, error handling, and animation specs.

---

## 1. Component Architecture

### 1.1 Three-Screen Flow Structure

```
ProviderActivationFlow (Container)
├── Screen 1: Dashboard State
│   ├── ProviderStatusCard
│   └── ActivationCTA (button → advance to wizard)
├── Screen 2: Activation Wizard (3 steps)
│   ├── ProviderWizardContainer
│   ├── Step 1: OS Selection
│   │   ├── OsSelector (radio group)
│   │   └── OsDescription
│   ├── Step 2: API Key Setup
│   │   ├── ProviderKeyInput (textarea)
│   │   ├── KeyValidationStatus
│   │   └── CopyButton
│   └── Step 3: Connection Test
│       ├── ConnectionTestButton
│       ├── TestStatus
│       └── SuccessMessage
└── Screen 3: Connected State
    ├── ProviderConnectedCard
    ├── MetricsDisplay
    └── NextStepsLinks
```

---

## 2. Component Props & State

### 2.1 ProviderActivationFlow (Root Container)

```typescript
interface ProviderActivationFlowProps {
  providerId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ActivationFlowState {
  currentScreen: 'dashboard' | 'wizard' | 'connected';
  wizardStep: 1 | 2 | 3;
  selectedOs: 'linux' | 'macos' | 'windows' | null;
  apiKey: string;
  apiKeyValid: boolean;
  connectionTestStatus: 'idle' | 'testing' | 'success' | 'error';
  connectionTestError?: string;
  showOfflineWarning: boolean;
}
```

**State Transitions:**
- `dashboard` → click "Start" → `wizard` (step 1)
- `wizard` step 1 → select OS → step 2
- `wizard` step 2 → paste key + validate → step 3
- `wizard` step 3 → test connection → success → `connected`
- Any step → click "Cancel" → back to `dashboard`

### 2.2 Screen 1: Dashboard State

**Component:** `ProviderDashboard`

```typescript
interface ProviderDashboardProps {
  providerId: string;
  providerName: string;
  registeredAt: Date;
  status: 'offline' | 'online';
  gpuCount: number;
  onStartActivation: () => void;
  onLearnMore: () => void;
}

interface ProviderDashboardState {
  // Stateless presentation component
}
```

**Render:**
- Status badge: 🔴 Offline / 🟢 Online (conditional)
- Provider name
- GPU count (from API)
- "Start Activation" button (primary, 48px height)
- "How it works" section (collapsible)

**Styling:**
- Container: 640px max-width, centered
- Padding: 24px (mobile) / 40px (desktop)
- Background: white
- Border radius: 12px
- Box shadow: 0 1px 3px rgba(0,0,0,0.1)

### 2.3 Screen 2: Activation Wizard

**Component:** `ProviderActivationWizard`

```typescript
interface ProviderActivationWizardProps {
  providerId: string;
  onSuccess: (connectionData: ConnectionData) => void;
  onCancel: () => void;
  defaultOs?: 'linux' | 'macos' | 'windows';
}

interface WizardState {
  step: 1 | 2 | 3;
  selectedOs: 'linux' | 'macos' | 'windows' | null;
  apiKey: string;
  apiKeyValid: boolean;
  apiKeyValidationError: string | null;
  connectionTesting: boolean;
  connectionTestResult: {
    success: boolean;
    latency?: number;
    errorMessage?: string;
  } | null;
}
```

#### Step 1: OS Selection

**Component:** `OsSelector`

```typescript
interface OsSelectorProps {
  selected: 'linux' | 'macos' | 'windows' | null;
  onChange: (os: 'linux' | 'macos' | 'windows') => void;
  disabled?: boolean;
}

// Render as 3-column radio group (stacks to 1 column on mobile)
// Each OS card:
// - Icon (48px)
// - Label (Poppins 600, 16px)
// - Description (Poppins 400, 12px, gray)
// - Selection state: blue border on selected
```

**OS Options:**
1. Linux (Ubuntu 20.04+, tested)
2. macOS (Ventura+)
3. Windows (WSL2 required)

**Button:** "Next" (disabled until OS selected)

#### Step 2: API Key Input & Validation

**Component:** `ProviderKeyInput`

```typescript
interface ProviderKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: (key: string) => Promise<{
    valid: boolean;
    error?: string;
  }>;
  isValidating?: boolean;
  validationError?: string;
}

interface KeyValidationState {
  isValidating: boolean;
  isValid: boolean;
  error: string | null;
  lastValidatedAt: Date | null;
}
```

**Render:**
- Label: "Paste your API Key"
- Textarea (monospace font, 4 lines, 100% width)
- Validation indicator:
  - Idle (gray): "Paste your key and press Tab or click Validate"
  - Validating (blue spinner): "Validating..."
  - Valid (green checkmark): "Key valid ✓"
  - Invalid (red X): "Invalid key: [error message]"
- Button: "Validate Key" (secondary, 48px height)
- Copy button (to right of textarea): "Copy Sample" → copies template key format
- Info box: "Key format: `sk-` followed by 64 alphanumeric characters"

**Validation API Call:**
```typescript
POST /api/providers/{providerId}/validate-key
{
  "apiKey": "sk-xxxxx..."
}

// Response
{
  "valid": true | false,
  "error"?: "Invalid format" | "Key expired" | "Already in use",
  "expiresAt"?: Date
}
```

**Button:** "Next" (disabled until key validates)

#### Step 3: Connection Test

**Component:** `ConnectionTest`

```typescript
interface ConnectionTestProps {
  providerId: string;
  apiKey: string;
  os: 'linux' | 'macos' | 'windows';
  onSuccess: (latency: number) => void;
  onError: (error: string) => void;
}

interface ConnectionTestState {
  testing: boolean;
  result: {
    success: boolean;
    latency?: number;
    gpuDetected?: {
      count: number;
      models: string[];
    };
    error?: string;
  } | null;
}
```

**Render:**
- Info: "Testing connection to your GPU machine..."
- Test progress:
  - Idle: Show "Test Connection" button (primary, 48px)
  - Testing: Show spinner + "Testing..." (disabled button)
  - Success:
    ```
    ✅ Connection Successful
    Latency: 45ms
    GPU Detected: 2 × RTX 4090
    ```
  - Error:
    ```
    ❌ Connection Failed
    [Error message]
    [Troubleshoot] link → opens support doc in new tab
    ```

**Test API Call:**
```typescript
POST /api/providers/{providerId}/test-connection
{
  "apiKey": "sk-xxxxx...",
  "os": "linux"
}

// Response
{
  "success": true | false,
  "latency": 45, // milliseconds
  "gpuDetected": {
    "count": 2,
    "models": ["RTX 4090", "RTX 4090"]
  },
  "error"?: "Timeout" | "Invalid key" | "GPU not detected"
}
```

**Button on Success:** "Continue" (primary, 48px) → advance to Screen 3

**Buttons on Error:** "Retry" + "Cancel"

---

## 3. Screen 3: Connected State

**Component:** `ProviderConnected`

```typescript
interface ProviderConnectedProps {
  providerId: string;
  connectionData: {
    os: 'linux' | 'macos' | 'windows';
    latency: number;
    gpuDetected: { count: number; models: string[] };
  };
  onClose: () => void;
}
```

**Render:**
- Success icon (animated checkmark, 64px, green #10B981)
- Heading: "Provider Activated! 🎉"
- Subheading: "Your GPU is now online and ready to serve jobs"
- Metrics display:
  ```
  OS: Linux (Ubuntu 20.04)
  Latency: 45ms
  GPUs: 2 × RTX 4090
  ```
- Next steps (3-step list):
  1. Monitor your earnings in the Dashboard
  2. Check job history (link to `/provider/jobs`)
  3. Join our provider community (link to Discord)
- Button: "Go to Dashboard" (primary, 48px) → navigate to `/provider`
- Small link: "View provider docs" → external link

---

## 4. API Endpoint Mappings

### 4.1 Fetch Provider Info

**Route:** `GET /api/providers/{providerId}`

**Response:**
```typescript
{
  "id": "prov-12345",
  "name": "Provider A",
  "email": "provider@example.com",
  "registeredAt": "2026-03-01T10:00:00Z",
  "status": "offline" | "online",
  "gpuCount": 2,
  "gpuModels": ["RTX 4090", "RTX 4090"],
  "connectedAt": null | Date,
  "lastHeartbeat": null | Date
}
```

### 4.2 Validate API Key

**Route:** `POST /api/providers/{providerId}/validate-key`

**Request:**
```json
{
  "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Response:**
```typescript
{
  "valid": true | false,
  "error"?: "Invalid format" | "Key expired" | "Already in use" | "Revoked",
  "expiresAt"?: "2026-06-24T10:00:00Z"
}
```

**Status Codes:**
- `200`: Valid or invalid (see `valid` field)
- `400`: Malformed request
- `404`: Provider not found
- `429`: Rate limited (max 5 attempts per 5 min)

### 4.3 Test Connection

**Route:** `POST /api/providers/{providerId}/test-connection`

**Request:**
```json
{
  "apiKey": "sk-xxxxxxx...",
  "os": "linux" | "macos" | "windows"
}
```

**Response (Success):**
```typescript
{
  "success": true,
  "latency": 45, // milliseconds
  "gpuDetected": {
    "count": 2,
    "models": ["RTX 4090", "RTX 4090"]
  },
  "version": "1.0.2" // daemon version
}
```

**Response (Error):**
```typescript
{
  "success": false,
  "error": "Timeout after 30s" | "Invalid key" | "GPU not detected" | "Daemon unreachable",
  "suggestion": "Check your network connection"
}
```

**Status Codes:**
- `200`: Test completed (check `success` field)
- `400`: Malformed request
- `408`: Timeout (30s)
- `404`: Provider not found
- `401`: Invalid API key

### 4.4 Confirm Activation

**Route:** `PATCH /api/providers/{providerId}/activate`

**Request:**
```json
{
  "apiKey": "sk-xxxxxxx...",
  "os": "linux",
  "connectionLatency": 45
}
```

**Response:**
```typescript
{
  "status": "online",
  "activatedAt": "2026-03-24T10:30:00Z",
  "connectedAt": "2026-03-24T10:30:00Z"
}
```

**Trigger:** After successful connection test, mark provider as `online` in database

---

## 5. Error Handling & Recovery

### 5.1 API Key Validation Errors

| Error | Message | Recovery |
|-------|---------|----------|
| Invalid format | "Key must start with `sk-` and be 68 characters" | Re-paste valid key |
| Key expired | "Your API key expired on Mar 20. Generate a new one." | Link to settings |
| Already in use | "This key is already connected to another provider." | Generate new key |
| Revoked | "This key was revoked. Generate a new one in settings." | Link to settings |

### 5.2 Connection Test Errors

| Error | Message | Recovery |
|-------|---------|----------|
| Timeout | "Connection timed out after 30s. Check your network." | [Retry] + [Troubleshoot] link |
| GPU not detected | "No GPU detected on the connected machine." | [View setup guide] |
| Daemon unreachable | "Can't reach your DC1 daemon. Is it running?" | [Installation guide] |
| Invalid key | "The API key is invalid or expired." | [Back to step 2] |
| Invalid OS | "OS not supported. Use Linux, macOS, or WSL2 Windows." | [Back to step 1] |

### 5.3 Offline Detection

**Display in Screen 1 (Dashboard):**
```
⚠️ Offline Alert (yellow banner)
"Your provider has been offline for 2 hours.
Check your network or restart the daemon."
[View troubleshooting guide]
```

**Trigger:** `lastHeartbeat > 2 hours ago`

---

## 6. Animation & Transitions

### 6.1 Screen Transitions

```typescript
// Dashboard → Wizard
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

**Easing:** `easeInOut`, 300ms

### 6.2 Connection Test Progress

```typescript
// Test running: Spinner animation
<motion.div
  animate={{ rotate: 360 }}
  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
>
  <Spinner />
</motion.div>

// Test complete: Checkmark animation
<motion.div
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
>
  ✓
</motion.div>
```

### 6.3 Step Progress Indicator

```typescript
// Animate progress bar width on step change
<motion.div
  animate={{ width: `${(currentStep / 3) * 100}%` }}
  transition={{ duration: 0.4 }}
/>
```

**Progress Bar:** Gray background, blue fill, 4px height, rounded caps

---

## 7. Mobile Responsiveness

### 7.1 Breakpoints

| Breakpoint | Behavior |
|-----------|----------|
| < 640px | Full-width container, 24px padding, 1-column layout |
| 640-1024px | Centered 500px container, 32px padding |
| > 1024px | Centered 640px container, 40px padding |

### 7.2 Touch Targets

All buttons and inputs must be **≥ 44px tall** (WCAG AA):
- Primary buttons: 48px height
- Secondary buttons: 40px height
- Radio button targets: 48px × 48px (with padding)
- Text input: 44px minimum height

### 7.3 OS Selector on Mobile

```
Desktop (> 640px):        Mobile (< 640px):
[Linux] [macOS] [Win]  →  [Linux]
                           [macOS]
                           [Windows]
```

---

## 8. Accessibility

### 8.1 WCAG AA Compliance

- **Keyboard navigation:** Tab → Next button, Shift+Tab → Previous, Escape → Cancel
- **Focus indicators:** 2px blue outline visible on all interactive elements
- **Color contrast:** All text ≥ 4.5:1 ratio (AA standard)
- **Alt text:** All icons have aria-label equivalents
- **Live regions:** Use `aria-live="polite"` for validation messages

### 8.2 Form Labels

```typescript
<label htmlFor="api-key" className="sr-only">
  API Key
</label>
<textarea id="api-key" placeholder="Paste your API key..." />
```

### 8.3 Error Announcements

```typescript
{error && (
  <div role="alert" aria-live="assertive">
    ❌ {error}
  </div>
)}
```

---

## 9. RTL / Arabic Support

### 9.1 CSS Logical Properties

```typescript
// Instead of margin-left/right, use:
marginInlineStart: 'auto'  // auto-flips in RTL
marginInlineEnd: '16px'

// Instead of border-left, use:
borderInlineStart: '2px solid blue'
```

### 9.2 Layout Flipping

- Icons on right (LTR) → flip to left (RTL)
- Progress bar direction: LTR left-to-right → RTL right-to-left
- Input icons: LTR right side → RTL left side

### 9.3 Arabic Copy

- "Start Activation" → "ابدأ التفعيل"
- "API Key" → "مفتاح API"
- "Test Connection" → "اختبر الاتصال"
- All labels, buttons, and messages must have Arabic translations

---

## 10. Implementation Checklist

### Phase 1: Components (Days 1-2)
- [ ] `ProviderActivationFlow` (state container)
- [ ] `ProviderDashboard` (screen 1)
- [ ] `ProviderActivationWizard` (screen 2)
- [ ] `OsSelector` (step 1)
- [ ] `ProviderKeyInput` (step 2)
- [ ] `ConnectionTest` (step 3)
- [ ] `ProviderConnected` (screen 3)

### Phase 2: API Integration (Day 3)
- [ ] Wire `GET /api/providers/{providerId}`
- [ ] Wire `POST /api/providers/{providerId}/validate-key`
- [ ] Wire `POST /api/providers/{providerId}/test-connection`
- [ ] Wire `PATCH /api/providers/{providerId}/activate`

### Phase 3: Polish & Testing (Days 4-5)
- [ ] Animations (screen transitions, progress bar, checkmark)
- [ ] Mobile responsiveness (test < 640px)
- [ ] Accessibility (keyboard nav, focus, WCAG AA)
- [ ] RTL/Arabic text and layout flipping
- [ ] Error states (all scenarios from section 5)
- [ ] Offline detection and alert (if `lastHeartbeat > 2h`)
- [ ] End-to-end testing (register → activate → online)

### Phase 4: QA & Deployment (Day 6)
- [ ] Integration test with real provider onboarding flow
- [ ] Cross-browser testing (Chrome, Safari, Firefox)
- [ ] Mobile device testing (iOS Safari, Android Chrome)
- [ ] Accessibility audit (axe-core)
- [ ] Performance check (Lighthouse)

---

## 11. Success Criteria

✅ **Implementation is complete when:**
1. User can select OS, paste API key, and test connection without leaving flow
2. All API responses properly handled (success + 5 error scenarios)
3. Mobile responsive on 375px viewport with 44px+ touch targets
4. Keyboard navigation works (Tab, Shift+Tab, Escape)
5. Focus indicators visible on all buttons
6. RTL layout flips correctly with Arabic text
7. All transitions smooth (300ms screen slides, 500ms success animation)
8. Offline alert displays after 2-hour heartbeat gap
9. User can navigate back/forward between screens
10. End-to-end: activate provider → status changes to online in 30s

---

**Prepared by:** UI/UX Specialist
**For Sprint:** 28
**Frontend Developer:** Ready to implement
