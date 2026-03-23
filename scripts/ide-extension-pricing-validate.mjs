#!/usr/bin/env node
/**
 * IDE Extension Pricing Display Post-Deployment Validation
 *
 * Validates that /api/models endpoint returns competitor_prices and savings_pct
 * fields needed for VS Code extension pricing comparison display.
 *
 * Depends on: DCP-668 (pricing fix) + DCP-524 (VPS deployment)
 *
 * Usage: node scripts/ide-extension-pricing-validate.mjs
 */

import https from 'https';

const API_URL = 'https://api.dcp.sa';
const TEST_ENDPOINT = '/api/models';

const EXPECTED_FIELDS = [
  'model_id',
  'display_name',
  'avg_price_sar_per_min',
  'competitor_prices',
  'savings_pct',
];

const COMPETITOR_KEYS = ['vast_ai', 'runpod', 'aws'];

class PricingValidator {
  constructor() {
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
    };
    this.startTime = Date.now();
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const icon = {
      '✓': '✅',
      '✗': '❌',
      '⚠': '⚠️',
    };
    console.log(`[${timestamp}] ${icon[level[0]]} ${message}`);
  }

  pass(message) {
    this.results.passed.push(message);
    this.log('✓', `PASS: ${message}`);
  }

  fail(message) {
    this.results.failed.push(message);
    this.log('✗', `FAIL: ${message}`);
  }

  warn(message) {
    this.results.warnings.push(message);
    this.log('⚠', `WARN: ${message}`);
  }

  async fetch(url) {
    return new Promise((resolve, reject) => {
      https
        .get(url, { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body: JSON.parse(data),
              });
            } catch (err) {
              reject(new Error(`Invalid JSON response: ${err.message}`));
            }
          });
        })
        .on('error', reject)
        .on('timeout', () => reject(new Error('Request timeout')));
    });
  }

  async validate() {
    console.log('🧪 IDE Extension Pricing Display Validation');
    console.log(`📍 Target: ${API_URL}${TEST_ENDPOINT}`);
    console.log('');

    try {
      // Test 1: Endpoint accessibility
      this.log('→', 'Fetching /api/models endpoint...');
      const response = await this.fetch(`${API_URL}${TEST_ENDPOINT}`);

      if (response.status !== 200) {
        this.fail(`HTTP ${response.status} (expected 200)`);
        return this.report();
      }
      this.pass(`Endpoint returns HTTP 200`);

      // Test 2: Response is array
      if (!Array.isArray(response.body)) {
        this.fail('Response is not an array');
        return this.report();
      }
      this.pass(`Response is valid array (${response.body.length} models)`);

      if (response.body.length === 0) {
        this.fail('Response array is empty');
        return this.report();
      }

      // Test 3: Iterate through models and validate structure
      let modelsWithPricing = 0;
      let modelsWithoutPricing = 0;

      for (let i = 0; i < Math.min(response.body.length, 5); i++) {
        const model = response.body[i];
        this.log('→', `Validating model ${i + 1}/${Math.min(5, response.body.length)}: ${model.model_id}`);

        // Check required fields
        for (const field of EXPECTED_FIELDS) {
          if (!(field in model)) {
            this.fail(`Model ${model.model_id} missing field: ${field}`);
          }
        }

        // Check competitor_prices structure
        if (model.competitor_prices) {
          const prices = model.competitor_prices;
          const hasCompetitorData = COMPETITOR_KEYS.every((key) => key in prices);

          if (hasCompetitorData) {
            this.pass(
              `Model ${model.model_id} has complete competitor pricing: ` +
                `Vast.ai=$${prices.vast_ai}/hr, RunPod=$${prices.runpod}/hr, AWS=$${prices.aws}/hr`
            );
            modelsWithPricing++;

            // Verify savings_pct makes sense
            if (typeof model.savings_pct === 'number' && model.savings_pct >= 0) {
              this.pass(`Model ${model.model_id} savings: ${model.savings_pct}%`);
            } else {
              this.warn(`Model ${model.model_id} has invalid savings_pct: ${model.savings_pct}`);
            }
          } else {
            const missing = COMPETITOR_KEYS.filter((k) => !(k in prices));
            this.fail(
              `Model ${model.model_id} competitor_prices incomplete: missing ${missing.join(', ')}`
            );
            modelsWithoutPricing++;
          }
        } else {
          this.warn(`Model ${model.model_id} has no competitor_prices field`);
          modelsWithoutPricing++;
        }
      }

      // Test 4: Summary
      console.log('');
      if (modelsWithPricing > 0) {
        this.pass(`${modelsWithPricing}/${Math.min(5, response.body.length)} models have complete pricing data`);
      }
      if (modelsWithoutPricing > 0 && modelsWithPricing === 0) {
        this.fail(
          `No models have competitor_prices data (DCP-668 may not be deployed)`
        );
      }

      // Test 5: Extension compatibility check
      console.log('');
      this.log('→', 'Extension compatibility check...');
      const firstModel = response.body[0];

      // Simulate what the extension does
      const extensionPricingLogic = {
        has_competitor_prices: !!firstModel.competitor_prices,
        displays_pricing: !!(
          firstModel.competitor_prices &&
          firstModel.competitor_prices.vast_ai &&
          firstModel.competitor_prices.runpod &&
          firstModel.competitor_prices.aws
        ),
        displays_savings: typeof firstModel.savings_pct === 'number' && firstModel.savings_pct > 0,
      };

      if (extensionPricingLogic.displays_pricing) {
        this.pass('Extension pricing tooltips can display full comparisons');
      } else if (extensionPricingLogic.has_competitor_prices) {
        this.warn('Extension has partial competitor data (graceful degradation)');
      } else {
        this.warn('Extension will not display pricing (no competitor_prices data)');
      }
    } catch (err) {
      this.fail(`Network/parsing error: ${err.message}`);
    }

    return this.report();
  }

  report() {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 VALIDATION REPORT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Duration: ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log(`Passed: ${this.results.passed.length}`);
    console.log(`Failed: ${this.results.failed.length}`);
    console.log(`Warnings: ${this.results.warnings.length}`);
    console.log('');

    if (this.results.failed.length === 0) {
      console.log('🎉 ALL CHECKS PASSED - Extension pricing display ready!');
      return 0;
    } else {
      console.log('❌ VALIDATION FAILED - Extension pricing display not ready');
      console.log('');
      console.log('Failed checks:');
      this.results.failed.forEach((f) => console.log(`  • ${f}`));
      console.log('');
      console.log('To fix:');
      console.log('  1. Ensure commit e1723ac is deployed (fix(api): wire competitor_prices)');
      console.log('  2. Verify /api/models endpoint returns competitor_prices field');
      console.log('  3. Check PM2 service is running: pm2 list');
      console.log('  4. Check backend logs: pm2 logs dc1-provider-onboarding');
      return 1;
    }
  }
}

// Run validation
const validator = new PricingValidator();
const exitCode = await validator.validate();
process.exit(exitCode);
