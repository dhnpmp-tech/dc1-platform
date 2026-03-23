# Phase 1 Testing Logistics Checklist

**For:** UX Researcher (Facilitator)
**Timeline:** When participant confirmations arrive (target: EOD 3/24) through testing execution (3/25-3/26)
**Objective:** Ensure all logistics are locked in before first testing session

---

## Upon Receiving Participant Confirmations (EOD 3/24)

### Step 1: Confirm Final Headcount (15 min)
- [ ] Count confirmed participants: _____ (target: 5-8)
- [ ] By persona:
  - [ ] Persona A (Saudi Enterprise): _____ (target: 2-3)
  - [ ] Persona B (Arabic NLP Dev): _____ (target: 2-3)
  - [ ] Persona C (Western ML Eng): _____ (target: 1-2)
- [ ] Any cancellations or no-shows? _____ (note: activate backups if >0)

**Decision Point:** Do we have 4+ confirmed?
- ✅ YES → Continue to Step 2
- ❌ NO → Escalate to UX Researcher (myself) and evaluate MVP vs. defer option

---

## Step 2: Finalize Session Schedule (30 min)

### Create Zoom Sessions
- [ ] Access Zoom account (verify recording permissions enabled)
- [ ] Create 6-8 private Zoom meeting links
- [ ] Set each meeting to:
  - [ ] Waiting room enabled (security)
  - [ ] Recording automatic (audio + screen)
  - [ ] Password protected (share only with participants)
  - [ ] Participant limit: 2 (facilitator + participant)

### Lock Session Times
- [ ] Final session schedule created:
  - [ ] 3/25 08:00-09:30 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] 3/25 09:30-11:00 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] 3/25 12:00-13:30 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] 3/25 13:30-15:00 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] 3/26 08:00-09:30 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] 3/26 09:30-11:00 UTC — Participant: __________ (Persona: __) — Zoom: [link]
  - [ ] [Additional sessions if >6 confirmed]

---

## Step 3: Send Participant Materials (3 Days Before First Session)

### Consent Form Package
- [ ] Send email to each participant with:
  - [ ] Consent form link (read + electronically sign)
  - [ ] Pre-session survey link (28 questions, ~10 min)
  - [ ] Session confirmation (time + timezone conversion)
  - [ ] Tech requirements (mic, camera, 10+ Mbps)
  - [ ] Deadline: 3 days before their session

### Email Template
```
Subject: Confirm Receipt: Phase 1 Testing Session [Date] [Time]

Hi [Name],

Thanks for confirming! Here's what you need to do before your session.

**Your Session:**
- Date: [Date], [Time] UTC (= [Local time] your local time)
- Duration: 90 minutes
- Zoom: [Link will be sent 24h before]

**Action Items (Due [3 Days Before]):**
1. Sign consent form: [Link]
2. Take pre-session survey: [Link]
3. Verify tech: Working mic + camera + internet 10+ Mbps

We'll send a reminder 24h before your session.

Looking forward to your feedback!
[UX Researcher]
```

---

## Step 4: Prepare Testing Environment (2 Days Before)

### Local Setup
- [ ] Clean desk workspace ready for 90-min sessions
- [ ] Microphone tested (backup headphones ready)
- [ ] Webcam tested (good lighting confirmed)
- [ ] Screen recording software tested (Zoom auto-record backup)
- [ ] Session notes template prepared
- [ ] Timer for 90-min protocol ready
- [ ] Session facilitation guide printed or accessible

### Production Environment
- [ ] Test api.dcp.sa is responding (test all 3 endpoints):
  - [ ] `GET /api/templates` → 200 OK, 20+ templates
  - [ ] `GET /api/models` → 200 OK, 11 models with pricing
  - [ ] `GET /api/models/{model_id}` → 200 OK for sample model
- [ ] Competitor reference (Vast.ai) opened in incognito tab
- [ ] DCP marketplace URL bookmarked + ready to share screen

