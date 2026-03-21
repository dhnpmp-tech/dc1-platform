'use client'

export default function ProviderSettingsError({ reset }: { reset: () => void }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="card p-6 max-w-md text-center space-y-3">
        <h2 className="text-lg font-semibold text-status-error">Provider settings failed to load</h2>
        <p className="text-sm text-dc1-text-secondary">Please retry. If the issue continues, verify daemon/session credentials.</p>
        <button onClick={reset} className="btn btn-primary text-sm">Retry</button>
      </div>
    </div>
  )
}
