# Audit M9 — "similar model" design exploration

**Status:** design exploration, not a spec. Input for the M9 design call.
**Audit ask:** when `/v1/chat/completions` lands and zero capable providers are
online for the requested model, return something better than a flat 503 —
suggest (or substitute) a model that *is* online.

This doc enumerates what "similar model" can mean, where each definition
breaks, and three concrete shapes the feature could take. Pick a definition
and a shape; everything else falls out.

---

## 0. Pre-question — is the 503 path even hot?

Before any design, run a one-week telemetry pass. Add a counter at the existing
`getCapableProviders` empty-list site in `backend/src/routes/v1.js` and log
`{model_id, has_paid_renter, retry_after_s}` whenever we 503 with code
`no_capable_providers`. If the volume is < ~20/day or concentrated on one
model that we can simply onboard a provider for, **fix the supply, not the
router**. M9 is only worth doing if the 503 path is structurally hot across
many models.

If the telemetry justifies the work, continue.

---

## 1. The five candidate definitions of "similar"

Each row below is a different lens on similarity. They are not mutually
exclusive — the final shape will combine 2-3 of them with explicit weights.

### 1.1 Architecture-similar  (same family, different size)

> "qwen3-4b is offline, suggest qwen3-8b"

- **Strength.** Lowest behavioural drift. Same tokenizer, same prompt format,
  same base training distribution.
- **Failure mode 1 — pricing surprise.** 4B → 8B is roughly 2× the cost per
  token. Renter chained the call into a budget and just got hit.
- **Failure mode 2 — context window mismatch.** Family members can have
  different context windows (qwen3 family currently varies). A renter sending
  a 100 k-token prompt to qwen3-4b's 128 k context might land on a sibling
  with 32 k context and silently truncate.
- **Failure mode 3 — capability cliff.** A 4B model's failure on a hard
  reasoning task is "it's bad at it." Substituting an 8B and getting a
  *partially-correct* answer is worse than a clear 503: the renter doesn't
  know to retry.
- **Where it lives.** `model_class` + `parameter_count` columns on the model
  catalog (already exist for most rows).

### 1.2 Capability-similar  (same model_class, different family)

> "qwen3-4b chat is offline, suggest mistral-7b chat or llama3-8b chat"

- **Strength.** Catalog already has a `model_class` field (chat, vision,
  reasoning) — easy to query.
- **Failure mode 1 — response style drift.** Mistral and Qwen produce
  noticeably different outputs even on the same chat prompt. A renter pipeline
  that does light post-processing (e.g. "extract JSON between curly braces")
  may break on the substitute.
- **Failure mode 2 — tool-call format drift.** Tool-call schemas across
  families are not identical. Today most of our catalog is text-in/text-out,
  but as soon as we have tool-callers in the catalog this becomes a sharp
  edge.
- **Failure mode 3 — license / region drift.** Some renters have explicit
  preferences (Saudi-data-locality renters care about which model touches
  their text). A blind family swap can violate that.
- **Where it lives.** `model_class` already in catalog. `family` /
  `provider_name` strings exist but aren't normalised.

### 1.3 Family-similar  (any qwen, any llama, any mistral)

> "qwen3-4b is offline, suggest any other qwen"

- **Strength.** Tokenizer + prompt-format compatibility almost guaranteed.
- **Failure mode.** Family is too coarse — a small-family qwen renter
  budgeting for a 4B can be silently upgraded to a 14B and lose the price
  envelope. Same risk as 1.1 but worse because there's no ladder rule.
- **Verdict.** Only useful when combined with a price/size ceiling.

### 1.4 Workload-similar  (same `model_class` + similar latency/throughput)

> "qwen3-4b is offline, suggest something that finishes in roughly the same
> wall-clock with roughly the same cost-per-token"

- **Strength.** Closest to what a renter actually cares about: "give me
  something that runs in my SLO budget at my price point."
- **Failure mode 1 — measurement.** Requires per-model latency and
  cost-per-token data that's reasonably current. We have pricing in the
  catalog; we have provider-side latency in `provider_latency_p50_ms` /
  `latency_recent_ms`; we don't have a per-model rolled-up p50 latency
  served-anywhere.
- **Failure mode 2 — bias toward bigger providers.** Cheapest-and-fastest
  ends up being whichever model the most-online provider serves; degenerates
  into "always suggest the same one."
- **Where it lives.** Needs a small precompute job that aggregates jobs
  table → `(model_id, p50_latency, avg_cost_halala_per_token)` rolled per
  hour.

