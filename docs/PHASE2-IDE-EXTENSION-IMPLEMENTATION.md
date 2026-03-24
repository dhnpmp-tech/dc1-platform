# Phase 2: IDE Extension Implementation Guide

**Date Created:** 2026-03-24
**Target Start:** 2026-03-27 (upon Phase 1 completion)
**Effort Estimate:** 12 hours total
**Scope:** Provider Status Panel + Job Submission Features

## Overview

Phase 2 extends the DCP Provider CLI VS Code extension with two major features:
1. **Provider Status Panel** — Real-time provider network monitoring (4 hours)
2. **Job Submission Modal** — Submit jobs directly from VS Code (5 hours)
3. **Testing & Polish** — Integration testing and refinement (3 hours)

## Architecture

### Current Extension (Phase 1)
- **Purpose:** Provider node management (start/stop/restart, earnings, GPU allocation)
- **Users:** GPU providers running DCP nodes
- **Entry Points:** Activity bar sidebar with 3 tree views
- **Build:** Webpack 5.105.4 + TypeScript 5.3
- **Bundle Size:** 38 KiB

### Phase 2 Extension
- **New Users:** Renters (in addition to providers)
- **New Features:** Provider browsing, job submission
- **New Tree Views:** Provider Network Status, Job History
- **Reuse:** Existing API client, styling, authentication patterns

## Feature 1: Provider Status Panel (Tree View)

### Purpose
- Show available providers on the network
- Display real-time status: online/offline/paused
- Show GPU utilization and provider metrics
- Allow renters to see who can serve their workloads

### UI Layout
```
Provider Network Status (Tree View)
├─ Network Overview
│  ├─ Total Providers: 43
│  ├─ Online Providers: N
│  ├─ Average Reputation: 4.2/5.0
│  └─ Total Compute: 240 GPUs
│
├─ Top Providers (by reputation)
│  ├─ [Provider 1] — 4 x RTX 4090 — $0.45/hr
│  ├─ [Provider 2] — 8 x H100 — $1.20/hr
│  └─ [Provider N] — ...
│
└─ Filter/Search
   ├─ By GPU model
   ├─ By price range
   └─ By region (future)
```

### Implementation Details

**File Structure**
```
src/
├─ providers/
│  ├─ ProviderNetworkPanel.ts      (Tree view + data provider)
│  ├─ types.ts                      (ProviderStatus, ProviderMetrics)
├─ ui/
│  └─ ProviderNetworkView.tsx       (Webview for detailed view)
```

**Key APIs**
- `GET /api/providers/public` — List active providers (30s cache)
  - Returns: id, gpu_model, vram_mb, gpu_count, cost_per_hour_sar, jobs_completed, online
- `GET /api/providers/active` — Detailed provider metrics (auth required)
  - Returns: reputation_score, reliability_score, heartbeats_7d, completed_jobs

**Polling Strategy**
- Update interval: 2-5 seconds (configurable)
- Cache: 30 seconds per provider
- Error handling: Graceful degradation if API is down

**Code Structure**
```typescript
export class ProviderNetworkPanel implements vscode.TreeDataProvider<ProviderNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProviderNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private providerAPI: ProviderAPI;
  private providers: ProviderStatus[] = [];
  private pollingInterval: NodeJS.Timer | null = null;

  constructor(providerAPI: ProviderAPI) {
    this.providerAPI = providerAPI;
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(() => this.refresh(), 3000);
  }

  async getChildren(element?: ProviderNode): Promise<ProviderNode[]> {
    if (!element) {
      // Return network overview + provider list
      this.providers = await this.providerAPI.getActiveProviders();
      return this.buildProviderList();
    }
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
```

**Success Criteria**
- [ ] Provider list shows "Online: N" (updates every 2-3s)
- [ ] Can expand provider nodes to see GPU details
- [ ] Clicking provider shows detailed metrics in output panel
- [ ] <500 KiB bundle size (with new code)
- [ ] Zero TypeScript errors
- [ ] No console errors during polling

