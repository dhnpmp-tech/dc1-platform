'use strict';

const { z } = require('zod');
const { normalizeProviderOs } = require('../lib/provider-os');

const providerOsSchema = z.string().min(1).max(40).transform((value, ctx) => {
  const normalized = normalizeProviderOs(value);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid OS value',
    });
    return z.NEVER;
  }
  return normalized;
});

/**
 * POST /api/providers/register — provider registration body.
 */
const providerRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  gpu_model: z.string().min(1).max(120),
  os: providerOsSchema,
  phone: z.string().max(40).optional(),
  location: z.string().max(200).optional(),
  location_country: z.string().max(200).optional(),
  resource_spec: z.union([z.string().max(4096), z.record(z.string(), z.unknown())]).optional(),
}).strict().transform((body) => {
  const normalizedLocation = body.location ?? body.location_country;
  const nextBody = { ...body };
  delete nextBody.location_country;
  if (normalizedLocation !== undefined) {
    nextBody.location = normalizedLocation;
  }
  return nextBody;
});

/**
 * POST /api/providers/:id/benchmark — GPU benchmark submission body.
 */
const providerBenchmarkSchema = z.object({
  gpu_model: z.string().min(1).max(255),
  vram_gb: z.number().min(1).max(1000),
  tflops: z.number().min(1).max(10000),
  bandwidth_gbps: z.number().min(1).max(100000),
  tokens_per_sec: z.number().min(1).max(100000),
  tier: z.enum(['A', 'B', 'C']).optional(),
}).strict();

module.exports = { providerRegisterSchema, providerBenchmarkSchema };
