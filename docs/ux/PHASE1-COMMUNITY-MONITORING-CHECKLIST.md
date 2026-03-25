# Phase 1 Community Monitoring Checklist

**Owner:** UX Researcher
**Frequency:** Daily (09:00-10:00 UTC)
**Timeline:** 2026-03-26 to 2026-04-02 (7 days)
**Channels:** Twitter/X, Discord, GitHub, Slack

---

## Daily Monitoring Checklist (09:00-10:00 UTC)

### Twitter/X Search Alerts
**Tools:** Twitter Search + IFTTT/Zapier (if configured)
**Keywords:** `#DCP`, `@dcp_ai`, `DCP GPU`, `GPU marketplace`

**Daily Tasks:**
- [ ] Search `#DCP` — capture new mentions, retweets, replies
- [ ] Search `@dcp_ai` — check direct mentions and conversations
- [ ] Search `"DCP GPU"` or `"dc1-platform"` — find broader mentions
- [ ] Check trending lists if #DCP in top 100 trends
- [ ] Document sentiment (positive/negative/neutral)
- [ ] Identify user pain points or feature requests
- [ ] Note competitor comparisons (Vast.ai, RunPod, Akash mentions)

**Logging Format:**
```
## Twitter/X Daily Summary (2026-03-26)

**Mentions:** 4
- Positive: 3 (deployments working, price praise)
- Neutral: 1 (technical question about model size)
- Negative: 0

**Key Quotes:**
- "DCP is 40% cheaper than Vast.ai for my workload" (@user1)
- "Deployed Llama 3.8B in 2 minutes, impressed" (@user2)

**Issues Raised:**
- Model selection UI unclear (1 mention)

**Competitor Mentions:**
- Vast.ai: 1 comparison (favorable to DCP)
```

### Discord #feedback Channel
**Server:** DCP Community Discord (if exists) or Slack #feedback

**Daily Tasks:**
- [ ] Read new messages in #feedback channel (last 24h)
- [ ] Categorize by type (bug report, feature request, praise, complaint)
- [ ] Respond to urgent questions or escalate
- [ ] Document patterns (recurring issues, popular features)
- [ ] Note user sentiment and NPS proxies

**Logging Format:**
```
## Discord #feedback Daily Summary (2026-03-26)

**New Messages:** 12
**Responders:** 3 users

**By Category:**
- Feature requests: 5 (batch jobs 3x, scheduled inference 2x)
- Bug reports: 2 (slow inference on H100, webhook timeout)
- Praise: 3 (fast support, good pricing)
- Questions: 2 (API documentation, pricing tiers)

**Action Items:**
- Escalate H100 slow inference to QA + ML Infra
- Create FAQ for batch jobs feature request
```

### GitHub Issues
**Repo:** dhnpmp-tech/dc1-platform

**Daily Tasks:**
- [ ] Check for new issues with label `phase1` or `user-report`
- [ ] Scan recent issues for user feedback (created in last 24h)
- [ ] Identify duplicate issues or patterns
- [ ] Note feature requests tagged as `enhancement`
- [ ] Check GitHub Discussions for user conversations

**Logging Format:**
```
## GitHub Issues Daily Summary (2026-03-26)

**New Issues:** 3
- DCP-XXX: Model serving timeout (user report)
- DCP-YYY: Request batch job support (enhancement)
- DCP-ZZZ: Question about token counting

**Patterns:**
- Inference latency concerns: 2 reports
- Model selection clarity: 1 report

**Action Items:**
- Link to existing performance investigation
- Create enhancement issue for batch jobs
```

### Slack #dcp-phase1-support
**Channel:** Internal team channel for Phase 1 coordination

**Daily Tasks:**
- [ ] Review all messages from QA + Support teams
- [ ] Flag critical issues for escalation
- [ ] Post daily community summary
- [ ] Respond to team questions about user feedback

---

## Weekly Sentiment Analysis (Due 2026-04-02)

### Metrics to Track
1. **NPS Proxy** — Estimate from community tone
   - Positive sentiment %: ___
   - Neutral sentiment %: ___
   - Negative sentiment %: ___

2. **Feature Request Heatmap** — Top 5 requests by frequency
   - Rank 1: _______________ (mentions)
   - Rank 2: _______________ (mentions)
   - Rank 3: _______________ (mentions)
   - Rank 4: _______________ (mentions)
   - Rank 5: _______________ (mentions)

3. **Issue Categories** — By volume
   - Performance/latency: ___ reports
   - UX confusion: ___ reports
   - Feature requests: ___ reports
   - Pricing questions: ___ reports
   - Other: ___ reports

4. **Competitor Mentions** — Comparison data
   - Vast.ai: ___ mentions (positive/negative)
   - RunPod: ___ mentions (positive/negative)
   - Akash: ___ mentions (positive/negative)
   - Others: ___ mentions

---

## Escalation Criteria

**Escalate Immediately (15-min SLA):**
- [ ] Critical bug report (model not deploying, payment issue)
- [ ] Security concern (API key exposed, data leak)
- [ ] Service outage report (API unresponsive, 502 errors)
- [ ] Negative press or major influencer complaint

**Escalate Within 1 Hour:**
- [ ] Multiple users reporting same bug
- [ ] High-volume feature request (3+ users in single day)
- [ ] Competitor comparison with unfavorable feedback
- [ ] Regulatory or compliance question

**Log for Review (daily summary):**
- [ ] General feature requests
- [ ] Pricing questions
- [ ] Documentation gaps
- [ ] Positive feedback and testimonials

---

## Monitoring Checklist

### Daily Monitoring Tasks
```
## Daily Checklist Template

Date: [2026-03-XX]
Monitoring Start: 09:00 UTC
Monitoring End: 10:00 UTC

### Twitter/X
- [ ] Searched #DCP (X mentions found)
- [ ] Searched @dcp_ai (X mentions found)
- [ ] Checked competitor mentions
- [ ] Documented sentiment
- [ ] Posted summary to #dcp-phase1-support

### Discord #feedback
- [ ] Reviewed last 24h messages
- [ ] Categorized by type
- [ ] Responded to urgent items
- [ ] Posted summary to #dcp-phase1-support

### GitHub Issues
- [ ] Checked for new phase1 issues
- [ ] Reviewed user discussions
- [ ] Documented patterns
- [ ] Posted summary to #dcp-phase1-support

### Critical Issues Found
- [ ] None
- [ ] Yes (escalated to [team])

### Monitoring Tools Status
- [ ] Twitter API working
- [ ] Discord access confirmed
- [ ] GitHub access confirmed
- [ ] All systems operational

### Time Spent
- Total monitoring time: ___ minutes
- Issues escalated: ___
- Summary posted: [link to #dcp-phase1-support message]
```

---

## Tools & Credentials

**Required Access:**
- [ ] Twitter/X API key (for automated tracking if using IFTTT)
- [ ] Discord account + #feedback channel access
- [ ] GitHub account + dc1-platform repo read access
- [ ] Slack access to #dcp-phase1-support channel
- [ ] Paperclip account for logging findings

**Recommended Tools:**
- Twitter Advanced Search: https://twitter.com/search-advanced
- Discord channel history export (if needed)
- GitHub issue filter by label
- Slack search API (for automation)

---

## Success Metrics

- ✅ Daily monitoring completed for all 7 days
- ✅ Zero critical issues missed
- ✅ Feature requests documented and prioritized
- ✅ Sentiment analysis completed by 2026-04-02
- ✅ Weekly insights report delivered
- ✅ Team kept informed via daily #dcp-phase1-support updates

