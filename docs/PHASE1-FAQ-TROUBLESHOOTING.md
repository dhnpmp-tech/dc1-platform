# Phase 1 FAQ & Troubleshooting Guide

**Created:** 2026-03-24
**Status:** Reference document for all teams
**Updated:** As needed during Phase 1 execution

---

## Quick Answers to Common Questions

### Launch Questions

**Q: What time exactly does Phase 1 launch?**
A: 2026-03-26 08:00 UTC exactly. Pre-flight health checks at 07:45 UTC.

**Q: Will we have any downtime before launch?**
A: No. The marketplace is currently live (api.dcp.sa). Phase 1 just means "real users" instead of internal testing.

**Q: What happens if pre-flight verification fails?**
A: Launch is delayed 24 hours. We fix the issue and re-verify at the next window (2026-03-27 23:00 UTC).

**Q: Can we delay Phase 1 if something breaks?**
A: Yes, but only if critical systems are down. Minor issues are acceptable (we have 3-day monitoring window).

---

### Analytics Questions

**Q: Why is analytics showing zero events?**
A: Check 1) Segment webhook is active, 2) Frontend is sending events, 3) Dashboard has correct time filter

**Q: Can I see real-time events in Mixpanel?**
A: Yes, events appear in real-time feed (2-minute lag). Check "Live" view in Mixpanel dashboard.

**Q: What if Segment is down?**
A: Fallback: Manual event logging + email alerts. We can reconstruct 2 hours of data from Segment backups.

**Q: How do I export analytics data?**
A: Daily snapshots automated. Manual export: Mixpanel admin panel → Data Export (CSV).

**Q: Why isn't my event appearing?**
A: Verify: 1) Event name matches schema (13 events defined), 2) Required properties included, 3) No typos in event name

---

### Feedback Widget Questions

**Q: Why isn't the feedback widget showing?**
A: Check: 1) JavaScript console for errors, 2) Widget script loaded (check Network tab), 3) Intercom/Pendo account active

**Q: Can I test the feedback widget?**
A: Yes. Submit test feedback → should appear in admin dashboard within 30 seconds. If not, check backend logs.

**Q: What if users report they can't submit feedback?**
A: 1) Check widget loads, 2) Test submission yourself, 3) Verify API endpoint is responding, 4) Restart widget if needed

**Q: How do I access the feedback dashboard?**
A: Intercom/Pendo admin panel (URL sent to frontend team). Bookmark it. You'll need it for daily monitoring.

**Q: What if the feedback API is rate-limited?**
A: Shouldn't happen during Phase 1 (expected <100 responses/day). If it does: contact Frontend team to increase limits.

---

### API & Backend Questions

**Q: What's the expected API response time?**
A: Target: <200ms (p95 latency). Acceptable: <500ms. Concerning: >1000ms (investigate).

**Q: What API endpoints are being hit in Phase 1?**
A: Signup, login, profile setup, model list, deployment create, inference submit. Watch error logs for these.

**Q: Why are deployments timing out?**
A: Check: 1) Model available, 2) Provider responding, 3) Network latency (SSH to provider), 4) Model startup time

**Q: How do I restart a service if it crashes?**
A: Only Backend Architect or Founding Engineer restart services. Tag @backend-architect in #dcp-phase1-support.

**Q: What if the database is full?**
A: Not expected during Phase 1 (low volume). If it happens: contact Backend Architect. Probably need to clean test data.

---

### Deployment & Provider Questions

**Q: Why can't a renter deploy a model?**
A: Troubleshoot: 1) Model exists in catalog, 2) Provider online + responsive, 3) Provider has enough VRAM, 4) Network connection stable

**Q: How do I check if a provider is online?**
A: HTTP heartbeat endpoint (Path B, active). Backend dashboard shows provider status. Check backend logs.

**Q: What if providers aren't responding?**
A: Phase 1 has HTTP fallback (Path B, already activated). Deployments may be slow but should work. P2P not required.

**Q: Can I manually register a test provider?**
A: No. Only real providers register. We have 43 registered but 0 online. They'll come online gradually.

---

### Infrastructure Questions

**Q: Is the VPS running?**
A: Yes. VPS 76.13.179.86 is live with PM2 services running. Check: `pm2 status` (Backend Architect only).

