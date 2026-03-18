'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const MC_BASE = (process.env.NEXT_PUBLIC_MC_URL || 'http://76.13.179.86:8084') + '/api';
const MC_TOKEN = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_MC_TOKEN || 'dc1-mc-gate0-2026')
  : 'dc1-mc-gate0-2026';

interface MCTask {
  id: string;
  title: string;
  status: string;
  assigned_to_name: string;
  completed_at: string | null;
  updated_at: string | null;
}

interface PaperclipAgent {
  id: string;
  name: string;
  role: string;
  urlKey: string;
  status: string;
  spentMonthlyCents: number;
  budgetMonthlyCents: number;
  lastHeartbeatAt: string | null;
  title: string | null;
  capabilities: string | null;
}

// Legacy mock agent data (kept for backward-compat with old agent IDs)
interface AgentProfile {
  name: string;
  role: string;
  status: 'online' | 'idle' | 'working' | 'offline';
  modelPreference: string;
  currentTask: { name: string; progress: number; startedAt: string; estimatedCompletion: string } | null;
  metrics: { tasksCompleted: number; avgCompletionHrs: number; qualityScore: number; blockerResolutionHrs: number };
  learnings: { insight: string; category: 'technical' | 'process' | 'tool' }[];
  ideas: { idea: string; impact: 'high' | 'medium' | 'low'; feasibility: 'easy' | 'medium' | 'hard' }[];
  feedback: { from: string; task: string; type: 'praise' | 'suggestion' | 'issue'; text: string }[];
  timeline: { time: string; action: string }[];
  taskHistory: { name: string; hours: number; tokens: number; quality: number }[];
}