### Participant Communication
- [ ] Confirm all participants have signed consent form
- [ ] Confirm all participants have completed pre-session survey
- [ ] Send 24-hour reminder emails (time zone conversion included)

---

## Step 5: Day-of Session Setup (Morning of Test)

### 30 Minutes Before Each Session
- [ ] Personal prep:
  - [ ] Water nearby
  - [ ] Bathroom break taken
  - [ ] Mental reset (take a breath)
  - [ ] Review: Participant's pre-session survey + persona notes

- [ ] Technical setup:
  - [ ] Zoom link open + ready
  - [ ] Facilitator guide open to correct session script
  - [ ] Session notes template loaded
  - [ ] api.dcp.sa + Vast.ai browser tabs ready
  - [ ] Recording settings verified (Zoom will auto-record)

- [ ] Participant communication:
  - [ ] Send Zoom link (30 min before start)
  - [ ] Note: "See you soon! Meeting opens 5 min early for tech check."

### Session Execution
- [ ] Follow: `docs/ux/phase1-session-facilitation-guide.md` (exact protocol)
- [ ] Time each section (90-min total):
  - [ ] Part 1: Warmup (10 min) ✓
  - [ ] Part 2: Discovery (15 min) ✓
  - [ ] Part 3: Evaluation (15 min) ✓
  - [ ] Part 4: Deploy (20 min) ✓
  - [ ] Part 5: Monitoring (10 min) ✓
  - [ ] Part 6: NPS (10 min) ✓
  - [ ] Part 7: Debrief (10 min) ✓

- [ ] Capture data:
  - [ ] Recording started (Zoom)
  - [ ] Session notes taken (discovery time, friction points, NPS)
  - [ ] Top quotes captured (3+ per session)

### Post-Session (Within 1 hour)
- [ ] Download recording from Zoom
- [ ] Save with naming: `phase1_session_{ParticipantID}_{Date}_{Time}.mp4`
- [ ] Send thank-you email:
  ```
  Thanks for participating! Your $[X] USDC is being processed
  to your wallet. DCP credit issued today.

  Your feedback will shape Phase 1 launch. Appreciate you!
  ```
- [ ] Update session data sheet with metrics:
  - [ ] Discovery time: _____ seconds
  - [ ] Deploy completion: [ ] Yes [ ] No
  - [ ] NPS score: _____
  - [ ] Friction points: _______________
  - [ ] Top quote: _______________

---

## Contingencies During Testing

### If Session Starts Late (Participant No-Show)
- [ ] Wait 10 minutes (time zone confusion possible)
- [ ] Send Zoom link reminder via email + SMS if available
- [ ] If still no-show after 15 min: Cancel, mark as no-show, contact recruiter for backup
- [ ] Document reason for absence

### If Technical Issue (API Down, Zoom Crash)
- [ ] Pause session, notify participant
- [ ] Attempt recovery (reconnect Zoom, refresh api.dcp.sa)
- [ ] If unfixable: Reschedule same day if possible, provide full compensation regardless
- [ ] Document issue + timing for final report

### If Participant Gets Stuck (During Deploy Flow)
- [ ] Let them struggle for 1-2 min (important to see friction)
- [ ] If asked directly: "What would you try next?"
- [ ] Only guide if critical blocker prevents continuation
- [ ] Document the blocker exactly

---

## Step 6: Post-Testing Synthesis (3/27)

### Data Aggregation
- [ ] All 6-8 session recordings downloaded
- [ ] All session notes compiled
- [ ] Metrics extracted to data sheet:
  - [ ] Discovery times → calculate average
  - [ ] Deploy completion rate
  - [ ] NPS scores → calculate average
  - [ ] Critical blockers → list & categorize
  - [ ] Quotes → top 15-20 extracted

