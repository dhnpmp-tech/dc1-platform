# Phase 1 UX Testing — Observation Template

## Overview
This document provides structured templates for capturing UX observations during Phase 1 user testing (2026-03-25 to 2026-03-28). Observers use these templates to record user behavior, hesitations, task completion, and feedback in real time.

---

## Per-Session Observation Form

### Header
```
Session ID: [auto-generated, e.g., P1-S-001]
Date: [YYYY-MM-DD]
Time: [HH:MM UTC]
Participant ID: [anonymized, e.g., P001]
Session Duration: [minutes]
Observer: [name]
Facilitator: [name]
Participant Language: English / Arabic / Bilingual
Device: Desktop / Mobile / Tablet
Browser: [Chrome/Safari/Firefox] v[version]
```

### Task 1: Provider Registration & Onboarding
**Goal:** New provider signs up and completes GPU benchmark.

#### Task Completion
- [ ] Completed successfully
- [ ] Partial completion (stopped at step: ___)
- [ ] Failed/abandoned (reason: ___)

#### Observation Notes
**What the user did:**
- First action taken: ___
- Unexpected navigation: ___
- Time spent: ___ minutes
- Backtracking observed: Yes / No (where: ___)

**Hesitations & Friction Points:**
- Paused at screen: [screenshot or description]
- Explicit question asked: ___
- Facial expression or verbal cue: "confused," "frustrated," "confident," etc.
- Hovered over UI element without clicking: [which element]

**Positive moments:**
- First click was correct: Yes / No
- Expressed confidence: Quote: ___
- Completed without assistance: Yes / No

#### Critical Issues (P0)
- [ ] Task blocking (user cannot proceed)
- [ ] Error message unclear or missing
- [ ] CTA button not found or non-functional
- [ ] Text unreadable or poorly translated

#### Open Questions
- "How would you describe what you just did?"
- "What confused you, if anything?"
- "Did the page layout match what you expected?"

---

### Task 2: Renter Dashboard & Model Browse
**Goal:** Renter signs up, browses available models, adds filters.

#### Task Completion
- [ ] Completed successfully
- [ ] Partial completion (stopped at step: ___)
- [ ] Failed/abandoned (reason: ___)

#### Observation Notes
**What the user did:**
- First action: browse models / apply filter / search / other
- Filter types used: GPU model / price range / region / Arabic-specific
- Models selected: [list]
- Time spent: ___ minutes

**Hesitations & Friction Points:**
- Difficulty finding filters: Yes / No
- Confusion about pricing display: Yes / No (describe)
- Arabic text rendering issues observed: Yes / No (describe)
- RTL navigation unexpected: Yes / No (describe)

**Language & Localization:**
- User switched language: English → Arabic / Arabic → English (when/why: ___)
- Arabic text appeared correct: Yes / No (describe any rendering issues)
- Dialect clarity: "Clear" / "Somewhat unclear" / "Unclear" (example: ___)
- User commented on translation: Quote: ___

#### Critical Issues (P0)
- [ ] Model catalog not loading
- [ ] Pricing not displaying
- [ ] Filters not responding
- [ ] Arabic text truncated or misaligned (RTL issue)

#### Open Questions
- "What did you look at first on this page?"
- "How would you find a cheaper GPU option?"
- "Did the pricing make sense to you?"
- (Arabic only) "Was the Arabic text easy to read?"

---

### Task 3: Model Deploy & Job Submission
**Goal:** Renter selects a model, configures parameters, submits a job.

#### Task Completion
- [ ] Completed successfully
- [ ] Partial completion (stopped at step: ___)
- [ ] Failed/abandoned (reason: ___)

#### Observation Notes
**What the user did:**
- Configuration options changed: [which ones]
- Parameter values selected: [RAM, VRAM, timeout, etc.]
- Time spent: ___ minutes
- Mistakes made: [describe]

**Hesitations & Friction Points:**
- Uncertain about parameter defaults: Yes / No
- Looked for help text or tooltips: Yes / No (found them: Yes / No)
- Clicked "Deploy" without understanding: Yes / No
- Concern about pricing: "Worried about cost" / "Confident about cost" / "Didn't think about it"

**Help-Seeking Behavior:**
- Asked clarifying question: ___
- Pointed at screen for guidance: [which element]
- Read error message: Yes / No (did they understand it: Yes / No)

#### Critical Issues (P0)
- [ ] Deploy button not found
- [ ] Parameter descriptions missing or unclear
- [ ] Price estimate not displayed
- [ ] Error on job submission

#### Open Questions
- "Before you clicked deploy, how much did you think this would cost?"
- "Did the parameter options make sense?"
- "What would you change about this page?"

---

### Task 4: Job Status & Results
**Goal:** Renter views running job, waits for completion, views results.

#### Task Completion
- [ ] Completed successfully (viewed results)
- [ ] Partial completion (viewed status but not results)
- [ ] Failed/abandoned (reason: ___)

