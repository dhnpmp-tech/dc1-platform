'use strict';
/**
 * /api/webhooks — Incoming provider webhook endpoints (DCP-722)
 *
 * Providers POST signed events here. Every route is protected by
 * webhookHmacMiddleware, which validates X-DCP-Signature against the
 * provider's own API key.
 *
 * Endpoints:
 *   POST /api/webhooks/provider/event  — Generic provider event (job_done,
 *                                        container_exit, error_report, etc.)
 */

const express = require('express');
const router = express.Router();
const { webhookHmacMiddleware } = require('../middleware/webhookHmac');
const { handleProviderEvent } = require('../services/jobQueue');

// All routes in this file require valid provider HMAC
router.use(webhookHmacMiddleware);

// POST /api/webhooks/provider/event
// Generic provider event ingestion signed with provider API key.
// Body: { "event": string, "job_id"?: string, "payload"?: object }
router.post('/provider/event', (req, res) => {
  const { event, job_id, payload } = req.body || {};

  if (typeof event !== 'string' || !event.trim()) {
    return res.status(400).json({ error: '"event" field is required and must be a non-empty string' });
  }

  const provider = req.webhookProvider;
  console.info(`[webhooks] provider=${provider.id} event=${event} job_id=${job_id || 'n/a'}`);

  // Dispatch to jobQueue to update job status based on event type
  const queueResult = handleProviderEvent({ event, job_id, provider_id: provider.id, payload });

  return res.status(200).json({
    received: true,
    provider_id: provider.id,
    event,
    job_id: job_id || null,
    job_updated: queueResult.updated,
    job_status: queueResult.newStatus || null,
  });
});

module.exports = router;
