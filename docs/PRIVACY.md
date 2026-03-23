# DCP Privacy Policy

**Effective Date:** 2026-03-23
**Last Updated:** 2026-03-23

---

## 1. Overview

DCP (Decentralized Compute Platform) is a GPU compute marketplace. This privacy policy explains how we collect, use, disclose, and safeguard your information in accordance with Saudi Arabia's Personal Data Protection Law (PDPL) and international best practices.

**Key principle:** Your data stays in Saudi Arabia. You own your job history and can export it anytime.

---

## 2. Information We Collect

### 2.1 Information You Provide Directly

**Account Registration (Renters & Providers):**
- Email address
- Full name
- Phone number (optional)
- Organization/Company name
- Wallet address (for payments)
- Profile picture (optional)

**Payment Information:**
- Credit card (processed by Moyasar, we don't store it)
- Billing address
- Invoice history

**Content You Submit:**
- Job prompts (your inference inputs)
- Job outputs (model outputs)
- Job metadata (model name, parameters, duration)
- Chat history (if using chat endpoints)
- File uploads (if submitting files to process)

**Communication:**
- Support emails and chat messages
- Feedback forms
- Bug reports

### 2.2 Information Collected Automatically

**Usage Data:**
- Timestamps of job submissions
- Model names and versions
- API request frequency
- Job duration and token counts
- Error logs (for debugging)
- Geographic location of API requests (IP)

**Device Information:**
- Browser type and version
- Operating system
- Device type (desktop, mobile)
- Language preferences

**Provider-Specific Data:**
- GPU model and availability
- Uptime metrics
- Job completion rates
- Average latency
- Reputation scores
- Daemon version and updates

### 2.3 Information from Third Parties

- **Payment processor (Moyasar):** Confirmation of payment, billing status
- **Cloud providers:** Basic service logs from Vercel (frontend hosting)
- **DNS/Security (Cloudflare):** Traffic logs and security events

---

## 3. How We Use Your Information

### 3.1 To Provide Services
- Execute your job requests and deliver results
- Process payments and issue invoices
- Send confirmation emails
- Provide customer support
- Track provider reputation and uptime

### 3.2 To Improve DCP
- Analyze job patterns to optimize infrastructure
- Identify bottlenecks and performance issues
- Train ML models for job routing (no personal data in training)
- Conduct A/B testing on the UI
- Audit security and compliance

### 3.3 To Protect DCP
- Detect and prevent fraud (suspicious job patterns, payment abuse)
- Investigate security incidents
- Comply with legal requirements
- Enforce our Terms of Service
- Prevent abuse (DDoS, spam, illegal content)

### 3.4 To Communicate
- Send billing notifications
- Announce new features
- Report service incidents
- Request feedback (optional surveys)

### 3.5 NOT For
- ❌ Selling your data to third parties
- ❌ Targeted advertising (we don't track you across the web)
- ❌ Training language models on your job prompts
- ❌ Sharing with social media platforms
- ❌ Creating detailed profiles for manipulation

---

## 4. Legal Basis for Processing (PDPL)

Under Saudi Arabia's PDPL, we process your data based on:

| Data Type | Legal Basis |
|-----------|-------------|
| Account information | Contract (you agreed to ToS) |
| Payment information | Contract (billing) |
| Job prompts/outputs | Contract (service delivery) |
| Usage analytics | Legitimate interest (service improvement) |
| Security logs | Legitimate interest (fraud prevention) |
| Support tickets | Contract (customer service) |
| Marketing emails | Consent (you can unsubscribe anytime) |

**You can withdraw consent for marketing anytime:** Click "Unsubscribe" in any email or email privacy@dcp.sa.

---

## 5. Data Retention

| Data Type | Retention Period | Reason |
|-----------|-----------------|--------|
| Account information | While active + 2 years | Tax records, audit trail |
| Job prompts/outputs | 30 days | PDPL compliance, regulatory |
| Job logs | 30 days | Debugging, support tickets |
| Payment records | 7 years | Tax, accounting requirements |
| Usage analytics | 1 year | Service improvement, trending |
| Email communications | 2 years | Legal/compliance record |
| API logs | 7 days | Security incident investigation |
| Reputation scores (providers) | While provider active | Platform operations |

**Exception:** If you request deletion before these periods expire, we delete your data immediately (except where legally required to retain).

---

## 6. Data Sharing

### 6.1 Who We Share Data With

**Service providers (data processors):**
- Supabase (database hosting) — processes PDPL-compliant EU infrastructure
- Moyasar (payment processing) — PCI-DSS certified
- Vercel (website hosting) — frontend only, no sensitive data
- Cloudflare (DDoS protection) — traffic logs only

**Legal requirements:**
- Saudi authorities (if required by law, with notice to you)
- Court orders (with legal challenge if possible)

### 6.2 What We DON'T Share

- Your email or personal information is **never sold**
- Job prompts/outputs are **never disclosed** to other users
- Provider node logs are **not shared** with renters
- Payment information is **not shared** (only Moyasar sees it)

### 6.3 Job Data Visibility

**Renters:**
- Can see their own job history (prompts, outputs, logs)
- Cannot see other renters' jobs
- Can export all job data anytime

**Providers:**
- Can see jobs assigned to them (prompts, outputs, logs)
- Cannot see jobs assigned to other providers
- Cannot see other providers' performance metrics

**Admins:**
- Can see aggregated metrics (total jobs, total revenue, error rates)
- Can see flagged jobs (security/abuse review only)
- Have access controls and audit trails

---

## 7. Your Rights Under PDPL

### Right to Access
**You can request a copy of your data.**
- Email privacy@dcp.sa with your request
- We'll respond within 30 days with a download link
- Includes: account data, job history, payment records, API usage

### Right to Correction
**You can update your information.**
- Edit your profile in the dashboard anytime
- Request corrections via privacy@dcp.sa for data we hold

### Right to Deletion
**You can request permanent deletion.**
- Email privacy@dcp.sa with deletion request
- We'll delete within 30 days (except legally required records)
- Does NOT include: tax records (7 years by law), blockchain transactions (immutable)

### Right to Data Portability
**You can export your data in standard format.**
- Dashboard: Export job history (CSV, JSON)
- Email privacy@dcp.sa to request all data exports

### Right to Restrict Processing
**You can limit how we use your data.**
- Opt-out of marketing emails (link in any email)
- Request we stop processing for analytics (we'll limit to legal minimum)
- Email privacy@dcp.sa with your request

### Right to Withdraw Consent
**You can withdraw permission to process your data.**
- For marketing: Click "Unsubscribe" in emails
- For analytics: Request opt-out via privacy@dcp.sa
- Note: We may need to retain some data for legal compliance

### Right to Lodge a Complaint
**If you believe we violate PDPL, you can file a complaint with:**
- **Saudi Data Privacy Authority:** [URL to be added]
- **Contact:** privacy@dcp.sa (and we'll assist in forwarding)

---

## 8. Security & Data Protection

### Technical Safeguards
- **HTTPS/TLS 1.3:** All data in transit is encrypted
- **AES-256:** Sensitive data encrypted at rest
- **API authentication:** Every request requires valid API key
- **Rate limiting:** Protects against brute force attacks
- **Firewalls:** Network-level isolation of critical systems

### Organizational Safeguards
- **Access controls:** Only authorized staff access user data
- **Audit logs:** All data access is logged and monitored
- **Background checks:** Security screening for staff with data access
- **Incident response:** Dedicated team on-call 24/7
- **Security training:** All staff trained on PDPL and data protection

### Incident Response
If a data breach occurs:
1. We investigate immediately (goal: <1 hour)
2. We contain the breach (goal: <4 hours)
3. We notify affected users within 24 hours
4. We report to authorities if required by law
5. We publish a transparency report within 7 days

---

## 9. Cookies & Tracking

### What We Use Cookies For
- **Session management:** Keep you logged in
- **Preferences:** Remember your language, theme, dashboard layout
- **Security:** CSRF protection, rate limiting

### What We DON'T Do
- ❌ No third-party tracking (Google Analytics, etc.)
- ❌ No retargeting ads
- ❌ No cross-site tracking
- ❌ No cookie-based profiling

### Cookie Preferences
You can disable non-essential cookies:
- In your browser settings
- In your DCP privacy preferences (dashboard)
- By emailing privacy@dcp.sa

---

## 10. Job Data Ownership & Licensing

### You Own Your Job Data
- **Prompts:** You own what you submit
- **Outputs:** You own the model's outputs
- **Training data:** If you fine-tune a model, you own the results
- **Usage rights:** You can use outputs for any lawful purpose

### We Own Our Infrastructure
- **Code:** DCP source code is licensed under GPL v3 (open-source)
- **Models:** Models are licensed by their creators (Meta, NVIDIA, Alibaba, etc.)
- **Servers:** We own the hardware and infrastructure

### Prohibited Uses
You cannot use DCP to:
- Generate illegal content (terrorism, child exploitation, etc.)
- Violate others' intellectual property rights
- Train competing models without agreement
- Reverse-engineer our proprietary code
- Use for surveillance or discrimination

---

## 11. International Data Transfers

### Data Location
All your data stays in **Saudi Arabia**. We do not transfer data internationally except:
- **Minimally:** Third-party service providers (Supabase EU, Moyasar, Vercel)
- **With safeguards:** These providers are PDPL/GDPR compliant
- **Transparently:** You can audit data processor agreements on request

### Subprocessors (Third Parties We Share Data With)
Current subprocessors:
1. **Supabase** (database) — EU infrastructure
2. **Moyasar** (payments) — Saudi Arabia
3. **Vercel** (frontend) — Global (frontend only)
4. **Cloudflare** (DDoS) — Global (traffic logs only)

You can request the full Data Processing Agreement (DPA) at privacy@dcp.sa.

---

## 12. Children & Age Requirements

**DCP is not for children under 18.**
- You must be 18+ to create an account
- If you're under 18, you need parental/guardian consent
- We don't knowingly collect data from children
- If we discover a child's account, we'll delete it within 7 days

---

## 13. Changes to This Policy

We may update this policy to reflect changes in law, technology, or our practices.

**If we make material changes:**
- We'll notify you by email (for registered users)
- We'll post the change date at the top of this policy
- Major changes will be announced on our status page

**You accept the new policy by continuing to use DCP** after the change date.

---

## 14. Contact & Privacy Requests

**Privacy questions or requests:**
- Email: privacy@dcp.sa
- Response time: 7-14 days

**Security incidents:**
- Email: security@dcp.sa
- Response time: 24 hours

**Legal/regulatory requests:**
- Contact: legal@dcp.sa
- We'll cooperate with lawful requests

**Unsubscribe from marketing:**
- Click "Unsubscribe" in any email
- Or email privacy@dcp.sa

---

## 15. Governing Law

This privacy policy is governed by:
- **Primary:** Saudi Arabia's Personal Data Protection Law (PDPL)
- **Secondary:** Saudi Arabia's general contract law
- **Jurisdiction:** Saudi Arabia courts

---

**Questions?** Email privacy@dcp.sa. We're here to help.
