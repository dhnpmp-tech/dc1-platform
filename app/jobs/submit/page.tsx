'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '../../lib/i18n';

function SubmitJobRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  useEffect(() => {
    const query = searchParams.toString();
    const target = query ? `/renter/playground?${query}` : '/renter/playground';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-dc1-void text-dc1-text-primary flex items-center justify-center px-4">
      <div className="text-center rounded-xl border border-dc1-border bg-dc1-surface-l1 px-6 py-5">
        <p className="text-base font-semibold text-dc1-text-primary">{t('jobs_submit_redirect.title')}</p>
        <p className="mt-1 text-sm text-dc1-text-secondary">{t('jobs_submit_redirect.message')}</p>
      </div>
    </div>
  );
}

export default function SubmitJobPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dc1-void" />}>
      <SubmitJobRedirect />
    </Suspense>
  );
}
