'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLanguage } from '../../../lib/i18n';

function trackLegacyJobsHandoff(event: string, payload: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const detail = { event, source: 'legacy_jobs_monitor', ...payload };
  window.dispatchEvent(new CustomEvent('dc1_analytics', { detail }));
  const win = window as typeof window & {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  };
  if (Array.isArray(win.dataLayer)) {
    win.dataLayer.push(detail);
  }
  if (typeof win.gtag === 'function') {
    win.gtag('event', event, payload);
  }
}

export default function MonitorPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [ready, setReady] = useState(false);
  const trackedRef = useRef(false);
  const target = `/renter/jobs/${params.id}`;
  const loginTarget = `/login?role=renter&redirect=${encodeURIComponent(target)}`;

  const trackCanonicalClick = (clickTarget: string) => {
    trackLegacyJobsHandoff('legacy_jobs_canonical_cta_clicked', {
      route: '/jobs/[id]/monitor',
      target: clickTarget,
      actor: 'visitor',
      job_id: params.id,
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const renterKey = localStorage.getItem('dc1_renter_key') || sessionStorage.getItem('dc1_renter_key');
        if (renterKey) {
          if (!trackedRef.current) {
            trackLegacyJobsHandoff('job_monitor_redirected_to_renter_detail', { target, actor: 'renter' });
            trackedRef.current = true;
          }
          router.replace(target);
          return;
        }
      } catch (error) {
        trackLegacyJobsHandoff('legacy_jobs_handoff_failed', {
          reason: error instanceof Error ? error.message : 'storage_access_error',
          target,
          actor: 'renter',
        });
      }
    }

    if (!trackedRef.current) {
      trackLegacyJobsHandoff('legacy_jobs_notice_seen', {
        route: '/jobs/[id]/monitor',
        actor: 'visitor',
        job_id: params.id,
      });
      trackLegacyJobsHandoff('job_monitor_login_required', { target, loginTarget, actor: 'visitor' });
      trackedRef.current = true;
    }

    setReady(true);
  }, [loginTarget, params.id, router, target]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-dc1-void text-dc1-text-primary flex items-center justify-center px-4">
        <p className="text-dc1-text-secondary text-sm">{t('jobs_legacy.monitor.redirecting')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dc1-void text-dc1-text-primary">
      <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24">
        <div className="rounded-xl border border-dc1-amber/35 bg-dc1-amber/10 p-4 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dc1-amber mb-2">{t('jobs_legacy.notice.badge')}</p>
          <p className="text-sm text-dc1-text-secondary">{t('jobs_legacy.monitor.notice')}</p>
        </div>

        <div className="rounded-2xl border border-dc1-border bg-dc1-surface-l1 p-8 text-center">
          <h1 className="text-2xl font-semibold mb-3 text-dc1-text-primary">{t('jobs_legacy.monitor.title')}</h1>
          <p className="text-sm text-dc1-text-secondary mb-6">{t('jobs_legacy.monitor.description')}</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href={loginTarget}
              onClick={() => trackCanonicalClick(loginTarget)}
              className="btn btn-primary min-h-[42px] px-5"
            >
              {t('jobs_legacy.monitor.login_cta')}
            </Link>
            <Link
              href={target}
              onClick={() => trackCanonicalClick(target)}
              className="btn btn-secondary min-h-[42px] px-5"
            >
              {t('jobs_legacy.monitor.renter_detail_cta')}
            </Link>
            <Link
              href="/admin/jobs"
              onClick={() => trackCanonicalClick('/admin/jobs')}
              className="btn btn-secondary min-h-[42px] px-5"
            >
              {t('jobs_legacy.notice.admin_cta')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
