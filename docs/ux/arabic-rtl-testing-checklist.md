# Arabic RTL UI Testing Checklist

**Purpose:** Verify Arabic UI correctness across all components, layouts, and user flows.

**Scope:** All pages and components in the DCP marketplace that support Arabic language.

**Test Environment:**
- Browser: Chrome (latest), Firefox (latest), Safari (latest)
- Viewports: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- Language setting: Arabic (ar-SA)

---

## 1. Text Direction & Bidi Markup

### Test 1.1: Page-level RTL declaration
- **How to test:** View page source; check `<html dir="rtl">` or `<html lang="ar">`
- **What to check:**
  - [ ] Root `<html>` element has `dir="rtl"` attribute
  - [ ] `lang="ar"` or `lang="ar-SA"` is set
  - [ ] Body text flows right-to-left
- **PASS:** All Arabic text flows RTL, page scrollbar on left
- **FAIL:** Mixed text directions, scrollbar on right, text baseline off

### Test 1.2: Component-level direction scoping
- **How to test:** Inspect English model names, code snippets, URLs within Arabic pages
- **What to check:**
  - [ ] English text within Arabic page uses `dir="ltr"` wrapper
  - [ ] Code blocks use `<pre dir="ltr">` or `<code dir="ltr">`
  - [ ] URLs and alphanumeric IDs render correctly without reversal
- **PASS:** English fragments render left-to-right, Arabic text RTL, no character reversal
- **FAIL:** English text reversed or overlapped, code unreadable

### Test 1.3: Mixed Arabic-English content (headers, form labels)
- **How to test:** Navigate to pages with mixed-language content (e.g., "إطلق ALLaM-7B" or "تكلفة المعالجة: $0.50/hour")
- **What to check:**
  - [ ] Currency symbols ($ / SAR) position correctly
  - [ ] Model names (e.g., ALLaM, Nemotron) don't reverse
  - [ ] Punctuation (commas, periods) appears in correct position relative to text
- **PASS:** Mixed content readable, symbols in logical position
- **FAIL:** Symbols reversed, words mangled, punctuation misaligned

---

## 2. Layout Mirroring & Component Alignment

### Test 2.1: Navigation sidebar
- **How to test:** Log in to marketplace; check sidebar position
- **What to check:**
  - [ ] Sidebar positioned on RIGHT side of screen (not left)
  - [ ] Logo/branding is right-aligned
  - [ ] Navigation items (Dashboard, Models, Providers, Settings) right-aligned
  - [ ] Icons positioned to the LEFT of text (icon → text order is reversed in RTL)
- **PASS:** Sidebar on right, all items right-aligned, icons on left of labels
- **FAIL:** Sidebar on left, left-aligned content, icons on right of text

### Test 2.2: Back buttons & breadcrumbs
- **How to test:** Navigate through multiple pages (e.g., Dashboard → Model List → Model Detail)
- **What to check:**
  - [ ] Back arrow/button points RIGHT (← is now →)
  - [ ] Breadcrumb flows right-to-left (Home > Models > ALLaM-7B becomes ALLaM-7B < Models < Home)
  - [ ] Chevrons in breadcrumb point left (< instead of >)
- **PASS:** Arrows/chevrons point in RTL direction, breadcrumb order reversed
- **FAIL:** Arrows point LTR direction, breadcrumb reads left-to-right

### Test 2.3: Forms & input fields
- **How to test:** Open any form (model search, provider registration, job submission)
- **What to check:**
  - [ ] Input fields are right-aligned
  - [ ] Labels are positioned above or to the right of inputs (not left)
  - [ ] Form errors appear on the right side
  - [ ] Multi-step form indicator (step 1 of 3) is right-aligned
- **PASS:** Form flows from top-right, labels right-positioned, errors right-aligned
- **FAIL:** Labels on left, inputs left-aligned, form flows left-to-right

### Test 2.4: Modals & popovers
- **How to test:** Trigger modals (confirm dialogs, tooltips, dropdowns)
- **What to check:**
  - [ ] Modal title is right-aligned
  - [ ] Close button (X) is on the LEFT (was top-right)
  - [ ] Button groups (Cancel, OK) have OK on the right
  - [ ] Tooltip positioning: arrow points toward RTL-aware position
- **PASS:** Modal components mirrored, close button on left, buttons in RTL order
- **FAIL:** Modal still LTR, close button on right, button order unchanged

### Test 2.5: Floating action buttons (FAB)
- **How to test:** Look for action buttons on marketplace pages
- **What to check:**
  - [ ] FAB positioned on LEFT side of screen (was right)
  - [ ] Related action menu opens to the left of FAB
- **PASS:** FAB on left, menu expands leftward
- **FAIL:** FAB on right, menu expands rightward

