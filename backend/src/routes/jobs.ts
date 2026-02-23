/**
 * DC1 Gate 0 — Job Execution Routes (Fastify)
 * VOLT-DOCKER Sub-agent
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { submitJob, getJobStatus, completeJob } from '../services/job-pipeline.js';
import type { JobRequest } from '../types/jobs.js';

interface JobIdParams {
  id: string;
}

export default async function jobRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/jobs/submit — Submit a new GPU job */
  app.post(
    '/api/jobs/submit',
    async (
      req: FastifyRequest<{ Body: JobRequest }>,
      reply: FastifyReply,
    ) => {
      try {
        const job = await submitJob(req.body);
        return reply.status(201).send({ success: true, job });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(400).send({ success: false, error: msg });
      }
    },
  );

  /** GET /api/jobs/:id/status — Get job status + metrics */
  app.get(
    '/api/jobs/:id/status',
    async (
      req: FastifyRequest<{ Params: JobIdParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const status = await getJobStatus(req.params.id);
        return reply.send({ success: true, status });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(404).send({ success: false, error: msg });
      }
    },
  );

  /** POST /api/jobs/:id/execute — Start execution (alias for submit flow) */
  app.post(
    '/api/jobs/:id/execute',
    async (
      req: FastifyRequest<{ Params: JobIdParams }>,
      reply: FastifyReply,
    ) => {
      try {
        // Execute triggers a status check / re-launch if needed
        const status = await getJobStatus(req.params.id);
        return reply.send({ success: true, status });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(400).send({ success: false, error: msg });
      }
    },
  );

  /** POST /api/jobs/:id/complete — Trigger completion flow */
  app.post(
    '/api/jobs/:id/complete',
    async (
      req: FastifyRequest<{ Params: JobIdParams }>,
      reply: FastifyReply,
    ) => {
      try {
        const result = await completeJob(req.params.id);
        return reply.send({ success: true, result });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return reply.status(400).send({ success: false, error: msg });
      }
    },
  );
}
