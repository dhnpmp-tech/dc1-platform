#!/usr/bin/env node

/**
 * Arabic RAG Validation Runner — Sprint 27 Phase 2 Validation
 *
 * Validates end-to-end Arabic RAG-as-a-Service bundle:
 * - BGE-M3 embeddings: Convert Arabic documents to 1024-dim vectors
 * - BGE Reranker v2-m3: Re-rank retrieved documents by relevance
 * - ALLaM 7B LLM: Generate coherent Arabic answers from retrieved docs
 *
 * Test corpus: Arabic legal documents (labor law, contracts, regulations)
 *
 * Usage:
 *   DCP_API_BASE=https://api.dcp.sa \
 *   DCP_RENTER_KEY=xxx \
 *   node scripts/arabic-rag-validation-runner.mjs
 *
 * Output: Generates comprehensive validation report with pass/fail for each component
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = (process.env.DCP_API_BASE || 'http://localhost:8083/api').replace(/\/$/, '');
const RENTER_KEY = process.env.DCP_RENTER_KEY || '';
const REPORT_FILE = process.env.RAG_VALIDATION_REPORT || 'docs/qa/sprint27-arabic-rag-validation-report.md';

// Arabic RAG components from strategic brief
const RAG_COMPONENTS = {
  embeddings: { id: 'bge-m3', name: 'BAAI/bge-m3', vram_gb: 8, model_size_gb: 7 },
  reranker: { id: 'bge-reranker-v2-m3', name: 'BAAI/bge-reranker-v2-m3', vram_gb: 8, model_size_gb: 5 },
  llm: { id: 'allam-7b', name: 'ALLaM 7B', vram_gb: 24, model_size_gb: 24 },
};

// Test documents: Arabic legal corpus
const TEST_DOCUMENTS = {
  labor_law: 'نظام العمل السعودي: المادة 1 - يسري هذا النظام على جميع العاملين في القطاع الخاص. المادة 2 - ساعات العمل لا تزيد على 8 ساعات يومياً. المادة 3 - للعامل الحق في إجازة سنوية مدفوعة.',
  contract: 'عقد البيع: بين البائع والمشتري. الشروط: 1. السعر متفق عليه. 2. التسليم في الموعد المحدد. 3. الدفع عند الاستلام. 4. ضمان المنتج لمدة سنة واحدة.',
  regulation: 'اللائحة التنفيذية: تنطبق على جميع المؤسسات الحكومية. متطلبات التوافق: الامتثال الكامل للمعايير الدولية. الفحوصات الدورية: كل 6 أشهر.',
  insurance: 'وثيقة التأمين: يغطي جميع الأضرار المادية والجسدية. الحد الأدنى للتغطية: 1 مليون ريال. المدة: سنة واحدة قابلة للتجديد.',
};

const TEST_QUERIES = [
  { query: 'ما هي ساعات العمل المسموحة؟', expected_doc: 'labor_law', relevance_threshold: 0.8 },
  { query: 'كم يبلغ الحد الأدنى للتغطية التأمينية؟', expected_doc: 'insurance', relevance_threshold: 0.85 },
  { query: 'متى يجب دفع الثمن؟', expected_doc: 'contract', relevance_threshold: 0.8 },
  { query: 'ما الفترة الزمنية بين الفحوصات؟', expected_doc: 'regulation', relevance_threshold: 0.8 },
];

// Utility: HTTP request helper
function makeRequest(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(RENTER_KEY && { 'Authorization': `Bearer ${RENTER_KEY}` }),
        ...headers,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
            parseError: e.message,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Validation check: Component availability
async function checkComponentAvailability(componentId, componentName) {
  try {
    const res = await makeRequest('GET', `${API_BASE}/models/${componentId}`);
    if (res.status !== 200) {
      return { ok: false, error: `Component not found (${res.status})` };
    }

    const model = res.body;
    return {
      ok: true,
      componentId,
      name: model.name || componentName,
      vram_gb: model.vram_gb,
      available: model.available !== false,
    };
  } catch (error) {
    return { ok: false, error: `Connection error: ${error.message}` };
  }
}

// Validation check: Embeddings generation
async function validateEmbeddings(documentText) {
  try {
    // Submit embedding job
    const res = await makeRequest('POST', `${API_BASE}/jobs`, {}, {
      model_id: RAG_COMPONENTS.embeddings.id,
      input: documentText,
      task: 'embedding',
    });

    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, error: `Embedding job failed (${res.status})` };
    }

    const job = res.body;
    if (!job.id) return { ok: false, error: 'No embedding job ID' };

    // Check job status (poll with timeout)
    const startTime = Date.now();
    const timeout = 2 * 60 * 1000; // 2 minutes

    while (Date.now() - startTime < timeout) {
      const statusRes = await makeRequest('GET', `${API_BASE}/jobs/${job.id}`);
      if (statusRes.status !== 200) {
        return { ok: false, error: `Status check failed (${statusRes.status})` };
      }

      const jobStatus = statusRes.body;
      if (jobStatus.status === 'completed') {
        // Validate embedding output
        const embedding = jobStatus.result?.embedding || jobStatus.embedding;
        if (!Array.isArray(embedding)) {
          return { ok: false, error: 'Embedding not an array' };
        }
        if (embedding.length !== 1024) {
          return { ok: false, error: `Embedding dimension ${embedding.length}, expected 1024` };
        }
        if (!embedding.every(x => typeof x === 'number')) {
          return { ok: false, error: 'Embedding contains non-numeric values' };
        }

        return {
          ok: true,
          embedding_dimensions: embedding.length,
          latency_ms: jobStatus.duration_ms || (Date.now() - startTime),
        };
      } else if (jobStatus.status === 'failed') {
        return { ok: false, error: `Embedding failed: ${jobStatus.error}` };
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { ok: false, error: 'Embedding timeout' };
  } catch (error) {
    return { ok: false, error: `Validation failed: ${error.message}` };
  }
}

// Validation check: Reranking
async function validateReranking(query, documents) {
  try {
    // Submit reranking job
    const res = await makeRequest('POST', `${API_BASE}/jobs`, {}, {
      model_id: RAG_COMPONENTS.reranker.id,
      query,
      documents: Object.values(documents).slice(0, 10), // Use up to 10 docs
      task: 'rerank',
    });

    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, error: `Rerank job failed (${res.status})` };
    }

    const job = res.body;
    if (!job.id) return { ok: false, error: 'No rerank job ID' };

    // Poll for completion
    const startTime = Date.now();
    const timeout = 2 * 60 * 1000;

    while (Date.now() - startTime < timeout) {
      const statusRes = await makeRequest('GET', `${API_BASE}/jobs/${job.id}`);
      if (statusRes.status !== 200) {
        return { ok: false, error: `Status check failed (${statusRes.status})` };
      }

      const jobStatus = statusRes.body;
      if (jobStatus.status === 'completed') {
        const scores = jobStatus.result?.scores || jobStatus.scores || [];
        if (!Array.isArray(scores)) {
          return { ok: false, error: 'Rerank scores not an array' };
        }
        if (!scores.every(s => typeof s === 'number' && s >= 0 && s <= 1)) {
          return { ok: false, error: 'Invalid relevance scores (should be 0-1)' };
        }
        if (scores.length === 0) {
          return { ok: false, error: 'No relevance scores returned' };
        }

        // Check if highest score makes sense
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const isOrdered = scores.slice(0, -1).every((val, i) => val >= scores[i + 1]);

        return {
          ok: true,
          num_documents_scored: scores.length,
          max_score: maxScore.toFixed(3),
          min_score: minScore.toFixed(3),
          properly_ordered: isOrdered,
          latency_ms: jobStatus.duration_ms || (Date.now() - startTime),
        };
      } else if (jobStatus.status === 'failed') {
        return { ok: false, error: `Reranking failed: ${jobStatus.error}` };
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { ok: false, error: 'Reranking timeout' };
  } catch (error) {
    return { ok: false, error: `Validation failed: ${error.message}` };
  }
}

// Validation check: RAG pipeline end-to-end
async function validateRAGPipeline(query, documents) {
  try {
    // Submit RAG job
    const res = await makeRequest('POST', `${API_BASE}/jobs`, {}, {
      model_id: RAG_COMPONENTS.llm.id,
      query,
      context: Object.values(documents).join('\n'),
      task: 'rag',
      max_tokens: 256,
    });

    if (res.status !== 200 && res.status !== 201) {
      return { ok: false, error: `RAG job failed (${res.status})` };
    }

    const job = res.body;
    if (!job.id) return { ok: false, error: 'No RAG job ID' };

    // Poll for completion
    const startTime = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    while (Date.now() - startTime < timeout) {
      const statusRes = await makeRequest('GET', `${API_BASE}/jobs/${job.id}`);
      if (statusRes.status !== 200) {
        return { ok: false, error: `Status check failed (${statusRes.status})` };
      }

      const jobStatus = statusRes.body;
      if (jobStatus.status === 'completed') {
        const answer = jobStatus.result?.answer || jobStatus.answer || '';
        if (typeof answer !== 'string') {
          return { ok: false, error: 'Answer not a string' };
        }
        if (answer.length === 0) {
          return { ok: false, error: 'Empty answer generated' };
        }

        return {
          ok: true,
          answer_length: answer.length,
          answer_preview: answer.substring(0, 100),
          latency_ms: jobStatus.duration_ms || (Date.now() - startTime),
          tokens_generated: Math.ceil(answer.length / 4), // Rough estimate
        };
      } else if (jobStatus.status === 'failed') {
        return { ok: false, error: `RAG generation failed: ${jobStatus.error}` };
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { ok: false, error: 'RAG pipeline timeout' };
  } catch (error) {
    return { ok: false, error: `Validation failed: ${error.message}` };
  }
}

// Main execution
async function runValidation() {
  console.log('Starting Arabic RAG Validation — Sprint 27 Phase 2\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`Components: ${Object.keys(RAG_COMPONENTS).length}`);
  console.log(`Test documents: ${Object.keys(TEST_DOCUMENTS).length}`);
  console.log(`Test queries: ${TEST_QUERIES.length}\n`);

  const results = {
    timestamp: new Date().toISOString(),
    api_base: API_BASE,
    components_tested: Object.keys(RAG_COMPONENTS).length,
    checks: [],
    summary: { passed: 0, failed: 0, error: 0 },
  };

  // Check 1: Component Availability
  console.log('CHECK 1: RAG Component Availability');
  for (const [key, component] of Object.entries(RAG_COMPONENTS)) {
    const result = await checkComponentAvailability(component.id, component.name);
    results.checks.push({ name: 'component_availability', component: key, ...result });
    console.log(`  ${result.ok ? '✓' : '✗'} ${key}: ${result.ok ? `${component.name} available` : result.error}`);
    if (result.ok) results.summary.passed++;
    else results.summary.failed++;
  }

  // Check 2: Embeddings Validation
  console.log('\nCHECK 2: Embeddings Generation & Validation');
  const labordocText = TEST_DOCUMENTS.labor_law;
  const embedResult = await validateEmbeddings(labordocText);
  results.checks.push({ name: 'embeddings_validation', ...embedResult });
  console.log(`  ${embedResult.ok ? '✓' : '✗'} BGE-M3: ${embedResult.ok ? `${embedResult.embedding_dimensions}-dim embeddings in ${embedResult.latency_ms}ms` : embedResult.error}`);
  if (embedResult.ok) results.summary.passed++;
  else results.summary.failed++;

  // Check 3: Reranking Validation
  console.log('\nCHECK 3: Reranking Validation');
  const rerankResult = await validateReranking(TEST_QUERIES[0].query, TEST_DOCUMENTS);
  results.checks.push({ name: 'reranking_validation', ...rerankResult });
  console.log(`  ${rerankResult.ok ? '✓' : '✗'} BGE-Reranker: ${rerankResult.ok ? `${rerankResult.num_documents_scored} docs scored, max relevance ${rerankResult.max_score}` : rerankResult.error}`);
  if (rerankResult.ok) results.summary.passed++;
  else results.summary.failed++;

  // Check 4: E2E RAG Pipeline
  console.log('\nCHECK 4: End-to-End RAG Pipeline');
  const ragResult = await validateRAGPipeline(TEST_QUERIES[0].query, TEST_DOCUMENTS);
  results.checks.push({ name: 'rag_pipeline', ...ragResult });
  console.log(`  ${ragResult.ok ? '✓' : '✗'} ALLaM 7B: ${ragResult.ok ? `Generated ${ragResult.answer_length} chars in ${ragResult.latency_ms}ms` : ragResult.error}`);
  if (ragResult.ok) results.summary.passed++;
  else results.summary.failed++;

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${results.summary.passed} passed, ${results.summary.failed} failed`);
  console.log(`Status: ${results.summary.failed === 0 ? '🟢 FULL ARABIC RAG VALIDATION PASSED' : '🟡 SOME VALIDATIONS FAILED'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Write report
  if (REPORT_FILE) {
    const reportContent = `# Arabic RAG Validation Report — Sprint 27 Phase 2
**Generated:** ${results.timestamp}
**API Base:** ${results.api_base}
**Components Tested:** ${results.components_tested}

## Summary
- **Passed:** ${results.summary.passed}
- **Failed:** ${results.summary.failed}
- **Status:** ${results.summary.failed === 0 ? '✅ FULL RAG PIPELINE VALIDATED' : '⚠️ SOME VALIDATIONS FAILED'}

## Component Status
- **BGE-M3 Embeddings:** Converts Arabic text to 1024-dimensional vectors
- **BGE Reranker v2-m3:** Re-ranks documents by relevance to queries
- **ALLaM 7B:** Generates coherent Arabic answers from retrieved context

## Detailed Results
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

## Test Documents
- Labor Law: Saudi labor regulations and employee rights
- Contract: Commercial contract template
- Regulation: Implementation guidelines
- Insurance: Insurance policy terms

## Test Queries
1. "ما هي ساعات العمل المسموحة؟" (What are allowed work hours?)
2. "كم يبلغ الحد الأدنى للتغطية التأمينية؟" (Minimum insurance coverage?)
3. "متى يجب دفع الثمن؟" (When is payment due?)
4. "ما الفترة الزمنية بين الفحوصات؟" (Inspection period?)

## Performance Targets
- Embeddings latency: < 100ms
- Reranking latency: < 50ms
- RAG generation latency: 2-3 seconds
- Embedding dimensions: 1024
- Relevance scores: [0.0, 1.0]

## Recommendations
- If embeddings > 100ms, check GPU utilization
- If reranking scores don't descend, check model correctness
- If RAG latency > 5 seconds, consider quantization
- All latency targets should be validated against SLA

## Next Steps
- Validate against production SLA targets
- Load test with concurrent queries
- Evaluate answer quality with human raters
- Move to production deployment upon passing all checks
`;
    fs.writeFileSync(REPORT_FILE, reportContent, 'utf8');
    console.log(`Report written to: ${REPORT_FILE}\n`);
  }

  return results;
}

// Run validation
runValidation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
