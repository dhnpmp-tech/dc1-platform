# Phase 2 Development: Hourly Checklist

**Duration:** 2026-03-27 00:00 UTC to 2026-03-29 12:00 UTC (12+ hours)
**Owner:** IDE Extension Developer (DCP-683)
**Scope:** Provider Status Panel (4h) + Job Submission Modal (5h) + Testing (3h)

---

## Pre-Development (2026-03-26 08:00-24:00 UTC)

**Immediately after Phase 1 completes:**

- [ ] Verify Phase 1 success criteria met (go/no-go decision)
- [ ] Read Phase 1 final status report
- [ ] Identify any Phase 1 findings that affect Phase 2
- [ ] Update Phase 2 branch with any critical bug fixes from Phase 1
- [ ] Review PHASE2-IDE-EXTENSION-IMPLEMENTATION.md one more time
- [ ] Have PHASE2-QUICKSTART.md open and ready
- [ ] Clear calendar: 3 days of uninterrupted development time
- [ ] Set up 4-hour checkpoint reminders

---

## Day 1: PROVIDER STATUS PANEL (2026-03-27)

### Hour 0-1: Setup & Branch Checkout (00:00-01:00 UTC)

**🟢 GREEN LIGHT CHECKLIST:**
- [ ] `git checkout ide-extension/phase2-provider-panel`
- [ ] `cd packages/ide-extension`
- [ ] `npm install --include=dev` ✓ (should be fast, ~30s)
- [ ] `npm run watch` ✓ (verify webpack starts with 0 errors)
- [ ] Open VS Code Extension Development Host (F5)
- [ ] Verify extension loads: Check Output panel for "DCP Provider extension activated"
- [ ] Confirm all 3 Phase 1 tree views present (Node, GPU, Earnings)
- [ ] **Status:** Phase 1 working, ready for Phase 2 code

**Expected Outcome:** Development environment ready, webpack watching, VS Code extension loaded

---

### Hour 1-2: Core Implementation (01:00-02:00 UTC)

**IMPLEMENT ProviderNetworkPanel.getChildren()**
- [ ] Open `src/providers/ProviderNetworkPanel.ts`
- [ ] Implement `getChildren()` method to call API
- [ ] Handle empty provider list (show "Loading...")
- [ ] Handle API error (show "Error loading providers")
- [ ] Build provider list items from response
- [ ] Webpack should auto-recompile
- [ ] Test in VS Code: Tree should show provider list or loading state

**Code Pattern (Reference):**
```typescript
async getChildren(element?: ProviderNode): Promise<ProviderNode[]> {
  if (!element) {
    try {
      this.providers = await this.providerAPI.getActiveProviders?.() || [];
      return this.buildProviderList();
    } catch (error) {
      return [new ProviderNode('Error', 'Failed to load providers')];
    }
  }
  return [];
}
```

**Expected Outcome:** Tree view displays provider list or error state

---

### Hour 2-3: Polling & Real-Time Updates (02:00-03:00 UTC)

**IMPLEMENT startPolling() and refresh()**
- [ ] Implement `startPolling()` method (3-second interval)
- [ ] Implement `refresh()` method to trigger updates
- [ ] Test in VS Code: Watch tree view update every 3 seconds
- [ ] Verify no webpack errors or console errors
- [ ] Check memory usage: Should be <50 MiB
- [ ] Check CPU: Should be <10% idle

**Code Pattern:**
```typescript
startPolling(): void {
  if (this.pollingInterval) return;
  this.pollingInterval = setInterval(() => this.refresh(), 3000);
}

refresh(): void {
  this._onDidChangeTreeData.fire(undefined);
}
```

**Performance Check:**
- [ ] Tree updates smoothly every 3 seconds
- [ ] No visual flicker or lag
- [ ] Memory stable at ~40-50 MiB
- [ ] CPU <15% during polling

**Expected Outcome:** Real-time polling working, tree view updating every 3 seconds

---

### Hour 3-4: Testing & Checkpoint (03:00-04:00 UTC)

**TEST: Provider Status Panel**
- [ ] [ ] Provider list shows 43+ providers
- [ ] [ ] Each provider shows: name, GPU model, count, cost/hr
- [ ] [ ] List updates every 3 seconds
- [ ] [ ] Clicking provider shows details (if implemented)
- [ ] [ ] Error handling works (test by stopping API)
- [ ] [ ] Memory <50 MiB sustained
- [ ] [ ] Zero TypeScript errors: `npm run lint`
- [ ] [ ] Zero console errors: F12 DevTools

**CHECKPOINT 1: Provider Panel COMPLETE**
- [ ] Tree view fully functional ✓
- [ ] Polling working ✓
- [ ] Performance acceptable ✓
- [ ] Ready for Phase 2 Feature 2

**If Issues:**
- [ ] TypeScript errors? Run `npm run lint` and fix
- [ ] API errors? Check backend is running
- [ ] Memory leak? Review polling cleanup
- [ ] Performance slow? Check polling interval

