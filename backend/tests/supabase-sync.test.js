// DC1 SQLite  Supabase Sync Bridge  Unit Tests
const sync = require('../src/services/supabase-sync');

describe('Supabase Sync Bridge', () => {
  describe('getStatus()', () => {
    test('returns status object when not initialized', () => {
      const status = sync.getStatus();
      expect(status).toHaveProperty('initialized', false);
      expect(status).toHaveProperty('running', false);
      expect(status).toHaveProperty('lastSyncAt', null);
      expect(status).toHaveProperty('stats');
      expect(status.stats).toHaveProperty('total', 0);
    });
  });

  describe('init()', () => {
    test('returns false when SUPABASE_SERVICE_ROLE_KEY is not set', () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      const result = sync.init();
      expect(result).toBe(false);
    });
  });

  describe('runSyncCycle()', () => {
    test('returns null when supabase not initialized', async () => {
      const result = await sync.runSyncCycle();
      expect(result).toBeNull();
    });
  });
});