### Analysis
- [ ] Open: `docs/ux/phase1-data-analysis-template.md`
- [ ] Fill in all sections:
  - [ ] Executive summary (recommendation)
  - [ ] Quantitative results (success metric scorecard)
  - [ ] 5 key findings (discovery, pricing, deploy, trust, NPS)
  - [ ] Issue inventory (critical → low priority)
  - [ ] Persona-specific insights
  - [ ] Launch readiness assessment

### Synthesis
- [ ] Final recommendation drafted:
  - [ ] GO? (all metrics pass, <3 critical issues)
  - [ ] GO WITH FIXES? (1-2 critical issues fixable in 1 week)
  - [ ] NO-GO? (>2 critical issues or NPS <5)

---

## Step 7: Founder Briefing (3/28)

### Prepare Briefing Package
- [ ] Executive summary (1 page)
- [ ] Key findings (2-3 pages)
- [ ] Issue inventory with recommendations
- [ ] Final go/no-go recommendation with rationale

### Communication
- [ ] Schedule founder briefing call/meeting
- [ ] Present findings + recommendation
- [ ] Answer founder questions
- [ ] Get approval for next steps (launch, fixes, defer)

---

## Success Checklist (For Me, the Facilitator)

### Before Testing Starts
- [ ] ✅ All 6-8 participants confirmed (or 4+ for MVP)
- [ ] ✅ All consent forms signed
- [ ] ✅ All pre-session surveys completed
- [ ] ✅ All Zoom links created + tested
- [ ] ✅ All emails sent with session details
- [ ] ✅ Production environment verified stable
- [ ] ✅ Facilitation guide ready

### During Testing (3/25-3/26)
- [ ] ✅ All sessions run on time
- [ ] ✅ All recordings captured
- [ ] ✅ All session notes taken
- [ ] ✅ No critical technical issues prevent data collection
- [ ] ✅ All participants complete 90-min protocol
- [ ] ✅ Compensation processed same day

### After Testing (3/27)
- [ ] ✅ All data aggregated into analysis template
- [ ] ✅ All metrics calculated
- [ ] ✅ All findings written
- [ ] ✅ Final recommendation drafted

### By 3/28 EOD
- [ ] ✅ Founder briefed with clear go/no-go recommendation
- [ ] ✅ Next steps decided (launch / fixes / defer)

---

## Key Metrics to Hit

| Metric | Target | Status |
|--------|--------|--------|
| Recruitment confirmation rate | 5-8 participants | [Recruiter's job] |
| Participant show-up rate | >90% (max 1 no-show) | |
| Session completion rate | 100% (all 90 min) | |
| Recording success rate | 100% (all 6-8 recorded) | |
| Data quality | Complete notes + NPS for all | |
| Analysis completeness | All sections filled in template | |
| Timeline adherence | Report by EOD 3/28 | |

---

## Timeline (My Perspective as Facilitator)

```
3/24 EOD: Recruitment complete → 5-8 confirmed
   ↓ (20 min - Zoom setup)
3/24 evening: Session schedule finalized + participant emails sent
   ↓ (overnight)
3/25 morning: Consent forms + surveys should be in (ideally)
   ↓ (24h before testing)
3/25 morning: Send reminder emails
   ↓ (start time)
3/25 08:00-15:00 UTC: Run first batch of testing sessions
   ↓ (overnight)
3/26 08:00-11:00 UTC: Run final sessions
   ↓ (4 hours for data aggregation)
3/27 morning: Begin data synthesis & analysis
   ↓ (full day analysis)
3/27 EOD: Analysis complete, recommendation drafted
   ↓ (overnight)
3/28 morning: Brief founder with findings + recommendation
   ↓
3/28 EOD: Phase 1 GO/NO-GO decision made
```

---

**I'm ready.** Once recruitment delivers confirmed participants, this checklist ensures flawless execution.

Testing window: 3/25-3/26. Analysis window: 3/27. Decision window: 3/28.

The infrastructure is in place. Let's validate renter feedback and make the launch decision with confidence.