**Q: Is HTTPS working?**
A: Yes. api.dcp.sa has valid SSL certificate (Let's Encrypt, valid through 2026-06-21).

**Q: What if the VPS goes down?**
A: Contact DevOps Automator (@devops-automator). They'll restart services + notify team. ETA: 15 minutes.

**Q: Can I SSH to the VPS?**
A: Only DevOps + Founding Engineer. For critical issues: ask in #dcp-phase1-support, don't SSH directly.

---

### User Experience Questions

**Q: Why is signup flow slow?**
A: Check: 1) Database queries, 2) Email verification (if enabled), 3) API latency, 4) Browser caching issues

**Q: Are users able to see all models in the catalog?**
A: Should be yes. If not: check 1) Model metadata (11 models expected), 2) Catalog API response, 3) Frontend rendering

**Q: Why is model deployment taking 5+ minutes?**
A: Expected for first deployment (model download + startup). Subsequent deployments should be faster (<2 min).

**Q: Can I see user session logs?**
A: Analytics dashboard shows user flows. Support queue shows user-reported issues. Community channels show unsolicited feedback.

---

### Support Questions

**Q: How do I submit a support ticket during Phase 1?**
A: Email: support@dcp.sa (monitored during Phase 1). Response target: <2 hours for critical, <8 hours for standard.

**Q: What categories should support tickets be tagged?**
A: Deployment, billing, models, signup, general. See PHASE1-TEAM-COORDINATION-GUIDE.md for details.

**Q: Can I contact users directly?**
A: No direct contact. Use feedback widget response feature. For urgent: ask UX Researcher to reach out via email.

---

### Community Monitoring Questions

**Q: Where should I monitor user sentiment?**
A: Twitter (#DCP @dcp_ai), Discord (#feedback), GitHub (issues), Hacker News (if posted).

**Q: What if someone tweets negatively about DCP?**
A: 1) Don't engage directly, 2) Post to #dcp-phase1-support, 3) DevRel will respond appropriately.

**Q: Can we respond to GitHub issues during Phase 1?**
A: Yes. But focus on critical bugs. Feature requests can be noted for post-Phase-1 analysis.

---

## Troubleshooting Flowcharts

### API Down (Response: <30 minutes)

```
API not responding?
  ↓
Check status: curl api.dcp.sa/health
  ├─ 200 OK → Check specific endpoint
  │   └─ If some endpoints down → Query/auth issue
  │       └─ Restart API service (Backend Architect)
  └─ Connection refused → Service down
      └─ Check VPS running (DevOps)
          └─ Restart PM2 service
              └─ If still down → Restore from backup
```

### Widget Not Loading (Response: <1 hour)

```
Widget not visible?
  ↓
Check browser console for errors
  ├─ JS error → Frontend fix needed
  │   └─ Tag @frontend-developer
  └─ No error → Widget script not loaded
      ├─ Check Network tab → Is Intercom/Pendo script loading?
      └─ If not → Check CDN/DNS issue
          └─ Contact Frontend team
```

### Analytics Down (Response: <2 hours)

```
No analytics events?
  ↓
Check Segment webhook active
  ├─ Active → Frontend sending events?
  │   └─ Check browser Network tab for Segment calls
  └─ Not active → Reactivate webhook
      └─ Restart Segment integration (Backend Architect)

Check Mixpanel dashboard
  ├─ Has events from before? → Current event issue
  │   └─ Fix current event → check event name, properties
  └─ No events ever? → Check API connection
```

### Database/Storage Issues

```
Database connection error?
  ↓
Check space available: df -h
  ├─ <10% free → Need cleanup
  │   └─ Remove test data (Backend Architect)
  └─ >10% free → Connection issue
      └─ Restart database service
          └─ Restore from backup if needed
```

---

## Common Solutions

### "Too many requests" / Rate limiting
**Solution:** Increase rate limit. Backend team can adjust. Temporary workaround: add request delays.

### "Model startup timeout"
**Solution:** Model taking >5 minutes to start? Normal for first startup (downloading weights). Let it complete.

### "Provider not responding"
**Solution:** Provider offline. Check HTTP heartbeat. If offline, may require P2P network (but Phase 1 is HTTP-only).

