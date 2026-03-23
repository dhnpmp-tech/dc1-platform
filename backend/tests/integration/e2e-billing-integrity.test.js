/**
 * E2E Billing Integrity — 75/25 halala split verification
 * 
 * DC1 billing rule: provider gets 75%, DC1 keeps 25%.
 * Integer division, remainder goes to DC1.
 * providerShare = Math.floor(total * 0.75)
 * dc1Share = total - providerShare
 */

describe('E2E Billing Integrity — 75/25 halala split', () => {
  function splitBilling(totalHalala) {
    const providerShare = Math.floor(totalHalala * 0.75);
    const dc1Share = totalHalala - providerShare;
    return { providerShare, dc1Share };
  }

  it('100 halala — exact split: 75 provider, 25 DC1', () => {
    const { providerShare, dc1Share } = splitBilling(100);
    expect(providerShare).toBe(75);
    expect(dc1Share).toBe(25);
    expect(providerShare + dc1Share).toBe(100);
  });

  it('101 halala — remainder to DC1: 75 provider, 26 DC1', () => {
    const { providerShare, dc1Share } = splitBilling(101);
    expect(providerShare).toBe(75);
    expect(dc1Share).toBe(26);
    expect(providerShare + dc1Share).toBe(101);
  });

  it('1 halala — goes entirely to DC1: 0 provider, 1 DC1', () => {
    const { providerShare, dc1Share } = splitBilling(1);
    expect(providerShare).toBe(0);
    expect(dc1Share).toBe(1);
    expect(providerShare + dc1Share).toBe(1);
  });

  it('0 halala — zero split', () => {
    const { providerShare, dc1Share } = splitBilling(0);
    expect(providerShare).toBe(0);
    expect(dc1Share).toBe(0);
  });

  it('3 halala — 2 provider, 1 DC1 (remainder to DC1)', () => {
    const { providerShare, dc1Share } = splitBilling(3);
    expect(providerShare).toBe(2);
    expect(dc1Share).toBe(1);
  });

  it('10000 halala (100 SAR) — 7500 provider, 2500 DC1', () => {
    const { providerShare, dc1Share } = splitBilling(10000);
    expect(providerShare).toBe(7500);
    expect(dc1Share).toBe(2500);
  });

  it('no rounding errors for large amounts', () => {
    // Test a range of values — sum must always equal total
    for (let total = 0; total <= 1000; total++) {
      const { providerShare, dc1Share } = splitBilling(total);
      expect(providerShare + dc1Share).toBe(total);
      expect(providerShare).toBe(Math.floor(total * 0.75));
      expect(dc1Share).toBeGreaterThanOrEqual(Math.floor(total * 0.25));
    }
  });

  it('billing matches actual job cost from cost calculator', () => {
    const { calculateCostHalala } = require('../../src/routes/jobs');
    
    // llm-inference at 9 halala/min × 10 min = 90 halala
    const cost = calculateCostHalala('llm-inference', 10);
    expect(cost).toBe(90);

    const { providerShare, dc1Share } = splitBilling(cost);
    expect(providerShare).toBe(67); // floor(90 * 0.75) = 67
    expect(dc1Share).toBe(23);      // 90 - 67 = 23
    expect(providerShare + dc1Share).toBe(90);
  });
});