#### Observation Notes
**What the user did:**
- Checked job status: every few seconds / after several minutes / once
- Behavior during wait: patient / anxious / left the page / other
- Time spent: ___ minutes
- Navigation to results: direct / searched / asked for help

**Hesitations & Friction Points:**
- Questioned why job was still running: Yes / No
- Looked for "estimated time remaining": Yes / No (found it: Yes / No)
- Confused by status labels: Yes / No (which labels: ___)
- Unexpected result format: Yes / No (describe)

**Confidence Level:**
- User confident results were correct: Yes / No
- User expressed concern about job quality: Quote: ___
- User knew how to interpret results: Yes / No

#### Critical Issues (P0)
- [ ] Status page not updating in real time
- [ ] Results not displaying
- [ ] Unclear whether job succeeded or failed

#### Open Questions
- "How did you know the job was complete?"
- "Did the results match what you expected?"
- "If you wanted to re-run this job, would you know how?"

---

## Post-Session Likert Scale Questions

Ask these immediately after the session (before participant leaves). Use 1–5 scale:
- **1** = Strongly Disagree
- **2** = Disagree
- **3** = Neutral
- **4** = Agree
- **5** = Strongly Agree

### Usability
1. The system was easy to navigate. [ 1 2 3 4 5 ]
2. I understood what each button does without asking. [ 1 2 3 4 5 ]
3. The pages loaded quickly and responsively. [ 1 2 3 4 5 ]
4. I would recommend this platform to a colleague. [ 1 2 3 4 5 ]

### Language & Localization
5. The English text was clear and professional. [ 1 2 3 4 5 ]
   (if Arabic session) The Arabic text was clear and professional. [ 1 2 3 4 5 ]
6. I understood the pricing information. [ 1 2 3 4 5 ]
7. The translations (English/Arabic) matched my expectations. [ 1 2 3 4 5 ]
8. Arabic text rendering (font, spacing, alignment) looked correct. [ 1 2 3 4 5 ]
   (Arabic session only)

### Task Completion
9. I was able to complete my goals without getting stuck. [ 1 2 3 4 5 ]
10. When I was confused, the interface helped me recover. [ 1 2 3 4 5 ]

### Open-Ended (Record Verbatim)
11. "What was the most confusing part of the experience?"
    Response: ___

12. "What worked really well?"
    Response: ___

13. "What would you change?"
    Response: ___

14. (Arabic session only) "How did the Arabic experience compare to what you expected?"
    Response: ___

---

## Arabic UX Rubric

For sessions conducted in Arabic or with bilingual participants, evaluate these dimensions:

### Text Rendering & Typography
- **Excellent (5):** Arabic fonts render clearly, consistent size, proper diacritics visible
- **Good (4):** Minor rendering inconsistencies, diacritics mostly visible
- **Neutral (3):** Readable but some minor font/spacing oddities
- **Poor (2):** Noticeable rendering issues, diacritics missing, hard to read
- **Critical (1):** Text unreadable, corrupted, or severely misaligned

### RTL Navigation & Layout
- **Excellent (5):** Buttons, forms, and navigation mirror perfectly for RTL, no confusion
- **Good (4):** RTL layout correct, one or two minor alignment quirks
- **Neutral (3):** RTL functional but layout feels slightly off
- **Poor (2):** RTL broken in multiple places, confusing navigation
- **Critical (1):** RTL completely broken, buttons misplaced, text overlapping

### Translation Quality & Dialect
- **Excellent (5):** Translation natural and culturally appropriate, dialect clear and accessible
- **Good (4):** Translation accurate, minor dialect variations, easily understood
- **Neutral (3):** Translation functional but slightly formal or awkward phrasing
- **Poor (2):** Awkward phrasing, possible mistranslations, confusing dialect
- **Critical (1):** Severe mistranslations, unintelligible dialect, offensive or inappropriate wording

### Localization Completeness
- **Excellent (5):** All UI strings translated, no untranslated English mixed in, appropriate currency/units
- **Good (4):** >95% of strings translated, one or two minor English remnants
- **Neutral (3):** ~90% translated, some English strings visible but not blocking
- **Poor (2):** <85% translated, noticeable English throughout
- **Critical (1):** Major UI strings untranslated, app appears incomplete

### Participant Confidence & Comfort
- **Excellent (5):** Participant is relaxed, confident in Arabic experience, made no language switches
- **Good (4):** Confident use, minor switches to English for technical terms
- **Neutral (3):** Adequate comfort, switches between Arabic/English several times
- **Poor (2):** Frequent language switching, visible frustration with Arabic experience
- **Critical (1):** Abandoned Arabic mid-session, strong preference for English

---

## Finding Classification Framework

### Severity Levels

**P0 (Critical — Stop-Ship Blocker)**
- Task cannot be completed
- Error prevents user from progressing
- Data loss or security issue
- Critical mistranslation or text corruption
- RTL layout completely broken
- Payment/pricing display incorrect

Examples:
- "Deploy button doesn't respond"
- "Model prices showing as [corrupted text]"
- "Arabic translation is offensive"

