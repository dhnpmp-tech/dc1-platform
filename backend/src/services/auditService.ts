/**
 * DC1 Audit Service — Gate 0 Security
 * Immutable audit logging with fire-and-forget pattern.
 * GUARDIAN agent (3bad1840)
 */

import { createClient } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuditEvent {
  agent_id?: string | null;
  action: string;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  method?: string;
  url?: string;
  status_code?: number;
  duration_ms?: number;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  request_body_hash?: string | null;
  response_size_bytes?: number | null;
}

export interface AuditRecord {
  id: string;
  agent_id: string | null;
  action: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export interface AuditFilters {
  agent_id?: string;
  action?: string;
  from?: string;   // ISO date
  to?: string;     // ISO date
  page?: number;
  limit?: number;
}

// ── Supabase Client ──────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// ── Service Functions ────────────────────────────────────────────────────────

/**
 * Fire-and-forget audit log insertion.
 * NEVER throws — audit failures must not crash the API.
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const supabase = getSupabase();
    const row = {
      agent_id: event.agent_id ?? null,
      action: event.action,
      resource_id: event.resource_id ?? null,
      details: {
        ...(event.details ?? {}),
        method: event.method,
        url: event.url,
        status_code: event.status_code,
        duration_ms: event.duration_ms,
        user_id: event.user_id,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        request_body_hash: event.request_body_hash,
        response_size_bytes: event.response_size_bytes,
      },
    };
    await supabase.from('audit_logs').insert(row);
  } catch (_err: unknown) {
    // Swallow — audit must never crash the API
    if (process.env.NODE_ENV === 'development') {
      console.error('[AUDIT] Failed to log event:', _err);
    }
  }
}

/**
 * Query audit logs with pagination and filters.
 */
export async function getAuditLog(filters: AuditFilters): Promise<AuditRecord[]> {
  const supabase = getSupabase();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audit_logs')
    .select('id, agent_id, action, resource_id, details, timestamp')
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.agent_id) query = query.eq('agent_id', filters.agent_id);
  if (filters.action) query = query.eq('action', filters.action);
  if (filters.from) query = query.gte('timestamp', filters.from);
  if (filters.to) query = query.lte('timestamp', filters.to);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditRecord[];
}

/**
 * Get single audit record by ID.
 */
export async function getAuditLogById(id: string): Promise<AuditRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, agent_id, action, resource_id, details, timestamp')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as AuditRecord;
}