const mockAgents: Record<string, AgentProfile> = {
  SPARK: {
    name: 'SPARK', role: 'Frontend Specialist', status: 'working', modelPreference: 'claude-sonnet',
    currentTask: { name: 'SPARK-UI: 5 dashboard views', progress: 80, startedAt: '2026-02-23T16:00:00Z', estimatedCompletion: '2026-02-23T18:00:00Z' },
    metrics: { tasksCompleted: 12, avgCompletionHrs: 2.4, qualityScore: 8.7, blockerResolutionHrs: 0.5 },
    learnings: [
      { insight: 'Tailwind dark theme works best with explicit border colors', category: 'technical' },
      { insight: 'Mock data should mirror real API shape for easy swap', category: 'process' },
      { insight: 'Next.js App Router needs "use client" for useState/useEffect', category: 'tool' },
    ],
    ideas: [
      { idea: 'Add WebSocket for real-time job updates instead of polling', impact: 'high', feasibility: 'medium' },
      { idea: 'Component library extraction for DC1 design system', impact: 'medium', feasibility: 'easy' },
    ],
    feedback: [
      { from: 'NEXUS', task: 'Dashboard layout', type: 'praise', text: 'Clean grid layout, matches spec exactly' },
      { from: 'SYNC', task: 'Connection Monitor', type: 'suggestion', text: 'Add error count badge to degraded services' },
    ],
    timeline: [
      { time: '17:24', action: 'Building Agent Intelligence view' },
      { time: '17:18', action: 'Completed Security Guards view' },
      { time: '17:10', action: 'Completed Job Execution Tracker' },
    ],
    taskHistory: [
      { name: 'Dashboard layout — 6-panel grid', hours: 3.2, tokens: 15000, quality: 9.0 },
      { name: 'Agents sidebar with status', hours: 1.5, tokens: 8000, quality: 8.5 },
    ],
  },
  VOLT: {
    name: 'VOLT', role: 'Backend Engineer', status: 'working', modelPreference: 'claude-sonnet',
    currentTask: { name: 'API contracts — lock all 25+ endpoints', progress: 65, startedAt: '2026-02-23T14:00:00Z', estimatedCompletion: '2026-02-23T20:00:00Z' },
    metrics: { tasksCompleted: 18, avgCompletionHrs: 3.1, qualityScore: 9.1, blockerResolutionHrs: 0.8 },
    learnings: [
      { insight: 'Supabase RLS policies need explicit service role bypass for agent ops', category: 'technical' },
      { insight: 'API versioning from day one prevents breaking changes', category: 'process' },
    ],
    ideas: [{ idea: 'GraphQL subscriptions for real-time dashboard data', impact: 'high', feasibility: 'hard' }],
    feedback: [{ from: 'GUARDIAN', task: 'Auth middleware', type: 'praise', text: 'Solid JWT validation with proper error codes' }],
    timeline: [{ time: '17:20', action: 'Defining job execution endpoints' }],
    taskHistory: [
      { name: 'Health check daemon — 30s GPU ping', hours: 4.0, tokens: 22000, quality: 9.0 },
      { name: 'Supabase schema deployment', hours: 2.5, tokens: 13000, quality: 9.5 },
    ],
  },
  GUARDIAN: {
    name: 'GUARDIAN', role: 'Security Specialist', status: 'online', modelPreference: 'claude-sonnet',
    currentTask: { name: 'Security isolation — container + GPU wipe', progress: 45, startedAt: '2026-02-23T15:00:00Z', estimatedCompletion: '2026-02-24T10:00:00Z' },
    metrics: { tasksCompleted: 8, avgCompletionHrs: 4.2, qualityScore: 9.4, blockerResolutionHrs: 1.2 },
    learnings: [{ insight: 'GPU memory wipe needs nvidia-smi reset + verification read', category: 'technical' }],
    ideas: [{ idea: 'Firecracker microVMs for Phase 2 job isolation', impact: 'high', feasibility: 'hard' }],
    feedback: [{ from: 'VOLT', task: 'API rate limiter', type: 'praise', text: 'Clean middleware, easy to configure per-agent limits' }],
    timeline: [{ time: '17:15', action: 'Documenting GPU wipe verification procedure' }],
    taskHistory: [
      { name: 'Guard rules engine', hours: 5.0, tokens: 28000, quality: 9.5 },
      { name: 'Audit logging system', hours: 4.0, tokens: 20000, quality: 9.6 },
    ],
  },
  ATLAS: {
    name: 'ATLAS', role: 'DevOps Engineer', status: 'idle', modelPreference: 'claude-haiku',
    currentTask: null,
    metrics: { tasksCompleted: 10, avgCompletionHrs: 2.8, qualityScore: 8.9, blockerResolutionHrs: 0.6 },
    learnings: [{ insight: 'Docker compose healthchecks must have start_period for slow services', category: 'technical' }],
    ideas: [{ idea: 'Terraform for VPS provisioning', impact: 'medium', feasibility: 'medium' }],
    feedback: [{ from: 'NEXUS', task: 'CI pipeline', type: 'praise', text: 'Fast pipeline, good caching strategy' }],
    timeline: [{ time: '16:00', action: 'Completed VPS deployment setup' }],
    taskHistory: [
      { name: 'VPS deployment config', hours: 3.0, tokens: 12000, quality: 9.0 },
      { name: 'CI/CD pipeline', hours: 4.0, tokens: 18000, quality: 9.2 },
    ],
  },
  SYNC: {
    name: 'SYNC', role: 'QA Engineer', status: 'working', modelPreference: 'claude-sonnet',
    currentTask: { name: 'Integration test suite — API endpoints', progress: 30, startedAt: '2026-02-23T16:30:00Z', estimatedCompletion: '2026-02-24T12:00:00Z' },
    metrics: { tasksCompleted: 6, avgCompletionHrs: 3.5, qualityScore: 8.6, blockerResolutionHrs: 0.9 },
    learnings: [{ insight: 'Mocked API responses must match exact schema for frontend parity', category: 'process' }],
    ideas: [{ idea: 'Playwright E2E tests for dashboard views', impact: 'high', feasibility: 'medium' }],
    feedback: [{ from: 'SPARK', task: 'Dashboard smoke test', type: 'praise', text: 'Thorough coverage of edge cases' }],
    timeline: [{ time: '17:00', action: 'Writing test cases for agent endpoints' }],
    taskHistory: [
      { name: 'Test plan Gate 0', hours: 2.0, tokens: 10000, quality: 8.8 },
      { name: 'API smoke tests', hours: 3.0, tokens: 16000, quality: 8.5 },
    ],
  },
  NEXUS: {
    name: 'NEXUS', role: 'Project Manager', status: 'online', modelPreference: 'claude-opus',
    currentTask: { name: 'Sprint coordination — Gate 0 task assignment', progress: 55, startedAt: '2026-02-23T09:00:00Z', estimatedCompletion: '2026-02-23T23:00:00Z' },
    metrics: { tasksCompleted: 15, avgCompletionHrs: 1.8, qualityScore: 9.0, blockerResolutionHrs: 0.3 },
    learnings: [{ insight: 'Parallel agent work needs clear API contracts before frontend starts', category: 'process' }],
    ideas: [{ idea: 'Automated daily standup summary from agent heartbeats', impact: 'medium', feasibility: 'easy' }],
    feedback: [{ from: 'VOLT', task: 'Task prioritization', type: 'praise', text: 'Clear priorities, no ambiguity' }],
    timeline: [{ time: '17:20', action: 'Reviewing SPARK-UI progress' }],
    taskHistory: [
      { name: 'Gate 0 sprint planning', hours: 2.0, tokens: 8000, quality: 9.2 },
      { name: 'Milestone definition', hours: 1.0, tokens: 4000, quality: 9.5 },
    ],
  },
};

