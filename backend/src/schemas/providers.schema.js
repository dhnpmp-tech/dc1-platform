'use strict';

const { z } = require('zod');

/**
 * POST /api/providers/register — provider registration body.
 * Captures GPU capability spec for job matching and marketplace discovery (DCP-796).
 */
const providerRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  gpu_model: z.string().min(1).max(120),
  os: z.enum(['windows', 'linux', 'mac', 'darwin']),
  phone: z.string().max(40).optional(),
  location: z.string().max(200).optional(),
  // GPU capability fields for job matching
  vram_gb: z.number().min(1).max(1000).optional(),
  cuda_version: z.string().max(20).optional(),
  gpu_count: z.number().min(1).max(1000).optional(),
  bandwidth_mbps: z.number().min(1).max(1000000).optional(),
  available_containers: z.array(z.string()).optional(),
  resource_spec: z.union([z.string().max(4096), z.record(z.string(), z.unknown())]).optional(),
}).strict();

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
