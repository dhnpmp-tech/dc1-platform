'use strict';

/**
 * Heuristic request classifier -- ported from Mesh-LLM router.rs signal lists.
 * Classifies a chat completion request into category + complexity.
 *
 * Categories: code | reasoning | creative | chat | tool_call
 * Complexity: quick | moderate | deep
 */

const CODE_SIGNALS = [
  '```', 'function ', 'def ', 'class ', 'import ', 'require(', 'const ', 'let ',
  'var ', 'return ', 'if (', 'for (', 'while (', '.map(', '.filter(', '.reduce(',
  'async ', 'await ', 'try {', 'catch (', 'throw ', 'console.log', 'print(',
  'SELECT ', 'INSERT ', 'UPDATE ', 'DELETE ', 'CREATE TABLE', 'ALTER TABLE',
  'git ', 'npm ', 'pip ', 'cargo ', 'docker ', 'kubectl ',
  'debug', 'refactor', 'bug', 'error', 'fix', 'compile', 'build'
];

const REASONING_SIGNALS = [
  'prove', 'step by step', 'calculate', 'derive', 'solve', 'analyze',
  'compare', 'evaluate', 'explain why', 'what if', 'trade-off', 'tradeoff',
  'pros and cons', 'reasoning', 'logic', 'mathematical', 'theorem'
];

const CREATIVE_SIGNALS = [
  'write a story', 'write a poem', 'imagine', 'creative', 'fiction',
  'narrative', 'compose', 'brainstorm', 'design a', 'invent', 'roleplay'
];

const DEEP_SIGNALS = [
  'architect', 'design a system', 'comprehensive', 'in-depth', 'thorough',
  'detailed analysis', 'review the entire', 'audit', 'security review',
  'performance optimization', 'scale to', 'production-ready', 'enterprise', 'roadmap'
];

function classifyRequest(messages, tools) {
  // Extract last user message + full conversation text
  const lastUser = (messages || [])
    .filter(m => m.role === 'user')
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .pop() || '';
  const allText = (messages || [])
    .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
    .join(' ');
  const lower = allText.toLowerCase();

  // Count signals
  const codeScore = CODE_SIGNALS.filter(s => lower.includes(s.toLowerCase())).length;
  const reasonScore = REASONING_SIGNALS.filter(s => lower.includes(s)).length;
  const creativeScore = CREATIVE_SIGNALS.filter(s => lower.includes(s)).length;
  const deepScore = DEEP_SIGNALS.filter(s => lower.includes(s)).length;
  const hasTools = !!(tools && tools.length > 0);

  // Category (highest signal wins)
  let category = 'chat';
  const maxScore = Math.max(codeScore, reasonScore, creativeScore);
  if (maxScore >= 2) {
    if (codeScore === maxScore) category = 'code';
    else if (reasonScore === maxScore) category = 'reasoning';
    else if (creativeScore === maxScore) category = 'creative';
  }
  if (hasTools) category = 'tool_call';

  // Complexity
  let complexity = 'moderate';
  if (deepScore >= 1 || lastUser.length > 500 || (messages || []).length > 10) {
    complexity = 'deep';
  } else if (lastUser.length < 60 && (messages || []).length <= 2 && reasonScore === 0 && deepScore === 0) {
    complexity = 'quick';
  }

  return { category, complexity, hasTools, codeScore, reasonScore, creativeScore, deepScore };
}

module.exports = { classifyRequest };
