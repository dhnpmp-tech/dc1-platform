#!/usr/bin/env node

/**
 * vLLM Provider Simulator
 *
 * A lightweight HTTP server that mimics a vLLM /v1/chat/completions endpoint.
 * Used for testing DCP-922 proxy routing without requiring real GPUs or providers.
 *
 * Usage:
 *   node scripts/vllm-provider-simulator.mjs --port 8000 --model ALLaM-7B
 *   node scripts/vllm-provider-simulator.mjs --port 8001 --model Qwen25-7B --latency-ms 500 --error-rate 0.05
 *
 * Environment Variables:
 *   SIMULATOR_PORT: Default port (default: 8000)
 *   SIMULATOR_LATENCY: Latency in milliseconds (default: 100)
 *   SIMULATOR_ERROR_RATE: Error rate 0-1 (default: 0)
 *
 * Features:
 *   - Streaming SSE responses in vLLM format
 *   - Configurable latency (simulates inference time)
 *   - Configurable error rate (simulates occasional failures)
 *   - Realistic token counting (prompt_tokens, completion_tokens, total_tokens)
 *   - Health check endpoint (/health)
 *   - Metrics endpoint (/metrics)
 */

import http from 'http';
import url from 'url';
import { performance } from 'perf_hooks';

// Parse command-line arguments
const args = process.argv.slice(2);
let port = parseInt(process.env.SIMULATOR_PORT || '8000');
let modelName = 'ALLaM-7B';
let latencyMs = parseInt(process.env.SIMULATOR_LATENCY || '100');
let errorRate = parseFloat(process.env.SIMULATOR_ERROR_RATE || '0');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[++i]);
  } else if (args[i] === '--model' && args[i + 1]) {
    modelName = args[++i];
  } else if (args[i] === '--latency-ms' && args[i + 1]) {
    latencyMs = parseInt(args[++i]);
  } else if (args[i] === '--error-rate' && args[i + 1]) {
    errorRate = parseFloat(args[++i]);
  }
}

// Metrics
let requestCount = 0;
let totalLatency = 0;
let errorCount = 0;
const startTime = Date.now();

// Realistic token estimators
function estimateTokens(text) {
  // Rough estimate: ~4 chars per token on average
  return Math.ceil((text || '').length / 4);
}

function generateCompletionText(model, promptTokens) {
  // Generate realistic completion length based on model
  const baseLengthMap = {
    'ALLaM-7B': 150,
    'Falcon-H1-7B': 140,
    'Qwen25-7B': 160,
    'Llama-3-8B': 170,
    'Mistral-7B': 155,
    'JAIS-13B': 180,
  };

  const baseLength = baseLengthMap[model] || 150;
  const completionTokens = baseLength + Math.floor(Math.random() * 50);

  // Generate dummy text (one word per token approximately)
  const words = [
    'the', 'model', 'generates', 'responses', 'with', 'realistic',
    'token', 'counts', 'for', 'testing', 'purposes', 'only',
    'this', 'is', 'a', 'simulated', 'vllm', 'provider',
    'endpoint', 'used', 'for', 'integration', 'testing',
  ];

  let text = '';
  for (let i = 0; i < completionTokens && text.length < 1000; i++) {
    text += words[Math.floor(Math.random() * words.length)] + ' ';
  }

  return { text: text.trim(), completionTokens };
}

function handleChatCompletions(req, res) {
  // Check for error rate
  if (Math.random() < errorRate) {
    errorCount++;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Simulated provider error', code: 'PROVIDER_ERROR' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const payload = JSON.parse(body);
      const prompt = payload.messages?.[payload.messages.length - 1]?.content || '';
      const promptTokens = estimateTokens(prompt);

      // Generate completion with configured latency
      const completion = generateCompletionText(modelName, promptTokens);
      const completionTokens = completion.completionTokens;
      const responseText = completion.text;

      // Create response ID
      const responseId = `cmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Set response headers for SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      // Send initial metadata
      const startTime = performance.now();
      const metadata = {
        id: responseId,
        object: 'text_completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: modelName,
        choices: [{
          index: 0,
          text: responseText,
          logprobs: null,
          finish_reason: 'length',
        }],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };

      // Send data chunks to simulate streaming with latency
      const wordTokens = responseText.split(/\s+/);
      const tokenInterval = Math.max(1, Math.floor(latencyMs / wordTokens.length));
      let chunkIndex = 0;

      const sendChunk = () => {
        if (chunkIndex < wordTokens.length) {
          const chunk = {
            id: responseId,
            object: 'text_completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
              index: 0,
              text: wordTokens[chunkIndex] + ' ',
              logprobs: null,
              finish_reason: null,
            }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          chunkIndex++;
          setTimeout(sendChunk, tokenInterval);
        } else {
          // Send final chunk with finish_reason and usage
          const finalChunk = {
            id: responseId,
            object: 'text_completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [{
              index: 0,
              text: '',
              logprobs: null,
              finish_reason: 'stop',
            }],
            usage: metadata.usage,
          };
          res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();

          // Update metrics
          const endTime = performance.now();
          const elapsed = endTime - startTime;
          totalLatency += elapsed;
          requestCount++;
        }
      };

      // Simulate latency before sending first chunk
      setTimeout(sendChunk, latencyMs);

    } catch (err) {
      errorCount++;
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid request', message: err.message }));
    }
  });
}

function handleHealthCheck(res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    model: modelName,
    timestamp: new Date().toISOString(),
  }));
}

function handleMetrics(res) {
  const uptime = Date.now() - startTime;
  const avgLatency = requestCount > 0 ? totalLatency / requestCount : 0;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    model: modelName,
    port,
    uptime_ms: uptime,
    requests: requestCount,
    errors: errorCount,
    average_latency_ms: Math.round(avgLatency),
    error_rate: errorRate,
    configured_latency_ms: latencyMs,
  }));
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route requests
  if (pathname === '/v1/chat/completions' && req.method === 'POST') {
    handleChatCompletions(req, res);
  } else if (pathname === '/health' && req.method === 'GET') {
    handleHealthCheck(res);
  } else if (pathname === '/metrics' && req.method === 'GET') {
    handleMetrics(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      available_endpoints: [
        'POST /v1/chat/completions',
        'GET /health',
        'GET /metrics',
      ],
    }));
  }
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] vLLM Provider Simulator started`);
  console.log(`  Model: ${modelName}`);
  console.log(`  Port: ${port}`);
  console.log(`  Latency: ${latencyMs}ms`);
  console.log(`  Error rate: ${(errorRate * 100).toFixed(1)}%`);
  console.log(`  Endpoint: http://localhost:${port}/v1/chat/completions`);
  console.log(`  Health: http://localhost:${port}/health`);
  console.log(`  Metrics: http://localhost:${port}/metrics`);
});

process.on('SIGTERM', () => {
  console.log('Shutting down...');
  server.close();
});
