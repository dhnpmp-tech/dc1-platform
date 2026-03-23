# IDE Extension — Post-Deployment Validation Checklist

**When to use:** Immediately after DCP-524 VPS deployment is confirmed
**Duration:** ~10 minutes
**Owner:** QA Engineer (for validation) + IDE Extension Developer (for troubleshooting)

---

## Pre-Validation Setup (2 min)

### Environment
- [ ] VPS deployment (DCP-524) completed and confirmed
- [ ] Backend service (dc1-provider-onboarding) is running: `pm2 list`
- [ ] API endpoint is accessible: `curl https://api.dcp.sa/api/models | head -c 100`
- [ ] HTTPS certificate valid (should see 200 OK above)

### Test Environment
- [ ] Node.js v18+ available: `node --version`
- [ ] All scripts are executable: `chmod +x scripts/*.mjs`

---

## Phase 1: Pricing Data Validation (3 min)

### 1.1 Run Extension Pricing Validation Script
```bash
node scripts/ide-extension-pricing-validate.mjs
```

**Expected output:**
```
✅ PASS: Endpoint returns HTTP 200
✅ PASS: Response is valid array (15 models)
✅ PASS: Model ALLaM-7B has complete competitor pricing: Vast.ai=$10/hr, RunPod=$14/hr, AWS=$48/hr
✅ PASS: Model ALLaM-7B savings: 95%
✅ PASS: Extension pricing tooltips can display full comparisons

🎉 ALL CHECKS PASSED - Extension pricing display ready!
```

**If test fails:**
- Check backend logs: `pm2 logs dc1-provider-onboarding | tail -50`
- Verify commit e1723ac is deployed: `git log --oneline | grep "e1723ac"`
- Restart service: `pm2 restart dc1-provider-onboarding`
- Re-run test

---

## Phase 2: API Response Structure (3 min)

### 2.1 Sample a Model Response
```bash
curl -s https://api.dcp.sa/api/models | head -c 1000
```

**Verify response includes:**
- ✅ `model_id` — Unique identifier (e.g., "ALLaM-AI/ALLaM-7B-Instruct-preview")
- ✅ `display_name` — Human-readable name (e.g., "ALLaM 7B Instruct")
- ✅ `avg_price_sar_per_min` — DCP pricing (e.g., 0.15)
- ✅ `competitor_prices` — Object with vast_ai, runpod, aws fields
- ✅ `savings_pct` — Calculated savings percentage (e.g., 95)

### 2.2 Verify Pricing Data Makes Sense
```bash
# Check that DCP price is always cheaper than competitors
curl -s https://api.dcp.sa/api/models | \
  grep -o '"competitor_prices"[^}]*}' | head -5
```

**Expected:** DCP prices significantly lower than Vast.ai/RunPod/AWS

---

## Phase 3: Extension Integration (2 min)

### 3.1 Extension Code Verification
The extension already has code to handle pricing data. No new code should be deployed.

Check that extension compilation is clean:
```bash
cd vscode-extension
npm run package 2>&1 | grep "compiled successfully"
```

**Expected:** `webpack 5.89.0 compiled successfully`

### 3.2 Extension Behavior After Deployment
Once users install/update the extension and set their API key:

1. **Open VS Code sidebar** → DCP Compute panel
2. **View Model Catalog tree**
3. **Hover over any model** → Rich tooltip should show:
   - Model name and family
   - VRAM requirement
   - **DCP Price**: SAR/hour
   - **Vast.ai Price**: SAR/hour (competitor comparison)
   - **RunPod Price**: SAR/hour (competitor comparison)
   - **AWS Price**: SAR/hour (competitor comparison)
   - **Savings**: % cheaper than Vast.ai baseline

**If pricing not displaying:**
- Extension is gracefully degrading (missing data handled)
- Check /api/models response with curl (Phase 2.1)
- May need extension restart/reload

---

## Phase 4: QA Sign-Off (2 min)

### 4.1 Validation Results
- [ ] All tests in ide-extension-pricing-validate.mjs passed
- [ ] API response includes all pricing fields
- [ ] No errors in backend logs (pm2 logs)
- [ ] Extension can display pricing tooltips (manual check if possible)

### 4.2 Known Limitations
- ✅ Pricing display is optional (gracefully degraded if data missing)
- ✅ Extension works with or without competitor_prices
- ✅ Savings % only displays if data available
- ✅ No new extension version needed (uses existing code from Sprint 27)

### 4.3 Sign-Off
**QA Engineer Name:** ________________
**Date/Time:** ________________
**Status:** ✅ PASS / ❌ FAIL

**Notes:**
_______________________________________________

---

## Troubleshooting

### Pricing data not showing in /api/models response
**Symptom:** `curl https://api.dcp.sa/api/models` returns models but no `competitor_prices` field

**Check:**
1. Is commit e1723ac deployed? `git log | grep e1723ac`
2. Backend service restarted? `pm2 restart dc1-provider-onboarding`
3. Check backend code: `grep -n "toLegacyListItem" backend/src/routes/models.js` should include competitor_prices

**Fix:**
```bash
cd /home/node/dc1-platform
git pull origin main  # Make sure e1723ac is pulled
npm --prefix backend start &
# Or: pm2 restart dc1-provider-onboarding
```

### Validation script shows warnings only
**Symptom:** Some models have competitor_prices, others don't

**This is OK** — DCP-668 fix was successful, gradual rollout is expected
- Extension handles this gracefully
- All models will have pricing after next backend restart

### curl command fails with "certificate verify failed"
**Fix:** Use `-k` flag to skip SSL verification (dev only):
```bash
curl -k https://api.dcp.sa/api/models | head -c 100
```

Or check certificate validity:
```bash
openssl s_client -connect api.dcp.sa:443 -showcerts
```

---

## Success Criteria

✅ **Extension Pricing Display is Production-Ready when:**
1. IDE Extension Pricing Validation script returns exit code 0
2. All expected fields present in /api/models response
3. Backend logs show no pricing-related errors
4. QA sign-off completed

**Timeline:** From VPS deployment to validation complete: ~10-15 minutes

---

**Commit:** e1723ac — fix(api): wire competitor_prices to /api/models endpoint
**Issue:** DCP-668 (Pricing Fix) + DCP-524 (VPS Deployment)
**Created:** 2026-03-23 by IDE Extension Developer
**Status:** Ready for QA execution post-deployment
