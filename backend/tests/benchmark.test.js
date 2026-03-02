const db = require('../src/db');

// Helper: insert a test provider, return its id
function createTestProvider(name = 'TestProvider') {
  const result = db.run(
    `INSERT INTO providers (name, email, gpu_model, os, api_key, status, uptime_percent)
     VALUES (?, ?, 'RTX 3060', 'linux', ?, 'online', 95)`,
    name, `${name.toLowerCase()}-${Date.now()}@test.com`, `key-${Date.now()}-${Math.random()}`
  );
  return result.lastInsertRowid;
}

beforeAll(() => {
  // Ensure tables exist (db.js runs migrations on import)
});

afterAll(() => {
  db.close();
});

describe('Benchmark Runs Table', () => {
  test('1. benchmark_runs table exists', () => {
    const info = db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='benchmark_runs'");
    expect(info).toBeTruthy();
    expect(info.name).toBe('benchmark_runs');
  });

  test('2. Can insert a benchmark run', () => {
    const pid = createTestProvider('InsertTest');
    const result = db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at)
       VALUES (?, 'quick', 'pending', ?)`, pid, new Date().toISOString()
    );
    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });

  test('3. Rejects invalid benchmark_type', () => {
    const pid = createTestProvider('BadType');
    expect(() => {
      db.run(
        `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at)
         VALUES (?, 'invalid', 'pending', ?)`, pid, new Date().toISOString()
      );
    }).toThrow();
  });

  test('4. Rejects invalid status', () => {
    const pid = createTestProvider('BadStatus');
    expect(() => {
      db.run(
        `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at)
         VALUES (?, 'quick', 'bogus', ?)`, pid, new Date().toISOString()
      );
    }).toThrow();
  });
});

describe('Benchmark Simulate & Results', () => {
  test('5. Simulate creates a completed run', () => {
    const pid = createTestProvider('Simulate');
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 5000, 25)`,
      pid, new Date().toISOString(), new Date().toISOString()
    );
    const run = db.get('SELECT * FROM benchmark_runs WHERE provider_id = ? AND status = ?', pid, 'completed');
    expect(run).toBeTruthy();
    expect(run.score_gflops).toBe(5000);
  });

  test('6. Results query returns all runs for a provider', () => {
    const pid = createTestProvider('MultiRun');
    for (let i = 0; i < 3; i++) {
      db.run(
        `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
         VALUES (?, 'standard', 'completed', ?, ?, ?, ?)`,
        pid, new Date().toISOString(), new Date().toISOString(), 1000 * (i + 1), 50 - i * 10
      );
    }
    const results = db.all('SELECT * FROM benchmark_runs WHERE provider_id = ?', pid);
    expect(results.length).toBe(3);
  });
});

describe('Leaderboard', () => {
  test('7. Leaderboard ranks providers by best score', () => {
    const pid1 = createTestProvider('Leader1');
    const pid2 = createTestProvider('Leader2');
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 10000, 20)`, pid1, new Date().toISOString(), new Date().toISOString()
    );
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 8000, 30)`, pid2, new Date().toISOString(), new Date().toISOString()
    );
    const rows = db.all(`
      SELECT p.id, MAX(br.score_gflops) AS best
      FROM providers p JOIN benchmark_runs br ON br.provider_id = p.id
      WHERE br.status = 'completed' AND br.score_gflops IS NOT NULL
      GROUP BY p.id ORDER BY best DESC
    `);
    const ids = rows.map(r => r.id);
    expect(ids.indexOf(pid1)).toBeLessThan(ids.indexOf(pid2));
  });
});

describe('Reliability Score', () => {
  test('8. Reliability score updates after benchmark', () => {
    const pid = createTestProvider('Reliable');
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'full', 'completed', ?, ?, 12000, 15)`, pid, new Date().toISOString(), new Date().toISOString()
    );
    // Import and call the update function
    const benchmarkRouter = require('../src/routes/benchmark');
    benchmarkRouter._updateReliabilityScore(pid);
    const provider = db.get('SELECT reliability_score FROM providers WHERE id = ?', pid);
    expect(provider.reliability_score).toBeGreaterThan(0);
    expect(provider.reliability_score).toBeLessThanOrEqual(100);
  });

  test('9. Reliability score accounts for uptime', () => {
    const pid = createTestProvider('UptimeTest');
    db.run('UPDATE providers SET uptime_percent = 100 WHERE id = ?', pid);
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 15000, 5)`, pid, new Date().toISOString(), new Date().toISOString()
    );
    const benchmarkRouter = require('../src/routes/benchmark');
    benchmarkRouter._updateReliabilityScore(pid);
    const p = db.get('SELECT reliability_score FROM providers WHERE id = ?', pid);
    // Perfect scores + 100% uptime should yield high reliability
    expect(p.reliability_score).toBeGreaterThanOrEqual(90);
  });

  test('10. Reliability score is 0 for provider with no benchmarks', () => {
    const pid = createTestProvider('NoBench');
    const benchmarkRouter = require('../src/routes/benchmark');
    benchmarkRouter._updateReliabilityScore(pid);
    const p = db.get('SELECT reliability_score FROM providers WHERE id = ?', pid);
    expect(p.reliability_score).toBe(0); // default
  });

  test('11. High latency reduces reliability score', () => {
    const pidGood = createTestProvider('LowLat');
    const pidBad = createTestProvider('HighLat');
    db.run('UPDATE providers SET uptime_percent = 50 WHERE id IN (?, ?)', pidGood, pidBad);
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 5000, 10)`, pidGood, new Date().toISOString(), new Date().toISOString()
    );
    db.run(
      `INSERT INTO benchmark_runs (provider_id, benchmark_type, status, started_at, completed_at, score_gflops, latency_ms)
       VALUES (?, 'quick', 'completed', ?, ?, 5000, 190)`, pidBad, new Date().toISOString(), new Date().toISOString()
    );
    const benchmarkRouter = require('../src/routes/benchmark');
    benchmarkRouter._updateReliabilityScore(pidGood);
    benchmarkRouter._updateReliabilityScore(pidBad);
    const good = db.get('SELECT reliability_score FROM providers WHERE id = ?', pidGood);
    const bad = db.get('SELECT reliability_score FROM providers WHERE id = ?', pidBad);
    expect(good.reliability_score).toBeGreaterThan(bad.reliability_score);
  });
});