### Testing
- Load panel with 0 providers
- Load panel with 43+ providers
- Test polling behavior (25+ rapid updates)
- Test error handling (API timeout, 500 error)
- Verify tree view updates without flicker

---

## Feature 2: Job Submission Modal

### Purpose
- Submit compute jobs from VS Code
- Select provider, model, script, parameters
- Show estimated cost before submission
- Monitor job status in real-time

### UI Flow

```
1. Open Command Palette (Ctrl+Shift+P)
2. Type "DCP: Submit Job"
3. Select template/model
   ├─ Show: Name, VRAM req, price/hour
   ├─ Filter: Arabic models, GPU type, budget
4. Select provider
   ├─ Show: Reputation, cost breakdown
   ├─ Filter: By GPU model, price range
5. Upload script or select template
   ├─ Show: File size, validation status
6. Review cost estimate
   ├─ Model: ALLaM 7B @ 1M tokens = SAR 1.65
   ├─ Provider: $0.45/hr
   ├─ Estimated total: SAR 2.50
7. Submit
   ├─ Show: Job ID, status, progress
   ├─ Poll job status every 2s
```

### Implementation Details

**File Structure**
```
src/
├─ jobs/
│  ├─ JobSubmissionModal.ts         (Webview modal UI)
│  ├─ types.ts                      (JobSubmission, JobStatus)
├─ commands/
│  └─ submitJobCommand.ts           (Command entry point)
```

**Key APIs**
- `POST /api/jobs` — Submit a new job (auth required)
  - Body: provider_id, model_id, script_content, parameters
  - Returns: job_id, status, estimated_cost_sar
- `GET /api/jobs/{id}` — Get job status
  - Returns: status, progress_percent, cost_incurred, eta_seconds
- `GET /api/templates/{id}/estimate` — Estimate cost for model
  - Returns: estimated_cost_sar, duration_seconds

**Code Structure**
```typescript
export async function submitJobCommand(context: vscode.ExtensionContext) {
  // Step 1: Show template selector
  const template = await showTemplateSelector();

  // Step 2: Show provider selector with cost comparison
  const provider = await showProviderSelector(template);

  // Step 3: Get script file
  const scriptPath = await vscode.window.showOpenDialog({
    filters: { 'Scripts': ['mjs', 'py', 'sh'] }
  });

  // Step 4: Show cost estimate
  const estimate = await jobAPI.estimateCost(template.id, provider.id);
  const confirmed = await vscode.window.showInformationMessage(
    `Estimated cost: SAR ${estimate.total}. Submit?`,
    'Submit', 'Cancel'
  );

  if (confirmed !== 'Submit') return;

  // Step 5: Submit job
  const result = await jobAPI.submitJob({
    provider_id: provider.id,
    model_id: template.id,
    script_content: await readFile(scriptPath[0].fsPath)
  });

  // Step 6: Monitor job status
  monitorJobStatus(result.job_id);
}

function monitorJobStatus(jobId: string): void {
  const statusInterval = setInterval(async () => {
    const job = await jobAPI.getJobStatus(jobId);
    outputChannel.appendLine(`[${job.status}] ${job.progress_percent}%`);

    if (job.status === 'completed' || job.status === 'failed') {
      clearInterval(statusInterval);
    }
  }, 2000);
}
```

**Success Criteria**
- [ ] Command "DCP: Submit Job" available in palette
- [ ] Template selector shows models with pricing
- [ ] Provider selector shows reputation and cost breakdown
- [ ] Cost estimate calculated correctly
- [ ] Job submission succeeds end-to-end
- [ ] Job status updates in output panel every 2s
- [ ] Handles 6 error scenarios (API timeout, auth failure, validation error, etc.)

### Testing
- Submit job with various model/provider combinations
- Test cost estimation accuracy
- Test job status polling
- Test error handling:
  - Invalid script (syntax error)
  - Provider offline during submission
  - Job fails on remote end
  - API timeout during polling

---

## Implementation Schedule

