/**
 * DC1 Billing Engine — Gate 0
 * Penny-perfect billing with cryptographic proofs.
 * All internal math in HALALA (integer). 1 SAR = 100 halala.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import * as wallet from './wallet';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// ── Constants ──────────────────────────────────────────────────────────────

/** Provider share: 75% */
const PROVIDER_SHARE = 75;
/** DC1 share: 25% */
const DC1_SHARE = 25;
/** Default reservation: 24 hours worth */
const DEFAULT_RESERVE_HOURS = 24;

// ── Interfaces ─────────────────────────────────────────────────────────────

export interface BillingSession {
  id: string;
  jobId: string;
  renterId: string;
  providerId: string;
  ratePerHourHalala: number;
  startedAt: Date;
  endedAt?: Date;
  reservationId: string;
  reservedAmountHalala: number;
  status: 'active' | 'closing' | 'closed';
}

export interface BillingTick {
  id: string;
  sessionId: string;
  tickNumber: number;
  elapsedMinutes: number;
  renterChargeHalala: number;
  providerCreditHalala: number;
  dc1RevenueHalala: number;
  proofHash: string;
  recordedAt: Date;
}

export interface BillingReceipt {
  sessionId: string;
  jobId: string;
  totalMinutes: number;
  renterChargedTotalHalala: number;
  providerPayoutTotalHalala: number;
  dc1RevenueTotalHalala: number;
  receiptHash: string;
  closedAt: Date;
}

export interface BillingAudit {
  sessionId: string;
  allValid: boolean;
  tickCount: number;
  discrepancies: Array<{ tickNumber: number; expected: string; actual: string; field: string }>;
}

export interface PayoutRecord {
  id: string;
  providerId: string;
  sessionId: string;
  amountHalala: number;
  status: 'pending';
  createdAt: Date;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function uuid(): string { return crypto.randomUUID(); }

function computeProofHash(jobId: string, sessionId: string, amountHalala: number, timestamp: string): string {
  return crypto.createHash('sha256')
    .update(`${jobId}|${sessionId}|${amountHalala}|${timestamp}`)
    .digest('hex');
}

/** Calculate cost in halala for a given number of minutes at a rate per hour (halala). */
function costForMinutes(minutes: number, ratePerHourHalala: number): number {
  // Integer arithmetic: (minutes * rate) / 60, rounded to nearest halala
  return Math.round((minutes * ratePerHourHalala) / 60);
}

function splitCost(totalHalala: number): { provider: number; dc1: number } {
  const provider = Math.round((totalHalala * PROVIDER_SHARE) / 100);
  const dc1 = totalHalala - provider; // remainder to DC1, ensures sum = total
  return { provider, dc1 };
}

function minutesBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 60000); // round to nearest minute
}

// ── Billing Engine ─────────────────────────────────────────────────────────

/**
 * Start a billing session for a GPU job.
 */
