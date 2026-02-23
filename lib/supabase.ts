import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fvvxqp-qqjszv6vweybvjfpc.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_fQ3SU27BygDby6WzWkjRtA_lQ3C994x'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getUsers() {
  const { data, error } = await supabase.from('users').select('*')
  if (error) console.error('Error fetching users:', error)
  return data || []
}

export async function getMachines() {
  const { data, error } = await supabase.from('machines').select('*')
  if (error) console.error('Error fetching machines:', error)
  return data || []
}

export async function getRentals() {
  const { data, error } = await supabase.from('rentals').select('*')
  if (error) console.error('Error fetching rentals:', error)
  return data || []
}

export async function getWallets() {
  const { data, error } = await supabase.from('wallets').select('*')
  if (error) console.error('Error fetching wallets:', error)
  return data || []
}

export async function getTransactions() {
  const { data, error } = await supabase.from('transactions').select('*')
  if (error) console.error('Error fetching transactions:', error)
  return data || []
}

export async function getRatings() {
  const { data, error } = await supabase.from('ratings').select('*')
  if (error) console.error('Error fetching ratings:', error)
  return data || []
}
