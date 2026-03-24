#!/usr/bin/env node

/**
 * Phase 1 Day 4 Monitoring Dashboard
 * Real-time metrics tracking during test execution
 *
 * Usage: node scripts/day4-monitoring-dashboard.mjs
 * Requirements: curl, tail (Unix standard tools)
 */

import { execSync } from 'child_process';
import fs from 'fs';

const API_BASE = process.env.DCP_API_BASE || 'https://api.dcp.sa';
const REFRESH_INTERVAL = 5000; // 5 seconds
const LOG_FILE = 'backend/logs/app.log';

class Day4Dashboard {
  constructor() {
    this.startTime = Date.now();
    this.metrics = {
      apiLatency: [],
      errorCount: 0,
      jobCount: 0,
      memoryUsage: 0,
      lastErrorTime: null
    };
  }

  clearScreen() {
    console.clear();
  }

  formatTime(ms) {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getElapsedTime() {
    const elapsed = Date.now() - this.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  checkAPIHealth() {
    try {
      const startTime = Date.now();
      const result = execSync(`curl -s -w "%{http_code}" -o /dev/null ${API_BASE}/api/health`, {
        timeout: 5000,
        encoding: 'utf-8'
      }).trim();

      const latency = Date.now() - startTime;
      this.metrics.apiLatency.push(latency);
      if (this.metrics.apiLatency.length > 60) {
        this.metrics.apiLatency.shift();
      }

      const statusCode = parseInt(result);
      return {
        status: statusCode === 200 ? '✅ LIVE' : `⚠️ ${statusCode}`,
        latency,
        avgLatency: this.metrics.apiLatency.reduce((a, b) => a + b, 0) / this.metrics.apiLatency.length
      };
    } catch (error) {
      return {
        status: '❌ DOWN',
        latency: 0,
        avgLatency: 0,
        error: error.message
      };
    }
  }

  checkModelCatalog() {
    try {
      const result = execSync(`curl -s ${API_BASE}/api/models | grep -c '"name"'`, {
        timeout: 5000,
        encoding: 'utf-8'
      }).trim();
      const count = parseInt(result) || 0;
      return {
        status: count === 11 ? '✅ READY' : `⚠️ ${count}/11`,
        modelCount: count
      };
    } catch (error) {
      return {
        status: '❌ ERROR',
        modelCount: 0,
        error: error.message
      };
    }
  }

  checkDatabaseHealth() {
    try {
      if (!fs.existsSync('backend/database/dc1.db')) {
        return { status: '❌ NOT FOUND', tableCount: 0 };
      }

      const result = execSync(`sqlite3 backend/database/dc1.db ".tables" | wc -w`, {
        timeout: 5000,
        encoding: 'utf-8'
      }).trim();

      const tableCount = parseInt(result) || 0;
      return {
        status: tableCount > 15 ? '✅ HEALTHY' : `⚠️ ${tableCount} tables`,
        tableCount
      };
    } catch (error) {
      return {
        status: '❌ ERROR',
        tableCount: 0
      };
    }
  }

  checkErrorLogs() {
    try {
      if (!fs.existsSync(LOG_FILE)) {
        return { errorCount: 0, recentErrors: [] };
      }

      const logs = execSync(`tail -100 ${LOG_FILE}`, { encoding: 'utf-8' });
      const errors = logs.split('\n').filter(line =>
        line.includes('ERROR') ||
        line.includes('500') ||
        line.includes('Exception') ||
        line.includes('failed')
      );

      this.metrics.errorCount = errors.length;
      const recentErrors = errors.slice(-3).reverse();

      return {
        errorCount: errors.length,
        recentErrors: recentErrors.map(e => {
          // Extract timestamp and message
          const match = e.match(/\[(.*?)\].*?(ERROR|500|Exception).*?(?::|$)(.*)/);
          return match ? `[${match[1]}] ${match[2]}: ${match[3]?.substring(0, 60)}` : e.substring(0, 80);
        })
      };
    } catch (error) {
      return { errorCount: 0, recentErrors: [] };
    }
  }

  getMemoryUsage() {
    try {
      const result = execSync('free -h | grep Mem', { encoding: 'utf-8' });
      const parts = result.split(/\s+/);
      return {
        total: parts[1],
        used: parts[2],
        free: parts[3],
        percent: Math.round((parseInt(parts[2]) / parseInt(parts[1])) * 100)
      };
    } catch (error) {
      return { total: '?', used: '?', free: '?', percent: 0 };
    }
  }

  display() {
    this.clearScreen();

    const apiHealth = this.checkAPIHealth();
    const modelCatalog = this.checkModelCatalog();
    const dbHealth = this.checkDatabaseHealth();
    const errorLogs = this.checkErrorLogs();
    const memory = this.getMemoryUsage();

    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║           PHASE 1 DAY 4 — REAL-TIME MONITORING DASHBOARD               ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    // Header
    console.log(`Elapsed Time: ${this.getElapsedTime()} | Refreshed: ${new Date().toLocaleTimeString()}\n`);

    // API Health
    console.log('📡 API HEALTH');
    console.log(`   Status:        ${apiHealth.status}`);
    console.log(`   Latency:       ${this.formatTime(apiHealth.latency)}`);
    console.log(`   Avg Latency:   ${this.formatTime(apiHealth.avgLatency)}`);
    if (apiHealth.error) console.log(`   Error:         ${apiHealth.error}`);
    console.log();

    // Model Catalog
    console.log('🤖 MODEL CATALOG');
    console.log(`   Status:        ${modelCatalog.status}`);
    console.log(`   Models:        ${modelCatalog.modelCount}`);
    console.log();

    // Database
    console.log('💾 DATABASE');
    console.log(`   Status:        ${dbHealth.status}`);
    console.log(`   Tables:        ${dbHealth.tableCount}`);
    console.log();

    // Memory
    console.log('💾 MEMORY');
    console.log(`   Used:          ${memory.used} / ${memory.total} (${memory.percent}%)`);
    console.log(`   Free:          ${memory.free}`);
    console.log();

    // Error Monitoring
    console.log('🚨 ERROR MONITORING');
    console.log(`   Total Errors:  ${errorLogs.errorCount}`);
    if (errorLogs.recentErrors.length > 0) {
      console.log('   Recent Errors:');
      errorLogs.recentErrors.forEach(err => {
        console.log(`     • ${err}`);
      });
    } else {
      console.log('   Recent Errors: ✅ None detected');
    }
    console.log();

    // Status Summary
    console.log('─'.repeat(72));
    const allHealthy =
      apiHealth.status.includes('✅') &&
      modelCatalog.status.includes('✅') &&
      dbHealth.status.includes('✅') &&
      errorLogs.errorCount === 0 &&
      memory.percent < 80;

    if (allHealthy) {
      console.log('🟢 OVERALL STATUS: HEALTHY | All systems operating normally');
    } else if (errorLogs.errorCount > 0) {
      console.log('🟡 OVERALL STATUS: DEGRADED | Errors detected, investigate root cause');
    } else if (apiHealth.status.includes('❌')) {
      console.log('🔴 OVERALL STATUS: CRITICAL | API is down, immediate attention required');
    } else {
      console.log('🟡 OVERALL STATUS: PARTIAL | Some systems showing issues');
    }
    console.log('─'.repeat(72));
    console.log();
    console.log('Press Ctrl+C to stop monitoring\n');
  }

  start() {
    // Display immediately
    this.display();

    // Set up refresh interval
    this.interval = setInterval(() => {
      this.display();
    }, REFRESH_INTERVAL);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(this.interval);
      console.log('\n✅ Monitoring stopped');
      process.exit(0);
    });
  }
}

// Start dashboard
const dashboard = new Day4Dashboard();
dashboard.start();