### "Inference latency >10 seconds"
**Solution:** Check 1) Model complexity, 2) Provider load, 3) Network latency. May be normal for large models.

### "Support ticket not received"
**Solution:** Check spam folder. Resend to: support@dcp.sa with detailed description + timestamp.

---

## Escalation Decision Tree

### Is this a critical issue?
- API down? **YES** → Escalate immediately
- Widget broken? **MAYBE** → Check if affecting users
- Wrong analytics event? **NO** → Post to daily summary

### Who should I escalate to?

**API/Backend Issue:** @backend-architect + @founding-engineer
**Widget/Frontend Issue:** @frontend-developer
**Provider/Network Issue:** @p2p-network-engineer + @backend-architect
**Infrastructure/VPS Issue:** @devops-automator
**Security Issue:** @security-engineer + @ceo
**Cross-team Blocker:** @ceo

### How do I escalate?

1. Post to #dcp-phase1-support with:
   - "CRITICAL: [issue description]"
   - Steps to reproduce
   - Impact (how many users affected?)
   - Suggested fix (if any)

2. Tag relevant team: @team-name
3. If cross-team: Tag @ceo
4. Expect response within 30 minutes for critical

---

## During Phase 1: Do's & Don'ts

### DO:
✅ Monitor your assigned metrics hourly
✅ Post observations to #dcp-phase1-support
✅ Escalate critical issues immediately
✅ Document issues in daily summary
✅ Support teammates during launch window
✅ Keep Slack notifications on
✅ Test your dashboards before 08:00 UTC

### DON'T:
❌ Deploy new code (freeze in effect)
❌ SSH to VPS without permission
❌ Restart services without approval
❌ Contact users directly
❌ Ignore critical alerts
❌ Go idle during launch window (08:00-10:00 UTC)
❌ Assume someone else is watching

---

## Success Indicators (By Hour)

### First Hour (08:00-09:00 UTC)
- ✅ API responding <200ms
- ✅ 1+ users signing up
- ✅ 0 critical errors
- ✅ All team channels active
- ✅ Observations posted

### First 6 Hours (08:00-14:00 UTC)
- ✅ 2-5 signups
- ✅ 1+ deployment attempted
- ✅ 2-5 feedback responses
- ✅ <1% error rate
- ✅ Community mentions appearing

### First 24 Hours (08:00 2026-03-26 to 08:00 2026-03-27)
- ✅ 5-15 signups total
- ✅ 3+ deployments
- ✅ 10+ feedback responses
- ✅ Positive community sentiment
- ✅ 0 critical unresolved issues
- ✅ Interview recruitment: 1+ confirmed

---

## After Phase 1 Ends

**Day 6 Evening (23:00 UTC):**
- Final observation summary posted
- Interview recruitment status: 3+ confirmed

**Week 2 (2026-03-31 to 2026-04-02):**
- Execute scheduled interviews
- Analyze interview data
- Compile final report with 5-7 recommendations

**Report Delivery (2026-04-02):**
- Final report posted
- Improvements prioritized
- Ready for Sprint 28 implementation

---

## Contact List (Quick Reference)

**UX Researcher (Coordinator):** @ux-researcher (24/7 on-call)
**Backend Architect:** @backend-architect (launch day on-call)
**Frontend Developer:** @frontend-developer (launch day on-call)
**QA Engineer:** @qa-engineer (launch day on-call)
**DevOps:** @devops-automator (emergency only)
**DevRel:** @devrel-engineer (community monitoring)
**CEO:** @ceo (executive decisions)

**Primary Channel:** #dcp-phase1-support
**Escalation:** Tag above + describe issue

---

## Last-Minute Checklist (Morning of 2026-03-26)

- [ ] All dashboards bookmarked + open
- [ ] Slack #dcp-phase1-support channel notifications ON
- [ ] All team members confirmed ready (Slack poll)
- [ ] Pre-flight verification complete (from yesterday)
- [ ] Observation templates ready to populate
- [ ] Escalation contacts tested (test ping)
- [ ] Coffee ☕ ready (long day ahead)

---

**Document Status:** Ready for reference
**Last Updated:** 2026-03-24
**Usage:** Reference during Phase 1 execution (2026-03-26 to 2026-04-02)
