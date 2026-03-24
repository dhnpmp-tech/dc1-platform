'use strict';

const { z } = require('zod');

/**
 * POST /api/renters/topup — sandbox top-up (dev/staging only).
 *
 * Accepts either halala (integer) or SAR (float); handler converts as needed.
 */
const renterTopupSchema = z
  .object({
    amount_halala: z.number().int().min(1).max(100000).optional(),
    amount_sar: z.number().min(0.01).max(1000).optional(),
  })
  .strict()
  .refine(
    (data) => data.amount_halala != null || data.amount_sar != null,
    { message: 'Provide amount_halala (int) or amount_sar (float)' }
  );

/**
 * POST /api/renters/register — renter registration body.
 */
const renterRegisterSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  organization: z.string().max(160).optional(),
  use_case: z.string().max(120).optional(),
  useCase: z.string().max(120).optional(),   // legacy alias accepted by the handler
  phone: z.string().max(40).optional(),
}).strict();

module.exports = { renterTopupSchema, renterRegisterSchema };
