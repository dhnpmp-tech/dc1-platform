/**
 * validate.js — Zod-based request body validation middleware factory.
 *
 * Usage:
 *   const { validateBody } = require('../middleware/validate');
 *   const { jobSubmitSchema } = require('../schemas/jobs.schema');
 *
 *   router.post('/submit', validateBody(jobSubmitSchema), handler);
 *
 * Behaviour:
 *   - Parses `req.body` against the supplied Zod schema.
 *   - On failure: responds 400 with structured field-level errors.
 *   - On success: replaces `req.body` with the parsed (and stripped) output
 *     so handlers receive clean, type-safe data.
 */
'use strict';

const { ZodError } = require('zod');

/**
 * Format a ZodError into an array of { field, message } objects.
 * @param {ZodError} error
 * @returns {{ field: string; message: string }[]}
 */
function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Middleware factory.  Pass a Zod schema; returns an Express middleware that
 * validates req.body and either calls next() with the parsed body or sends a
 * 400 response with structured validation errors.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @returns {import('express').RequestHandler}
 */
function validateBody(schema) {
  return function validate(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      return res.status(400).json({
        error: 'Validation failed',
        fields: errors,
      });
    }
    // Replace req.body with the parsed (unknown-field-stripped) output.
    req.body = result.data;
    return next();
  };
}

module.exports = { validateBody, formatZodErrors };