---

## Day 2: JOB SUBMISSION MODAL (2026-03-28)

### Hour 4-5: Webview & UI (04:00-05:00 UTC)

**IMPLEMENT JobSubmissionModal webview UI**
- [ ] Open `src/jobs/JobSubmissionModal.ts`
- [ ] Create webview panel with basic HTML
- [ ] Add form fields: template selector, provider selector, script textarea
- [ ] Add styling using VS Code theme variables
- [ ] Add submit button
- [ ] Test: `vscode.commands.executeCommand('dcp.submitJob')` should open modal
- [ ] Modal should be visible and styled correctly

**HTML Form Structure (Reference):**
```html
<select id="template">
  <option value="">Loading templates...</option>
</select>

<select id="provider">
  <option value="">Loading providers...</option>
</select>

<textarea id="script" rows="8"></textarea>

<div class="cost-estimate">
  <strong>Estimated Cost:</strong>
  <div id="costBreakdown">-</div>
</div>

<button id="submitBtn">Submit Job</button>
```

**Expected Outcome:** Modal opens with form fields visible

---

### Hour 5-6: Template & Provider Data (05:00-06:00 UTC)

**POPULATE Template & Provider Dropdowns**
- [ ] Load templates from `/api/templates`
- [ ] Load providers from `/api/providers/public`
- [ ] Display in dropdowns with name + price
- [ ] Handle loading state ("Loading templates...")
- [ ] Handle errors gracefully
- [ ] Update cost estimate when selections change
- [ ] Verify data displays correctly

**Expected Outcome:** Dropdowns populated with templates and providers

---

### Hour 6-8: Cost Estimation & Submission (06:00-08:00 UTC)

**IMPLEMENT Cost Estimation & Job Submission**
- [ ] Call `/api/templates/{id}/estimate` on template select
- [ ] Calculate total cost: model + provider
- [ ] Display in cost breakdown
- [ ] Implement script upload/paste functionality
- [ ] On submit: POST to `/api/jobs`
- [ ] Handle submission response (job_id, status)
- [ ] Display job ID in output panel
- [ ] Start polling job status every 2 seconds
- [ ] Show status: "pending → running → completed"

**Code Pattern:**
```typescript
async submitJob() {
  const result = await jobAPI.submitJob({
    provider_id: selectedProvider.id,
    model_id: selectedTemplate.id,
    script_content: scriptContent
  });

  monitorJobStatus(result.job_id);
}

function monitorJobStatus(jobId: string) {
  const interval = setInterval(async () => {
    const job = await jobAPI.getJobStatus(jobId);
    outputChannel.appendLine(`[${job.status}] ${job.progress_percent}%`);

    if (['completed', 'failed'].includes(job.status)) {
      clearInterval(interval);
    }
  }, 2000);
}
```

**Expected Outcome:** Job submission works end-to-end, status tracking active

---

### Hour 8-9: Testing & Checkpoint (08:00-09:00 UTC)

**TEST: Job Submission Modal**
- [ ] [ ] Modal opens on command
- [ ] [ ] Templates populate correctly
- [ ] [ ] Providers populate correctly
- [ ] [ ] Cost estimate calculates correctly
- [ ] [ ] Job submits successfully
- [ ] [ ] Job ID returned and displayed
- [ ] [ ] Job status updates every 2 seconds
- [ ] [ ] Error scenarios handled (invalid script, offline provider)
- [ ] [ ] Memory usage stable <50 MiB
- [ ] [ ] Zero TypeScript errors

**CHECKPOINT 2: Job Submission COMPLETE**
- [ ] Modal fully functional ✓
- [ ] Job submission working ✓
- [ ] Status tracking working ✓
- [ ] Ready for Day 3 testing

**If Issues:**
- [ ] Job submission fails? Check `/api/jobs` endpoint
- [ ] Cost estimate wrong? Verify strategic brief data
- [ ] Status not updating? Check job polling loop
- [ ] Modal not opening? Check command registration

---

## Day 3: TESTING & POLISH (2026-03-29)

### Hour 9-10: Integration Testing (09:00-10:00 UTC)

**TEST: Both Features Together**
- [ ] [ ] Open extension with Provider Panel active
- [ ] [ ] Open Job Submission modal from panel
- [ ] [ ] Select provider from panel → auto-populate in modal
- [ ] [ ] Submit job → See status in panel
- [ ] [ ] Both features update in real-time
- [ ] [ ] Memory stable even with both active
- [ ] [ ] No race conditions or conflicts

**Performance Validation:**
- [ ] Bundle size: `npm run package` → check .vsix size <550 KiB
- [ ] Memory: Monitor <50 MiB sustained
- [ ] CPU: <20% during active use
- [ ] No memory leaks: Let run for 10+ minutes, check memory stable

**Expected Outcome:** Both features work together seamlessly

---

### Hour 10-11: Error Handling & Polish (10:00-11:00 UTC)

