'use strict';

/**
 * imageValidation.test.js — DCP-SEC-011
 * Unit tests for image_override registry whitelist enforcement.
 */

const {
  isApprovedImage,
  stripImageOverride,
  validateImageOverride,
} = require('../middleware/imageValidation');

describe('isApprovedImage', () => {
  test('allows exact approved images', () => {
    expect(isApprovedImage('dc1/general-worker:latest')).toBe(true);
    expect(isApprovedImage('dc1/llm-worker:latest')).toBe(true);
    expect(isApprovedImage('dc1/sd-worker:latest')).toBe(true);
    expect(isApprovedImage('nvcr.io/nvidia/pytorch:24.01-py3')).toBe(true);
    expect(isApprovedImage('pytorch/pytorch:2.1.0-cuda11.8-cudnn8-runtime')).toBe(true);
  });

  test('allows ghcr.io/dcp- prefix images', () => {
    expect(isApprovedImage('ghcr.io/dcp-worker:latest')).toBe(true);
    expect(isApprovedImage('ghcr.io/dcp-llm-worker:v1.2.3')).toBe(true);
  });

  test('allows docker.io/nvidia/ prefix images', () => {
    expect(isApprovedImage('docker.io/nvidia/cuda:12.0')).toBe(true);
    expect(isApprovedImage('docker.io/nvidia/triton:latest')).toBe(true);
  });

  test('allows nvcr.io/nvidia/ prefix images', () => {
    expect(isApprovedImage('nvcr.io/nvidia/tensorflow:24.01-tf2-py3')).toBe(true);
  });

  test('allows huggingface/ prefix images', () => {
    expect(isApprovedImage('huggingface/transformers:latest')).toBe(true);
  });

  test('rejects attacker-controlled registries', () => {
    expect(isApprovedImage('attacker.io/malicious:latest')).toBe(false);
    expect(isApprovedImage('evil.com/image')).toBe(false);
    expect(isApprovedImage('ghcr.io/notdcp/malicious')).toBe(false);   // prefix must be ghcr.io/dcp-
    expect(isApprovedImage('docker.io/evil/cuda:12.0')).toBe(false);   // must be docker.io/nvidia/
    expect(isApprovedImage('fakenvida.io/cuda')).toBe(false);
    expect(isApprovedImage('docker.io/nvidia.evil.com/cuda')).toBe(false);
  });

  test('rejects empty or invalid inputs', () => {
    expect(isApprovedImage('')).toBe(false);
    expect(isApprovedImage(null)).toBe(false);
    expect(isApprovedImage(undefined)).toBe(false);
    expect(isApprovedImage(123)).toBe(false);
  });
});

describe('validateImageOverride', () => {
  test('returns valid=true for approved image', () => {
    const result = validateImageOverride('ghcr.io/dcp-worker:latest');
    expect(result.valid).toBe(true);
  });

  test('returns valid=false for attacker.io/malicious', () => {
    const result = validateImageOverride('attacker.io/malicious');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not on the approved registry whitelist/);
  });

  test('returns valid=false for empty string', () => {
    const result = validateImageOverride('');
    expect(result.valid).toBe(false);
  });

  test('returns valid=false for non-string', () => {
    const result = validateImageOverride(null);
    expect(result.valid).toBe(false);
  });
});

describe('stripImageOverride', () => {
  test('removes image_override from params object', () => {
    const params = { image_override: 'attacker.io/evil', model: 'llama3', temperature: 0.7 };
    const result = stripImageOverride(params);
    expect(result.image_override).toBeUndefined();
    expect(result.model).toBe('llama3');
    expect(result.temperature).toBe(0.7);
  });

  test('returns unchanged object when image_override absent', () => {
    const params = { model: 'llama3' };
    const result = stripImageOverride(params);
    expect(result).toEqual({ model: 'llama3' });
  });

  test('does not mutate original params', () => {
    const params = { image_override: 'ghcr.io/dcp-worker:latest', model: 'llama3' };
    stripImageOverride(params);
    expect(params.image_override).toBe('ghcr.io/dcp-worker:latest'); // original unchanged
  });

  test('handles null/undefined safely', () => {
    expect(stripImageOverride(null)).toBeNull();
    expect(stripImageOverride(undefined)).toBeUndefined();
  });
});
