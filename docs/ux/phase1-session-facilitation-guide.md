# Phase 1 Session Facilitation Guide

**Facilitator Role:** UX Researcher
**Session Duration:** 90 minutes
**Format:** Zoom video call
**Objective:** Validate renter journey usability with Arabic LLM templates

---

## Pre-Session (45 minutes before)

### Technical Setup (15 min before session)

1. **Zoom Room:**
   - [ ] Zoom link activated (private room, waiting room enabled)
   - [ ] Password set (send to participant)
   - [ ] Recording settings configured (audio + screen)
   - [ ] Screenshare permission enabled
   - [ ] Chat enabled for participant reference links

2. **Testing Environment:**
   - [ ] Browser tab 1: DCP marketplace (api.dcp.sa, pre-loaded)
   - [ ] Browser tab 2: Competitor reference (Vast.ai, open in incognito)
   - [ ] Browser tab 3: Session notes / tracking sheet
   - [ ] Notepad for live note-taking
   - [ ] Timer set (visible, for pacing)

3. **Audio/Video Check:**
   - [ ] Microphone working (test recording)
   - [ ] Webcam working (self-view)
   - [ ] Screen share tested
   - [ ] Headphones ready (to minimize echo)
   - [ ] Backup: Phone available if Zoom fails

4. **Participant Communication:**
   - [ ] Final reminder sent 15 min before (Zoom link + tech requirements)
   - [ ] Ready to accept participant 5 min early
   - [ ] Contact info handy if they're late

### Mental Preparation (10 min before)

- [ ] Review participant profile (pre-survey responses)
- [ ] Anticipate pain points from their background
- [ ] Note any special requirements (accessibility, language, timezone)
- [ ] Plan follow-up questions based on their role
- [ ] Take a breath — this is collaborative, not interrogation

### Session Setup (5 min before)

- [ ] Start recording (notify participant)
- [ ] Welcome participant to waiting room
- [ ] Tech check: "Can you hear me? See me? Good?"
- [ ] Consent confirmation: "I'll be recording audio and screen—are you still OK with that?"
- [ ] Any last-minute questions before we begin?

---

## SESSION PROTOCOL (90 MINUTES)

### PART 1: WARMUP (10 min) | 00:00-00:10

**Facilitator Goal:** Build rapport, understand their context, set expectations

**Opening Script:**
```
"Thanks for taking time today! I'm [Name], UX Researcher at DCP.
We're launching a GPU marketplace for Arabic LLMs, and I want to understand
your experience with the product. There are no right or wrong answers —
I'm testing the product, not you.

We'll spend 90 minutes together:
- Start with some background questions (10 min)
- Then you'll explore our marketplace and try a few tasks (75 min)
- Finally, I'll ask for your overall feedback (5 min)

Sound good? Let's start with some context about you."
```

**Questions to Ask (Choose based on their background):**

**For Saudi Enterprise Buyers:**
- "Tell me about your current tech stack. How do you handle GPU compute right now?"
- "What's your experience with platforms like Vast.ai or AWS?"
- "What are your top pain points with GPU inference today?"
- "How important is PDPL compliance in your infrastructure decisions?"
- *Listen for: compliance concerns, cost sensitivity, Arabic support needs*

**For Arabic NLP Developers:**
- "What Arabic NLP projects are you working on?"
- "Which Arabic models have you used before (ALLaM, JAIS, others)?"
- "What's your experience deploying ML models at scale?"
- "What bothers you most about existing GPU marketplaces?"
- *Listen for: model quality concerns, ease of deployment, cost awareness*

**For Western ML Engineers:**
- "What's your current stack for GPU compute?"
- "How familiar are you with Vast.ai / RunPod?"
- "What would a better GPU marketplace look like to you?"
- "Any experience with Arabic models or non-English workloads?"
- *Listen for: UX friction points, cost expectations, portability concerns*

**Facilitator Notes During Warmup:**
- Take light notes on their background
- Identify any pain points to validate later
- Gauge technical confidence level
- Note any language/communication preferences

**Transition:**
```
"Great, thanks for that context. Now I'm going to show you DCP,
and you'll walk through a few realistic tasks. Think of this as
if you're a new user visiting for the first time. I'll watch
and take notes, but I won't guide you unless you ask.
Ready to explore?"
```

---

### PART 2: COLD-START DISCOVERY (15 min) | 00:10-00:25

**Facilitator Goal:** Measure how quickly they find Arabic LLMs, observe their mental model

**Setup:**
- [ ] Share screen: DCP homepage (api.dcp.sa)
- [ ] Turn off any hints/tooltips that would give away navigation
- [ ] Have Vast.ai open in background for later comparison

