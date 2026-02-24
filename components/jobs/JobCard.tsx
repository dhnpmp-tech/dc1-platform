'use client';

import Link from 'next/link';

interface Job {
  id: string;
  dockerImage: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'over-budget';
  costSoFarSar: number;
  elapsedMinutes: number;
  requiredVramGb: number;
  gpuCount: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  running: 'bg-[#00A8E1]/20 text-[#00A8E1]',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  'over-budget': 'bg-orange-500/20 text-orange-400',
};

function formatElapsed(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function JobCard({ job }: { job: Job }) {
  return (
    <Link href={`/jobs/${job.id}/monitor`}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-5 hover:border-[#FFD700]/40 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-sm font-mono truncate max-w-[200px]">{job.id}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[job.status] || ''}`}>
            {job.status}
          </span>
        </div>
        <p className="text-white text-sm font-mono truncate mb-3">{job.dockerImage}</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-white/40 text-xs">Cost</p>
            <p className="text-[#FFD700] font-medium">﷼{job.costSoFarSar.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">Elapsed</p>
            <p className="text-white">{formatElapsed(job.elapsedMinutes)}</p>
          </div>
          <div>
            <p className="text-white/40 text-xs">GPUs</p>
            <p className="text-white">{job.gpuCount}× {job.requiredVramGb}GB</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