---

## 3. Number & Currency Formatting

### Test 3.1: Currency display (SAR)
- **How to test:** View pricing on any page (model catalog, earnings, billing)
- **What to check:**
  - [ ] SAR amounts use consistent format across the app
  - [ ] Decide: Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) OR Western numerals (0123456789)
  - [ ] Currency symbol positioning: "2,450 SAR" or "SAR 2,450" or "₹ 2,450"
  - [ ] Thousands separator: "٢٬٤٥٠" (Arabic comma) vs "2,450" (Western comma)
- **PASS:** All prices use same format, numerals readable, symbol positioned consistently
- **FAIL:** Mixed formats on same page, numerals inconsistent, symbol position varies

### Test 3.2: Large numbers (token counts, bandwidth)
- **How to test:** View model details with large metrics (e.g., 7B parameters, 1,000,000 tokens)
- **What to check:**
  - [ ] Thousands separators render correctly
  - [ ] Numerals display with correct script (Arabic or Western, consistently)
  - [ ] Decimal points use correct locale (. or ٫)
- **PASS:** Large numbers readable, thousands separator clear, decimals positioned correctly
- **FAIL:** Numbers reversed, separators missing or in wrong position

### Test 3.3: Percentages & rates
- **How to test:** View earnings dashboard (% utilization, ROI, discount %), billing/cost per hour
- **What to check:**
  - [ ] Percentage symbol (%) positioned correctly after numeral (e.g., "٧٠٪" in Arabic)
  - [ ] Rates (e.g., "0.267 $/hour") render with correct number format
- **PASS:** Percentages and rates display with correct formatting
- **FAIL:** % symbol position wrong, numerals unclear

---

## 4. Typography & Font Rendering

### Test 4.1: Arabic font loading
- **How to test:** Open DevTools → Fonts tab; navigate to Arabic content
- **What to check:**
  - [ ] Arabic font (Noto Kufi Arabic, Traditional Arabic, or equivalent) loads
  - [ ] Font file URL resolves (check Network tab for 200 OK)
  - [ ] No tofu characters (□) appear in place of Arabic text
  - [ ] Text renders with correct weight (normal, bold, light)
- **PASS:** Arabic text renders clearly, no tofu, font loads without errors
- **FAIL:** Missing glyphs, tofu characters visible, font fails to load

### Test 4.2: Text size & readability
- **How to test:** Read Arabic labels, model descriptions, error messages
- **What to check:**
  - [ ] Arabic text is legible at body size (14px+)
  - [ ] Headers are proportionally larger
  - [ ] Line height accommodates Arabic diacritics (not cut off)
  - [ ] Line-height is ≥1.5 for Arabic text (diacritics add height)
- **PASS:** Text is clear and readable, diacritics not clipped
- **FAIL:** Text too small, diacritics cut off, poor contrast

### Test 4.3: Font fallback chain
- **How to test:** Disable primary Arabic font in DevTools; refresh
- **What to check:**
  - [ ] Fallback font provides acceptable Arabic rendering
  - [ ] Text remains readable if primary font fails
- **PASS:** Fallback rendering acceptable, text still legible
- **FAIL:** Tofu appears, text becomes unreadable

---

## 5. Form Inputs & Placeholders

### Test 5.1: Input field placeholder text
- **How to test:** Click into any input field with placeholder (search, email, amount)
- **What to check:**
  - [ ] Placeholder text is right-aligned
  - [ ] Placeholder text color is appropriately faded
  - [ ] Cursor starts at RIGHT edge of input (not left)
- **PASS:** Placeholder right-aligned, cursor begins at right
- **FAIL:** Placeholder left-aligned, cursor starts on left

### Test 5.2: Text input cursor behavior
- **How to test:** Type into an input field; observe cursor movement
- **What to check:**
  - [ ] Cursor moves RIGHT-to-LEFT as you type Arabic
  - [ ] Backspace deletes the rightmost character
  - [ ] Cursor wraps to next line correctly in multi-line inputs
- **PASS:** Cursor moves RTL, backspace deletes right-to-left, line wrapping correct
- **FAIL:** Cursor moves LTR, backspace behavior incorrect

### Test 5.3: Input validation & error messages
- **How to test:** Submit invalid form (e.g., negative amount, invalid email)
- **What to check:**
  - [ ] Error message appears RIGHT-aligned
  - [ ] Error icon positioned on the right side of input
  - [ ] Error text wraps correctly in RTL
- **PASS:** Errors right-aligned, icon on right, wrapping correct
- **FAIL:** Errors left-aligned, icon on left, text runs off screen

