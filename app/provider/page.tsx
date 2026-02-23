'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getMachines, getRentals, getWallets } from '@/lib/supabase'

interface Machine {
  id: string
  model: string
  vram: number
  hourly_rate: number
  status: string
}

interface Rental {
  id: string
  machine_id: string
  renter_id: string
  hours_rented: number
  status: string
}

interface Wallet {
  id: string
  user_id: string
  balance: number
}

export default function ProviderDashboard() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [loading, setLoading] = useState(true)
  const [earnings, setEarnings] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [machinesData, rentalsData, walletsData] = await Promise.all([
          getMachines(),
          getRentals(),
          getWallets(),
        ])

        setMachines(machinesData)
        setRentals(rentalsData)
        
        // Get first provider's wallet
        const providerWallet = walletsData.find((w: any) => w.user_id === 'tareg-uuid')
        setWallet(providerWallet || null)

        // Calculate earnings
        const totalEarnings = rentalsData.reduce((sum: number, rental: any) => {
          const machine = machinesData.find((m: any) => m.id === rental.machine_id)
          return sum + (rental.hours_rented * (machine?.hourly_rate || 0))
        }, 0)
        setEarnings(totalEarnings)
      } catch (error) {
        console.error('Error loading provider data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription
    const subscription = supabase
      .channel('provider-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
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
        <p className="text-dc-gold text-xl">Loading Provider Dashboard...</p>
      </div>
    )
  }

  const activeRentals = rentals.filter(r => r.status === 'active')
  const rewardTier = earnings > 10000 ? 'Gold' : earnings > 5000 ? 'Silver' : 'Bronze'

  return (
    <main className="min-h-screen bg-dc-black">
      {/* Navigation */}
      <nav className="bg-gray-900 border-b border-dc-gold/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-dc-gold font-bold text-xl">DC1</Link>
          <h1 className="text-dc-gold text-2xl font-bold">Provider Dashboard</h1>
          <div />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Earnings Summary */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-dc-gold/10 to-transparent border border-dc-gold/30 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Total Earnings</p>
            <h2 className="text-3xl font-bold text-dc-gold">${earnings.toFixed(2)}</h2>
            <p className="text-xs text-gray-500 mt-2">From {rentals.length} rentals</p>
          </div>

          <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border border-dc-cyan/30 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Active Rentals</p>
            <h2 className="text-3xl font-bold text-dc-cyan">{activeRentals.length}</h2>
            <p className="text-xs text-gray-500 mt-2">Generating income</p>
          </div>

          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Reward Tier</p>
            <h2 className="text-3xl font-bold text-white">{rewardTier}</h2>
            <p className="text-xs text-gray-500 mt-2">Based on earnings</p>
          </div>
        </div>

        {/* Machines Table */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-dc-gold text-xl font-bold">Your Machines</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Model</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">VRAM</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Hourly Rate</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((machine) => (
                  <tr key={machine.id} className="border-b border-gray-700 hover:bg-gray-800/50">
                    <td className="px-6 py-4 text-sm">{machine.model}</td>
                    <td className="px-6 py-4 text-sm">{machine.vram}GB</td>
                    <td className="px-6 py-4 text-sm text-dc-gold">${machine.hourly_rate}/hr</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        machine.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {machine.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-dc-cyan hover:text-dc-cyan/80">Manage</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Rentals */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 mb-8 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-dc-cyan text-xl font-bold">Active Rentals</h2>
            <span className="text-dc-cyan font-bold">{activeRentals.length}</span>
          </div>
          <div className="p-6">
            {activeRentals.length > 0 ? (
              <div className="space-y-4">
                {activeRentals.map((rental) => (
                  <div key={rental.id} className="bg-gray-800 rounded p-4 flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">Rental #{rental.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-400">{rental.hours_rented} hours rented</p>
                    </div>
                    <button className="bg-dc-cyan/20 text-dc-cyan hover:bg-dc-cyan/30 px-4 py-2 rounded">
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No active rentals</p>
            )}
          </div>
        </div>

        {/* Withdraw Button */}
        <div className="bg-gradient-to-r from-dc-gold/10 to-transparent border border-dc-gold/30 rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-dc-gold font-bold text-lg mb-1">Available Balance</h3>
              <p className="text-gray-400">${wallet?.balance.toFixed(2) || '0.00'}</p>
            </div>
            <button className="bg-dc-gold text-dc-black px-8 py-3 rounded-lg font-bold hover:bg-dc-gold/90 transition">
              Withdraw
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
