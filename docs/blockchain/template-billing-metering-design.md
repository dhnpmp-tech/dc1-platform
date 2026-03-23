# DCP Template Billing & Metering Design

**Version:** 2026-03-23
**Author:** Blockchain Engineer
**Status:** Design — pending founder review before implementation
**Related:** DCP-654, contracts/contracts/Escrow.sol, infra/config/arabic-portfolio.json

---

## 1. Overview

Sprint 27 activates the template catalog — 20+ pre-built Docker templates that renters can deploy with one click. Each template has known resource requirements (GPU tier, VRAM, container type). This document defines how template-based jobs are metered and settled via on-chain escrow.

The current `Escrow.sol` is designed for a single `depositAndLock(jobId, provider, amount, expiry)` call. Template billing requires a pre-computed `amount` that accurately reflects actual resource consumption. This document specifies how to compute that amount.

---

## 2. Template Resource Profile

Every template in `docker-templates/*.json` declares:
- `gpu_tier` — GPU class required (e.g., `rtx4090`, `a100`, `h100`)
- `min_vram_gb` — minimum VRAM required
- `container_profile` — `vllm`, `jupyter`, `pytorch`, `custom`

From `infra/config/arabic-portfolio.json`, Tier A models require 8–24 GB VRAM; Tier B requires 24–80 GB.

---

## 3. Billing Options Analysis

### Option A — Time-Based Billing (Recommended)

**Mechanism:** Renter pre-pays for a fixed duration. Escrow amount = `hourly_rate × hours_requested`.

```
escrow_amount = gpu_hourly_rate_usdc × duration_hours
```

**Pros:**
- Simple: matches the existing escrow flow (single `depositAndLock` → `claimLock`)
- Predictable for renters — they know their cost upfront
- No oracle complexity: claim proof certifies "job ran for N seconds" rather than counting tokens
- Works for all template types (inference, training, Jupyter, SD)
- No model-side metering changes needed

**Cons:**
- Renter may over-pay if job completes early (mitigated by partial-claim extension — see §5)
- Providers are incentivized to pad job time (mitigated by oracle timestamp attestation)

**Duration window:** Renter selects from fixed tiers (1h / 6h / 24h / 72h). The expiry timestamp in escrow = `block.timestamp + duration + 1h buffer`. Unclaimed after expiry → `cancelExpiredLock` refunds renter.

### Option B — Per-Token Metering

**Mechanism:** Backend counts tokens consumed, oracle signs `Claim(jobId, provider, tokenCount × tokenRate)`.

**Pros:** Precise billing for inference workloads

**Cons:**
- Requires the `amount` field in the EIP-712 Claim to be dynamic (currently fixed at deposit time)
- Renter must deposit a large pre-authorization buffer that may be partially refunded
- Does not work for non-LLM templates (SD, Jupyter, training)
- Requires contract modification to support partial claims / refunds
- Adds oracle complexity (token counting pipeline must be on-chain verifiable)
- vllm metering verified in DCP-619 but not yet integrated into claim flow

### Option C — Hybrid (Time-Based + Token Cap)

**Mechanism:** Renter pays time-based escrow but escrow amount is capped by a token budget. Job terminates when token budget is exhausted.

**Verdict:** Adds significant complexity for marginal benefit. Not recommended for Sprint 27.

---

## 4. Recommendation

**Use Option A — Time-Based Billing for Sprint 27.**

Rationale:
1. Zero contract changes required — `Escrow.sol` supports it today
2. Covers all 20+ template types uniformly
3. Predictable UX — renters see a clear price before deploying
4. Per-token billing can be added in Sprint 28 for LLM-specific templates once the contract is deployed and battle-tested

---

## 5. GPU Tier Pricing

Based on `docs/FOUNDER-STRATEGIC-BRIEF.md` floor prices (23.7% below Vast.ai):

| GPU Tier     | DCP Floor Price (USDC/hr) | Vast.ai Comparable | VRAM    |
|--------------|---------------------------|---------------------|---------|
| RTX 4090     | $0.267                    | $0.35               | 24 GB   |
| RTX 4080     | $0.206                    | $0.27               | 16 GB   |
| A100 40GB    | $1.10                     | $1.44               | 40 GB   |
| H100 80GB    | $2.49                     | $3.26               | 80 GB   |
| H200 141GB   | $3.20                     | ~$4.19              | 141 GB  |

**Template-to-tier mapping:**

| Template Profile         | Min VRAM | Assigned GPU Tier | USDC/hr |
|--------------------------|----------|-------------------|---------|
| nemotron-nano-4b         | 8 GB     | RTX 4080          | $0.206  |
| qwen25-7b / llama3-8b    | 16 GB    | RTX 4080          | $0.206  |
| allam-7b / falcon-h1-7b  | 24 GB    | RTX 4090          | $0.267  |
| jais-13b / sdxl          | 24 GB    | RTX 4090          | $0.267  |
| nemotron-super-49b       | 80 GB    | H100 80GB         | $2.49   |
| arabic-rag-complete      | 48 GB*   | RTX 4090 ×2       | $0.534  |

