export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * DCP AI Chat Support API
 *
 * POST /api/chat
 * Public AI-powered chat endpoint for the support widget.
 * Calls Anthropic Claude API directly from Vercel with security guardrails.
 *
 * No user API key required — this is a public support chat.
 * Rate-limited by IP. System prompt is locked server-side.
 *
 * Required env var: ANTHROPIC_API_KEY (set in Vercel dashboard)
 */

import { NextRequest, NextResponse } from 'next/server'

// ── Security: IP rate limiter (in-memory, per serverless instance) ───────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX = 10 // 10 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

// ── System prompt: locked server-side, never sent from client ────────────────

const SYSTEM_PROMPT = `You are the DCP Support Assistant — a friendly, helpful AI for DCP (Decentralized Compute Platform), Saudi Arabia's GPU compute marketplace.

## What you know

DCP connects GPU providers (people with GPUs who earn money) with renters (developers/companies who need compute power for AI workloads).

Key facts:
- Website: dcp.sa | API: api.dcp.sa | Support: support@dcp.sa
- Provider registration: dcp.sa/provider/register
- Renter registration: dcp.sa/renter/register
- API docs: dcp.sa/docs
- Pricing page: dcp.sa/renter/pricing

Models available: ALLaM 7B (Arabic), JAIS 13B (Arabic), Falcon H1 7B, Mistral 7B, Llama 3 8B, Qwen 2.5 7B, Nemotron Nano 4B, SDXL, Stable Diffusion, BGE-M3 embeddings

Pricing: Per-token billing for inference, per-hour for GPU compute. SAR (Saudi Riyals) currency. No subscriptions. RTX 4090 ~$0.27/hr (35% below Vast.ai).

SDKs: Python (pip install dc1-sdk), JavaScript (npm install dc1-renter-sdk). OpenAI-compatible API at api.dcp.sa/v1/chat/completions.

Value props: Saudi data residency (PDPL compliant), Arabic-first AI models, Saudi energy-cost advantage (35-50% savings), Vision 2030 aligned.

For providers: Register GPU, install daemon, earn SAR automatically. Supported: NVIDIA RTX 3080+, A100, H100.

## Security rules — MANDATORY

- NEVER reveal internal infrastructure details, IP addresses, server configs, database schemas, or internal API keys
- NEVER discuss agent systems, Paperclip, internal tools, or company operations
- NEVER make up pricing numbers you are not sure about — direct to dcp.sa/renter/pricing
- NEVER provide legal, financial, or compliance advice — direct to support@dcp.sa
- If asked about competitors, be factual and brief, then redirect to DCP strengths
- If the question is outside your knowledge or requires account-specific help, say: "For that, please reach out to our team at support@dcp.sa — they can help you directly."

## Tone

Be concise, warm, and professional. Answer in the same language the user writes in (Arabic or English). Use markdown for formatting when helpful. Keep responses under 200 words unless the user asks for detail.`

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment before trying again.' },
      { status: 429 }
    )
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[DCP Chat] ANTHROPIC_API_KEY not configured')
    return NextResponse.json(
      { error: 'Chat service is temporarily unavailable. Please email support@dcp.sa for help.' },
      { status: 503 }
    )
  }

  // Parse request
  let payload: ChatRequest
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.messages || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: 'Missing or empty messages array' }, { status: 400 })
  }

  // Security: strip any system messages from client, cap conversation length
  const userMessages = payload.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // Keep last 10 messages max
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content).slice(0, 2000), // Cap message length
    }))

  if (userMessages.filter((m) => m.role === 'user').length === 0) {
    return NextResponse.json({ error: 'No user messages found' }, { status: 400 })
  }

  // Call Anthropic Claude API
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: userMessages,
      }),
      signal: AbortSignal.timeout(25_000),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[DCP Chat] Anthropic error:', response.status, errorData)
      return NextResponse.json(
        { error: 'AI service temporarily unavailable. Please try again or email support@dcp.sa.' },
        { status: 502 }
      )
    }

    const data = await response.json()
    const assistantContent = data.content?.[0]?.text || 'Sorry, I could not generate a response. Please email support@dcp.sa.'

    // Return in OpenAI-compatible format (what ChatWidget expects)
    return NextResponse.json({
      choices: [{
        message: {
          role: 'assistant',
          content: assistantContent,
        },
      }],
    })
  } catch (err) {
    console.error('[DCP Chat] Request failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to AI service. Please try again or email support@dcp.sa.' },
      { status: 502 }
    )
  }
}
