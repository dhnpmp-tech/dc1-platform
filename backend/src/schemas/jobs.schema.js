'use strict';

const { z } = require('zod');

/**
 * POST /api/jobs/submit — job submission body.
 *
 * Note: the actual handler accepts many optional fields.  This schema validates
 * the fields that are security-relevant or required for routing.  Unknown keys
 * are stripped by Zod's .strict() equivalent (strip mode, the default).
 */
const jobSubmitSchema = z.object({
  // Core routing fields
  job_type: z.string().min(1).max(64).optional(),
  template_id: z.string().min(1).max(128).optional(),

  // Duration: 0.1 to 1440 minutes (24 hours)
  duration_minutes: z.number().min(0.1).max(1440).optional(),

  // Optional provider targeting
  provider_id: z.union([z.number().int().positive(), z.null()]).optional(),

  // GPU requirements object — keys and values must be strings/numbers
  gpu_requirements: z
    .object({
      min_vram_gb: z.number().positive().optional(),
    })
    .passthrough()
    .optional(),

  // Container spec — allow passthrough of image_override etc.
  container_spec: z
    .object({
      image_override: z.string().min(1).max(512).optional(),
    })
    .passthrough()
    .optional(),

  // Arbitrary env vars and params — values must be strings or numbers
  env_vars: z.record(z.string(), z.string()).optional(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  task_spec: z.record(z.string(), z.unknown()).optional(),

  // Optional metadata
  model: z.string().max(256).optional(),
  priority: z.string().max(32).optional(),
  pricing_class: z.string().max(64).optional(),
  prewarm_requested: z.boolean().optional(),
  max_duration_seconds: z.number().positive().max(86400).optional(),
}).strict();

module.exports = { jobSubmitSchema };
