# Provider Reputation Scoring System

## Overview

Provider reputation is a quality scoring system that measures historical performance of GPU providers on the DCP marketplace. Renters and the job dispatch system use reputation scores to make informed decisions about provider selection.

**Score Range:** 0–100 (higher is better)
**Update Frequency:** After each job completion
**Components:** Weighted average of uptime, completion rate, and throughput efficiency

## Scoring Algorithm

### Formula

```
reputation_score = (uptime_pct × 0.40) + (job_completion_rate × 0.40) + (tokens_per_sec_score × 0.20)
```

### Components

| Component | Weight | Description | Calculation |
|-----------|--------|-------------|-------------|
| **uptime_pct** | 40% | Percentage of time provider was available (inverse of failure rate) | 100 − (failed_jobs / total_jobs × 100) |
| **job_completion_rate** | 40% | Percentage of assigned jobs successfully completed | completed_jobs / total_jobs × 100 |
| **tokens_per_sec_score** | 20% | Normalized throughput efficiency (inference speed) | min(avg_tokens_per_sec / 100, 1) × 100 |

### Weight Justification

1. **Uptime (40%):** Availability is critical in a decentralized marketplace. Renters cannot afford providers who frequently go offline mid-job.

2. **Job Completion Rate (40%):** Direct measure of job success. A provider that accepts jobs but fails them wastes renter time and compute budget. Equal weight to uptime reflects that both directly impact renter ROI.

3. **Tokens Per Second (20%):** Throughput is a secondary factor. A slightly slower provider (45 tokens/sec vs. 50) is still preferable over one with poor reliability. Lower weight reflects that renters can work around slower speeds, but not unreliability.

## Data Collection

### Metrics Tracked (30-day rolling window)

- **Total Jobs Assigned:** Count of all jobs routed to provider
- **Completed Jobs:** Count of jobs with status `completed`
- **Failed Jobs:** Count of jobs with status `failed` or `timeout`
- **Average Tokens Per Second:** Mean of (tokens_generated / duration_seconds) across all completed jobs

### Database Schema

**providers table:**
```sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS (
  reputation_score REAL DEFAULT 50,
  uptime_pct REAL,
  job_completion_rate REAL,
  avg_tokens_per_sec REAL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Default Scores for New Providers

New providers (no job history) are assigned:
- **uptime_pct:** 100%
- **job_completion_rate:** 100%
- **avg_tokens_per_sec:** 50 tokens/sec (conservative baseline)
- **Initial Score:** (100 × 0.40) + (100 × 0.40) + (50 × 0.20) = **80**

This gives new providers a fair chance to win jobs while establishing track record.

## Update Mechanism

### When Reputation Updates

1. **After Job Completion:** When a job transitions to `completed` or `failed` status, trigger `providerReputation.updateReputation(providerId)`
2. **Batch Updates:** Periodically (e.g., every 6 hours) call `providerReputation.batchUpdate(providerIds)` to refresh scores for active providers

### Calculation Steps

1. Fetch provider's jobs from the past 30 days
2. Count completed, failed, and total jobs
3. Calculate uptime as `100 − (failed / total × 100)`
4. Calculate completion rate as `completed / total × 100`
5. Calculate average tokens/sec from job completion records
6. Apply weighted formula
7. Store updated metrics and score in database

## API Endpoints

### Get Provider Reputation

```
GET /api/providers/:providerId/reputation
```

**Response:**
```json
{
  "providerId": "provider-abc123",
  "score": 87.5,
  "components": {
    "uptime_pct": 95,
    "job_completion_rate": 98,
    "avg_tokens_per_sec": 65
  },
  "updatedAt": "2026-03-24T08:15:00Z"
}
```

### Rank Providers by Reputation

```
GET /api/providers/rank?ids=provider1,provider2,provider3
```

**Response:**
```json
[
  { "id": "provider1", "reputation_score": 92.3, ... },
  { "id": "provider2", "reputation_score": 88.1, ... },
  { "id": "provider3", "reputation_score": 76.5, ... }
]
```

### Get Top Providers

```
GET /api/providers/top?limit=10
```

Returns top 10 providers by reputation score.

## Job Dispatch Integration

The job dispatch system prefers higher-reputation providers when multiple are available:

```javascript
// Pseudo-code: rank candidate providers by reputation
const candidates = await getEligibleProviders(job); // sufficient VRAM, model cached, online
const ranked = await ProviderReputation.rankProviders(candidates.map(p => p.id));
const selectedProvider = ranked[0]; // highest reputation
```

## Monitoring & Decay

### Score Recency

Scores are weighted towards recent job history (30-day window). If a provider hasn't accepted jobs in 30 days:
- Metrics stay current but become increasingly stale
- Optionally: decay score toward 50 (neutral) if inactive >60 days
- Rationale: Prevents gaming; a provider with old 100-score history but no recent activity is higher-risk

### Anomaly Detection

Flag for manual review if:
- Score drops >30 points in one day → possible infrastructure issue
- Sudden completion_rate > 99% after 80% → possible acceptance filtering
- avg_tokens_per_sec > 150 → validate measurement logic

## Future Enhancements

1. **Time-Decay:** Weight recent jobs more heavily (exponential decay)
2. **Latency Component:** Add TTFT (time-to-first-token) as a quality factor
3. **Cost Efficiency:** Factor in price relative to completion rate
4. **Peer Slashing:** Negative scores for byzantine behavior (fake job completion, DoS)

## Testing

See `test/reputation.test.js` for:
- Score calculation verification
- Edge cases (0 jobs, 100% failure, very high throughput)
- Ranking algorithm validation
- Update trigger integration

## Example Scenario

**Provider Profile After 100 Jobs:**
- 95 completed successfully, 5 failed
- Average throughput: 62 tokens/sec
- Never went offline

**Calculation:**
- uptime_pct = 100 − (5/100 × 100) = 95%
- job_completion_rate = 95/100 × 100 = 95%
- tokens_per_sec_score = min(62/100, 1) × 100 = 62%
- **score = (95 × 0.40) + (95 × 0.40) + (62 × 0.20) = 38 + 38 + 12.4 = 88.4**

This provider would rank in the top tier and be preferred by the dispatch system.
