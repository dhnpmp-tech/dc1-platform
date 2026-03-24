'use strict';

const { z } = require('zod');

/**
 * POST /api/benchmark/run — start a benchmark on a provider.
 */
const benchmarkRunSchema = z.object({
  provider_id: z.union([z.string().min(1).max(128), z.number().int().positive()]),
  benchmark_type: z.enum(['quick', 'standard', 'full']),
}).strict();

/**
 * POST /api/benchmark/simulate — simulate a benchmark result (dev/test).
 */
const benchmarkSimulateSchema = z.object({
  provider_id: z.union([z.string().min(1).max(128), z.number().int().positive()]),
  benchmark_type: z.enum(['quick', 'standard', 'full']).optional(),
  score_gflops: z.number().positive().optional(),
  temp_max_celsius: z.number().min(0).max(200).optional(),
  vram_used_mib: z.number().positive().optional(),
  latency_ms: z.number().positive().optional(),
}).strict();

module.exports = { benchmarkRunSchema, benchmarkSimulateSchema };
