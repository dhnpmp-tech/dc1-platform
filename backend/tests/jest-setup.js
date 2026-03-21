/**
 * Jest global setup — runs before any module is loaded in each test file.
 * Points the DB at an in-memory SQLite so tests never touch providers.db.
 */
process.env.DC1_DB_PATH = ':memory:';
process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';
// Suppress Supabase sync in tests
process.env.SUPABASE_URL = '';
process.env.SUPABASE_KEY = '';