### Test 5.4: Input labels & helper text
- **How to test:** Inspect form labels and helper text
- **What to check:**
  - [ ] Labels positioned to the RIGHT of inputs (or above)
  - [ ] Helper text ("e.g., 2,450 SAR") is right-aligned
  - [ ] Required field indicator (*) positioned on the right
- **PASS:** Labels and helpers right-positioned, indicator on right
- **FAIL:** Labels on left, indicator on left

---

## 6. Tables & Data Grids

### Test 6.1: Table column alignment
- **How to test:** View any data table (model catalog, provider list, job history, earnings)
- **What to check:**
  - [ ] Column headers are right-aligned
  - [ ] Numeric columns (price, VRAM, earnings) are right-aligned
  - [ ] Text columns (model name, status) are right-aligned
  - [ ] Table scrolls horizontally on mobile (scroll direction is natural in RTL)
- **PASS:** All columns right-aligned, headers match data alignment, scrolling intuitive
- **FAIL:** Headers left-aligned, mixed alignments, scrolling counter-intuitive

### Test 6.2: Table sorting & interaction
- **How to test:** Click sortable column headers
- **What to check:**
  - [ ] Sort arrow (▲ ▼) appears on the RIGHT side of header text
  - [ ] Clicking sorts ascending/descending correctly
- **PASS:** Sort arrows on right, sorting works as expected
- **FAIL:** Sort arrows on left, sorting behaves unexpectedly

### Test 6.3: Row selection & context menus
- **How to test:** Select/hover over table rows; right-click for context menu
- **What to check:**
  - [ ] Selection checkbox appears on the LEFT (mirror of LTR layout)
  - [ ] Context menu positioning: appears naturally for RTL (left-click to open menu on right side)
- **PASS:** Checkboxes on left, context menu positioned intuitively
- **FAIL:** Checkboxes on right, context menu in wrong position

---

## 7. Error Messages & Notifications

### Test 7.1: Toast/notification positioning
- **How to test:** Trigger an error or success notification (e.g., failed login, deployment started)
- **What to check:**
  - [ ] Toast appears in TOP-RIGHT corner (was top-right in LTR, still top-right in RTL for western convention, but confirm)
  - [ ] Text inside toast is right-aligned
  - [ ] Close button (X) is on the LEFT (inside the toast)
- **PASS:** Toast positioned correctly, text RTL, close on left
- **FAIL:** Toast positioning wrong, text LTR, close button in wrong place

### Test 7.2: Alert/error box styling
- **How to test:** View validation errors or system errors
- **What to check:**
  - [ ] Error icon positioned on the right of the text
  - [ ] Error message text is right-aligned
  - [ ] Error box padding/margins are symmetric
  - [ ] "Dismiss" or "Retry" button is right-positioned
- **PASS:** Icons on right, text RTL, buttons positioned correctly
- **FAIL:** Icons on left, text LTR, buttons misaligned

### Test 7.3: Multi-line error messages
- **How to test:** Trigger an error with long or multiple lines of text
- **What to check:**
  - [ ] Text wraps naturally from right to left
  - [ ] Line breaks don't split words awkwardly
  - [ ] Bullet points (•) or list items are right-indented
- **PASS:** Multi-line text flows correctly, wrapping natural
- **FAIL:** Text breaks awkwardly, line breaks split words

---

## 8. Bidirectional Content (Code & Data)

### Test 8.1: Code snippets in Arabic pages
- **How to test:** Navigate to documentation or example sections with code blocks
- **What to check:**
  - [ ] Code block uses `dir="ltr"` wrapper
  - [ ] Code is NOT reversed (e.g., function names, brackets stay in correct order)
  - [ ] Syntax highlighting is preserved
  - [ ] Monospace font is used (not proportional)
- **PASS:** Code renders correctly LTR, syntax highlighting intact, readable
- **FAIL:** Code reversed, syntax highlighting broken, unreadable

### Test 8.2: URLs & API endpoints in Arabic text
- **How to test:** View a page with embedded URLs or API paths in Arabic context
- **What to check:**
  - [ ] URL/API endpoint is not character-reversed
  - [ ] URL is clickable and links to correct destination
  - [ ] Long URLs don't overflow container
- **PASS:** URLs intact and functional, no overflow
- **FAIL:** URLs garbled, links broken, text overflow

### Test 8.3: JSON/structured data display
- **How to test:** View any JSON response or structured data (API response viewer, logs)
- **What to check:**
  - [ ] JSON uses `dir="ltr"` wrapper or `<pre dir="ltr">`
  - [ ] Keys and values are not reversed
  - [ ] Nested structures remain readable
- **PASS:** JSON structure intact, keys/values readable
- **FAIL:** JSON garbled, structure unreadable

---

## 9. Mobile & Responsive Design

