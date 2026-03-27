export const dynamic = 'force-dynamic'

/**
 * DCP AI Chat Support API
 *
 * POST /api/chat
 * Public AI-powered chat endpoint for the support widget.
 * Proxies to /v1/chat/completions with a DCP system prompt.
 *
 * No API key required from user — this is a public support chat.
 */

import { NextRequest, NextResponse } from 'next/server'

const DCP_SYSTEM_PROMPT = `You are DCP Support Assistant, an AI assistant for the DCP (Distributed Compute Platform) - Saudi Arabia's GPU compute marketplace.

DCP Overview:
- DCP connects GPU providers (people with GPUs) with renters (people who need GPU compute)
- Providers earn money by renting out their GPU time
- Renters pay for GPU access at transparent per-token rates
- All compute runs on Saudi energy-powered GPUs in-Kingdom
- Data residency: Saudi Arabia (PDPL compliant)
- DCP is Vision 2030 aligned

Key Information:
- Website: https://dcp.sa
- Support email: support@dcp.sa
- API documentation: https://dcp.sa/docs/api-reference
- Provider registration: https://dcp.sa/provider/register
- Renter registration: https://dcp.sa/renter/register

Supported Models:
- ALLaM (Arabic LLM) - جيس, falcon models
- Meta Llama 3, Mistral, Qwen, Gemma
- Image models: SDXL, ControlNet, DreamBooth
- Embedding models: BGE-M3

Pricing:
- Pay-per-token with SAR billing
- No upfront costs, no subscriptions
- Transparent pricing at https://dcp.sa/renter/pricing

You help users with:
- Understanding DCP services and pricing
- Troubleshooting GPU job issues
- API integration questions
- Provider and renter onboarding
- General questions about GPU compute

Be helpful, concise, and friendly. Respond in the same language as the user's question.`

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  sessionId?: string
}

const BACKEND_URL = process.env.BACKEND_URL || 'http://76.13.179.86:8083'
const INTERNAL_API_KEY = process.env.DCP_INTERNAL_CHAT_KEY || 'dcp_chat_internal_key_change_me'

export async function POST(req: NextRequest) {
  let payload: ChatRequest
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!payload.messages || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: 'Missing or empty messages array' }, { status: 400 })
  }

  const userMessages = payload.messages.filter((m) => m.role === 'user')
  if (userMessages.length === 0) {
    return NextResponse.json({ error: 'No user messages found' }, { status: 400 })
  }

  const systemMessage: ChatMessage = { role: 'system', content: DCP_SYSTEM_PROMPT }

  const combinedMessages = [systemMessage, ...payload.messages]

  let response: Response
  try {
    response = await fetch(`${BACKEND_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct',
        messages: combinedMessages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    })
  } catch (err) {
    console.error('[DCP Chat] Proxy error:', err)
    return NextResponse.json({ error: 'Failed to connect to AI service. Please try again.' }, { status: 502 })
  }

  if (!response.ok) {
    let errorData: { error?: string } = {}
    try {
      errorData = await response.json()
    } catch { /* ignore */ }
    console.error('[DCP Chat] Backend error:', response.status, errorData)
    return NextResponse.json(
      { error: errorData.error || 'AI service error. Please try again.' },
      { status: response.status }
    )
  }

  const data = await response.json()
  return NextResponse.json(data, { status: 200 })
}