const statusColors: Record<string, string> = {
  online: 'bg-[#00c853]/10 text-[#00c853]',
  running: 'bg-[#00c853]/10 text-[#00c853]',
  working: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  idle: 'bg-gray-500/10 text-gray-400',
  offline: 'bg-[#ff5252]/10 text-[#ff5252]',
};

const impactColors: Record<string, string> = {
  high: 'bg-[#ff5252]/10 text-[#ff5252]',
  medium: 'bg-[#ffab00]/10 text-[#ffab00]',
  low: 'bg-[#00c853]/10 text-[#00c853]',
};

const categoryColors: Record<string, string> = {
  technical: 'bg-purple-500/10 text-purple-400',
  process: 'bg-blue-500/10 text-blue-400',
  tool: 'bg-orange-500/10 text-orange-400',
};

const feedbackColors: Record<string, string> = {
  praise: 'bg-[#00c853]/10 text-[#00c853]',
  suggestion: 'bg-[#00d4ff]/10 text-[#00d4ff]',
  issue: 'bg-[#ff5252]/10 text-[#ff5252]',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Live Paperclip agent view component
function PaperclipAgentView({ agent, liveTasks, liveError }: { agent: PaperclipAgent; liveTasks: MCTask[]; liveError: string | null }) {
  const spentDollars = agent.spentMonthlyCents / 100;
  const budgetDollars = agent.budgetMonthlyCents / 100;

  const liveTaskStatusColors: Record<string, string> = {
    done: 'bg-[#00c853]/10 text-[#00c853]',
    completed: 'bg-[#00c853]/10 text-[#00c853]',
    in_progress: 'bg-[#00d4ff]/10 text-[#00d4ff]',
    building: 'bg-[#bb86fc]/10 text-[#bb86fc]',
    pending: 'bg-[#ffab00]/10 text-[#ffab00]',
    blocked: 'bg-[#ff5252]/10 text-[#ff5252]',
    todo: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Agent header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#00d4ff]/20 flex items-center justify-center text-[#00d4ff] text-xl font-bold">
          {agent.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs ${statusColors[agent.status] || 'bg-gray-500/10 text-gray-400'}`}>
              {agent.status}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff]">LIVE</span>
          </div>
          <div className="text-gray-400 text-sm">
            {agent.title || agent.role}
            {agent.lastHeartbeatAt && (
              <span className="ml-2 text-gray-600">· Last active {timeAgo(agent.lastHeartbeatAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="font-semibold text-sm text-gray-400 mb-2">Capabilities</h2>
          <p className="text-sm text-gray-300">{agent.capabilities}</p>
        </div>
      )}

      {/* Budget metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Spend', value: `$${spentDollars.toFixed(2)}` },
          { label: 'Budget Cap', value: agent.budgetMonthlyCents > 0 ? `$${budgetDollars.toFixed(2)}` : 'No cap' },
          { label: 'Agent ID', value: agent.urlKey },
          { label: 'Adapter', value: 'claude_local' },
        ].map(m => (
          <div key={m.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className="text-lg font-bold text-[#00d4ff] truncate">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Live Tasks */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Live Tasks (Mission Control)</h2>
          <div className="flex items-center gap-2">
            {liveError ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#ffab00]/10 text-[#ffab00]">MC Offline</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00c853]/10 text-[#00c853]">LIVE</span>
            )}
            <span className="text-xs text-gray-600">{liveTasks.length} tasks</span>
          </div>
        </div>
        {liveError ? (
          <div className="p-4 text-xs text-gray-500">Mission Control API unavailable — {liveError}</div>
        ) : liveTasks.length === 0 ? (
          <div className="p-4 text-xs text-gray-500">No tasks assigned in Mission Control</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-[#30363d]">
                <th className="text-left px-4 py-2">Task</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {liveTasks.map((t) => (
                <tr key={t.id} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                  <td className="px-4 py-2.5 text-gray-300">{t.title}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs ${liveTaskStatusColors[t.status] || 'bg-gray-500/10 text-gray-400'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {t.completed_at ? new Date(t.completed_at).toLocaleString() : t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = (params.id as string);
  const agentIdUpper = agentId?.toUpperCase();
  const mockAgent = mockAgents[agentIdUpper];

  // Live tasks from Mission Control API
  const [liveTasks, setLiveTasks] = useState<MCTask[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Real Paperclip agent data
  const [paperclipAgent, setPaperclipAgent] = useState<PaperclipAgent | null>(null);
  const [paperclipLoading, setPaperclipLoading] = useState(true);

  // Fetch Paperclip agent list to find match
  useEffect(() => {
    fetch('/api/paperclip-agents', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then((agents: PaperclipAgent[] | null) => {
        if (agents) {
          const match = agents.find(
            a => a.urlKey === agentId || a.urlKey === agentId?.toLowerCase() || a.name.toUpperCase() === agentIdUpper
          );
          if (match) setPaperclipAgent(match);
        }
      })
      .catch(() => {})
      .finally(() => setPaperclipLoading(false));
  }, [agentId, agentIdUpper]);

  const fetchLiveTasks = useCallback(async () => {
    if (!agentId) return;
    try {
      const res = await fetch(`${MC_BASE}/tasks`, {
        headers: { Authorization: `Bearer ${MC_TOKEN}` },
      });
      if (!res.ok) throw new Error(`MC API ${res.status}`);
      const tasks: MCTask[] = await res.json();
      const agentTasks = tasks.filter(
        (t) => t.assigned_to_name?.toUpperCase() === agentIdUpper
      );
      agentTasks.sort((a, b) => {
        const aTime = a.updated_at || '';
        const bTime = b.updated_at || '';
        return bTime.localeCompare(aTime);
      });
      setLiveTasks(agentTasks);
      setLiveError(null);
    } catch (err: unknown) {
      setLiveError(err instanceof Error ? err.message : 'MC API unavailable');
    }
  }, [agentId, agentIdUpper]);

  useEffect(() => {
    fetchLiveTasks();
    const interval = setInterval(fetchLiveTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveTasks]);

  // Loading state
  if (paperclipLoading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Real Paperclip agent found — show live view
  if (paperclipAgent) {
    return <PaperclipAgentView agent={paperclipAgent} liveTasks={liveTasks} liveError={liveError} />;
  }

  // Legacy mock agent fallback
  if (!mockAgent) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <div>Agent &quot;{agentId}&quot; not found</div>
          <div className="text-xs mt-2 text-gray-600">
            Check the agent URL key or use a valid agent identifier
          </div>
          <Link href="/agents" className="text-[#00d4ff] text-sm mt-3 inline-block hover:underline">← Back to Agents</Link>
        </div>
      </div>
    );
  }

  const agent = mockAgent;

  const liveTaskStatusColors: Record<string, string> = {
    done: 'bg-[#00c853]/10 text-[#00c853]',
    completed: 'bg-[#00c853]/10 text-[#00c853]',
    in_progress: 'bg-[#00d4ff]/10 text-[#00d4ff]',
    building: 'bg-[#bb86fc]/10 text-[#bb86fc]',
    pending: 'bg-[#ffab00]/10 text-[#ffab00]',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Agent header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#00d4ff]/20 flex items-center justify-center text-[#00d4ff] text-xl font-bold">
          {agent.name[0]}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs ${statusColors[agent.status]}`}>{agent.status}</span>
          </div>
          <div className="text-gray-400 text-sm">{agent.role} · Model: {agent.modelPreference}</div>
        </div>
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-gray-400">Current Task</h2>
            <span className="text-xs text-gray-500">Started {new Date(agent.currentTask.startedAt).toLocaleTimeString()}</span>
          </div>
          <div className="text-white mb-2">{agent.currentTask.name}</div>
          <div className="w-full h-2 rounded-full bg-[#21262d] mb-1">
            <div className="h-2 rounded-full bg-[#00d4ff]" style={{ width: `${agent.currentTask.progress}%` }} />
          </div>
          <div className="text-xs text-gray-500">{agent.currentTask.progress}% · Est. completion: {new Date(agent.currentTask.estimatedCompletion).toLocaleTimeString()}</div>
        </div>
      )}

      {/* Live Tasks from Mission Control */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Live Tasks (Mission Control)</h2>
          <div className="flex items-center gap-2">
            {liveError ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#ffab00]/10 text-[#ffab00]">MC Offline</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00c853]/10 text-[#00c853]">LIVE</span>
            )}
            <span className="text-xs text-gray-600">{liveTasks.length} tasks</span>
          </div>
        </div>
        {liveError ? (
          <div className="p-4 text-xs text-gray-500">Mission Control API unavailable — {liveError}</div>
        ) : liveTasks.length === 0 ? (
          <div className="p-4 text-xs text-gray-500">No tasks assigned to {agent.name} in Mission Control</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-[#30363d]">
                <th className="text-left px-4 py-2">Task</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {liveTasks.map((t) => (
                <tr key={t.id} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                  <td className="px-4 py-2.5 text-gray-300">{t.title}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs ${liveTaskStatusColors[t.status] || 'bg-gray-500/10 text-gray-400'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {t.completed_at ? new Date(t.completed_at).toLocaleString() : t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Tasks Completed', value: agent.metrics.tasksCompleted.toString() },
          { label: 'Avg Completion', value: `${agent.metrics.avgCompletionHrs}h` },
          { label: 'Quality Score', value: `${agent.metrics.qualityScore}/10` },
          { label: 'Blocker Resolution', value: `${agent.metrics.blockerResolutionHrs}h` },
        ].map(m => (
          <div key={m.label} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-center">
            <div className="text-xs text-gray-500">{m.label}</div>
            <div className="text-2xl font-bold text-[#00d4ff]">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Learnings */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Learnings</h2>
          <div className="space-y-2">
            {agent.learnings.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 mt-0.5 ${categoryColors[l.category]}`}>{l.category}</span>
                <span className="text-sm text-gray-300">{l.insight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ideas */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Ideas</h2>
          <div className="space-y-2">
            {agent.ideas.map((idea, i) => (
              <div key={i} className="flex items-start justify-between gap-2">
                <span className="text-sm text-gray-300">{idea.idea}</span>
                <div className="flex gap-1 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${impactColors[idea.impact]}`}>{idea.impact}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs bg-gray-500/10 text-gray-400">{idea.feasibility}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Feedback</h2>
          <div className="space-y-2">
            {agent.feedback.map((f, i) => (
              <div key={i} className="border-l-2 border-[#30363d] pl-3">
                <div className="flex items-center gap-2 text-xs mb-1">
                  <span className="text-[#00d4ff]">{f.from}</span>
                  <span className="text-gray-600">on</span>
                  <span className="text-gray-400">{f.task}</span>
                  <span className={`px-1.5 py-0.5 rounded ${feedbackColors[f.type]}`}>{f.type}</span>
                </div>
                <div className="text-sm text-gray-300">{f.text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Operations Timeline</h2>
          <div className="space-y-2">
            {agent.timeline.map((t, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="text-gray-600 font-mono shrink-0">{t.time}</span>
                <span className="text-gray-300">{t.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task history */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#30363d]">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Task History</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-[#30363d]">
              <th className="text-left px-4 py-2">Task</th>
              <th className="text-right px-4 py-2">Hours</th>
              <th className="text-right px-4 py-2">Tokens</th>
              <th className="text-right px-4 py-2">Quality</th>
            </tr>
          </thead>
          <tbody>
            {agent.taskHistory.map((t, i) => (
              <tr key={i} className="border-b border-[#30363d]/50 hover:bg-[#21262d]">
                <td className="px-4 py-2.5 text-gray-300">{t.name}</td>
                <td className="px-4 py-2.5 text-right text-gray-400">{t.hours}h</td>
                <td className="px-4 py-2.5 text-right text-gray-400">{(t.tokens / 1000).toFixed(0)}K</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={t.quality >= 9 ? 'text-[#00c853]' : 'text-[#ffab00]'}>{t.quality}/10</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
