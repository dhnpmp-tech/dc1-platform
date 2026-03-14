'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy provider onboarding wizard — now redirects to the canonical
 * /provider/register page which has the same functionality with the
 * unified DC1 design system.
 */
export default function ProviderOnboardingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/provider/register');
  }, [router]);

  return (
    <div className="min-h-screen bg-dc1-void flex items-center justify-center">
      <p className="text-dc1-text-secondary text-sm">Redirecting to registration...</p>
    </div>
  );
}
