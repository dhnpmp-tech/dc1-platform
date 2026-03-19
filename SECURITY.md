# Security Policy — DC1 Platform

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main) | ✅ Active |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report security issues by emailing: **security@dc1st.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce (proof of concept if applicable)
- Potential impact assessment
- Your contact information for follow-up

We will acknowledge your report within **48 hours** and provide a remediation timeline within **7 days**.

### Responsible Disclosure Policy

- We ask that you give us reasonable time to fix the issue before public disclosure
- We will not take legal action against researchers who follow this policy
- We will credit you in our changelog (unless you prefer to remain anonymous)
- We do not currently offer a bug bounty program

## Data Breach Procedure (PDPL Article 19)

Saudi Arabia's Personal Data Protection Law (PDPL) requires notification within **72 hours** of discovering a personal data breach.

### Incident Response Steps

1. **Detection & Containment** (0–4 hours)
   - Identify scope: which data, how many users affected
   - Isolate affected systems if necessary
   - Preserve logs for forensic analysis

2. **Assessment** (4–24 hours)
   - Classify breach severity: PII exposure, financial data, API keys
   - Determine root cause
   - Assess whether breach is likely to result in risk to data subjects

3. **Notification** (within 72 hours of awareness)
   - **Regulatory**: Notify the Saudi Data and AI Authority (SDAIA) via the PDPL breach portal if breach involves personal data of Saudi residents
   - **Users**: Email affected users with: what happened, what data was involved, what we are doing, what they can do
   - **Internal**: Escalate to CEO and legal counsel

4. **Remediation**
   - Patch root cause
   - Rotate compromised credentials/API keys
   - Conduct post-incident review
   - Update security controls to prevent recurrence

### Notification Template (User Email)

```
Subject: Important Security Notice — DC1 Account

Dear [Name],

We are writing to inform you of a security incident affecting your DC1 account.

What happened: [description]
When we discovered it: [date]
What data was involved: [name/email/other]
What we have done: [actions taken]
What you should do: [recommended user actions, e.g. rotate API key]

We sincerely apologize for this incident. If you have questions, contact security@dc1st.com.

— DC1 Team
```

## Security Controls in Place

- **Authentication**: Cryptographically random API keys (32 bytes entropy)
- **Transport**: TLS enforced on all public endpoints; HSTS headers
- **Input validation**: Server-side sanitization of all request bodies and query params
- **Rate limiting**: Registration (5/hour), heartbeat (4/min), job submission (30/min)
- **CORS lockdown**: Explicit allowlist of origins; no wildcard
- **Security headers**: X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy
- **SQL injection**: Parameterized queries throughout (better-sqlite3)
- **Data retention**: Automated cleanup — heartbeat logs 30 days, job logs 90 days, payments 7 years (SAMA)

## Known Limitations (Roadmap)

- API keys in query params (`?key=`) — planned migration to header-only auth
- No MFA for admin token — planned for Q3 2026
- VPS data outside Saudi Arabia — data residency migration planned Q3 2026 (STC Cloud / AWS Bahrain)

## Contact

- Security reports: security@dc1st.com
- Privacy/PDPL inquiries: privacy@dc1st.com
- General: support@dc1st.com
