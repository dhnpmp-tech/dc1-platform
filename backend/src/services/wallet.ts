/**
 * DC1 Wallet Service — Gate 0
 * All internal amounts in HALALA (1 SAR = 100 halala) to avoid floating point.
 * Display conversion: halala / 100 = SAR
 *
 * C3 fix: Atomic debit uses Supabase RPC (debit_wallet_atomic) with SELECT FOR UPDATE
 * to prevent TOCTOU race conditions on concurrent debit calls.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { DbBillingTransaction, DbBillingReservation } from '../types/db';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Types ──────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  userId: string;
  type: 'debit' | 'credit';
  amountHalala: number;
  reason: string;
  jobId?: string;
  createdAt: Date;
}

export interface Reservation {
  id: string;
  userId: string;
  amountHalala: number;
  jobId: string;
  status: 'held' | 'settled' | 'released';
  createdAt: Date;
}

export interface WalletBalance {
  total: number;       // halala
  reserved: number;    // halala
  available: number;   // halala
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert SAR to halala (integer). Rounds to avoid fp drift. */
export function sarToHalala(sar: number): number {
  return Math.round(sar * 100);
}

/** Convert halala to SAR for display. */
export function halalaToSar(halala: number): number {
  return halala / 100;
}

function uuid(): string {
  return crypto.randomUUID();
}

// ── Wallet Operations ──────────────────────────────────────────────────────

/**
 * Debit (decrease) a user's wallet.
 * C3 fix: Uses debit_wallet_atomic RPC which runs inside a DB transaction with
 * SELECT FOR UPDATE to prevent TOCTOU race — concurrent debits cannot double-spend.
 * Idempotent via unique txId.
 */
export async function debit(
  userId: string,
  amountHalala: number,
  reason: string,
  jobId?: string,
  idempotencyKey?: string
): Promise<Transaction> {
  const txId = idempotencyKey ?? uuid();

  // Atomic balance check + debit in a single PL/pgSQL transaction (no TOCTOU)
  const { data, error } = await supabase.rpc('debit_wallet_atomic', {
    p_user_id: userId,
    p_amount_halala: amountHalala,
    p_reason: reason,
    p_job_id: jobId ?? null,
    p_idempotency_key: txId,
  });

  if (error) {
    // Supabase RPC surfaces PL/pgSQL RAISE EXCEPTION as error.message
    throw new Error(`Debit failed: ${error.message}`);
  }

  return mapTx(data as DbBillingTransaction);
}

/**
 * Credit (increase) a user's wallet.
 */
export async function credit(
  userId: string,
  amountHalala: number,
  reason: string,
  jobId?: string,
  idempotencyKey?: string
): Promise<Transaction> {
  const txId = idempotencyKey ?? uuid();

  const { data: existing } = await supabase
    .from('billing_transactions')
    .select('*')
    .eq('id', txId)
    .maybeSingle();
  if (existing) return mapTx(existing);

  const now = new Date();
  const { data, error } = await supabase
    .from('billing_transactions')
    .insert({
      id: txId,
      user_id: userId,
      type: 'credit',
      amount_halala: amountHalala,
      reason,
      job_id: jobId ?? null,
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Credit failed: ${error.message}`);
  return mapTx(data);
}

/**
 * Reserve funds for a job. Funds remain in wallet but unavailable.
 */
export async function reserve(
  userId: string,
  amountHalala: number,
  jobId: string,
  idempotencyKey?: string
): Promise<Reservation> {
  const resId = idempotencyKey ?? uuid();

  const { data: existing } = await supabase
    .from('billing_reservations')
    .select('*')
    .eq('id', resId)
    .maybeSingle();
  if (existing) return mapRes(existing);

  const bal = await getBalance(userId);
  if (bal.available < amountHalala) {
    throw new Error(`Cannot reserve: available ﷼${halalaToSar(bal.available)}, need ﷼${halalaToSar(amountHalala)}`);
  }

  const now = new Date();
  const { data, error } = await supabase
    .from('billing_reservations')
    .insert({
      id: resId,
      user_id: userId,
      amount_halala: amountHalala,
      job_id: jobId,
      status: 'held',
      created_at: now.toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Reserve failed: ${error.message}`);
  return mapRes(data);
}

/**
 * Release a reservation. If actualAmountHalala < reserved, difference is freed.
 * If actualAmountHalala > 0, a debit is recorded for the actual amount.
 */
export async function releaseReservation(
  reservationId: string,
  actualAmountHalala: number
): Promise<void> {
  const { data: res, error: fetchErr } = await supabase
    .from('billing_reservations')
    .select('*')
    .eq('id', reservationId)
    .single();

  if (fetchErr || !res) throw new Error(`Reservation ${reservationId} not found`);
  if (res.status !== 'held') return; // idempotent

  const newStatus = actualAmountHalala > 0 ? 'settled' : 'released';

  const { error } = await supabase
    .from('billing_reservations')
    .update({
      status: newStatus,
      actual_amount_halala: actualAmountHalala,
      settled_at: new Date().toISOString(),
    })
    .eq('id', reservationId);

  if (error) throw new Error(`Release failed: ${error.message}`);
}

/**
 * Get wallet balance. Computed from transactions + reservations.
 * total = sum(credits) - sum(debits)
 * reserved = sum(held reservations)
 * available = total - reserved
 */
export async function getBalance(userId: string): Promise<WalletBalance> {
  // Sum credits
  const { data: credits } = await supabase
    .from('billing_transactions')
    .select('amount_halala')
    .eq('user_id', userId)
    .eq('type', 'credit');

  const totalCredits = (credits ?? []).reduce((s, r) => s + r.amount_halala, 0);

  // Sum debits
  const { data: debits } = await supabase
    .from('billing_transactions')
    .select('amount_halala')
    .eq('user_id', userId)
    .eq('type', 'debit');

  const totalDebits = (debits ?? []).reduce((s, r) => s + r.amount_halala, 0);

  // Sum held reservations
  const { data: reservations } = await supabase
    .from('billing_reservations')
    .select('amount_halala')
    .eq('user_id', userId)
    .eq('status', 'held');

  const totalReserved = (reservations ?? []).reduce((s, r) => s + r.amount_halala, 0);

  const total = totalCredits - totalDebits;
  return {
    total,
    reserved: totalReserved,
    available: total - totalReserved,
  };
}

// ── Mappers ────────────────────────────────────────────────────────────────

// H3 fix: Use proper DB types instead of `any`
function mapTx(row: DbBillingTransaction): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amountHalala: row.amount_halala,
    reason: row.reason,
    jobId: row.job_id ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

function mapRes(row: DbBillingReservation): Reservation {
  return {
    id: row.id,
    userId: row.user_id,
    amountHalala: row.amount_halala,
    jobId: row.job_id,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}
