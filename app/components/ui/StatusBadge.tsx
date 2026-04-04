'use client'

type StatusType = 'online' | 'offline' | 'degraded' | 'active' | 'inactive' | 'pending' | 'running' | 'completed' | 'failed' | 'permanently_failed' | 'cancelled' | 'paused' | 'warning' | 'assigned' | 'queued'

interface StatusBadgeProps {
  status: StatusType
  label?: string
  size?: 'sm' | 'md'
  pulse?: boolean
}

const statusConfig: Record<StatusType, { dot: string; bg: string; text: string; defaultLabel: string }> = {
  online:    { dot: 'bg-status-success', bg: 'bg-status-success/10', text: 'text-status-success', defaultLabel: 'Online' },
  active:    { dot: 'bg-status-success', bg: 'bg-status-success/10', text: 'text-status-success', defaultLabel: 'Active' },
  completed: { dot: 'bg-status-success', bg: 'bg-status-success/10', text: 'text-status-success', defaultLabel: 'Completed' },
  running:   { dot: 'bg-status-info',    bg: 'bg-status-info/10',    text: 'text-status-info',    defaultLabel: 'Running' },
  pending:   { dot: 'bg-status-warning', bg: 'bg-status-warning/10', text: 'text-status-warning', defaultLabel: 'Pending' },
  warning:   { dot: 'bg-status-warning', bg: 'bg-status-warning/10', text: 'text-status-warning', defaultLabel: 'Warning' },
  paused:    { dot: 'bg-status-warning', bg: 'bg-status-warning/10', text: 'text-status-warning', defaultLabel: 'Paused' },
  degraded:  { dot: 'bg-status-warning', bg: 'bg-status-warning/10', text: 'text-status-warning', defaultLabel: 'Degraded' },
  offline:   { dot: 'bg-status-error',   bg: 'bg-status-error/10',   text: 'text-status-error',   defaultLabel: 'Offline' },
  inactive:  { dot: 'bg-dc1-text-muted', bg: 'bg-dc1-text-muted/10', text: 'text-dc1-text-muted', defaultLabel: 'Inactive' },
  failed:    { dot: 'bg-status-error',   bg: 'bg-status-error/10',   text: 'text-status-error',   defaultLabel: 'Failed' },
  permanently_failed: { dot: 'bg-status-error', bg: 'bg-status-error/10', text: 'text-status-error', defaultLabel: 'Failed' },
  cancelled: { dot: 'bg-dc1-text-muted', bg: 'bg-dc1-text-muted/10', text: 'text-dc1-text-muted', defaultLabel: 'Cancelled' },
  assigned:  { dot: 'bg-status-info',    bg: 'bg-status-info/10',    text: 'text-status-info',    defaultLabel: 'Assigned' },
  queued:    { dot: 'bg-status-warning', bg: 'bg-status-warning/10', text: 'text-status-warning', defaultLabel: 'Queued' },
}

export default function StatusBadge({ status, label, size = 'md', pulse = true }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.inactive
  const displayLabel = label || config.defaultLabel

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${config.bg} ${config.text} ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
    }`}>
      <span className={`rounded-full ${config.dot} ${
        size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
      } ${pulse && (status === 'online' || status === 'running' || status === 'active' || status === 'degraded') ? 'animate-pulse' : ''}`} />
      {displayLabel}
    </span>
  )
}