### Day 1 (2026-03-27): Provider Status Panel
- [ ] 08:00 UTC - Start: Create ProviderNetworkPanel class
- [ ] 10:00 UTC - Implement tree view, polling, API integration
- [ ] 12:00 UTC - Test with live API, handle edge cases
- [ ] **Checkpoint:** Provider list renders, updates every 3s, zero errors

### Day 2 (2026-03-28): Job Submission Modal
- [ ] 08:00 UTC - Start: Create JobSubmissionModal webview
- [ ] 11:00 UTC - Implement API integration, cost estimation
- [ ] 13:00 UTC - Test end-to-end job submission, status polling
- [ ] **Checkpoint:** Job submission succeeds, status displays

### Day 3 (2026-03-29): Testing & Polish
- [ ] 08:00 UTC - Integration testing: both features together
- [ ] 10:00 UTC - Error handling, edge cases, performance optimization
- [ ] 12:00 UTC - Code review, documentation, cleanup
- [ ] **Checkpoint:** All tests pass, ready for deployment

---

## Development Environment Setup

### Prerequisites
- Node.js 18+
- npm 9+ (with webpack, typescript)
- VS Code 1.85+
- DCP API running on http://localhost:8083

### Build Commands
```bash
cd packages/ide-extension

# Install dependencies (must include dev deps)
npm install --include=dev

# Development build with watch
npm run watch

# Production build
npm run package

# Run tests
npm test

# Lint
npm run lint
```

### Debugging
- Run extension in VS Code Extension Development Host
- Use Debug panel to set breakpoints
- Check `DCP Provider` output channel for logs

---

## Testing Checklist

### Unit Tests
- [ ] ProviderNetworkPanel tree item rendering
- [ ] ProviderAPI HTTP request formatting
- [ ] JobAPI response parsing
- [ ] Cost estimation calculation

### Integration Tests
- [ ] Create test provider entries
- [ ] Test full job submission flow
- [ ] Verify cost breakdown accuracy
- [ ] Test job status polling loop

### Manual Testing (QA)
- [ ] Load extension in dev host
- [ ] Provider panel: 0, 10, 43+ providers
- [ ] Submit job: simple script, complex parameters
- [ ] Cancel job submission at each step
- [ ] Job status: pending → running → completed
- [ ] Error cases: API timeout, invalid script, offline provider

### Performance Testing
- [ ] Tree view with 100+ providers: <2s render time
- [ ] Polling 50 jobs: <10% CPU, <50 MiB memory
- [ ] Bundle size: <550 KiB total

---

## Code Review Checklist

- [ ] No `any` types (must be specific)
- [ ] Error handling for all API calls
- [ ] Loading states for async operations
- [ ] Graceful degradation if API is unavailable
- [ ] Comments for complex logic
- [ ] No console errors in DevTools
- [ ] Memory leaks checked (polling cleanup on deactivation)
- [ ] TypeScript strict mode compliant

---

## Known Limitations & Future Work

### Phase 2 Scope (Out of Scope)
- ❌ WebSocket real-time updates (use polling instead)
- ❌ Job cancellation/pause (submit only)
- ❌ Advanced filtering (MVP: basic list only)

### Phase 3 Opportunities
- Real-time WebSocket updates (if backend supports)
- Job management: cancel, pause, retry
- Advanced filtering: by GPU model, price range, region
- Cost analytics: spending trends, budget alerts

---

## Success Metrics

### Adoption
- [ ] Renters can submit jobs from VS Code (MVP goal)
- [ ] Provider status visible and updates live
- [ ] No increase in support tickets (good UX)

### Quality
- [ ] Zero unhandled errors in production
- [ ] <5s job submission (happy path)
- [ ] Job status polling 99%+ uptime

### Performance
- [ ] Extension bundle: <550 KiB
- [ ] Memory: <50 MiB during normal use
- [ ] CPU: <5% idle, <20% during polling

---

**Document Version:** 1.0
**Last Updated:** 2026-03-24 00:25 UTC
**Status:** Ready for Phase 2 development (pending Phase 1 completion)
