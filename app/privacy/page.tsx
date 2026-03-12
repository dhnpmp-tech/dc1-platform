import LegalPage from '@/app/components/layout/LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="March 12, 2026">
      <h2>1. Information We Collect</h2>
      <p>When you register on DC1, we collect your name, email address, and (for providers) GPU hardware details and operating system. We also collect usage data including job submissions, compute time, and billing transactions.</p>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to operate the DC1 marketplace, process billing, match renters with available GPU providers, and communicate important service updates. We do not sell your personal information to third parties.</p>

      <h2>3. Data Storage and Security</h2>
      <p>Your data is stored on secure servers. API keys are generated using cryptographically secure random values. We implement reasonable security measures to protect your data, but no system is completely secure.</p>

      <h2>4. Provider Data</h2>
      <p>When providers connect their GPU daemon, we collect hardware metrics (GPU model, VRAM, temperature, utilization), IP address, and hostname for the purpose of job routing and platform health monitoring.</p>

      <h2>5. Cookies and Tracking</h2>
      <p>DC1 uses localStorage for session management (API keys). We do not use third-party tracking cookies or advertising trackers.</p>

      <h2>6. Data Retention</h2>
      <p>We retain your account data for as long as your account is active. Job logs and billing records are retained for a minimum of 2 years for compliance purposes. You may request deletion of your account by contacting support.</p>

      <h2>7. Your Rights</h2>
      <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:privacy@dc1st.com">privacy@dc1st.com</a>.</p>

      <h2>8. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify registered users of material changes via email.</p>

      <h2>9. Contact</h2>
      <p>For privacy-related inquiries, contact <a href="mailto:privacy@dc1st.com">privacy@dc1st.com</a>.</p>
    </LegalPage>
  )
}
