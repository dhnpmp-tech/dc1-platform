/**
 * DC1 Provider Routes — Gate 0
 * Handles provider self-registration, heartbeats, and setup script serving.
 *
 * GPU specs are AUTO-DETECTED by the provider's daemon.sh and sent in the
 * registration payload — no manual entry required.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GpuSpec {
  index: number;
  name: string;
  vram_mib: number;
  driver: string;
  compute: string;
}

interface PrimaryGpu {
  name: string;
  vram_mib: number;
  driver: string;
  compute: string;
  count: number;
}

interface RegisterBody {
  api_key: string;
  public_ip: string;
  agent_port?: number;
  os?: string;
  disk_free_gb?: number;
  gpus: GpuSpec[];
  primary_gpu: PrimaryGpu;
}

interface HeartbeatBody {
  provider_id: string;
  status: 'online' | 'idle' | 'busy' | 'offline';
  gpu_name?: string;
  gpu_util_pct?: number;
  vram_used_mib?: number;
}

interface SetupQuery {
  key: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a scoped provider API key */
function generateProviderKey(): string {
  return `dc1-prov-${randomBytes(16).toString('hex')}`;
}

/** Minimum VRAM requirement in MiB (8 GB) */
const MIN_VRAM_MIB = 8192;

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function providerRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /api/providers/register ─────────────────────────────────────────
  // Self-registration from daemon.sh — GPU specs auto-detected on the provider side.
  app.post(
    '/api/providers/register',
    async (
      req: FastifyRequest<{ Body: RegisterBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { api_key, public_ip, agent_port, os, disk_free_gb, gpus, primary_gpu } = req.body;

        // Validate presence
        if (!api_key || !public_ip || !primary_gpu?.name) {
          return reply.status(400).send({
            success: false,
            error: 'Missing required fields: api_key, public_ip, primary_gpu',
          });
        }

        // Validate minimum GPU spec
        if (primary_gpu.vram_mib < MIN_VRAM_MIB) {
          return reply.status(422).send({
            success: false,
            error: `GPU VRAM ${primary_gpu.vram_mib} MiB is below DC1 minimum of ${MIN_VRAM_MIB} MiB (8 GB)`,
            vram_mib: primary_gpu.vram_mib,
            minimum_mib: MIN_VRAM_MIB,
          });
        }

        // Validate API key exists in machines table (pre-issued keys) OR issue a new one
        const providerKey = api_key.startsWith('dc1-prov-')
          ? api_key
          : generateProviderKey();

        // Upsert machine record with auto-detected GPU specs
        const { data: machine, error } = await supabase
          .from('machines')
          .upsert({
            api_key: providerKey,
            ip_address: public_ip,
            agent_port: agent_port ?? 8085,
            os_info: os ?? 'unknown',
            disk_free_gb: disk_free_gb ?? null,
            gpu_name: primary_gpu.name,           // Auto-detected
            gpu_vram_mib: primary_gpu.vram_mib,   // Auto-detected
            gpu_count: primary_gpu.count,          // Auto-detected
            driver_version: primary_gpu.driver,    // Auto-detected
            compute_capability: primary_gpu.compute, // Auto-detected
            gpu_specs_json: JSON.stringify(gpus),  // All GPUs raw
            status: 'online',
            registered_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
          }, {
            onConflict: 'api_key',
            ignoreDuplicates: false,
          })
          .select('id, gpu_name, gpu_vram_mib, status')
          .single();

        if (error) {
          console.error('[providers] upsert error:', error);
          return reply.status(500).send({ success: false, error: 'Database error during registration' });
        }

        return reply.status(201).send({
          success: true,
          provider_id: machine.id,
          api_key: providerKey,
          gpu_name: machine.gpu_name,
          gpu_vram_mib: machine.gpu_vram_mib,
          status: machine.status,
          message: `Provider registered — ${primary_gpu.name} (${Math.round(primary_gpu.vram_mib / 1024)} GB VRAM)`,
        });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[providers] register error:', msg);
        return reply.status(500).send({ success: false, error: msg });
      }
    },
  );

  // ── POST /api/providers/heartbeat ────────────────────────────────────────
  app.post(
    '/api/providers/heartbeat',
    async (
      req: FastifyRequest<{ Body: HeartbeatBody }>,
      reply: FastifyReply,
    ) => {
      try {
        const { provider_id, status, gpu_util_pct, vram_used_mib } = req.body;
        const apiKey = req.headers['x-dc1-key'] as string | undefined;

        if (!provider_id && !apiKey) {
          return reply.status(400).send({ success: false, error: 'provider_id or X-DC1-Key required' });
        }

        const query = supabase.from('machines').update({
          status: status ?? 'online',
          last_heartbeat: new Date().toISOString(),
          ...(gpu_util_pct !== undefined && { gpu_util_pct }),
          ...(vram_used_mib !== undefined && { vram_used_mib }),
        });

        const { error } = provider_id
          ? await query.eq('id', provider_id)
          : await query.eq('api_key', apiKey!);

        if (error) {
          return reply.status(500).send({ success: false, error: 'Heartbeat update failed' });
        }

        return reply.status(200).send({ ok: true, received: new Date().toISOString() });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ success: false, error: msg });
      }
    },
  );

  // ── GET /api/providers/setup ──────────────────────────────────────────────
  // Serves daemon.sh with the API key pre-injected.
  // curl -s "http://HOST/api/providers/setup?key=YOUR_KEY" | bash
  app.get(
    '/api/providers/setup',
    async (
      req: FastifyRequest<{ Querystring: SetupQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { key } = req.query;
        if (!key) {
          return reply.status(400).send({
            error: 'API key required. Usage: /api/providers/setup?key=YOUR_KEY',
          });
        }

        // Path relative to this route file: ../../orchestration/setup/daemon.sh
        const daemonPath = path.resolve(
          __dirname,
          '../../../orchestration/setup/daemon.sh',
        );

        if (!fs.existsSync(daemonPath)) {
          return reply.status(404).send({ error: 'daemon.sh not found on server' });
        }

        let script = fs.readFileSync(daemonPath, 'utf-8');

        // Inject the API key so providers don't need to pass it as an arg
        script = script.replace(
          'DC1_API_KEY="${1:-}"',
          `DC1_API_KEY="${key}"`,
        );

        reply
          .header('Content-Type', 'text/x-shellscript')
          .header('Content-Disposition', 'inline; filename="dc1-setup.sh"')
          .send(script);

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply.status(500).send({ error: msg });
      }
    },
  );

  // ── GET /api/providers/agent.py ───────────────────────────────────────────
  // Serves the Python monitoring agent for download during setup.
  app.get(
    '/api/providers/agent.py',
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const agentPath = path.resolve(
        __dirname,
        '../../../orchestration/setup/dc1-monitoring-agent.py',
      );

      if (!fs.existsSync(agentPath)) {
        return reply.status(404).send({ error: 'Monitoring agent not found' });
      }

      reply
        .header('Content-Type', 'text/x-python')
        .send(fs.readFileSync(agentPath, 'utf-8'));
    },
  );

  // ── GET /api/providers ────────────────────────────────────────────────────
  // List all registered providers (admin — MC token required)
  app.get(
    '/api/providers',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const token = (req.headers['authorization'] ?? '').replace('Bearer ', '');
      if (token !== process.env.MC_TOKEN) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { data, error } = await supabase
        .from('machines')
        .select('id, gpu_name, gpu_vram_mib, gpu_count, status, ip_address, last_heartbeat, registered_at')
        .order('registered_at', { ascending: false });

      if (error) return reply.status(500).send({ error: error.message });
      return reply.send({ providers: data, total: data?.length ?? 0 });
    },
  );
}
