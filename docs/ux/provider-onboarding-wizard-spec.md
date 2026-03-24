# Provider Onboarding Wizard Spec

**DCP-865 Deliverable 1**
**Status:** Implementation-ready UX spec
**Audience:** Frontend developer building the wizard flow
**Last Updated:** 2026-03-24

---

## Overview

A **guided multi-step wizard** that transforms a newly-registered provider from "registered but inactive" → "active and earning". The wizard walks the provider through hardware validation, API key setup, connection testing, and model pre-fetching in ~10-15 minutes.

**Key Principle:** Every step must show **immediate, visible proof of progress**. Providers should never wonder "did that work?" or "what do I do next?"

---

## Success Criteria

- [ ] Provider completes all 5 steps in <15 minutes
- [ ] Provider can see real-time GPU metrics during hardware check
- [ ] API key is generated and copied in <1 minute
- [ ] Connection test shows green checkmark when backend receives heartbeat
- [ ] Pre-fetch progress is visible (% downloaded per model)
- [ ] Provider is marked **active** in DB after Step 5
- [ ] No jargon—use plain language (earnings, not "net margin")

---

## Step-by-Step Specification

### Step 1: Hardware Check (Estimated: 2 min)

**What the provider sees:**
- Large heading: **"Let's check your GPU"**
- Instructions:
  ```
  Run this command in your terminal (copy with one click):

  [Copy Button] npx @dcp/validate-provider-startup
  ```
- Status box (initially empty, then populates):
  ```
  GPU Model: RTX 4090
  VRAM: 24 GB
  Driver: NVIDIA 550.68
  CUDA: 12.4
  Status: ✅ Ready to serve
  ```
- Estimated monthly earnings: **$2,847** at 70% utilization
- "Next Step" button (disabled until hardware check passes)

**What the provider must do:**
1. Copy the validation command
2. Paste into their terminal
3. Wait for output
4. Script reports back to API endpoint: `POST /api/providers/:id/hardware-check`
   - Payload: `{ gpuModel, vramGb, driverVersion, cudaVersion, cpuCores, ramGb }`

**Success state:**
- ✅ All metrics displayed
- Hardware is supported (GPU in approved list)
- Earnings estimate shows
- "Next Step" button enabled

**Failure state:**
- ❌ "Unsupported GPU" message with docs link (e.g. need CUDA 12+)
- "Try again" button to re-run validation
- Chat/support link for troubleshooting

**Skip option:**
- None—this is mandatory for provider credibility and anti-gaming

---

### Step 2: API Key & Quickstart (Estimated: 3 min)

**What the provider sees:**
- Large heading: **"Get your API key"**
- Generated key display (truncated for security):
  ```
  sk-prov_abc123def456...
  ```
- Copy-to-clipboard button (with "Copied!" confirmation)
- Quickstart link: "See how to use this key" → docs/PROVIDER-QUICKSTART-API.md
- Usage example (copy-able):
  ```bash
  curl -H "Authorization: Bearer sk-prov_abc123..." \
    https://api.dcp.sa/api/providers/heartbeat
  ```
- "Next Step" button

**What the provider must do:**
1. Copy the API key
2. Save it securely (e.g., `.env` file)
3. Optionally read quickstart docs
4. Continue

**Success state:**
- Key is visible, copyable
- Example code is ready to paste
- No validation needed—just show, copy, proceed

**Failure state:**
- If API key generation fails on backend: "Error creating key. Refresh and try again."

**Skip option:**
- None—every provider needs an API key

---

### Step 3: Connection Test (Estimated: 2-3 min)

**What the provider sees:**
- Large heading: **"Verify your connection"**
- Instructions:
  ```
  Run this command from your machine to prove you're online:

  [Copy Button] npx @dcp/heartbeat-test --key <your-api-key>
  ```
- Polling status box (updates every 2 sec):
  ```
  Listening for your heartbeat...
  [spinner] Polling (checking in 2 seconds)
  ```
- Once heartbeat received:
  ```
  ✅ Connection verified!
  Last heartbeat: 2 seconds ago
  Your IP: 102.45.123.89
  ```
- "Next Step" button enabled

**What the provider must do:**
1. Copy the heartbeat test command (includes their API key)
2. Run it on their server/machine
3. Wait for confirmation

**Success state:**
- ✅ Green checkmark shown
- Heartbeat timestamp and IP confirmed
- "Next Step" enabled

**Failure state:**
- After 30 seconds of no heartbeat: "We didn't receive your heartbeat. Troubleshooting steps:"
  - Verify API key is correct
  - Check firewall/NAT rules
  - Verify network connectivity (e.g., `ping dcp.sa`)
  - Support link to create ticket
- "Try again" button to restart polling

**Skip option:**
- "I'll test this later" (sets provider to "pending_verification" state, not "active" yet)

---

### Step 4: Model Pre-fetch (Estimated: 5-10 min, can happen in background)

