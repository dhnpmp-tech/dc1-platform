# Phase 1 Real-Time Execution Guide — Live Recruitment Response Handler

**Purpose:** Quick reference for immediate actions when recruitment confirmations arrive or fallback is triggered
**Status:** Ready to execute
**Timeline:** Recruitment window is TODAY
**Owner:** UX Researcher (active monitoring)

---

## 🚨 FALLBACK TRIGGER: 18:00 UTC

**If no founder approval by 18:00 UTC:**

### IMMEDIATE ACTION (within 5 minutes):
1. [ ] Post to DCP-676: "Executing Path B (Public Outreach) per contingency plan"
2. [ ] Deploy PHASE1-SOCIAL-MEDIA-READY content across 5 channels:
   - Twitter: Post Tweet A (Arabic AI builders)
   - LinkedIn: Post A (Enterprise angle)
   - Reddit: r/MachineLearning comment
   - Hacker News: Ask HN post
   - Product Hunt: Comment on 2-3 recent posts

### MONITORING (ongoing):
3. [ ] Monitor Twitter/LinkedIn/Reddit responses every 30 minutes
4. [ ] Update tracker with any confirmations
5. [ ] Report confirmations back to DCP-676 in real-time

---

## 📝 WHEN PARTICIPANT CONFIRMATION ARRIVES

### Immediate Response (within 30 minutes of confirmation):

#### Step 1: Capture Info
```
From confirmation, collect:
- Participant name: [_____]
- Email: [_____]
- Persona type (A/B/C): [_____]
- Preferred session time: [_____]
- Preferred date (3/25 or 3/26): [_____]
- Source (warm lead / Twitter / LinkedIn / Reddit / etc): [_____]
```

#### Step 2: Update Tracker
- Add to `phase1-recruitment-tracker.md`
- Mark as "Confirmed"
- Assign session slot

#### Step 3: Send Confirmation Email
**Use this template:**

```
Subject: Phase 1 Session Confirmed — [Date] [Time] [Timezone]

Hi [Name],

Great! Your session is confirmed for [Date] [Time] [Timezone].

BEFORE YOUR SESSION (complete by [Date-3days]):

1. Sign Consent Form (5 min)
   File attached: phase1-consent-form.pdf
   Action: E-sign and return

2. Complete Pre-Session Survey (10 min)
   Link: [Survey link]
   Action: Complete by [Date-1day]

3. Test Your Setup (day of session)
   Zoom audio/video working
   Quiet environment
   30 min before session: test Zoom link

SESSION DETAILS:
- Zoom Link: [LINK]
- Date: [Full date + day]
- Time: [Time in their timezone]
- Duration: 90 minutes

WHAT WE'LL COVER:
- Your GPU experience (10 min)
- Template catalog discovery (15 min)
- Model selection & pricing (10 min)
- Deployment scenario (20 min)
- Monitoring & NPS (25 min)

YOUR INCENTIVE:
- $75-100 USDC (paid within 24 hours)
- $25-50 DCP credits (deposited same day)

Questions? Reply here or email [your email].

Looking forward to your feedback!
[Your name]
UX Researcher, DCP
```

#### Step 4: Post to DCP-676
```
Confirmation received: [Name]
- Persona: [A/B/C]
- Preferred slot: [3/25 or 3/26] [time]
- Source: [warm lead / Twitter / Reddit / etc]
- Status: Confirmation email sent, awaiting consent form signature

Running tally: [X]/5 confirmed
```

#### Step 5: Archive Confirmation
- Save email response
- Log timestamp
- Update tracker with confirmation date/time

---

## ⏰ IF CONFIRMATIONS ARRIVE SLOWLY

### At 15:00 UTC (if <2 confirmations):
1. [ ] Post follow-up message to DCP-676
2. [ ] Initiate additional outreach (if warm leads path)
3. [ ] Post follow-up tweets
4. [ ] Check Reddit threads for new replies

### At 17:00 UTC (if <3 confirmations):
1. [ ] Escalate to founder: "On pace for [X] confirmations, may need contingency"
2. [ ] Activate backup outreach channels
3. [ ] Extend to 4 sessions (3/25 + 3/26 + 4/1) if needed
4. [ ] Lower incentive offer to $50 USDC (if founder approves)

### At 20:00 UTC (if <3 confirmations):
1. [ ] Finalize with whatever confirmations arrived
2. [ ] Post to DCP-676: "Recruitment closed with [X] confirmations"
3. [ ] Prepare reduced scope (2-3 sessions vs target 5)
4. [ ] Proceed to scheduling phase

---

## 📅 CONFIRMATION SCHEDULING

### For Each Confirmed Participant:

1. **Send Zoom Link** (in confirmation email, but confirm again)
2. **Assign Session Slot:**
   - Persona A (Enterprise): Prefer morning KSA time (14:00 KSA = 08:00 UTC)
   - Persona B (Arabic AI): Prefer afternoon KSA (18:00 KSA = 12:00 UTC)
   - Persona C (Western ML): Prefer morning UTC (08:00 UTC)

3. **Available Slots:**
   - 3/25 08:00-09:30 UTC
   - 3/25 10:00-11:30 UTC
   - 3/25 12:00-13:30 UTC
   - 3/26 08:00-09:30 UTC

4. **Calendar Reminders:**
   - Send to participant: 3 days before, 1 day before, 1 hour before

---

## 🎬 DAY BEFORE SESSION (3/24 evening or 3/25 morning)

### For Each Confirmed Participant:

