'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getUsers, getMachines, getRentals, getWallets } from '../../lib/supabase'

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

interface Machine {
  id: string
  model: string
  provider_id: string
  hourly_rate: number
  status: string
}

interface Rental {
  id: string
  machine_id: string
  renter_id: string
  hours_rented: number
  status: string
  created_at: string
}

interface Wallet {
  id: string
  user_id: string
  balance: number
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProviders: 0,
    totalRenters: 0,
    totalMachines: 0,
    activeMachines: 0,
    totalRentals: 0,
    activeRentals: 0,
    totalVolume: 0,
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, machinesData, rentalsData, walletsData] = await Promise.all([
          getUsers(),
          getMachines(),
          getRentals(),
          getWallets(),
        ])

        setUsers(usersData)
        setMachines(machinesData)
        setRentals(rentalsData)
        setWallets(walletsData)

        // Calculate statistics
        const providers = usersData.filter((u: any) => u.role === 'provider')
        const renters = usersData.filter((u: any) => u.role === 'renter')
        const activeMachines = machinesData.filter((m: any) => m.status === 'active')
        const activeRentals = rentalsData.filter((r: any) => r.status === 'active')
        
        const totalVolume = rentalsData.reduce((sum: number, r: any) => {
          const machine = machinesData.find((m: any) => m.id === r.machine_id)
          return sum + (r.hours_rented * (machine?.hourly_rate || 0))
        }, 0)

        setStats({
          totalUsers: usersData.length,
          totalProviders: providers.length,
          totalRenters: renters.length,
          totalMachines: machinesData.length,
          activeMachines: activeMachines.length,
          totalRentals: rentalsData.length,
          activeRentals: activeRentals.length,
          totalVolume,
        })
      } catch (error) {
        console.error('Error loading admin data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription
    const subscription = supabase
      .channel('admin-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-dc-black flex items-center justify-center">
        <p className="text-white text-xl">Loading Admin Dashboard...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-dc-black">
      {/* Navigation */}
      <nav className="bg-gray-900 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-white font-bold text-xl">DC1</Link>
          <h1 className="text-white text-2xl font-bold">Admin Dashboard</h1>
          <div className="text-xs bg-red-900/30 text-red-400 px-3 py-1 rounded-full font-semibold">ADMIN</div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* KPI Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30 rounded-lg p-4">
            <p className="text-gray-400 text-xs mb-1">TOTAL USERS</p>
            <h3 className="text-2xl font-bold text-blue-400">{stats.totalUsers}</h3>
            <p className="text-xs text-gray-500 mt-2">Providers: {stats.totalProviders} | Renters: {stats.totalRenters}</p>
          </div>

          <div className="bg-gradient-to-br from-dc-gold/10 to-transparent border border-dc-gold/30 rounded-lg p-4">
            <p className="text-gray-400 text-xs mb-1">MACHINES</p>
            <h3 className="text-2xl font-bold text-dc-gold">{stats.activeMachines}/{stats.totalMachines}</h3>
            <p className="text-xs text-gray-500 mt-2">Active / Total</p>
          </div>

          <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border border-dc-cyan/30 rounded-lg p-4">
            <p className="text-gray-400 text-xs mb-1">RENTALS</p>
            <h3 className="text-2xl font-bold text-dc-cyan">{stats.activeRentals}/{stats.totalRentals}</h3>
            <p className="text-xs text-gray-500 mt-2">Active / Total</p>
          </div>

          <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30 rounded-lg p-4">
            <p className="text-gray-400 text-xs mb-1">TOTAL VOLUME</p>
            <h3 className="text-2xl font-bold text-green-400">${stats.totalVolume.toFixed(2)}</h3>
            <p className="text-xs text-gray-500 mt-2">Platform revenue</p>
          </div>
        </div>

        {/* Machine Health */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-dc-gold text-xl font-bold">Machine Health</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Model</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Provider</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Uptime</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <tr key={machine.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-sm font-medium">{machine.model}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{machine.provider_id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-sm text-dc-gold font-semibold">${machine.hourly_rate}/hr</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        machine.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {machine.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-green-400 font-semibold">99.8%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Rentals */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-dc-cyan text-xl font-bold">Recent Rentals</h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
              {rentals.slice(0, 5).map((rental) => (
                <div key={rental.id} className="px-6 py-4 hover:bg-gray-800/50">
                  <p className="text-white font-semibold text-sm">Rental #{rental.id.slice(0, 8)}</p>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-xs text-gray-400">
                    <p>Duration: {rental.hours_rented}h</p>
                    <p className={rental.status === 'active' ? 'text-green-400' : 'text-gray-500'}>
                      {rental.status}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{new Date(rental.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Provider Leaderboard */}
          <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-dc-gold text-xl font-bold">Provider Leaderboard</h2>
            </div>
            <div className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
              {users
                .filter((u) => u.role === 'provider')
                .map((provider, idx) => (
                  <div key={provider.id} className="px-6 py-4 hover:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                      <span className="bg-dc-gold text-dc-black w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{provider.email}</p>
                        <p className="text-xs text-gray-500">{provider.role}</p>
                      </div>
                      <p className="text-dc-gold font-bold text-sm">
                        ${wallets.find((w) => w.user_id === provider.id)?.balance.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Auth Notice */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-center">
          <p className="text-blue-400 text-sm font-semibold">
            🔐 Admin access requires @dc1st.com email authentication
          </p>
        </div>
      </div>
    </main>
  )
}
