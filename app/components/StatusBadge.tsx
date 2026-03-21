'use client';

interface StatusBadgeProps {
  status: 'online' | 'degraded' | 'offline' | 'active' | 'inactive' | 'warning';
  label?: string;
  size?: 'sm' | 'md';
}

const colors: Record<string, { dot: string; bg: string; text: string }> = {
  online: { dot: 'bg-[#00c853]', bg: 'bg-[#00c853]/10', text: 'text-[#00c853]' },
  active: { dot: 'bg-[#00c853]', bg: 'bg-[#00c853]/10', text: 'text-[#00c853]' },
  degraded: { dot: 'bg-[#ffab00]', bg: 'bg-[#ffab00]/10', text: 'text-[#ffab00]' },
  warning: { dot: 'bg-[#ffab00]', bg: 'bg-[#ffab00]/10', text: 'text-[#ffab00]' },
  offline: { dot: 'bg-[#ff5252]', bg: 'bg-[#ff5252]/10', text: 'text-[#ff5252]' },
  inactive: { dot: 'bg-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-400' },
};

export default function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
  const c = colors[status] || colors.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${c.bg} ${c.text} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
      {label || status}
    </span>
  );
}
