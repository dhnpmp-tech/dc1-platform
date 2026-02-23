'use client';

import { useParams } from 'next/navigation';

// TODO: wire to GET /api/agents/:id/intelligence

// MOCKED DATA
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
      { time: '16:55', action: 'Completed Token Usage Dashboard' },
      { time: '16:40', action: 'Completed Connection Monitor' },
      { time: '16:30', action: 'Created shared components (StatusBadge, DashboardLayout)' },
      { time: '16:00', action: 'Started SPARK-UI task — 5 dashboard views' },
    ],
    taskHistory: [
      { name: 'Dashboard layout — 6-panel grid', hours: 3.2, tokens: 15000, quality: 9.0 },
      { name: 'Agents sidebar with status', hours: 1.5, tokens: 8000, quality: 8.5 },
      { name: 'Task pipeline Kanban', hours: 2.0, tokens: 11000, quality: 8.8 },
      { name: 'Milestones + Health panels', hours: 1.8, tokens: 9500, quality: 8.5 },
      { name: 'API Access panel', hours: 0.8, tokens: 4000, quality: 9.2 },
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
    ideas: [
      { idea: 'GraphQL subscriptions for real-time dashboard data', impact: 'high', feasibility: 'hard' },
    ],
    feedback: [
      { from: 'GUARDIAN', task: 'Auth middleware', type: 'praise', text: 'Solid JWT validation with proper error codes' },
    ],
    timeline: [
      { time: '17:20', action: 'Defining job execution endpoints' },
      { time: '16:30', action: 'Completed agent CRUD endpoints' },
      { time: '15:00', action: 'Started API contracts task' },
    ],
    taskHistory: [
      { name: 'Health check daemon — 30s GPU ping', hours: 4.0, tokens: 22000, quality: 9.0 },
      { name: 'Supabase schema deployment', hours: 2.5, tokens: 13000, quality: 9.5 },
      { name: 'Mission Control API scaffold', hours: 5.0, tokens: 35000, quality: 8.8 },
      { name: 'Agent registration system', hours: 2.0, tokens: 10000, quality: 9.2 },
      { name: 'Heartbeat endpoint', hours: 1.0, tokens: 5000, quality: 9.0 },
    ],
  },
  GUARDIAN: {
    name: 'GUARDIAN', role: 'Security Specialist', status: 'online', modelPreference: 'claude-sonnet',
    currentTask: { name: 'Security isolation — container + GPU wipe', progress: 45, startedAt: '2026-02-23T15:00:00Z', estimatedCompletion: '2026-02-24T10:00:00Z' },
    metrics: { tasksCompleted: 8, avgCompletionHrs: 4.2, qualityScore: 9.4, blockerResolutionHrs: 1.2 },
    learnings: [
      { insight: 'GPU memory wipe needs nvidia-smi reset + verification read', category: 'technical' },
      { insight: 'Rate limiting per agent prevents cascade failures', category: 'process' },
    ],
    ideas: [
      { idea: 'Firecracker microVMs for Phase 2 job isolation', impact: 'high', feasibility: 'hard' },
    ],
    feedback: [
      { from: 'VOLT', task: 'API rate limiter', type: 'praise', text: 'Clean middleware, easy to configure per-agent limits' },
    ],
    timeline: [
      { time: '17:15', action: 'Documenting GPU wipe verification procedure' },
      { time: '16:00', action: 'Completed container network isolation rules' },
    ],
    taskHistory: [
      { name: 'Guard rules engine', hours: 5.0, tokens: 28000, quality: 9.5 },
      { name: 'API rate limiter middleware', hours: 3.0, tokens: 15000, quality: 9.2 },
      { name: 'Token budget enforcement', hours: 2.5, tokens: 12000, quality: 9.0 },
      { name: 'Audit logging system', hours: 4.0, tokens: 20000, quality: 9.6 },
      { name: 'Security checklist Gate 0', hours: 1.5, tokens: 7000, quality: 9.0 },
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
      { name: 'Docker compose setup', hours: 2.0, tokens: 8000, quality: 8.8 },
      { name: 'CI/CD pipeline', hours: 4.0, tokens: 18000, quality: 9.2 },
      { name: 'SSH key management', hours: 1.0, tokens: 4000, quality: 8.5 },
      { name: 'Monitoring stack', hours: 3.5, tokens: 14000, quality: 8.7 },
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
      { name: 'Dashboard accessibility audit', hours: 1.5, tokens: 7000, quality: 9.0 },
      { name: 'Load test plan', hours: 2.5, tokens: 12000, quality: 8.4 },
      { name: 'Error handling review', hours: 1.5, tokens: 6000, quality: 8.7 },
    ],
  },
  NEXUS: {
    name: 'NEXUS', role: 'Project Manager', status: 'online', modelPreference: 'claude-opus',
    currentTask: { name: 'Sprint coordination — Gate 0 task assignment', progress: 55, startedAt: '2026-02-23T09:00:00Z', estimatedCompletion: '2026-02-23T23:00:00Z' },
    metrics: { tasksCompleted: 15, avgCompletionHrs: 1.8, qualityScore: 9.0, blockerResolutionHrs: 0.3 },
    learnings: [{ insight: 'Parallel agent work needs clear API contracts before frontend starts', category: 'process' }],
    ideas: [{ idea: 'Automated daily standup summary from agent heartbeats', impact: 'medium', feasibility: 'easy' }],
    feedback: [{ from: 'VOLT', task: 'Task prioritization', type: 'praise', text: 'Clear priorities, no ambiguity' }],
    timeline: [
      { time: '17:20', action: 'Reviewing SPARK-UI progress' },
      { time: '15:00', action: 'Assigned API contracts to VOLT' },
      { time: '12:00', action: 'Updated milestone tracker' },
    ],
    taskHistory: [
      { name: 'Gate 0 sprint planning', hours: 2.0, tokens: 8000, quality: 9.2 },
      { name: 'Agent coordination setup', hours: 1.5, tokens: 6000, quality: 9.0 },
      { name: 'Milestone definition', hours: 1.0, tokens: 4000, quality: 9.5 },
      { name: 'Risk assessment', hours: 2.0, tokens: 9000, quality: 8.8 },
      { name: 'Stakeholder update', hours: 0.5, tokens: 2000, quality: 9.0 },
    ],
  },
};

const statusColors: Record<string, string> = {
  online: 'bg-[#00c853]/10 text-[#00c853]',
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

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = (params.id as string)?.toUpperCase();
  const agent = mockAgents[agentId];

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-3">🤖</div>
          <div>Agent "{agentId}" not found</div>
          <div className="text-xs mt-2">Available: {Object.keys(mockAgents).join(', ')}</div>
        </div>
      </div>
    );
  }

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
