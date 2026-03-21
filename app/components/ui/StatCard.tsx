interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: { value: string; positive: boolean }
  accent?: 'amber' | 'success' | 'error' | 'info' | 'default'
}

const accentColors = {
  amber: 'border-dc1-amber/30 hover:border-dc1-amber/50',
  success: 'border-status-success/30 hover:border-status-success/50',
  error: 'border-status-error/30 hover:border-status-error/50',
  info: 'border-status-info/30 hover:border-status-info/50',
  default: 'border-dc1-border hover:border-dc1-border-light',
}

const valueColors = {
  amber: 'text-dc1-amber',
  success: 'text-status-success',
  error: 'text-status-error',
  info: 'text-status-info',
  default: 'text-dc1-text-primary',
}

export default function StatCard({ label, value, icon, trend, accent = 'default' }: StatCardProps) {
  return (
    <div className={`bg-dc1-surface-l1 border rounded-lg p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${accentColors[accent]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-dc1-text-secondary">{label}</p>
        {icon && (
          <span className="text-dc1-text-muted">{icon}</span>
        )}
      </div>
      <p className={`text-2xl font-bold ${valueColors[accent]}`}>{value}</p>
      {trend && (
        <p className={`text-xs mt-1 ${trend.positive ? 'text-status-success' : 'text-status-error'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </p>
      )}
    </div>
  )
}
