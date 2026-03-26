#!/usr/bin/env node

/**
 * Validate docker templates for schema compliance
 * Usage: node scripts/validate-templates.mjs
 *
 * Checks:
 * - All template JSON files are valid JSON
 * - Required fields present: name, image, description
 * - Image references are valid Docker image names
 * - No duplicate template names
 */

import Fs from 'fs';
import Path from 'path';
import { fileURLToPath } from 'url';

const __dirname = Path.dirname(fileURLToPath(import.meta.url));
const templateDir = Path.join(__dirname, '../docker-templates');

// Validation rules
const REQUIRED_FIELDS = ['name', 'image', 'description'];
const IMAGE_REGEX = /^[\w\-:\.\/]+$/;
const RESERVED_NAMES = ['template', 'default', 'test'];

function validateTemplate(filename, content) {
  try {
    const template = JSON.parse(content);

    // Check required fields
    for (const field of REQUIRED_FIELDS) {
      if (!template[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate image reference
    if (!IMAGE_REGEX.test(template.image)) {
      throw new Error(
        `Invalid image reference: "${template.image}". ` +
        `Must match pattern: [a-zA-Z0-9_\\-:./ ]+`
      );
    }

    // Validate name (no reserved words)
    if (RESERVED_NAMES.includes(template.name.toLowerCase())) {
      throw new Error(
        `Reserved template name: "${template.name}". ` +
        `Cannot use: ${RESERVED_NAMES.join(', ')}`
      );
    }

    // Validate vram_gb if present
    if (template.vram_gb && typeof template.vram_gb !== 'number') {
      throw new Error(`Invalid vram_gb: must be a number, got ${typeof template.vram_gb}`);
    }

    return { valid: true, template };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function main() {
  if (!Fs.existsSync(templateDir)) {
    console.error(`❌ Template directory not found: ${templateDir}`);
    process.exit(1);
  }

  const files = Fs.readdirSync(templateDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.warn(`⚠️  No template files found in ${templateDir}`);
    process.exit(1);
  }

  const results = [];
  const names = new Set();
  let hasErrors = false;

  for (const file of files) {
    const filepath = Path.join(templateDir, file);
    const content = Fs.readFileSync(filepath, 'utf-8');
    const result = validateTemplate(file, content);

    if (!result.valid) {
      console.error(`❌ ${file}: ${result.error}`);
      hasErrors = true;
    } else {
      // Check for duplicate names
      if (names.has(result.template.name)) {
        console.error(`❌ ${file}: Duplicate template name "${result.template.name}"`);
        hasErrors = true;
      } else {
        names.add(result.template.name);
        console.log(`✅ ${file}`);
      }
    }

    results.push({ file, ...result });
  }

  // Summary
  const validCount = results.filter(r => r.valid).length;
  console.log(`\n📊 Summary: ${validCount}/${files.length} templates valid`);

  if (hasErrors) {
    console.error('\n❌ VALIDATION FAILED');
    process.exit(1);
  }

  console.log('\n✅ ALL TEMPLATES VALID');
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
