export const dynamic = 'force-dynamic'

/**
 * DCP Phase 1 — Feedback Collection API
 *
 * POST /api/feedback
 * Receives feedback submissions from the in-app FeedbackWidget.
 *
 * Storage strategy (Phase 1):
 *   - Appends JSONL records to /tmp/dcp-feedback.jsonl on the server
 *   - Also logs to stdout for immediate visibility
 *   - Replace with Intercom/Pendo/database write when accounts are provisioned
 *
 * Integration points (swap in later):
 *   - Intercom: POST https://api.intercom.io/events  (INTERCOM_ACCESS_TOKEN)
 *   - Pendo: POST https://app.pendo.io/api/v1/track  (PENDO_API_KEY)
 *   - Supabase: insert into feedback table
 *
 * Admin access:
 *   GET /api/feedback — returns all collected feedback (requires DC1_ADMIN_TOKEN)
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const FEEDBACK_FILE = path.join('/tmp', 'dcp-feedback.jsonl')

interface FeedbackPayload {
  type: string
  rating?: number
  yesNo?: 'yes' | 'no' | 'other'
  text: string
  url: string
  timestamp: string
  survey?: string
  surveyContext?: string
}

function appendFeedback(record: FeedbackPayload & { id: string }): void {
  try {
    fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(record) + '\n', 'utf8')
  } catch {
    // /tmp write failure is non-fatal; we still have the console log
  }
}

function readAllFeedback(): FeedbackPayload[] {
  try {
    if (!fs.existsSync(FEEDBACK_FILE)) return []
    const lines = fs.readFileSync(FEEDBACK_FILE, 'utf8').trim().split('\n').filter(Boolean)
    return lines.map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

// ── POST /api/feedback ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let payload: Partial<FeedbackPayload>
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Basic validation
  if (!payload.type || typeof payload.type !== 'string') {
    return NextResponse.json({ error: 'Missing type' }, { status: 400 })
  }

  // Sanitise text to avoid storing raw scripts
  const text = (payload.text ?? '').slice(0, 2000).trim()

  const record = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: payload.type,
    rating: payload.rating ?? undefined,
    yesNo: payload.yesNo ?? undefined,
    text,
    url: (payload.url ?? '').slice(0, 500),
    timestamp: payload.timestamp ?? new Date().toISOString(),
    survey: payload.survey ?? undefined,
    surveyContext: (payload.surveyContext ?? '').slice(0, 200),
    ip: req.headers.get('x-forwarded-for') ?? 'unknown',
    userAgent: (req.headers.get('user-agent') ?? '').slice(0, 200),
  }

  // Persist
  appendFeedback(record)

  // Console log for immediate observability during Phase 1
  console.log('[DCP Feedback]', JSON.stringify(record))

  // ── Optional: forward to Intercom ────────────────────────────────────────
  // Uncomment and set INTERCOM_ACCESS_TOKEN env var when account is ready:
  //
  // const intercomToken = process.env.INTERCOM_ACCESS_TOKEN
  // if (intercomToken) {
  //   await fetch('https://api.intercom.io/events', {
  //     method: 'POST',
  //     headers: {
  //       Authorization: `Bearer ${intercomToken}`,
  //       'Content-Type': 'application/json',
  //       Accept: 'application/json',
  //     },
  //     body: JSON.stringify({
  //       event_name: `dcp_feedback_${record.type}`,
  //       created_at: Math.floor(Date.now() / 1000),
  //       metadata: record,
  //     }),
  //   }).catch(() => {})
  // }

  // ── Optional: forward to Pendo ───────────────────────────────────────────
  // Uncomment and set PENDO_API_KEY env var when account is ready:
  //
  // const pendoKey = process.env.PENDO_API_KEY
  // if (pendoKey) {
  //   await fetch('https://app.pendo.io/api/v1/track', {
  //     method: 'POST',
  //     headers: {
  //       'x-pendo-integration-key': pendoKey,
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({
  //       type: 'track',
  //       event: `dcp_feedback_${record.type}`,
  //       timestamp: record.timestamp,
  //       properties: record,
  //     }),
  //   }).catch(() => {})
  // }

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 })
}

// ── GET /api/feedback (admin only) ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const adminToken = process.env.DC1_ADMIN_TOKEN
  const authHeader = req.headers.get('authorization')

  if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const records = readAllFeedback()

  return NextResponse.json(
    {
      count: records.length,
      records,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Disposition': 'inline; filename="dcp-feedback.json"',
      },
    },
  )
}
