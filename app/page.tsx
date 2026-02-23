import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-dc-black via-gray-900 to-dc-black">
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-dc-gold mb-4">DC1 Platform</h1>
          <p className="text-xl text-gray-300">GPU Rental Network - Decentralized Computing</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Provider Dashboard */}
          <Link href="/provider">
            <div className="bg-gradient-to-br from-dc-gold/10 to-transparent border-2 border-dc-gold rounded-lg p-8 hover:shadow-lg hover:shadow-dc-gold/50 transition-all cursor-pointer">
              <h2 className="text-2xl font-bold text-dc-gold mb-3">Provider</h2>
              <p className="text-gray-300 mb-6">Manage your GPU machines, view earnings, and track active rentals</p>
              <div className="space-y-2 text-sm text-gray-400">
                <p>✓ Earnings Summary</p>
                <p>✓ Machines Management</p>
                <p>✓ Active Rentals</p>
                <p>✓ Withdrawal</p>
                <p>✓ Reward Tier</p>
              </div>
            </div>
          </Link>

          {/* Renter Dashboard */}
          <Link href="/renter">
            <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border-2 border-dc-cyan rounded-lg p-8 hover:shadow-lg hover:shadow-dc-cyan/50 transition-all cursor-pointer">
              <h2 className="text-2xl font-bold text-dc-cyan mb-3">Renter</h2>
              <p className="text-gray-300 mb-6">Browse GPUs, rent machines, and track your billing</p>
              <div className="space-y-2 text-sm text-gray-400">
                <p>✓ GPU Marketplace</p>
                <p>✓ Advanced Filters</p>
                <p>✓ Rent Button</p>
                <p>✓ Billing Management</p>
                <p>✓ Rebate Tracker</p>
              </div>
            </div>
          </Link>

          {/* Admin Dashboard */}
          <Link href="/admin">
            <div className="bg-gradient-to-br from-white/5 to-transparent border-2 border-white/20 rounded-lg p-8 hover:shadow-lg hover:shadow-white/50 transition-all cursor-pointer">
              <h2 className="text-2xl font-bold text-white mb-3">Admin</h2>
              <p className="text-gray-300 mb-6">Platform overview, machine health, and provider analytics</p>
              <div className="space-y-2 text-sm text-gray-400">
                <p>✓ Key Metrics</p>
                <p>✓ Machine Health</p>
                <p>✓ Recent Activity</p>
                <p>✓ Provider Leaderboard</p>
                <p>✓ System Monitoring</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-16 text-center text-sm text-gray-500">
          <p>Supabase Connected | Real-time Updates | Responsive Design</p>
        </div>
      </div>
    </main>
  )
}