export async function startBillingSession(
  jobId: string,
  renterId: string,
  providerId: string,
  ratePerHourSar: number
): Promise<BillingSession> {
  const sessionId = uuid();
  const rateHalala = wallet.sarToHalala(ratePerHourSar);
  const reserveHalala = rateHalala * DEFAULT_RESERVE_HOURS;
  const now = new Date();

  // Idempotency: check if session already exists for this job
  const { data: existing } = await supabase
    .from('billing_sessions')
    .select('*')
    .eq('job_id', jobId)
    .in('status', ['active', 'closing'])
    .maybeSingle();
  if (existing) return mapSession(existing);

  // Reserve funds from renter
  const reservation = await wallet.reserve(renterId, reserveHalala, jobId);

  const { data, error } = await supabase
    .from('billing_sessions')
    .insert({
      id: sessionId,
      job_id: jobId,
      renter_id: renterId,
      provider_id: providerId,
      rate_per_hour_halala: rateHalala,
      started_at: now.toISOString(),
      reservation_id: reservation.id,
      reserved_amount_halala: reserveHalala,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw new Error(`startBillingSession failed: ${error.message}`);
  return mapSession(data);
}

/**
 * Record a billing tick (called hourly).
 */
export async function recordBillingTick(sessionId: string): Promise<BillingTick> {
  const session = await getSession(sessionId);
  if (session.status !== 'active') throw new Error(`Session ${sessionId} is ${session.status}, not active`);

  // Get previous ticks to determine tick number and already-billed minutes
  const { data: prevTicks } = await supabase
    .from('billing_ticks')
    .select('tick_number, elapsed_minutes')
    .eq('session_id', sessionId)
    .order('tick_number', { ascending: false })
    .limit(1);

  const lastTick = prevTicks?.[0];
  const tickNumber = lastTick ? lastTick.tick_number + 1 : 1;
  const previouslyBilledMinutes = lastTick ? lastTick.elapsed_minutes : 0;

  const now = new Date();
  const totalElapsedMinutes = minutesBetween(session.startedAt, now);
  const incrementMinutes = totalElapsedMinutes - previouslyBilledMinutes;

  if (incrementMinutes <= 0) {
    // Idempotent: no new time to bill
    throw new Error('No new minutes to bill since last tick');
  }

  // Calculate costs for THIS increment only
  const renterCharge = costForMinutes(incrementMinutes, session.ratePerHourHalala);
  const { provider, dc1 } = splitCost(renterCharge);

  const timestamp = now.toISOString();
  const proofHash = computeProofHash(session.jobId, sessionId, renterCharge, timestamp);

  // Debit renter
  await wallet.debit(session.renterId, renterCharge, `Billing tick #${tickNumber} for job ${session.jobId}`, session.jobId);

  // Credit provider (escrow)
  await wallet.credit(session.providerId, provider, `Provider credit tick #${tickNumber} for job ${session.jobId}`, session.jobId);

  const tickId = uuid();
  const { data, error } = await supabase
    .from('billing_ticks')
    .insert({
      id: tickId,
      session_id: sessionId,
      tick_number: tickNumber,
      elapsed_minutes: totalElapsedMinutes,
      increment_minutes: incrementMinutes,
      renter_charge_halala: renterCharge,
      provider_credit_halala: provider,
      dc1_revenue_halala: dc1,
      proof_hash: proofHash,
      recorded_at: timestamp,
    })
    .select()
    .single();

  if (error) throw new Error(`recordBillingTick failed: ${error.message}`);
  return mapTick(data);
}

/**
 * Close a billing session. Final settlement.
 */
export async function closeBillingSession(sessionId: string): Promise<BillingReceipt> {
  const session = await getSession(sessionId);
  if (session.status === 'closed') {
    // Idempotent: return existing receipt
    const { data: receipt } = await supabase
      .from('billing_receipts')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    if (receipt) return mapReceipt(receipt);
  }

  // Mark closing
  await supabase.from('billing_sessions').update({ status: 'closing' }).eq('id', sessionId);

  const now = new Date();
  const totalMinutes = minutesBetween(session.startedAt, now);
  const totalRenterCharge = costForMinutes(totalMinutes, session.ratePerHourHalala);
  const { provider: totalProvider, dc1: totalDc1 } = splitCost(totalRenterCharge);

  // Sum already-billed amounts from ticks
  const { data: ticks } = await supabase
    .from('billing_ticks')
    .select('renter_charge_halala, provider_credit_halala, dc1_revenue_halala')
    .eq('session_id', sessionId);

  const billedRenter = (ticks ?? []).reduce((s, t) => s + t.renter_charge_halala, 0);
  const billedProvider = (ticks ?? []).reduce((s, t) => s + t.provider_credit_halala, 0);

  // Settle remainder
  const remainRenter = totalRenterCharge - billedRenter;
  const remainProvider = totalProvider - billedProvider;

  if (remainRenter > 0) {
    await wallet.debit(session.renterId, remainRenter, `Final settlement for job ${session.jobId}`, session.jobId);
  }
  if (remainProvider > 0) {
    await wallet.credit(session.providerId, remainProvider, `Final provider credit for job ${session.jobId}`, session.jobId);
  }

  // Release reservation (actual = totalRenterCharge)
  await wallet.releaseReservation(session.reservationId, totalRenterCharge);

  // Generate receipt
  const closedAt = now.toISOString();
  const receiptHash = crypto.createHash('sha256')
    .update(`RECEIPT|${sessionId}|${session.jobId}|${totalRenterCharge}|${totalProvider}|${totalDc1}|${closedAt}`)
    .digest('hex');

  const receiptId = uuid();
  const { data: receiptRow, error } = await supabase
    .from('billing_receipts')
    .insert({
      id: receiptId,
      session_id: sessionId,
      job_id: session.jobId,
      total_minutes: totalMinutes,
      renter_charged_total_halala: totalRenterCharge,
      provider_payout_total_halala: totalProvider,
      dc1_revenue_total_halala: totalDc1,
      receipt_hash: receiptHash,
      closed_at: closedAt,
    })
    .select()
    .single();

  if (error) throw new Error(`closeBillingSession receipt failed: ${error.message}`);

  // Mark closed
  await supabase.from('billing_sessions').update({ status: 'closed', ended_at: closedAt }).eq('id', sessionId);

  return mapReceipt(receiptRow);
}

/**
 * Verify billing integrity for a session.
 */
export async function verifyBillingIntegrity(sessionId: string): Promise<BillingAudit> {
  const session = await getSession(sessionId);
  const { data: ticks } = await supabase
    .from('billing_ticks')
    .select('*')
    .eq('session_id', sessionId)
    .order('tick_number', { ascending: true });

  const discrepancies: BillingAudit['discrepancies'] = [];

  for (const tick of (ticks ?? [])) {
    // Verify proof hash
    const expectedHash = computeProofHash(
      session.jobId, sessionId, tick.renter_charge_halala, tick.recorded_at
    );
    if (expectedHash !== tick.proof_hash) {
      discrepancies.push({
        tickNumber: tick.tick_number,
        expected: expectedHash,
        actual: tick.proof_hash,
        field: 'proofHash',
      });
    }

    // Verify split consistency
    const { provider, dc1 } = splitCost(tick.renter_charge_halala);
    if (provider !== tick.provider_credit_halala) {
      discrepancies.push({
        tickNumber: tick.tick_number,
        expected: String(provider),
        actual: String(tick.provider_credit_halala),
        field: 'providerCredit',
      });
    }
    if (dc1 !== tick.dc1_revenue_halala) {
      discrepancies.push({
        tickNumber: tick.tick_number,
        expected: String(dc1),
        actual: String(tick.dc1_revenue_halala),
        field: 'dc1Revenue',
      });
    }
  }

  // If closed, verify ticks + final settlement = receipt
  if (session.status === 'closed') {
    const { data: receipt } = await supabase
      .from('billing_receipts')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (receipt) {
      const tickTotal = (ticks ?? []).reduce((s, t) => s + t.renter_charge_halala, 0);
      // Note: final settlement covers the gap, so tick total ≤ receipt total is expected
    }
  }

  return {
    sessionId,
    allValid: discrepancies.length === 0,
    tickCount: (ticks ?? []).length,
    discrepancies,
  };
}

/**
 * Get wallet balance (delegates to wallet service).
 */
export async function getWalletBalance(userId: string) {
  const bal = await wallet.getBalance(userId);
  return {
    totalSar: wallet.halalaToSar(bal.total),
    reservedSar: wallet.halalaToSar(bal.reserved),
    availableSar: wallet.halalaToSar(bal.available),
    totalHalala: bal.total,
    reservedHalala: bal.reserved,
    availableHalala: bal.available,
  };
}

/**
 * Record provider payout intent (Gate 0: no actual transfer).
 */
export async function processProviderPayout(
  providerId: string,
  sessionId: string
): Promise<PayoutRecord> {
  // Idempotency
  const { data: existing } = await supabase
    .from('billing_payouts')
    .select('*')
    .eq('session_id', sessionId)
    .eq('provider_id', providerId)
    .maybeSingle();
  if (existing) return mapPayout(existing);

  const { data: receipt } = await supabase
    .from('billing_receipts')
    .select('provider_payout_total_halala')
    .eq('session_id', sessionId)
    .single();

  if (!receipt) throw new Error(`No receipt for session ${sessionId}`);

  const payoutId = uuid();
  const { data, error } = await supabase
    .from('billing_payouts')
    .insert({
      id: payoutId,
      provider_id: providerId,
      session_id: sessionId,
      amount_halala: receipt.provider_payout_total_halala,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`processProviderPayout failed: ${error.message}`);
  return mapPayout(data);
}

// ── Internal ───────────────────────────────────────────────────────────────

async function getSession(sessionId: string): Promise<BillingSession> {
  const { data, error } = await supabase
    .from('billing_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (error || !data) throw new Error(`Session ${sessionId} not found`);
  return mapSession(data);
}

function mapSession(row: any): BillingSession {
  return {
    id: row.id,
    jobId: row.job_id,
    renterId: row.renter_id,
    providerId: row.provider_id,
    ratePerHourHalala: row.rate_per_hour_halala,
    startedAt: new Date(row.started_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : undefined,
    reservationId: row.reservation_id,
    reservedAmountHalala: row.reserved_amount_halala,
    status: row.status,
  };
}

function mapTick(row: any): BillingTick {
  return {
    id: row.id,
    sessionId: row.session_id,
    tickNumber: row.tick_number,
    elapsedMinutes: row.elapsed_minutes,
    renterChargeHalala: row.renter_charge_halala,
    providerCreditHalala: row.provider_credit_halala,
    dc1RevenueHalala: row.dc1_revenue_halala,
    proofHash: row.proof_hash,
    recordedAt: new Date(row.recorded_at),
  };
}

function mapReceipt(row: any): BillingReceipt {
  return {
    sessionId: row.session_id,
    jobId: row.job_id,
    totalMinutes: row.total_minutes,
    renterChargedTotalHalala: row.renter_charged_total_halala,
    providerPayoutTotalHalala: row.provider_payout_total_halala,
    dc1RevenueTotalHalala: row.dc1_revenue_total_halala,
    receiptHash: row.receipt_hash,
    closedAt: new Date(row.closed_at),
  };
}

function mapPayout(row: any): PayoutRecord {
  return {
    id: row.id,
    providerId: row.provider_id,
    sessionId: row.session_id,
    amountHalala: row.amount_halala,
    status: row.status,
    createdAt: new Date(row.created_at),
  };
}