### 1.5 Embedding-similar  (model card text similarity via vector lookup)

> "embed every model description, return nearest neighbour"

- **Strength.** Captures fuzzy similarity humans intend (same training data
  vibe, same intended use case).
- **Failure mode.** Heavy infra (vector store, embedding pipeline) for one
  feature. Hard to audit — when a recommendation is wrong, "the embedding
  said so" is not an explanation.
- **Verdict.** YAGNI for v1. Revisit if catalog grows past ~200 models.

### 1.6 What we don't have but probably need

- A `model_aliases` table that the daemon-side already owns
  (`qwen3-4b → qwen2.5-4b → qwen-2.5-4b-chat`). The router today uses these
  for *routing* but not for *fallback suggestion*. They're the cheapest
  source of high-confidence "is similar" data.
- A `model_tier` column (`small / mid / large`) for an explicit price ladder.
  Doesn't exist yet; would let us write a one-line "stay in the same tier"
  rule that closes the price-surprise hole on definition 1.1 and 1.3.

---

## 2. Three concrete shapes for the feature

These are increasing-effort options. Pick one based on the call.

### Shape A — Suggest, don't substitute  (RECOMMENDED for v1)

Return 503 as today, but include a `suggested_models` array in the body.
Renter must explicitly retry — no surprise billing, no surprise behaviour.

```json
HTTP/1.1 503 Service Unavailable
Retry-After: 30
{
  "error": "no_capable_providers",
  "model": "qwen3-4b",
  "suggested_models": [
    {
      "model_id": "qwen3-8b",
      "reason": "same_family_larger_size",
      "price_delta_pct": 95,
      "online_providers": 2
    },
    {
      "model_id": "mistral-7b",
      "reason": "same_class_different_family",
      "price_delta_pct": 12,
      "online_providers": 3
    }
  ]
}
```

- **Definitions used:** alias-similar (free, deterministic) → architecture-
  similar (one tier) → capability-similar (capped at +25 % price delta).
- **Surface area:** one new helper `suggestSimilarModels(modelId)` in
  `backend/src/lib/model-catalog-contract.js`, three lines added to the
  v1.js empty-providers branch.
- **Why this is right for v1.** Every failure mode in §1 is closed by
  *not making the choice for the renter*. The only renter complaint here is
  "ok but I just want it to work" — which is what shape B is for.
- **Pricing surprise.** Solved by `price_delta_pct`. If it's > 25 %, demote
  the suggestion to a footnote; > 100 %, drop it.
- **Test cost.** Small. One new unit test per definition + one route test.

### Shape B — Opt-in substitute via header

Renter sets `X-Substitute-Model: allow` (or
`X-Substitute-Model: same-family-only`). When set, route the call to a
similar model and return it, with a header echoing what was substituted.

```
HTTP/1.1 200 OK
X-Substituted-Model: qwen3-8b
X-Original-Model: qwen3-4b
X-Substitute-Reason: same_family_larger_size
{ ... normal completion ... }
```

- **Definitions used:** same as shape A; the header value picks how loose.
- **Surface area:** shape A *plus* a new branch in v1.js that re-resolves
  `effectiveModelId`, re-runs auth + idempotency, and proxies. Idempotency
  cache key must include the substituted model so a retry-as-original gets a
  cache miss correctly.
- **Risks closed.** None of the §1 failure modes apply — the renter opted in.
- **Risk added.** Subtle billing path: the renter's quota is now consumed
  against `qwen3-8b` even though the request said `qwen3-4b`. The webhook /
  receipt must clearly show which model was actually used.
- **When to ship.** After shape A has telemetry showing renters
  programmatically retrying against the suggestions. Don't pre-build it.

### Shape C — Default substitute with hard tier guardrail

Substitute by default, but only inside a `model_tier` (would require adding
the column from §1.6). Header opt-out (`X-Substitute-Model: never`).

- **Strength.** "It just works" for renters who don't read 503 bodies.
- **Cost.** Adds the `model_tier` column, requires backfill, requires a
  consensus on what counts as "same tier" (a four-way committee fight). The
  default-on behaviour also flips an existing contract — every shipped SDK
  call site has to know about the opt-out.
- **Verdict.** Don't ship this in the audit-followup window. It's a feature
  decision, not an audit fix.

### Comparison

