/**
 * Jest global setup — runs before any module is loaded in each test file.
 * Points the DB at an in-memory SQLite so tests never touch providers.db.
 */
process.env.DC1_DB_PATH = ':memory:';
process.env.DC1_ADMIN_TOKEN = 'test-admin-token-jest';
process.env.DC1_HMAC_SECRET = 'test-hmac-secret-jest-fixed-32-byte-key-!!';
// Suppress Supabase sync in tests
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_KEY = 'test-supabase-key-jest';
process.env.SUPABASE_SERVICE_KEY = 'test-supabase-service-key-jest';
