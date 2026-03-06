'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function EarningsInner() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
      <div className="max-w-md w-full px-4 text-center">
        <p className="text-5xl mb-4">📊</p>
        <h1 className="text-2xl font-bold mb-3">Earnings History</h1>
        <p className="text-gray-400 mb-6">
          Detailed earnings breakdown is coming soon. Your totals are available on your dashboard.
        </p>
        <Link
          href={key ? `/provider?key=${key}` : '/provider'}
          className="inline-block py-3 px-8 rounded-lg font-semibold bg-[#FFD700] text-black hover:bg-[#e6c200] transition"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function EarningsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">Loading...</div>}>
      <EarningsInner />
    </Suspense>
  );
}