### Test 9.1: Mobile layout (375px width)
- **How to test:** Open browser DevTools; set viewport to 375x667 (iPhone SE); navigate to key pages
- **What to check:**
  - [ ] Layout reflows correctly for narrow viewport
  - [ ] Navigation is still accessible (sidebar collapses gracefully, hamburger menu on left)
  - [ ] Content is right-aligned and readable
  - [ ] Single-column layout is right-to-left
- **PASS:** Layout reflows correctly, no horizontal scroll, content readable
- **FAIL:** Layout breaks, content overflow, unreadable on small screen

### Test 9.2: Touch targets & spacing
- **How to test:** Test on actual mobile device or use touch emulation
- **What to check:**
  - [ ] Touch targets (buttons, links) are ≥44x44px
  - [ ] Spacing between touch targets is sufficient (no accidental taps)
  - [ ] FAB or bottom action bar doesn't obscure content in RTL
- **PASS:** All touch targets appropriately sized and spaced
- **FAIL:** Touch targets too small, overlap, or obscured

### Test 9.3: Text input on mobile
- **How to test:** Open a form on mobile; type in an input field
- **What to check:**
  - [ ] Keyboard is appropriate for field type (Arabic keyboard for text, numeric for amounts)
  - [ ] Text input cursor behaves correctly RTL
  - [ ] Mobile keyboard doesn't hide important UI
- **PASS:** Correct keyboard appears, cursor works, UI visible
- **FAIL:** Wrong keyboard, cursor behaves unexpectedly, UI hidden

### Test 9.4: Images & responsive images
- **How to test:** View pages with images at different viewport sizes
- **What to check:**
  - [ ] Images scale responsively without distortion
  - [ ] Image captions are right-aligned if present
  - [ ] Decorative images don't interfere with text flow
- **PASS:** Images scale correctly, captions aligned, layout flows naturally
- **FAIL:** Images distorted, captions misaligned, text wrapping issues

---

## 10. Accessibility (Arabic + RTL)

### Test 10.1: Screen reader navigation
- **How to test:** Use a screen reader (NVDA, JAWS, VoiceOver) to navigate
- **What to check:**
  - [ ] Page structure is logical (headings, landmarks, sections)
  - [ ] Links have descriptive labels (not "click here")
  - [ ] Form labels are associated with inputs (`<label for="inputId">`)
  - [ ] Arabic text is pronounced correctly by screen reader
- **PASS:** Screen reader navigation logical, labels descriptive, Arabic pronunciation acceptable
- **FAIL:** Navigation broken, labels missing, pronunciation garbled

### Test 10.2: Keyboard navigation
- **How to test:** Use Tab/Shift+Tab to navigate page without mouse
- **What to check:**
  - [ ] Focus order is logical (top-right to bottom-left for RTL pages)
  - [ ] Focus is visually indicated (outline or highlight)
  - [ ] No keyboard traps
  - [ ] Buttons and links are keyboard-accessible
- **PASS:** Focus order logical, indicator visible, no traps
- **FAIL:** Focus jumps around, indicator invisible, unable to tab to elements

### Test 10.3: Color contrast
- **How to test:** Check text/background contrast ratio
- **What to check:**
  - [ ] Arabic text meets WCAG AA (4.5:1) or AAA (7:1) contrast
  - [ ] Labels and form text have sufficient contrast
- **PASS:** All text meets WCAG AA minimum
- **FAIL:** Low contrast, text hard to read

### Test 10.4: Font size & zoom
- **How to test:** Zoom page to 150% and 200%; ensure readability
- **What to check:**
  - [ ] Text remains readable at zoomed sizes
  - [ ] Layout doesn't break (no horizontal scroll)
  - [ ] Arabic diacritics remain visible
- **PASS:** Text readable at all zoom levels, layout stable
- **FAIL:** Text unreadable, layout breaks, diacritics clipped

---

## Sign-Off Checklist

Use this section to track overall RTL readiness:

- [ ] **Text Direction (1):** All sections PASS
- [ ] **Layout Mirroring (2):** All sections PASS
- [ ] **Number Formatting (3):** All sections PASS
- [ ] **Typography (4):** All sections PASS
- [ ] **Form Inputs (5):** All sections PASS
- [ ] **Tables (6):** All sections PASS
- [ ] **Error Messages (7):** All sections PASS
- [ ] **Bidirectional Content (8):** All sections PASS
- [ ] **Mobile (9):** All sections PASS
- [ ] **Accessibility (10):** All sections PASS

**Overall Status:**
- [ ] PASS — Ready for production
- [ ] FAIL — Blocker found; list below:

**Blockers (if any):**

---

**Last Updated:** 2026-03-24
**QA Owner:** [To be assigned]
**Next Review:** [Schedule after RTL implementation]
