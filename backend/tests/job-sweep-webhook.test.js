const crypto = require('crypto');
const { createWebhookSignature } = require('../src/services/jobSweep');

describe('jobSweep webhook signature', () => {
  test('generates sha256-prefixed signature from renter API key and payload', () => {
    const secret = 'dc1-renter-test-secret';
    const payloadJson = JSON.stringify({ job_id: 'job-123', status: 'done' });

    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payloadJson).digest('hex')}`;
    const actual = createWebhookSignature(secret, payloadJson);

    expect(actual).toBe(expected);
    expect(actual.startsWith('sha256=')).toBe(true);
  });

  test('changes signature when payload changes', () => {
    const secret = 'dc1-renter-test-secret';
    const payloadA = JSON.stringify({ job_id: 'job-123', status: 'done' });
    const payloadB = JSON.stringify({ job_id: 'job-123', status: 'failed' });

    const sigA = createWebhookSignature(secret, payloadA);
    const sigB = createWebhookSignature(secret, payloadB);

    expect(sigA).not.toBe(sigB);
  });
});
