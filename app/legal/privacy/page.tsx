import LegalPage from '../../components/layout/LegalPage'

export default function PrivacyPolicyLegalPage() {
  return (
    <LegalPage title="Privacy Policy | سياسة الخصوصية" lastUpdated="2026-03-20">
      <h2>English</h2>
      <p>
        DCP processes personal data to operate a GPU compute marketplace in Saudi Arabia in line with the
        Personal Data Protection Law (PDPL).
      </p>

      <h3>What we collect</h3>
      <ul>
        <li>Email and account identity data</li>
        <li>Payment and billing records</li>
        <li>Job metadata (job type, status, timestamps, cost)</li>
        <li>Provider machine telemetry (GPU model, VRAM, utilization, heartbeat metrics)</li>
      </ul>

      <h3>Why we use data</h3>
      <ul>
        <li>Marketplace matching between renters and providers</li>
        <li>Usage billing, payouts, and financial reconciliation</li>
        <li>Fraud prevention, abuse detection, and platform security monitoring</li>
      </ul>

      <h3>Retention</h3>
      <ul>
        <li>Job data: 90 days</li>
        <li>Operational logs: 30 days</li>
        <li>Account profile: retained until account deletion request</li>
      </ul>

      <h3>Your PDPL rights</h3>
      <ul>
        <li>Right of access/export of your data</li>
        <li>Right to correction of inaccurate data</li>
        <li>Right to deletion of your account data, subject to legal obligations</li>
      </ul>

      <p>
        Privacy contact: <a href="mailto:privacy@dcp.sa">privacy@dcp.sa</a>
      </p>

      <h2 dir="rtl">العربية</h2>
      <div dir="rtl">
        <p>
          تقوم منصة DCP بمعالجة البيانات الشخصية لتشغيل سوق حوسبة GPU داخل المملكة العربية السعودية وفقاً
          لنظام حماية البيانات الشخصية (PDPL).
        </p>

        <h3>ما البيانات التي نجمعها</h3>
        <ul>
          <li>البريد الإلكتروني وبيانات الهوية للحساب</li>
          <li>بيانات الدفع والفوترة</li>
          <li>بيانات تعريف الوظائف (النوع، الحالة، الوقت، التكلفة)</li>
          <li>قياسات أجهزة المزوّد (نوع GPU، الذاكرة، الاستهلاك، نبضات التشغيل)</li>
        </ul>

        <h3>كيف نستخدم البيانات</h3>
        <ul>
          <li>مطابقة المستأجرين مع مزوّدي الموارد</li>
          <li>الفوترة والمدفوعات والتسوية المالية</li>
          <li>منع الاحتيال، كشف إساءة الاستخدام، وحماية المنصة</li>
        </ul>

        <h3>فترات الاحتفاظ</h3>
        <ul>
          <li>بيانات الوظائف: 90 يوماً</li>
          <li>سجلات التشغيل: 30 يوماً</li>
          <li>بيانات الحساب: حتى طلب الحذف</li>
        </ul>

        <h3>حقوقك وفق PDPL</h3>
        <ul>
          <li>حق الوصول إلى بياناتك وتصديرها</li>
          <li>حق تصحيح البيانات غير الدقيقة</li>
          <li>حق طلب حذف بيانات الحساب بما لا يتعارض مع الالتزامات النظامية</li>
        </ul>

        <p>
          للتواصل بشأن الخصوصية: <a href="mailto:privacy@dcp.sa">privacy@dcp.sa</a>
        </p>
      </div>
    </LegalPage>
  )
}