**What the provider sees:**
- Large heading: **"Pre-warm models"** (optional but recommended)
- Intro text: "Download Tier A models to your GPU now. Cuts first response time in half."
- Checkbox list of Tier A models:
  ```
  ☑ ALLaM 7B (3.2 GB, ~8 min on 100 Mbps)
  ☑ Falcon H1 7B (3.1 GB, ~8 min)
  ☑ Qwen 2.5 7B (3.5 GB, ~9 min)
  ☑ Llama 3 8B (3.8 GB, ~10 min)
  ☑ Mistral 7B (3.2 GB, ~8 min)
  ```
  - Estimated total: 16.8 GB, ~45 min
  - All checkboxes pre-selected
- "Start Pre-fetch" button

**After clicking "Start Pre-fetch":**
- Streaming progress bar per model:
  ```
  ALLaM 7B: ████████░░ 85% (2.7 GB / 3.2 GB)
  Downloaded at: 6.2 MB/s
  Time remaining: ~2 min
  ```
- "Run in background" option (doesn't close wizard, provider can check status later on dashboard)
- "Skip pre-fetch" button (provider stays active, models are lazily loaded)

**What the provider must do:**
1. Select which models to pre-fetch (defaults: all Tier A)
2. Start pre-fetch
3. Can wait or skip (either works)

**Success state:**
- All selected models downloaded
- Progress bars show 100%
- "Next Step" button enabled

**Failure state:**
- If download fails for a model: "Failed to download ALLaM 7B: network timeout. Retry?"
  - Can retry or skip that model
  - Doesn't block moving to Step 5

**Skip option:**
- Yes—provider can "Run in background" or "Skip pre-fetch"
- Models are still available immediately, just with slower first request (cold-start)

---

### Step 5: Go Live (Estimated: 1 min)

**What the provider sees:**
- Large heading: **"You're live! 🚀"**
- Status summary:
  ```
  ✅ Hardware validated: RTX 4090 (24 GB)
  ✅ API key: sk-prov_abc123...
  ✅ Connection verified: 2026-03-24 14:32 UTC
  ✅ Pre-fetch: 5 models ready (16.8 GB)
  ```
- Confetti animation (subtle, not distracting)
- Next actions box:
  ```
  What happens next:
  • Your provider status is now ACTIVE
  • Renters can see your GPU in the marketplace
  • First job expected in: 15-60 minutes

  Earnings to date: $0.00
  ```
- Buttons:
  - [Primary] "Go to Dashboard" → /dashboard/provider
  - [Secondary] "Share provider link" (copies invitation URL)
  - [Link] "Read provider docs"

**What the provider must do:**
- Nothing—wizard is complete
- Can optionally navigate to dashboard or share link

**Success state:**
- Provider status updated to "active" in DB
- Wizard closes
- Dashboard shows provider with green "Online" badge
- Renters can immediately request jobs

**Failure state:**
- If activation fails on backend: "Error activating provider. Our team is notified. Check back in 1 hour."

**Skip option:**
- None—Step 5 is confirmation, not action

---

## Technical Implementation Notes

### Wizard State & Persistence
- Store wizard state in browser session storage (not persistent across browser closes)
- If provider refreshes during wizard: resume from last completed step
- If provider closes wizard mid-way: offer "Resume wizard" button on dashboard

### API Endpoints Required
1. **POST /api/providers/:id/hardware-check** — Provider submits hardware metrics
2. **POST /api/providers/:id/connection-verify** — Backend confirms heartbeat received
3. **POST /api/providers/:id/prefetch-start** — Start model pre-fetch
4. **GET /api/providers/:id/prefetch-status** — Stream pre-fetch progress (Server-Sent Events)
5. **POST /api/providers/:id/activate** — Mark provider as active

### Polling & Real-Time Updates
- Step 3 (connection test): Poll `GET /api/providers/:id/heartbeat-status` every 2 sec
- Step 4 (pre-fetch): Use Server-Sent Events (SSE) stream from `GET /api/providers/:id/prefetch-status` for real-time % updates
- Timeout Step 3 after 30 sec, allow retry
- Timeout Step 4 after 5 min per model, allow skip/retry

### Responsive Design
- Full width on mobile (<640px): single-column, large touch targets
- Tablet (640px–1024px): two-column layout (instructions + status)
- Desktop (>1024px): wide layout with sidebar navigation

### Accessibility
- All steps have clear, large headings (h1 > 32px)
- Form inputs: labels, error messages, success messages all high contrast (WCAG AA)
- Copy buttons: keyboard accessible, show visual feedback
- Progress indicator: step numbers + labels at top, non-blocking (decorative)

### Error Handling
- Every step has a clear "what went wrong" message + recovery path
- No generic "error" messages—be specific (e.g., "CUDA 12.0+ required, you have 11.8")
- Offer support contact at each failure state
- Log all wizard abandonment (which step, why) for product analytics

---

## UX Patterns & Tone

| Pattern | Treatment |
|---------|-----------|
| **Progress** | Show step number + name at top (e.g., "Step 2 of 5: API Key"). Color bar fills as steps complete. |
| **Confirmation** | Checkmark icons (✅) for completed steps, spinner for in-progress, blank for pending. |
| **Earnings** | Always in USD first, SAR in parenthesis: "$2,847 (₪10,676/month at 70% utilization)" |
| **Copy buttons** | Icon + "Copied!" toast on click. Re-enable after 2 sec. |
| **Skip option** | Only shown where noted. Button text: "I'll do this later" or "Skip & continue". |
| **Jargon** | No: heartbeat, webhook, provisioning. Yes: "verify connection", "download models", "go live". |

---

## Success Metrics (Post-Launch)

- **Wizard completion rate:** % of registered providers who finish all steps
- **Time to completion:** Median minutes per provider
- **Drop-off rate:** Which step do providers abandon most?
- **Pre-fetch adoption:** % of providers who download models (vs. skip)
- **Hardware issues:** % of providers with unsupported GPUs (feedback for recruitment)

---

## Related Issues & Documents

- **DCP-766:** Provider Onboarding CLI (backend, scripts)
- **DCP-751:** Provider Activation Campaign (copywriting, outreach)
- **DCP-770:** Provider Earnings Calculator (backend API)
- **docs/PROVIDER-QUICKSTART-API.md** (referenced in Step 2)

---

## Step 3B: Stake Activation (Phase 2 Addition)

> **Phase:** Inserted between Step 3 (Connection Test) and Step 4 (Model Pre-fetch) when Phase 2 staking activates. Hidden in Phase 1 — providers go directly from Step 3 to Step 4.
>
> **Backend flag:** `STAKING_REQUIRED=true` enables this step.

### What the provider sees

**Heading:** "Activate your GPU slot"

**Subheading:** "A small refundable deposit secures your place in the marketplace."

**Stake summary card (RTX 4090 example):**

```
Your GPU Tier: Standard (RTX 4090)
Required Deposit: 0.008 ETH  (~$25.60 / SAR 96)

This deposit:
  ✅ Unlocks job routing — you start receiving jobs immediately
  ✅ Is fully refundable after 7 days notice
  ✅ Higher stake = higher routing priority

Wallet: Not connected
```

**"Connect Wallet" button** — MetaMask or WalletConnect (wagmi)

**After wallet connects:**

```
Connected: 0xAbCd...1234
Balance: 0.045 ETH (~$144)   ✅ Sufficient

  [  Stake 0.008 ETH and Activate  ]
```

**Optional "Earn faster" accordion (collapsed by default):**

```
Stake multiple  | Routing bonus | Badge
1× (0.008 ETH)  | Baseline      | —
2× (0.016 ETH)  | +10% jobs     | Bronze ⬤
5× (0.040 ETH)  | +25% jobs     | Silver ⬤
10× (0.080 ETH) | +50% + featured | Gold ⬤
```

### Widget Interaction States

| State | What provider sees |
|-------|--------------------|
| Wallet not connected | "Connect Wallet" button; stake button hidden |
| Connected, insufficient balance | ❌ "You need 0.008 ETH, you have 0.003 ETH. [Buy ETH →]" |
| Connected, sufficient | Green "Stake X ETH and Activate" button |
| Transaction pending | Spinner: "Sending… (do not close this page)" |
| Confirmed | ✅ "Stake confirmed! [View on Basescan]" — "Next Step" unlocked |
| Failed/rejected | ❌ "Transaction failed. [Try again]" |

### On-Chain Flow

1. Provider clicks "Stake X ETH and Activate"
2. Frontend calls `ProviderStake.stake({ value: tierMin })`
3. Wallet prompts confirmation
4. Contract emits `Staked(provider, amount)`
5. Backend `stakeEventListener.js` sets `providers.stake_status = 'active'`
6. Frontend polls `GET /api/providers/:id/stake-status` every 2s
7. On `'active'` → show confirmation, unlock Step 4

> **Phase 2 USDC:** Two-step flow — "Approve USDC" then "Stake and Activate".

### Skip Option

- **"I'll stake later"** — grey link, de-emphasised
- Effect: `stake_status = 'none'`, provider inactive
- Dashboard: persistent yellow banner "Stake required to receive jobs. [Stake now →]"

### Required API Endpoints (Phase 2)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/providers/:id/stake-status` | Poll `{ stakeStatus }` after tx |
| `POST /api/providers/:id/set-wallet` | Save `evmWalletAddress` |
| `GET /api/providers/:id/stake-info` | Return `{ tierMin, stakeStatus, routingWeight, badge }` |

### Coordination

Implementation by **Frontend Developer** (DCP-910). Contracts audited and ready. Backend schema and event listener: `docs/blockchain/provider-stake-integration.md`.

*DCP-913 | Blockchain Engineer | 2026-03-24*