**P1 (High — Launch Concern)**
- Task completion requires workaround or excessive clicks
- User confusion visible but recoverable
- Performance noticeably poor
- Minor text rendering issues or awkward translations
- RTL layout slightly misaligned but functional
- Hesitation observed but user eventually succeeds

Examples:
- "User had to click 'Browse Models' twice to trigger navigation"
- "Arabic text slightly truncated in one field"
- "User paused for 30 seconds trying to find the filter button"

**P2 (Medium — Improve Next Release)**
- Workflow suboptimal but not blocking
- Minor UI polish issues
- Suggestion for improvement
- Cosmetic text or translation refinements
- Potential for higher conversion with minor tweaks

Examples:
- "Empty state illustration could better represent GPU compute"
- "Likert scale labels could be more concise"
- "Provider earnings example showed monthly, but user expected hourly"

**P3 (Low — Nice-to-Have)**
- Feedback on preference or future feature
- Not related to core tasks
- Accessibility suggestion
- Potential for future locales or regions

Examples:
- "Would like to see provider reviews"
- "Dark mode would be nice"

---

## Session Summary Template

Complete after all tasks and Likert questions are finished.

```
Session ID: [P1-S-001]
Participant: [P001] | Duration: [75 minutes]

Overall Task Completion: [X/4 tasks completed successfully]
Overall Usability Score: [average of Likert questions]
Language Session: English / Arabic
Device: [Desktop / Mobile]

Key Findings:
- [Most critical issue or positive highlight]
- [Second-most important observation]
- [Localization-specific finding if applicable]

P0 Blockers Found: [Yes / No]
If yes: [List and brief description]

P1 Issues Found: [number]
If >0: [List top 3]

Participant Quoted: [Most memorable quote or concern]

Recommendations for Design Changes:
1. [Priority 1: What should change immediately]
2. [Priority 2: What should change before launch]
3. [Priority 3: Nice-to-have for next sprint]

Follow-up Questions:
- [Any questions for participant via email]

Next Observer Note:
- [Watch for X in the next session]
```

---

## Data Analysis Framework (Post-Testing Synthesis)

After all sessions are complete, synthesize findings across participants:

### Aggregation
- Tally P0, P1, P2 issues by category (Navigation, Pricing, Localization, Performance, etc.)
- Calculate task completion rates by task
- Average Likert scores across all participants
- Identify patterns: "3 out of 5 participants paused at the filter button"

### Synthesis
- **What worked?** List features with 80%+ positive feedback
- **What failed?** List features with >1 P0 or >2 P1 issues
- **What confused people?** Group hesitations by theme
- **Localization health:** How did Arabic-only and bilingual participants fare?

### Recommendations
1. **Immediate fixes (P0):** List for emergency pre-launch deployment
2. **Must-fix before launch (P1):** List for final sprint if time permits
3. **Post-launch improvements (P2+):** Prioritize for Sprint 29 or Q2 2026

### Report Structure (Share with Product, Frontend, Copywriter, CEO)
```
Phase 1 UX Testing — Final Report
Date: [2026-03-29]
Participants: [N]
Tasks Tested: [4]
Overall Usability Score: [avg Likert]
Go/No-Go Recommendation: [GO / NO-GO / GO with conditions]

Critical Issues Found: [X]
Recommendations: [Prioritized list]
```

---

## Instructions for Observers

1. **Before Session:**
   - Review this template
   - Prepare note-taking setup (digital or printed)
   - Test audio/video recording if applicable
   - Familiarize yourself with the prototype

2. **During Session:**
   - Write observations in real time; do not rely on memory
   - Use specific descriptions ("User clicked X twice" vs. "User had trouble")
   - Note timing (e.g., "paused for 15 seconds before clicking")
   - Record exact quotes when participant speaks
   - Flag P0 blockers immediately (may affect subsequent tasks)

3. **After Session:**
   - Immediately complete Likert questions with participant
   - Within 1 hour, write Session Summary while details are fresh
   - Classify all issues as P0/P1/P2/P3
   - Flag any follow-up needed (e.g., "Clarify what 'frustrated' really meant")

4. **Confidentiality:**
   - Participant names are anonymized (P001, P002, etc.)
   - Store session recordings/notes per [data-governance-policy]
   - Share findings via [findings-repository] for analysis

---

## Tools & Resources

- **Note-taking:** Google Docs (shared template), Notion, or printed forms
- **Recording:** [OBS / Zoom / native browser recording] — only with participant consent
- **Findings repository:** [DCP/Phase1-UX-Findings] in [project-folder]
- **Slack channel for real-time coordination:** #phase1-ux-testing
- **Live synthesis meeting:** 2026-03-29 at 10:00 UTC (post-testing review)

---

## Sign-Off

**Prepared by:** UI/UX Specialist
**Date:** 2026-03-24
**Phase 1 Testing Window:** 2026-03-25 to 2026-03-28
**Ready for:** QA Engineer, UX Researcher, Product Manager
