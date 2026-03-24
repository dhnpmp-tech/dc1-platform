# Phase 1 Extension Support Checklist

**Agent:** IDE Extension Developer (53f02e7e-66f9-4cb5-9ed7-a1da440eb797)
**Created:** 2026-03-24 09:45 UTC
**Purpose:** Real-time support readiness for Phase 1 testing (2026-03-25 to 2026-03-26)

---

## Pre-Phase-1 Verification (Due 2026-03-24 23:00 UTC)

### Extension Bundle Health
- [ ] Extension compiles without errors (`npm run compile` passes)
- [ ] Bundle size < 300 KiB (webpack report confirms)
- [ ] No console errors when extension loads
- [ ] All tree views render without crash
- [ ] Status bar items appear correctly

### API Connectivity
- [ ] `GET /api/templates` responds with 20+ templates
- [ ] `GET /api/models` includes competitive pricing data
- [ ] `POST /api/jobs/submit` accepts job payloads
- [ ] `/health` endpoint accessible
- [ ] Rate limiting headers present in responses

### Feature Validation
- [ ] Template Catalog: All 20 templates browsable and searchable
- [ ] Model Catalog: 11 models visible, Arabic flags correct
- [ ] Pricing Display: Savings % calculated correctly
- [ ] Job Submission: Can submit without errors
- [ ] Log Streaming: SSE or polling fallback works
- [ ] Arabic RAG Quick-Start: Command executes without error

### Configuration & Auth
- [ ] Default API endpoint is `https://api.dcp.sa`
- [ ] SecretStorage working for API key storage
- [ ] Auth migration (plain-text → SecretStorage) successful
- [ ] Provider key separate from renter key
- [ ] Error prompts on auth failure are clear

---

## Phase 1 Support Response Procedures

### Critical Issue Types & Quick Fixes

#### Issue Type 1: Extension Won't Load
**Severity:** 🔴 CRITICAL | **SLA:** 5 min | **Escalation:** Code Reviewer

**Symptoms:**
- VS Code shows "Extension activation failed"
- Activity bar shows error icon
- Error message appears on startup

**Quick Diagnosis:**
1. Check extension output channel: `code --help | grep extension`
2. Check for TypeScript compilation errors
3. Review webpack build log for failed bundles

**Quick Fix (if possible):**
- Rebuild extension: `npm run compile`
- Reload VS Code window (`Ctrl+R`)
- Check if network is blocking HTTPS to api.dcp.sa

**If not fixed in 2 min:**
- Post issue to Code Reviewer with error output
- Provide workaround (use web dashboard instead)

---

#### Issue Type 2: Template Catalog Shows "No Templates"
**Severity:** 🟠 HIGH | **SLA:** 10 min | **Escalation:** Backend Architect

**Symptoms:**
- Template tree empty or "Loading..." forever
- API key is set and working
- Model Catalog works fine

**Quick Diagnosis:**
1. Run `dcp.diagnose` command → check model count
2. If models are 0, API is down → escalate to DevOps
3. If models > 0, templates endpoint may be broken

**Quick Fix:**
- Refresh templates: `dcp.refreshTemplates` command
- Check if user has correct API key (try `dcp.setup` again)
- Clear extension cache: `rm ~/.vscode/extensions/dcp-*/.cache`

**If not fixed in 3 min:**
- Post to Backend Architect: "GET /api/templates returns empty"
- Provide user's job submission workaround (use CLI)

---

#### Issue Type 3: Model Pricing Shows "N/A" or Zeros
**Severity:** 🟡 MEDIUM | **SLA:** 15 min | **Escalation:** ML Infra Engineer

**Symptoms:**
- Models visible but savings % is blank
- Competitor prices show 0
- Status shows "no_providers"

**Quick Diagnosis:**
1. Hover over model → tooltip shows pricing data?
2. Run `dcp.diagnose` → check `modelsAvailable` count
3. Check backend `/api/models` endpoint raw response

**Quick Fix:**
- Refresh models: `dcp.refreshModels` command
- Wait 2 min (pricing may be updating)
- Check backend pricing cache: curl `https://api.dcp.sa/api/models`

**If not fixed in 5 min:**
- Post to ML Infra: "Pricing data missing for models, check /api/models"
- User impact: Minor (jobs can still submit, just no price comparison)

---

#### Issue Type 4: Job Submission Fails "API Key Invalid"
**Severity:** 🔴 CRITICAL | **SLA:** 5 min | **Escalation:** Auth System

**Symptoms:**
- Submit button → immediate error "API key is required"
- Or "401 Unauthorized"
- `dc.diagnose` shows "Not authenticated"

**Quick Diagnosis:**
1. Ask user: "Did you run 'DCP: Set Renter API Key'?"
2. If yes, run `dcp.diagnose` → should show renter status
3. If shows "API key not configured", auth storage failed

**Quick Fix:**
- Run `dcp.setup` (Set Renter API Key) again
- Paste a known-good API key from another device
- Check if VS Code SecretStorage is working: `echo $VSCODE_KEYCHAIN_USE_DARWIN` (may be a macOS issue)

**If still fails:**
- Post to Auth System: "SecretStorage failed to save key"
- Workaround: User can set key in workspace settings (less secure)

---

#### Issue Type 5: Log Streaming Stalls or Shows "Connection Failed"
**Severity:** 🟠 HIGH | **SLA:** 10 min | **Escalation:** QA Engineer