*Arabic RAG bundle: BGE-M3 (8GB) + BGE reranker (8GB) + ALLaM 7B (24GB) = ~40GB total; requires multi-GPU or high-VRAM card.

**USDC amounts use 6 decimals** (as per USDC standard). Example: 1 hour on RTX 4090 = `267000` micro-USDC.

---

## 6. Escrow Deposit Computation

Backend pseudocode for computing escrow amount before calling `depositAndLock`:

```javascript
// backend/src/services/escrow-billing.js

const GPU_TIER_RATES_MICRO_USDC_PER_HOUR = {
  'rtx4080':  206000,  // $0.206
  'rtx4090':  267000,  // $0.267
  'a100_40g': 1100000, // $1.10
  'h100_80g': 2490000, // $2.49
  'h200':     3200000, // $3.20
};

function computeEscrowAmount(templateId, gpuTier, durationHours) {
  const ratePerHour = GPU_TIER_RATES_MICRO_USDC_PER_HOUR[gpuTier];
  if (!ratePerHour) throw new Error(`Unknown GPU tier: ${gpuTier}`);
  return BigInt(ratePerHour) * BigInt(durationHours);
}

function computeEscrowExpiry(durationHours, bufferHours = 1) {
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec + (durationHours + bufferHours) * 3600;
}
```

**Job ID derivation** (existing pattern):
```javascript
const jobId = ethers.keccak256(ethers.toUtf8Bytes(dcJobUuid));
```

---

## 7. Arabic RAG Bundle Billing

The "Arabic RAG complete" template bundles three models simultaneously:
- **BGE-M3** (Arabic embeddings): ~8 GB VRAM
- **BGE Reranker** (cross-encoder): ~8 GB VRAM
- **ALLaM 7B** (Arabic generation): ~24 GB VRAM
- **Total:** ~40 GB VRAM

### Recommended: Single Escrow Deduction for Bundle

**Rationale:** The three models run on the same GPU or GPU pair assigned to the job. From the renter's perspective, it is a single workload. From the provider's perspective, it occupies a single allocation slot.

**Implementation:**
1. Treat the bundle as a single template with a composite GPU tier (`rtx4090_x2` or `a100`)
2. One `depositAndLock(bundleJobId, provider, bundleAmount, expiry)`
3. Oracle signs one `claimLock` at job end
4. Bundle hourly rate = 2× RTX 4090 rate = **$0.534/hr** (or A100 rate $1.10/hr if H100 allocated)

**Alternative (per-model deductions) — NOT recommended for Sprint 27:**
- Would require three concurrent escrow locks
- More gas, more complexity, worse UX
- Renter would need USDC approval for three transactions
- Reserve for future micro-billing feature

---

## 8. Job Lifecycle with Template Billing

```
Renter selects template + duration
        │
        ▼
Backend computes amount = rate × hours
Backend creates DC1 job record (UUID → jobId bytes32)
        │
        ▼
Renter approves USDC + calls depositAndLock(jobId, provider, amount, expiry)
        │
        ▼
Provider container pulls template image and starts
Job runs for duration
        │
        ▼
DC1 backend oracle detects completion / timeout
Oracle signs EIP-712 Claim(jobId, provider, amount)
        │
        ▼
Relayer calls claimLock(jobId, proof)
75% → provider wallet
25% → DC1 treasury (owner)
        │
        ▼
If job fails / times out:
Renter calls cancelExpiredLock after expiry
100% → renter
```

---

## 9. Future Extensions (Post-Sprint 27)

1. **Partial refund on early termination** — Requires contract upgrade to support split between locked amount and actual consumption amount. Out of scope for Sprint 27.
2. **Per-token billing for LLM templates** — Requires dynamic `amount` in oracle claim and a pre-authorization buffer model. Enabled once per-token metering (DCP-619) is fully integrated.
3. **Staking for providers** — Provider deposits stake as insurance against SLA violations. Separate contract.
4. **ERC-4337 account abstraction** — Allow renters to pay via gasless meta-transactions. Future UX improvement.

---

## 10. Implementation Checklist (Sprint 27)

- [ ] Create `backend/src/services/escrow-billing.js` with rate table and amount computation
- [ ] Wire template ID → GPU tier mapping in backend template registry
- [ ] Add `escrow_amount`, `escrow_expiry` fields to job creation API response
- [ ] Frontend: show total cost before renter confirms template deployment
- [ ] Test: unit tests for `computeEscrowAmount` with all GPU tiers
- [ ] Test: integration test — deposit → run → claim round trip on Base Sepolia (post-deployment)
