/**
 * Tests for GET /api/providers/setup-windows
 * 
 * Run: node backend/tests/windows-installer.test.js
 * (Standalone — no test framework needed)
 */

const path = require('path');
const fs = require('fs');

// --- Mock DB ---
let mockProvider = null;
const mockDb = {
    get: async (sql, params) => mockProvider,
    run: async () => ({ lastInsertRowid: 1 })
};

// Patch require for db
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    if (request === '../db') return 'mock-db';
    return originalResolveFilename.call(this, request, parent, ...rest);
};
require.cache['mock-db'] = { id: 'mock-db', filename: 'mock-db', loaded: true, exports: mockDb };

// Now load router
const express = require('express');
const app = express();
app.use(express.json());
const providersRouter = require('../src/routes/providers');
app.use('/api/providers', providersRouter);

let server;
let passed = 0;
let failed = 0;

function assert(condition, name) {
    if (condition) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}`); }
}

async function runTests() {
    server = app.listen(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    console.log('\n--- Windows Installer Route Tests ---\n');

    // Test 1: Missing key returns 400
    {
        const res = await fetch(`${base}/api/providers/setup-windows`);
        assert(res.status === 400, 'Missing key returns 400');
    }

    // Test 2: Invalid key returns 404
    {
        mockProvider = null;
        const res = await fetch(`${base}/api/providers/setup-windows?key=invalid-key-123`);
        assert(res.status === 404, 'Invalid key returns 404');
    }

    // Test 3: Valid key returns 200 with text/plain
    {
        mockProvider = { id: 1, name: 'Test', api_key: 'dc1-provider-abc123' };
        const res = await fetch(`${base}/api/providers/setup-windows?key=dc1-provider-abc123`);
        assert(res.status === 200, 'Valid key returns 200');
        assert(res.headers.get('content-type').includes('text/plain'), 'Content-Type is text/plain');

        const body = await res.text();
        // Test 4: Script contains injected API key
        assert(body.includes('dc1-provider-abc123'), 'Script contains injected API key');

        // Test 5: Script does NOT contain placeholder
        assert(!body.includes('INJECTED_API_KEY'), 'Script does NOT contain INJECTED_API_KEY placeholder');

        // Test 6: Script looks like PowerShell
        assert(body.includes('DC1 Provider Daemon Installer'), 'Script contains expected PowerShell content');

        // Test 7: No hardcoded C:\dc1-provider path (should use LOCALAPPDATA)
        assert(!body.includes('C:\\dc1-provider'), 'Script does NOT contain hardcoded C:\\dc1-provider');

        // Test 8: Uses per-user LOCALAPPDATA path
        assert(body.includes('LOCALAPPDATA'), 'Script contains LOCALAPPDATA (per-user install path)');

        // Test 9: Checks pip exit code
        assert(body.includes('LASTEXITCODE'), 'Script contains LASTEXITCODE (pip error check)');

        // Test 10: ErrorActionPreference is Continue, not Stop
        assert(!body.includes('ErrorActionPreference = "Stop"'), 'Script does NOT use ErrorActionPreference = "Stop"');
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
    server.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => { console.error(err); process.exit(1); });