**Symptoms:**
- Job is running but no logs appear
- Output channel shows "Stream error: connection refused"
- Job eventually completes without output

**Quick Diagnosis:**
1. Check if SSE is being used: Backend logs show `/api/jobs/{id}/logs/stream`
2. If 502 errors: Backend service may be restarting
3. Check polling fallback: `dc1.pollIntervalSeconds` setting

**Quick Fix:**
- Stop log stream: `dcp.stopLogStream` command
- Wait 30s, then run `dcp.watchJobLogs` again
- Increase polling interval: Settings → search "dc1.poll"

**If stream still broken:**
- Post to QA: "SSE /api/jobs/{jobId}/logs/stream returns 502"
- Workaround: View completed job output via `dcp.viewJobLogs` when job finishes

---

#### Issue Type 6: Extension Uses 100% CPU or Memory Leak
**Severity:** 🔴 CRITICAL | **SLA:** Immediate | **Escalation:** Code Reviewer

**Symptoms:**
- VS Code becomes unresponsive
- Activity Monitor shows extension using > 500 MB RAM
- Fans spin up, battery drains fast

**Quick Diagnosis:**
1. Check if infinite loop in tree view refresh
2. Check if log streaming is stuck in retry loop
3. Open DevTools: Help → Toggle Developer Tools → check console for errors

**Quick Fix (User):**
- Disable extension: `code --disable-extension dcp-compute`
- Reload VS Code
- Don't submit jobs until fixed

**If CPU/memory still high:**
- Post to Code Reviewer immediately with:
  - DevTools console log (copy full error message)
  - VS Code version: `code --version`
  - Extension version: `dcp-compute 0.4.0`
- Recommend user use web dashboard instead for critical work

---

### Escalation Matrix

| Issue | Owner | Slack Tag | Est. Fix Time |
|-------|-------|-----------|---------------|
| Extension won't load | Code Reviewer | @cr1 @cr2 | 15 min |
| Templates endpoint broken | Backend Architect | @backend-lead | 30 min |
| Pricing data missing | ML Infra Engineer | @ml-infra-lead | 20 min |
| Auth/API key rejected | Auth System | @auth-owner | 10 min |
| Log streaming broken | QA Engineer | @qa-lead | 25 min |
| CPU/memory leak | Code Reviewer | @cr1 @cr2 | 60+ min |
| Provider activation blocked | Provider Engineer | @provider-lead | 30 min |

---

## During-Phase-1 Monitoring

### 2026-03-25 00:00 UTC — Phase 1 Testing Begins

**Standby Mode:**
- Monitor DCP-682 issue for user feedback/escalations
- Check Slack #dcp-phase1 for real-time issue reports
- Keep browser tab open to `/api/health` for quick health checks

### 2026-03-25 to 2026-03-26 — Testing Window (36 hours)

**Daily Checklist:**
- [ ] 08:00 UTC: Check Phase 1 status comment on DCP-682
- [ ] 12:00 UTC: Review any escalations from QA or UX
- [ ] 16:00 UTC: Verify no unresolved extension issues
- [ ] 20:00 UTC: Post end-of-day summary comment

**Issue Response:**
- New extension issue → respond within 15 min
- Follow escalation matrix for ownership
- Post updates to DCP-682 with resolution or blocker status

### 2026-03-26 08:00 UTC — Testing Concludes

**Final Verification:**
- All extension-related issues resolved or escalated
- Post final Phase 1 support summary to DCP-682
- Prepare recommendations for Phase 2 features

---

## Support Communication Template

**For Quick Fixes (Post in issue comments):**

```markdown
## Extension Support Update

**Issue:** [User description]
**Diagnosed:** [Brief root cause]
**Status:** ✅ RESOLVED / 🔧 IN PROGRESS / 🔴 ESCALATED

**What we did:**
- [Action 1]
- [Action 2]

**Next steps:** [User action or our action]
```

**For Escalations (Create task + tag owner):**

```markdown
## Escalation: [Component Name]

**Issue:** [User description]
**Severity:** 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM
**SLA:** [15 min / 30 min / 60 min]

**Diagnosis:**
- [Finding 1]
- [Finding 2]

**Impact:** [Number of users affected, feature blocked, etc.]

**Workaround for users:** [Temporary solution if available]

**Owner:** [Component owner tag]
```

---

## Success Criteria

Phase 1 extension support is **successful** if:

1. ✅ All template/model/job operations complete without extension errors
2. ✅ No extension crashes or hangs reported during testing
3. ✅ Average issue resolution time < 20 min
4. ✅ Zero API key/auth escalations (users set up correctly)
5. ✅ Pricing data accurately displayed throughout testing
6. ✅ Log streaming works for ≥ 95% of jobs

---

## Reference Materials

- **API Docs:** https://api.dcp.sa/api/docs
- **Extension Source:** `vscode-extension/src/`
- **Test Scenarios:** `docs/PHASE1-TEAM-COORDINATION-DASHBOARD.md`
- **Diagnostics Command:** Run `dcp.diagnose` in VS Code
- **Quick Support Link:** `/DCP/issues/DCP-682` (Phase 1 monitoring issue)

---

**Last Updated:** 2026-03-24 09:50 UTC
**Status:** 🟢 READY FOR PHASE 1
