'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, getMachines, getTransactions } from '@/lib/supabase'

interface Machine {
  id: string
  model: string
  vram: number
  hourly_rate: number
  provider_id: string
  status: string
}

interface Transaction {
  id: string
  user_id: string
  amount: number
  type: string
  created_at: string
}

export default function RenterDashboard() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    minVram: 0,
    maxPrice: 10,
    status: 'all',
  })
  const [totalSpent, setTotalSpent] = useState(0)
  const [rebates, setRebates] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [machinesData, transactionsData] = await Promise.all([
          getMachines(),
          getTransactions(),
        ])

        setMachines(machinesData)
        applyFilters(machinesData)

        // Calculate billing and rebates
        const spent = transactionsData.reduce((sum: number, tx: any) => {
          return tx.type === 'rental' ? sum + tx.amount : sum
        }, 0)
        setTotalSpent(spent)
        setRebates(spent * 0.05) // 5% rebate

        setTransactions(transactionsData)
      } catch (error) {
        console.error('Error loading renter data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // Real-time subscription
    const subscription = supabase
      .channel('renter-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const applyFilters = (machineList: Machine[]) => {
    const filtered = machineList.filter((m) => {
      const matchesVram = m.vram >= filter.minVram
      const matchesPrice = m.hourly_rate <= filter.maxPrice
      const matchesStatus = filter.status === 'all' || m.status === filter.status
      return matchesVram && matchesPrice && matchesStatus
    })
    setFilteredMachines(filtered)
  }

  const handleFilterChange = (key: string, value: any) => {
    const newFilter = { ...filter, [key]: value }
    setFilter(newFilter)
    applyFilters(machines)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dc-black flex items-center justify-center">
        <p className="text-dc-cyan text-xl">Loading Renter Dashboard...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-dc-black">
      {/* Navigation */}
      <nav className="bg-gray-900 border-b border-dc-cyan/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-dc-cyan font-bold text-xl">DC1</Link>
          <h1 className="text-dc-cyan text-2xl font-bold">Renter Dashboard</h1>
          <div />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Billing & Rebates */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-dc-cyan/10 to-transparent border border-dc-cyan/30 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Total Spent</p>
            <h2 className="text-3xl font-bold text-dc-cyan">${totalSpent.toFixed(2)}</h2>
            <p className="text-xs text-gray-500 mt-2">Lifetime spending</p>
          </div>

          <div className="bg-gradient-to-br from-dc-gold/10 to-transparent border border-dc-gold/30 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Rebate Earned</p>
            <h2 className="text-3xl font-bold text-dc-gold">${rebates.toFixed(2)}</h2>
            <p className="text-xs text-gray-500 mt-2">5% on all rentals</p>
          </div>

          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-lg p-6">
            <p className="text-gray-400 text-sm">Available GPUs</p>
            <h2 className="text-3xl font-bold text-white">{filteredMachines.length}</h2>
            <p className="text-xs text-gray-500 mt-2">Ready to rent</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 mb-8">
          <h3 className="text-dc-cyan font-bold mb-4">GPU Marketplace Filters</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Min VRAM (GB)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filter.minVram}
                onChange={(e) => handleFilterChange('minVram', parseInt(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Max Price ($/hr)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={filter.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', parseFloat(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Status</label>
              <select
                value={filter.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* GPU Marketplace */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredMachines.map((machine) => (
            <div key={machine.id} className="bg-gray-900 rounded-lg border border-gray-700 hover:border-dc-cyan/50 overflow-hidden transition-all group">
              <div className="bg-gradient-to-r from-dc-cyan/20 to-transparent p-4 border-b border-gray-700">
                <h3 className="text-lg font-bold text-white group-hover:text-dc-cyan transition">{machine.model}</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">VRAM</p>
                    <p className="text-lg font-bold text-dc-cyan">{machine.vram}GB</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Hourly Rate</p>
                    <p className="text-lg font-bold text-dc-gold">${machine.hourly_rate}/hr</p>
                  </div>
                </div>
                <div className="mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    machine.status === 'active' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-300'
                  }`}>
                    {machine.status}
                  </span>
                </div>
                <button className="w-full bg-dc-cyan text-dc-black font-bold py-2 rounded hover:bg-dc-cyan/90 transition">
                  Rent Now
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-dc-cyan text-xl font-bold">Billing History</h2>
          </div>
          <div className="divide-y divide-gray-700">
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-800/50">
                <div>
                  <p className="text-white font-semibold capitalize">{tx.type}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <p className={`text-lg font-bold ${tx.type === 'rebate' ? 'text-dc-gold' : 'text-red-400'}`}>
                  {tx.type === 'rebate' ? '+' : '-'}${tx.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