|                       | Shape A | Shape B | Shape C |
|-----------------------|---------|---------|---------|
| Behaviour change      | none    | opt-in  | default |
| Billing surprise      | none    | header-gated | header-out only |
| New schema columns    | 0       | 0       | 1 (`model_tier`) |
| New backend logic     | helper + 3 LOC | + 1 branch in v1.js | +1 branch + tier table |
| Closes audit M9?      | yes (suggest) | yes (suggest+act) | yes (act) |
| Recommended for v1?   | **yes** | not yet | no |

---

## 3. Implementation sketch for shape A

`backend/src/lib/model-catalog-contract.js` — new helper:

```js
// Returns up to 3 suggestions, ranked by alias-then-architecture-then-class,
// each capped at +25% price delta vs the original.
function suggestSimilarModels(modelId, { db, maxSuggestions = 3, maxPriceDeltaPct = 25 }) {
  const original = getCatalogEntry(modelId, { db });
  if (!original) return [];

  // 1. alias hits — free, high-confidence.
  const aliases = getModelAliases(modelId, { db })
    .filter(alias => alias.providers_online > 0);

  // 2. architecture-similar (same family, one tier larger or smaller).
  const archHits = db.all(
    `SELECT * FROM models
       WHERE family = ?
         AND model_class = ?
         AND providers_online > 0
         AND model_id != ?
         AND ABS(parameter_count - ?) / parameter_count <= 1.0  -- within 2x
       ORDER BY ABS(parameter_count - ?)
       LIMIT 5`,
    original.family, original.model_class, modelId,
    original.parameter_count, original.parameter_count
  );

  // 3. capability-similar (same model_class).
  const capHits = db.all(
    `SELECT * FROM models
       WHERE model_class = ?
         AND providers_online > 0
         AND model_id != ?
         AND family != ?
       ORDER BY parameter_count
       LIMIT 5`,
    original.model_class, modelId, original.family
  );

  return [...aliases, ...archHits, ...capHits]
    .map(candidate => ({
      ...candidate,
      price_delta_pct: pricePctDelta(original, candidate),
      reason: aliases.includes(candidate) ? 'alias'
            : archHits.includes(candidate) ? 'same_family_different_size'
            : 'same_class_different_family',
    }))
    .filter(c => c.price_delta_pct <= maxPriceDeltaPct)
    .slice(0, maxSuggestions);
}
```

`backend/src/routes/v1.js` — at the existing empty-`capableProviders` site:

```js
if (!capableProviders.length) {
  const suggestions = suggestSimilarModels(effectiveModelId, { db });
  return res.status(503).json({
    error: 'no_capable_providers',
    model: effectiveModelId,
    suggested_models: suggestions,
    code: suggestions.length ? 'no_capable_providers_with_alts' : 'no_capable_providers',
  });
}
```

Tests:

- catalog with one offline qwen3-4b + online qwen3-8b → suggestion includes
  qwen3-8b with `reason: 'same_family_different_size'`.
- catalog with no online provider for any qwen → suggestion falls through to
  `model_class = chat` neighbours.
- price delta > 25 % → suggestion dropped.
- empty catalog → response code is `no_capable_providers` (not `_with_alts`).

---

## 4. Decision points for the call

1. **Telemetry first?** Run one week of `no_capable_providers` counters, or
   skip and ship shape A blind?
2. **Definition order.** Confirm: alias → architecture-similar (same family) →
   capability-similar (same class), capped at price delta.
3. **Price delta ceiling.** 25 %? 50 %? Hard reject above 100 %?
4. **Surface.** Shape A only for v1, with a separate roadmap entry to
   re-evaluate shape B once we have a quarter of `suggested_models` consumption
   telemetry?
5. **Catalog gaps.** Do we block on a `model_tier` column, or accept that
   `parameter_count` + `family` is good enough for v1?
6. **Test goal.** Is "suggestions are deterministic given the catalog" a hard
   contract, or are they allowed to drift as `providers_online` changes?
   (Recommend: deterministic for v1, ranking can shift if `providers_online`
   shifts.)

---

## 5. Out of scope for this design

- Substitution at the streaming-SSE layer (shape B issue, not v1).
- Cross-provider parameter equivalence beyond price (temperature, top_p,
  function-calling format) — assume the renter's request is portable, error
  out clearly when it isn't.
- Embedding-similarity (§1.5) — defer until catalog > 200 models.
- Multi-step degradation ("if A is offline try B, if B is offline try C"
  inside a single request) — explicit retries are the renter's responsibility
  in shape A.