1. [ ] Confirm consent form signed
2. [ ] Confirm pre-session survey completed
3. [ ] Send final reminder with Zoom link
4. [ ] Confirm participant can still attend
5. [ ] Provide facilitator contact info (email/phone)
6. [ ] Brief note: "Excited to speak with you tomorrow!"

---

## 📊 REAL-TIME TRACKER UPDATE

**File:** `phase1-recruitment-tracker.md`

**Update whenever confirmation arrives:**

```markdown
### Participant [Name]
- Status: ✅ Confirmed
- Persona: [A/B/C]
- Session: [3/25 or 3/26], [08:00 / 10:00 / 12:00 UTC]
- Email: [email]
- Confirmation date: [date]
- Consent signed: [ ] (due 3 days before)
- Survey completed: [ ] (due day before)
- Session completed: [ ] (date TBD)
- Notes: [any special accommodations]
```

---

## 🎯 PHASE 1 FACILITATION (3/25-3/26)

### 10 Minutes Before Each Session:

1. [ ] Open Zoom link (test audio/video)
2. [ ] Have facilitation guide open
3. [ ] Have participant pre-session survey responses visible
4. [ ] Have product demo links ready (Vercel, template catalog)
5. [ ] Start recording (ensure participant consents first)

### During Session (90 minutes):

1. **Welcome & Setup (5 min)**
   - Consent confirmation
   - Recording start
   - Tech check

2. **Background Interview (10 min)**
   - Their GPU experience
   - Current workflows
   - Pain points

3. **Template Catalog (15 min)**
   - Browse templates
   - Find Arabic models
   - Evaluate descriptions

4. **Model Selection (10 min)**
   - Compare pricing
   - Assess value
   - Arabic language support

5. **Deployment Scenario (20 min)**
   - Walk through template
   - Explain deployment
   - Answer questions

6. **Monitoring & Performance (10 min)**
   - Show running job
   - Explain metrics
   - Cost tracking

7. **NPS & Closing (10 min)**
   - Net Promoter Score
   - Would recommend?
   - Final feedback

8. **Post-Session (5 min)**
   - Thank you
   - Incentive payment details
   - Collect wallet address (if needed)

### Immediately After Session:

1. [ ] Stop recording
2. [ ] Save recording to secure location
3. [ ] Log session notes:
   - Key findings
   - Blockers identified
   - NPS score
   - Persona insights
4. [ ] Update tracker: "Session completed [date/time]"
5. [ ] Start incentive payment process

---

## 💰 INCENTIVE PAYOUT

### After Each Session:

1. [ ] Get wallet address (from participant or pre-session form)
2. [ ] Initiate USDC transfer ($75-100)
   - Network: Polygon preferred (lower fees)
   - Timing: Within 24 hours
3. [ ] Deposit DCP credits ($25-50)
   - Account: [participant email]
   - Timing: Same day
4. [ ] Confirm receipt with participant
5. [ ] Document payment in tracker

---

## 📈 POST-SESSION DATA SYNTHESIS (3/27-3/28)

### After All Sessions Complete:

1. [ ] Compile all recordings + notes
2. [ ] Extract key quotes from each session
3. [ ] Score success metrics:
   - Discovery time (< 60 sec for Arabic models?)
   - Pricing clarity (% who understood cost advantage)
   - Deploy completion (% who finished unassisted)
   - Critical blockers (count)
   - NPS score (average)
   - Would recommend (%)

4. [ ] Use `phase1-data-analysis-template.md` to synthesize:
   - Executive summary
   - Quantitative results
   - Qualitative findings
   - Issue inventory
   - Persona patterns
   - Launch readiness scorecard

5. [ ] Draft recommendation:
   - GO (all metrics pass)
   - GO WITH FIXES (1-2 minor issues)
   - NO-GO (critical blockers)

6. [ ] Post recommendation to DCP-676

---

## 🆘 EMERGENCY CONTACTS

**If confirmation arrives via:**
- **Email:** Forward to [researcher email]
- **DM:** Post to DCP-676 immediately
- **Slack:** Screenshot + post to DCP-676
- **Twitter/LinkedIn:** Respond + post to DCP-676

**Founder signal if needed:** @founder in DCP-676 comment with urgent tag

---

## ✅ FINAL CHECKLIST

**Pre-Recruitment:**
- [ ] All materials prepared
- [ ] Zoom meetings created (4 slots)
- [ ] Confirmation email template ready
- [ ] Consent form ready to send
- [ ] Survey link ready
- [ ] Incentive payment method confirmed
- [ ] Tracker spreadsheet ready
- [ ] Facilitation guide reviewed
- [ ] Analysis template ready

**During-Recruitment:**
- [ ] Monitor DCP-676 continuously
- [ ] Track confirmations in real-time
- [ ] Send materials immediately upon confirmation
- [ ] Update tracker for each confirmation
- [ ] Monitor participant submissions (consent, survey)

**During-Sessions:**
- [ ] Facilitation guide open
- [ ] Recording enabled
- [ ] Zoom link working
- [ ] Notes being captured
- [ ] NPS score recorded

**Post-Sessions:**
- [ ] Recordings saved
- [ ] Incentive payments processed
- [ ] Session notes logged
- [ ] Data synthesis underway
- [ ] Go/no-go recommendation drafted

---

**Status:** Ready to execute
**Trigger:** Founder approval OR 14:00 UTC fallback
**Monitoring:** ACTIVE
**Deadline:** EOD TODAY 2026-03-24

**All systems go. Standing by for execution signal.**