**Task Description (Read verbatim):**
```
"Imagine you need to deploy an Arabic language model for production,
and you want something cost-effective. You're landing on DCP for the
first time.

Your task: Find a good option for deploying an Arabic LLM with budget awareness.
You can click around, search, filter—whatever feels natural.
Tell me what you're thinking as you go.

Let me know when you've found something you'd consider, or if you're stuck."
```

**Metrics to Capture:**
- [ ] **Time to discovery:** How long until they find an Arabic model?
  - <30 sec: Excellent (clear signaling)
  - 30-60 sec: Good (intuitive navigation)
  - 60-120 sec: OK (some friction)
  - >120 sec: Poor (buried / confusing)
- [ ] **Search vs. browse:** Do they use search bar or browse templates?
- [ ] **Models they considered:** Which ones did they look at?
- [ ] **Confidence level:** Do they seem sure about their choice?
- [ ] **Questions they ask:** What's unclear to them?
- [ ] **Hesitation points:** Where do they pause or click back?

**Facilitator Behavior During Discovery:**
- Observe silently (don't coach)
- Let them talk through their thinking
- If they're completely stuck after 2 min: "What are you looking for?" (open, not suggestive)
- If they ask direct questions: "What do you think?" (reflect back)
- Start timer audibly if it helps with awareness

**After Discovery Complete:**
```
"OK, you found [Model Name].
- How confident are you in this choice? (0-10)
- What made you choose this over others?
- Was the process clear, or did you have to hunt?"
```

**Facilitator Notes:**
- Model they chose: ________________
- Time to discovery: _________ seconds
- Confidence: ___/10
- Friction points: ________________________________

---

### PART 3: TEMPLATE EVALUATION (15 min) | 00:25-00:40

**Facilitator Goal:** Assess pricing clarity, competitive positioning, trust in cost advantage

**Setup:**
- [ ] Navigate to template catalog (or model card with template options)
- [ ] Have 3 templates ready to compare (e.g., ALLaM 7B on DCP vs. Vast.ai vs. AWS)

**Task Description:**
```
"Now let's say you're actually going to deploy this.
Here are three template options for the same model on different platforms:

1. [Show DCP option] — Cost: $X/hour, Features: [...]
2. [Show Vast.ai option] — Cost: $Y/hour, Features: [...]
3. [Show AWS option] — Cost: $Z/hour, Features: [...]

Take a moment to review them. Then tell me:
- Which would you choose and why?
- How clear is the pricing comparison?
- Do you trust these prices?"
```

**Metrics to Capture:**
- [ ] **Template comparison time:** How long to evaluate 3 options?
  - <2 min: Quick decision-maker
  - 2-5 min: Thorough review
  - >5 min: Thorough but possibly overwhelmed
- [ ] **Choice they make:** Which platform? Why?
- [ ] **Pricing clarity:** 1-10 scale
  - "How clear is the price difference between DCP and competitors?"
- [ ] **Competitive perception:** Do they understand cost advantage?
- [ ] **Trust level:** Do they believe the pricing data?
  - "Do these prices seem accurate to you?"
- [ ] **Friction areas:** Confusing features? Hidden costs? Unclear terms?

**Facilitator Notes:**
- Their choice: ________________________________
- Clarity score: ___/10
- Why they chose it: ____________________________
- Trust in pricing: [ ] Trusted [ ] Skeptical [ ] Confused

---

### PART 4: DEPLOY FLOW (20 min) | 00:40-01:00

**Facilitator Goal:** Test deploy UX, identify friction, measure completion rate

**Setup:**
- [ ] Navigate to template deployment page
- [ ] Ensure we DON'T complete payment (stop before final submit)
- [ ] Have template config ready but don't fill it

**Task Description:**
```
"Let's actually try to set this up.
I want you to configure the template for deployment—fill in settings,
choose specs, review the config.

Stop right before you'd submit payment (I don't want to charge you!).
Think out loud as you go — tell me what each step is asking,
whether it makes sense, if you're confident."
```

**Facilitate the Flow (Steps to Observe):**

**Step 1: GPU Selection**
- [ ] Do they understand the GPU tier options?
- [ ] Can they read the spec comparison?
- [ ] Is pricing visible at this point?
- *Observe:* Confusion on GPU names? Unclear VRAM differences? Price shock?

**Step 2: Configuration (Framework, Model, Endpoint)**
- [ ] Do they understand what each field means?
- [ ] Is the form clear / overwhelming?
- [ ] Do they know what parameters to set?
- *Observe:* Do they fill randomly? Ask for help? Feel confident?

**Step 3: Review & Confirm**
- [ ] Can they see what they've configured?
- [ ] Is pricing breakdown clear?
- [ ] Do they know how to monitor the job after launch?
- *Observe:* Do they double-check settings? Ask clarifying questions?

**Metrics to Capture:**
- [ ] **Completion rate:** Did they make it to final review? (Y/N)
- [ ] **Time per step:** [Step 1: __ min] [Step 2: __ min] [Step 3: __ min]
- [ ] **Errors encountered:** Validation errors? Unclear fields? Crashes?
- [ ] **Assistance needed:** Did they ask for help? How often?
- [ ] **Critical blockers:** What prevented progress (if any)?
- [ ] **Confidence at each step:** 1-10 rating after each major section
- [ ] **Clarity of pricing:** "Is the total cost clear at this point?"

**Facilitator Behavior:**
- Let them explore first
- If stuck for 1+ min: "What are you unsure about?"
- If they ask: "What would you expect this button to do?"
- Avoid saying: "Just click here" or "That's correct"
- If critical error: Note it, refresh if needed, move forward

**Facilitator Notes:**
- Completed deploy config: [ ] Yes [ ] No (stopped at step ___)
- Critical blockers: ______________________________
- Friction points: ________________________________
- Confidence level: ___/10

---

### PART 5: JOB MONITORING (10 min) | 01:00-01:10

**Facilitator Goal:** Test dashboard usability, understanding of cost/performance tradeoffs

**Setup:**
- [ ] Show a sample running job (mock or real if available)
- [ ] Ensure they can see: Job status, cost/hour, performance metrics, logs

**Task Description:**
```
"OK, let's say your job is now running on DCP.
Here's what you'd see in the dashboard.

Take a moment to look around:
- Can you tell if the job is healthy?
- What's it costing you per hour?
- Where would you go if something goes wrong?
- How would you stop the job if you wanted to?"
```

**Metrics to Capture:**
- [ ] **Job health interpretation:** Can they tell if job is OK? (Y/N)
- [ ] **Cost awareness:** Do they immediately see cost/hour? Understand it?
- [ ] **Dashboard usability:** 1-10 scale
  - "Is the information organized clearly?"
- [ ] **Key metric identification:**
  - Can they find: Status? Cost? Performance metrics? Logs?
  - *Count:* ___/4 located correctly
- [ ] **Error recovery understanding:** If job fails, would they know what to do?
- [ ] **Performance confidence:** "Would you trust the metrics on this dashboard?"

**Facilitator Notes:**
- Could identify job health: [ ] Yes [ ] No
- Noticed cost display: [ ] Immediately [ ] Had to search [ ] Didn't notice
- Dashboard clarity: ___/10
- Would know how to troubleshoot: [ ] Yes [ ] Somewhat [ ] No

---

### PART 6: SENTIMENT & NPS (10 min) | 01:10-01:20

**Facilitator Goal:** Capture overall sentiment, measure Net Promoter Score, identify advocates vs. critics

**Opening:**
```
"OK, we're almost done. Let me ask some wrap-up questions
about your overall impression."
```

**Questions (Read in order):**

1. **Overall Impression (1-10):**
   - "On a scale of 1-10, how would you rate your overall experience today?"
   - *Probe:* If <5: "What could make it better?" If 8-10: "What went well?"

2. **Net Promoter Score (0-10):**
   - "How likely are you to recommend DCP to a colleague?"
   - (0-10 scale, 9-10 = promoter, 7-8 = passive, 0-6 = detractor)

3. **Likelihood to Use (1-5):**
   - "If DCP were available today, how likely are you to actually use it?"
   - [ ] Very likely (would sign up this week)
   - [ ] Likely (would try it)
   - [ ] Neutral (would consider)
   - [ ] Unlikely (prefer existing platform)
   - [ ] Very unlikely (wouldn't use)

4. **Competitive Comparison:**
   - "How does DCP compare to Vast.ai / RunPod / AWS that you've used?"
   - Strengths: ____________________________
   - Weaknesses: ____________________________

5. **Pricing Perception (Revisited):**
   - "Do you believe DCP is actually 30-50% cheaper than competitors?"
   - [ ] Yes, credible
   - [ ] Mostly, but seems too good
   - [ ] Skeptical
   - [ ] Need to verify independently

6. **Arabic Model Advantage:**
   - "For your use case, how important was having Arabic models built-in?"
   - [ ] Critical differentiator
   - [ ] Nice to have
   - [ ] Neutral / not relevant
   - [ ] Didn't notice

7. **Would Recommend To:**
   - "Who would you recommend DCP to? (Use case / audience)"
   - _________________________________________

8. **Friction / Dealbreakers (Open):**
   - "If there was ONE thing holding you back from using DCP, what would it be?"
   - _________________________________________

**Facilitator Notes:**
- Overall rating: ___/10
- NPS score: _____ (0-10)
- Likelihood to use: [ ] Very [ ] Likely [ ] Neutral [ ] Unlikely [ ] No
- Top strength: _______________________________
- Top weakness: _______________________________

---

### PART 7: DEBRIEF & OPEN FEEDBACK (10 min) | 01:20-01:30

**Facilitator Goal:** Capture nuanced feedback, understand mental models, leave positive impression

**Opening:**
```
"Great! Last part—I want to give you space to share
anything else that stood out to you. These conversations
really shape our roadmap."
```

**Open-Ended Questions:**

1. **Feature Requests:**
   - "Is there anything you wished DCP had that it doesn't?"
   - "What would make this platform 10x better for your use case?"

2. **Confusion Points (Revisit):**
   - "Were there any moments where you felt confused or unsure?"
   - "What caused that?"

3. **Surprises:**
   - "Was there anything that surprised you (positively or negatively)?"

4. **Market Context:**
   - "Do you think there's real market demand for Arabic GPU models?"
   - "Who should DCP be targeting first?"

5. **Barriers to Adoption:**
   - "What would need to change for you to actually use DCP?"
   - "Is it pricing? Trust? Features? Something else?"

6. **Team Feedback:**
   - "Would you recommend this to your team? Why / why not?"

**Facilitator Notes:**
- Key quote 1: _________________________________
- Key quote 2: _________________________________
- Feature request: ______________________________
- Biggest barrier to adoption: __________________

**Closing Script:**
```
"Thank you so much for this. Your feedback is genuinely valuable—
it'll help us polish the experience before broader launch.

You'll receive $[X] USDC to your wallet and $[Y] DCP credit
within 24 hours. Any questions?"
```

---

## POST-SESSION (30 min after)

### Data Processing (Immediately)

1. **Recording & Transcript:**
   - [ ] Pause recording (Zoom auto-saves)
   - [ ] Export/download session recording (keep in secure folder)
   - [ ] Request auto-transcript from Zoom (or manually transcribe key sections)

2. **Session Data Entry:**
   - [ ] Transfer facilitator notes to master tracking sheet
   - [ ] Upload metrics: completion rates, times, NPS, clarity scores
   - [ ] Capture top 3 quotes from this session
   - [ ] Flag any critical issues found

3. **Participant Followup:**
   - [ ] Send thank-you email within 1 hour
   - [ ] Include incentive payment details (wallet address confirmation)
   - [ ] DCP platform credit issued
   - [ ] Offer option to review transcript before analysis

### Analysis Template (End of Testing Day)

After all sessions for the day, fill out:
- Daily summary: How many sessions? What's the pattern?
- Critical blockers spotted: List any showstoppers
- Quick wins: Easy UX fixes that came up multiple times?
- Persona insights: Any differences between Persona A, B, C?
- Confidence check: Is Phase 1 on track for launch?

---

## Tips for Facilitators

### Do ✅
- Be genuinely curious ("Tell me more about that")
- Normalize struggle ("This is helpful—I want to see where you get stuck")
- Give them silence ("Take your time, no rush")
- Validate emotions ("That's frustrating, I hear you")
- Ask follow-ups ("Why did you hesitate there?")

### Don't ❌
- Guide them ("Try clicking here")
- Defend the product ("Actually, it's easier than you think")
- Lead questions ("Did you find that confusing?" → "What was your experience?")
- Assume intent ("You chose that because...")
- Rush them ("We're running out of time")

### Emergency Exits
- **Zoom crashes:** Have phone number, call participant, reconnect
- **Participant forgets:** Check pre-session reminder, reschedule if needed
- **Participant gets stuck:** "Is there anything else you'd like to try?" (graceful exit)
- **Critical bug found:** Note it, move forward, don't dwell on it

---

## Session Checklist (Print for Each Session)

```
Participant: _________________ Persona: [ ] A [ ] B [ ] C
Session Time: _________________ Duration: ______ min

PRE-SESSION:
[ ] Tech check (mic, camera, screen share)
[ ] Consent confirmation recorded
[ ] Timer ready
[ ] DCP + competitor tabs open
[ ] Notes template loaded

SESSION EXECUTION:
[ ] Part 1 Warmup (10 min) — confidence level noted
[ ] Part 2 Discovery (15 min) — discovery time: ______ sec
[ ] Part 3 Evaluation (15 min) — pricing clarity: ____/10
[ ] Part 4 Deploy (20 min) — completed: [ ] Y [ ] N
[ ] Part 5 Monitoring (10 min) — usability: ____/10
[ ] Part 6 NPS (10 min) — NPS score: ____
[ ] Part 7 Debrief (10 min) — top quote captured

POST-SESSION:
[ ] Recording downloaded
[ ] Data entered into tracking sheet
[ ] Thank-you email sent
[ ] Incentive processed
[ ] Key insights noted for synthesis

CRITICAL ISSUES FOUND: [ ] Yes [ ] No
If yes: ________________________________________
```

---

**Facilitator:** Print this guide and use it as your script. Adapt as needed, but keep the structure and timing. Trust the process!

