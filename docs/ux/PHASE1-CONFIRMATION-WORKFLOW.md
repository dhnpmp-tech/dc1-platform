# Phase 1 Confirmation Response Workflow (Real-Time)

**When:** Someone confirms interest via Twitter, email, Hacker News, Discord, or cold email
**Response Time:** < 15 minutes target (< 1 hour maximum)
**Your Actions:** Follow this workflow step-by-step

---

## STEP 1: CONFIRM RECEIPT (< 5 minutes)

Reply with **enthusiastic confirmation** using channel-native format:

### Twitter/X Reply
```
🎉 You're in! Here's what's next:

📅 Session: 90 min on 3/25 or 3/26 (pick your timezone)
💰 Incentive: $75-100 USDC + $25 DCP credit
🔗 Calendar: [Calendly link]

Check your DMs for full details.
```

### Email Reply
```
Subject: RE: Phase 1 testing — You're confirmed! 🎉

Hi [Name],

Amazing! You're confirmed for Phase 1 user testing of our Arabic GPU marketplace.

Here's what's next:

📅 **Pick Your Session**
[Calendly link with 3 time options per persona]

The next steps will be sent as soon as you select your time.

Questions? Reply here.

Looking forward to it!
```

### Discord/Slack DM
```
🎉 You're in! Here's what's next:

📅 Session: 90 min on 3/25 or 3/26
💰 $75-100 USDC + $25 DCP credit incentive
🔗 [Calendly link]

Once you pick your time, I'll send full details + consent form.
```

---

## STEP 2: COLLECT SESSION PREFERENCE (< 30 minutes)

Once they confirm interest, you need **date + time** + **timezone**:

### Option A: Calendly Booking (Automated)
- Use shared Calendly with pre-set 3 slots per persona:
  - Persona A: 3/25, 08:00-09:30 UTC (or 14:00-15:30 KSA)
  - Persona B: 3/25, 12:00-13:30 UTC
  - Persona C: 3/26, 08:00-09:30 UTC
- When they book, Calendly auto-sends confirmation

### Option B: Manual Confirmation (If no Calendly access)
Ask in reply: "Which session works best for you?"
```
Option 1: Tuesday 3/25, 08:00-09:30 UTC (2pm KSA time)
Option 2: Tuesday 3/25, 12:00-13:30 UTC
Option 3: Wednesday 3/26, 08:00-09:30 UTC

Your timezone: [___________]

Reply here or DM me!
```

---

## STEP 3: SEND CONFIRMATION PACKAGE (< 1 hour of session booking)

Once they've booked via Calendly or replied with preference, send this email:

### Email Template: Confirmation + Materials

```
Subject: Confirmed! Your session: [Date & Time in their timezone]

Hi [Name],

You're all set! Here's everything you need:

📅 **SESSION DETAILS**
Date: [Day, Date]
Time: [HH:MM-HH:MM UTC] = [Local time in their timezone]
Platform: Zoom (link below)
Duration: 90 minutes

🔗 **ZOOM LINK** (password protected)
[Unique zoom link for this session]
Password: [password]

Please test your mic/camera 24 hours before the session.

---

📋 **WHAT WE'LL DO**
1. 5 min: Welcome + tech check
2. 20 min: Explore Arabic LLM templates in the marketplace
3. 30 min: Deploy an inference server (hands-on)
4. 20 min: Cost comparison — us vs Vast.ai/RunPod
5. 15 min: Your feedback + wrap-up

---

📝 **BEFORE YOUR SESSION**

**By [Day+1]:**
1. Review & sign consent form (recording permission + data use)
   [Link to consent form]

2. Fill out 5-min pre-session survey (about you + your experience)
   [Link to pre-session survey]

3. Reply with Polygon wallet address (for USDC payment post-session)
   Format: 0x... (MetaMask, Phantom, or any Polygon wallet)

---

💰 **COMPENSATION**
$75-100 USDC + $25 DCP credit
(Will be sent to your wallet address within 24 hours of session end)

---

❓ **QUESTIONS?**
Reply to this email or DM me. I'm here to help.

Looking forward to meeting you!

[Your name]
UX Researcher, DCP Team
```

---

## STEP 4: TRACK IN RECRUITMENT TRACKER (< 15 minutes)

Update `/docs/ux/phase1-recruitment-tracker.md`:

For each confirmed participant:
1. **Mark status:** 🟢 Confirmed (instead of 🔴 Not yet contacted)
2. **Fill in details:**
   - Name: [confirmed name]
   - Title: [job title / "Independent" / "Founder"]
   - Organization: [company or "Self"]
   - Email: [confirmed email]
   - Session: [3/25 or 3/26, HH:MM-HH:MM UTC]
   - Timezone: [their timezone]
   - Source: [Twitter/Email/HN/Discord/LinkedIn/Cold Email]

**Example:**
```
#### Participant A1
- Status: 🟢 Confirmed
- Name: Sarah Al-Rashid
- Title: CTO
- Organization: LegalTech Saudi
- Email: sarah@legaltech.sa
- Session: 3/25, 08:00-09:30 UTC (14:00-15:30 KSA)
- Confirmed: Yes ✅
- Source: Cold email
```

---

## STEP 5: MONITOR FOR SURVEY COMPLETION (24-48h after confirmation)

**By 3/25 at 08:00 UTC:**
- [ ] Consent form signed
- [ ] Pre-session survey completed
- [ ] Wallet address collected
- [ ] Zoom link tested

If not complete 24h before session:
- Send reminder email
- Include links again
- Ask if they need help

---

## STEP 6: FINAL SESSION PREP (24h before each session)

### 24 Hours Before:
- [ ] Send final reminder with:
  - Zoom link
  - Time in their timezone
  - Technical requirements (mic, camera, internet 10+ Mbps)
  - "See you soon!"

### 30 Minutes Before:
- [ ] Log into Zoom early
- [ ] Test audio/video
- [ ] Check screen sharing works
- [ ] Confirm presenter notes + templates loaded
- [ ] Have consent form + survey responses pulled up for reference

### 5 Minutes Before:
- [ ] Admit participant to waiting room
- [ ] Greet warmly: "Hi [Name]! Welcome. Let me do a quick tech check..."
- [ ] Tech check (2 min): Mic working? Camera good? Can you hear me?
- [ ] Start recording (with verbal consent)

---

## RESPONSE TIME TARGETS

| Action | Target | Max |
|--------|--------|-----|
| Initial confirmation reply | < 5 min | 15 min |
| Session preference collected | < 30 min | 1 hour |
| Full materials sent | < 1 hour | 2 hours |
| Tracker updated | < 15 min | 30 min |
| Follow-up for missing docs | 24h before | 36h before |
| Final reminder | 24h before | 12h before |

---

## IF SOMEONE CANCELS

**Any time before session:**

1. **Don't panic.** Immediately reach out to cold email list or community posts.
2. **Offer to reschedule:** "I completely understand. Would you be available on [alternative date]?"
3. **If they can't reschedule:** Mark as 🔴 Cancelled, note reason
4. **Recruit replacement:** Post urgent message to Discord/Twitter/email (whichever channel worked)

**Message:**
```
Quick opening for Arabic GPU marketplace user research:
- 90 min session, [date/time UTC]
- $75-100 USDC incentive
- Interested? [Calendar link]
```

---

**Status:** Ready for real-time deployment
**Expected First Confirmation:** 08:00-12:00 UTC (social media blitz window)
**Response Template:** Above (copy-paste, customize name + time)
**Tracking:** `/docs/ux/phase1-recruitment-tracker.md`

**GO: All systems ready for instant response workflow.**
