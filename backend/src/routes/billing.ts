/**
 * DC1 Billing Routes — Gate 0
 * Fastify routes for billing and wallet endpoints.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as billing from '../services/billing';
import { halalaToSar } from '../services/wallet';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/** Format halala amounts to SAR for API responses */
function formatSar(halala: number): string {
  return `﷼${halalaToSar(halala).toFixed(2)}`;
}

export default async function billingRoutes(app: FastifyInstance) {

  // ── GET /api/billing/:sessionId ────────────────────────────────────────
  app.get('/api/billing/:sessionId', async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = req.params;

      const { data: session, error } = await supabase
        .from('billing_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (error || !session) return reply.code(404).send({ error: 'Session not found' });

      const { data: ticks } = await supabase
        .from('billing_ticks')
        .select('*')
        .eq('session_id', sessionId)
        .order('tick_number', { ascending: true });

      return reply.send({
        session: {
          id: session.id,
          jobId: session.job_id,
          renterId: session.renter_id,
          providerId: session.provider_id,
          ratePerHour: formatSar(session.rate_per_hour_halala),
          startedAt: session.started_at,
          endedAt: session.ended_at,
          status: session.status,
          reservedAmount: formatSar(session.reserved_amount_halala),
        },
        ticks: (ticks ?? []).map(t => ({
          tickNumber: t.tick_number,
          elapsedMinutes: t.elapsed_minutes,
          incrementMinutes: t.increment_minutes,
          renterCharge: formatSar(t.renter_charge_halala),
          providerCredit: formatSar(t.provider_credit_halala),
          dc1Revenue: formatSar(t.dc1_revenue_halala),
          proofHash: t.proof_hash,
          recordedAt: t.recorded_at,
        })),
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── GET /api/billing/:sessionId/receipt ─────────────────────────────────
  app.get('/api/billing/:sessionId/receipt', async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = req.params;

      const { data: receipt, error } = await supabase
        .from('billing_receipts')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error || !receipt) return reply.code(404).send({ error: 'Receipt not found. Session may still be active.' });

      return reply.send({
        sessionId: receipt.session_id,
        jobId: receipt.job_id,
        totalMinutes: receipt.total_minutes,
        renterChargedTotal: formatSar(receipt.renter_charged_total_halala),
        providerPayoutTotal: formatSar(receipt.provider_payout_total_halala),
        dc1RevenueTotal: formatSar(receipt.dc1_revenue_total_halala),
        receiptHash: receipt.receipt_hash,
        closedAt: receipt.closed_at,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── POST /api/billing/:sessionId/verify ─────────────────────────────────
  app.post('/api/billing/:sessionId/verify', async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const audit = await billing.verifyBillingIntegrity(req.params.sessionId);
      return reply.send({
        sessionId: audit.sessionId,
        allValid: audit.allValid,
        tickCount: audit.tickCount,
        discrepancies: audit.discrepancies,
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── GET /api/wallets/:userId ────────────────────────────────────────────
  app.get('/api/wallets/:userId', async (req: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
    try {
      const balance = await billing.getWalletBalance(req.params.userId);
      return reply.send({
        userId: req.params.userId,
        total: formatSar(balance.totalHalala),
        reserved: formatSar(balance.reservedHalala),
        available: formatSar(balance.availableHalala),
        raw: {
          totalHalala: balance.totalHalala,
          reservedHalala: balance.reservedHalala,
          availableHalala: balance.availableHalala,
        },
      });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
