'use strict';

/**
 * imageValidation.js — DCP-SEC-011
 *
 * Validates Docker image references against the approved registry whitelist.
 * Used in template deploy to prevent image_override injection attacks.
 */

// Approved registry prefixes and exact patterns.
const APPROVED_REGISTRY_PATTERNS = [
  /^ghcr\.io\/dcp-/i,
  /^docker\.io\/nvidia\//i,
  /^nvcr\.io\/nvidia\//i,
  /^huggingface\//i,
  /^dc1\//i,
  /^pytorch\/pytorch:/i,
  /^tensorflow\/tensorflow:/i,
];

// Exact approved images (from APPROVED_IMAGES_EXTRA in templates.js)
const APPROVED_EXACT = new Set([
  'dc1/general-worker:latest',
  'dc1/llm-worker:latest',
  'dc1/sd-worker:latest',
  'dc1/base-worker:latest',
  'pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime',
  'pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime',
  'nvcr.io/nvidia/pytorch:24.01-py3',
  'nvcr.io/nvidia/tensorflow:24.01-tf2-py3',
  'tensorflow/tensorflow:2.15.0-gpu',
]);

/**
 * Returns true if the image reference is on the approved whitelist.
 * @param {string} image
 * @returns {boolean}
 */
function isApprovedImage(image) {
  if (!image || typeof image !== 'string') return false;
  const ref = image.trim();
  if (APPROVED_EXACT.has(ref)) return true;
  return APPROVED_REGISTRY_PATTERNS.some(pattern => pattern.test(ref));
}

/**
 * Strips image_override from an extraParams object.
 * Returns a new object with image_override removed.
 * @param {object} params
 * @returns {object}
 */
function stripImageOverride(params) {
  if (!params || typeof params !== 'object') return params;
  const { image_override: _removed, ...rest } = params;
  return rest;
}

/**
 * Validates a caller-supplied image_override string.
 * Returns { valid: true } if approved, or { valid: false, reason: string } if not.
 * @param {string} image
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateImageOverride(image) {
  if (!image || typeof image !== 'string' || image.trim() === '') {
    return { valid: false, reason: 'image_override must be a non-empty string' };
  }
  if (!isApprovedImage(image.trim())) {
    return {
      valid: false,
      reason: `image_override '${image}' is not on the approved registry whitelist`,
    };
  }
  return { valid: true };
}

module.exports = {
  isApprovedImage,
  stripImageOverride,
  validateImageOverride,
  APPROVED_REGISTRY_PATTERNS,
  APPROVED_EXACT,
};