**IMPLEMENT Error Handling (6 Scenarios)**
- [ ] API timeout (>5s response) → show "Request timeout" message
- [ ] API 500 error → show "Server error" message
- [ ] Invalid script → show "Invalid script" message
- [ ] Provider offline → show "Provider unavailable" message
- [ ] Job failed → show "Job failed: [reason]"
- [ ] No network → graceful degradation

**Code Quality:**
- [ ] Run `npm run lint` → fix all errors
- [ ] Run `npm run compile` → zero TypeScript errors
- [ ] Check DevTools console → zero errors
- [ ] Add comments to complex logic
- [ ] Clean up any debug code

**UI Polish:**
- [ ] Loading states show "Loading..."
- [ ] Error messages are clear and actionable
- [ ] Buttons are disabled during loading
- [ ] Success messages clear after 3s

**Expected Outcome:** Robust error handling, code quality high

---

### Hour 11-12: Code Review & Finalization (11:00-12:00 UTC)

**CODE REVIEW CHECKLIST:**
- [ ] No `any` types (all types specific)
- [ ] All API calls have error handling
- [ ] No console.log() left in code
- [ ] Comments explain "why", not "what"
- [ ] Memory leaks checked (polling cleanup)
- [ ] Event listeners cleaned up on deactivate
- [ ] No circular dependencies
- [ ] Follows existing code patterns

**FINAL VALIDATION:**
- [ ] `npm run compile` → ✓ Success
- [ ] `npm run lint` → ✓ Zero errors
- [ ] `npm run package` → ✓ Creates .vsix <550 KiB
- [ ] Manual test: All features work ✓
- [ ] Memory stable: ~45 MiB ✓
- [ ] CPU baseline: <10% idle ✓

**COMMIT & PR:**
- [ ] Create clean commit message
- [ ] Push to feature branch
- [ ] Create PR to main with:
  - [ ] Summary of features implemented
  - [ ] Testing checklist completed
  - [ ] Performance metrics confirmed
  - [ ] Ready for code review

**Expected Outcome:** Phase 2 complete, PR ready for review

---

### Checkpoint Summary (2026-03-29 12:00 UTC)

**PHASE 2 COMPLETE**
- ✅ Provider Status Panel: Real-time monitoring, 43+ providers
- ✅ Job Submission Modal: End-to-end job submission + tracking
- ✅ Error Handling: 6 scenarios covered
- ✅ Performance: <550 KiB bundle, <50 MiB memory
- ✅ Code Quality: Zero TypeScript errors, strict type checking
- ✅ Tests: All critical paths validated
- ✅ Documentation: Code comments and docstrings
- ✅ PR: Ready for code review

---

## Timeline Summary

```
Day 1 (2026-03-27) — Provider Status Panel
├─ 00:00-01:00: Setup & branch checkout
├─ 01:00-02:00: Core implementation (getChildren)
├─ 02:00-03:00: Polling & real-time updates
└─ 03:00-04:00: Testing & checkpoint

Day 2 (2026-03-28) — Job Submission Modal
├─ 04:00-05:00: Webview UI setup
├─ 05:00-06:00: Template & provider data
├─ 06:00-08:00: Cost estimation & submission
└─ 08:00-09:00: Testing & checkpoint

Day 3 (2026-03-29) — Testing & Polish
├─ 09:00-10:00: Integration testing
├─ 10:00-11:00: Error handling & polish
└─ 11:00-12:00: Code review & finalization

DEADLINE: 2026-03-29 12:00 UTC (Phase 2 complete)
```

---

## Quick Reference: Key Files

**Phase 2 Implementation Files:**
- `src/providers/ProviderNetworkPanel.ts` — Tree view provider
- `src/jobs/JobSubmissionModal.ts` — Webview modal
- `src/providers/types.ts` — Provider types
- `src/jobs/types.ts` — Job types

**Reference Documentation:**
- `PHASE2-IDE-EXTENSION-IMPLEMENTATION.md` — Full guide
- `PHASE2-QUICKSTART.md` — Quick-start reference
- `PHASE2-DEVELOPMENT-CHECKLIST.md` — This file

**Build Commands:**
- `npm run watch` — Development build
- `npm run lint` — TypeScript linting
- `npm run compile` — One-time build
- `npm run package` — Production build (.vsix)

---

## Success Criteria

**Phase 2 is COMPLETE when:**
- ✅ Provider Status Panel shows 43+ providers updating every 3s
- ✅ Job Submission Modal: end-to-end workflow succeeds
- ✅ Cost estimation accurate vs strategic brief
- ✅ Job status tracking (2s polling) works
- ✅ All 6 error scenarios handled gracefully
- ✅ Bundle <550 KiB, memory <50 MiB, CPU <20%
- ✅ Zero TypeScript errors
- ✅ Zero console errors
- ✅ PR created and ready for code review

---

**This checklist is your hourly roadmap for Phase 2 development.**
**Reference it throughout development to stay on track.**
**Post checkpoint comments in DCP-683 at Hours 4, 9, and 12.**
