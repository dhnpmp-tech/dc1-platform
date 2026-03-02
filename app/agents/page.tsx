'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import Link from 'next/link';

interface MCTask {
  id: string;
  title: string;
  status: string;
  assigned_to_name: string;
  completed_at: string | null;
  updated_at: string | null;
}

interface AgentInfo {
  name: string;
  uuid: string;
  role: string;
  color: string;
  borderColor: string;
  badgeBg: string;
}

interface AgentStats {
  doneTasks: number;
  totalTasks: number;
  lastCompletedTitle: string | null;
  lastCompletedTime: string | null;
  status: 'ACTIVE' | 'IDLE' | 'BUILDING';
}

const AGENTS: AgentInfo[] = [
  { name: 'NEXUS', uuid: '37c0fd6b', role: 'COO — Orchestration & Comms', color: 'text-[#ffd700]', borderColor: 'border-[#ffd700]/30', badgeBg: 'bg-[#ffd700]/10' },
  { name: 'ATLAS', uuid: '3149e473', role: 'DevOps — Infrastructure & Failover', color: 'text-[#4da6ff]', borderColor: 'border-[#4da6ff]/30', badgeBg: 'bg-[#4da6ff]/10' },
  { name: 'VOLT', uuid: '1293aef8', role: 'Backend — API & Billing Engine', color: 'text-[#00c853]', borderColor: 'border-[#00c853]/30', badgeBg: 'bg-[#00c853]/10' },
  { name: 'GUARDIAN', uuid: '3bad1840', role: 'Security — Audit & Hardening', color: 'text-[#ff5252]', borderColor: 'border-[#ff5252]/30', badgeBg: 'bg-[#ff5252]/10' },
  { name: 'SPARK', uuid: '4aa8d644', role: 'Frontend — UI & Dashboards', color: 'text-[#bb86fc]', borderColor: 'border-[#bb86fc]/30', badgeBg: 'bg-[#bb86fc]/10' },
  { name: 'SYNC', uuid: 'cb6a5cc5', role: 'QA — Tests & Integration', color: 'text-[#00d4ff]', borderColor: 'border-[#00d4ff]/30', badgeBg: 'bg-[#00d4ff]/10' },
];

const MC_BASE = 'http://76.13.179.86:8084/api';
const MC_TOKEN = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_MC_TOKEN || 'dc1-mc-gate0-2026')
  : 'dc1-mc-gate0-2026';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function SkeletonCard() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[#21262d]" />
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-[#21262d] rounded w-1/3" />
          <div className="h-3 bg-[#21262d] rounded w-2/3" />
        </div>
      </div>
      <div className="h-2 bg-[#21262d] rounded w-full mb-3" />
      <div className="h-3 bg-[#21262d] rounded w-1/2" />
    </div>
  );
}

export default function AgentsPage() {
  const [agentStats, setAgentStats] = useState<Record<string, AgentStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${MC_BASE}/tasks`, {
        headers: { Authorization: `Bearer ${MC_TOKEN}` },
      });
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const tasks: MCTask[] = await res.json();

      const stats: Record<string, AgentStats> = {};
      for (const agent of AGENTS) {
        const agentTasks = tasks.filter(
          (t) => t.assigned_to_name?.toUpperCase() === agent.name
        );
        const done = agentTasks.filter((t) => t.status === 'done' || t.status === 'completed');
        const inProgress = agentTasks.filter((t) => t.status === 'in_progress' || t.status === 'building');

        const lastCompleted = done
          .filter((t) => t.completed_at || t.updated_at)
          .sort((a, b) => {
            const aTime = a.completed_at || a.updated_at || '';
            const bTime = b.completed_at || b.updated_at || '';
            return bTime.localeCompare(aTime);
          })[0];

        stats[agent.name] = {
          doneTasks: done.length,
          totalTasks: agentTasks.length,
          lastCompletedTitle: lastCompleted?.title ?? null,
          lastCompletedTime: lastCompleted?.completed_at ?? lastCompleted?.updated_at ?? null,
          status: inProgress.length > 0 ? 'BUILDING' : done.length > 0 ? 'ACTIVE' : 'IDLE',
        };
      }
      setAgentStats(stats);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-[#00c853]/10 text-[#00c853]',
    BUILDING: 'bg-[#00d4ff]/10 text-[#00d4ff]',
    IDLE: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#00d4ff]">🤖 Agent Intelligence</h1>
            <p className="text-sm text-gray-500">DC1 agent swarm — status & task progress</p>
          </div>
          {error && (
            <div className="text-xs text-[#ffab00] bg-[#ffab00]/10 px-3 py-1 rounded-md">
              ⚠️ API: {error} — showing cached data
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && Object.keys(agentStats).length === 0
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : AGENTS.map((agent) => {
                const stats = agentStats[agent.name] ?? {
                  doneTasks: 0,
                  totalTasks: 0,
                  lastCompletedTitle: null,
                  lastCompletedTime: null,
                  status: 'IDLE' as const,
                };
                const progressPct =
                  stats.totalTasks > 0
                    ? Math.round((stats.doneTasks / stats.totalTasks) * 100)
                    : 0;

                return (
                  <Link key={agent.name} href={`/agents/${agent.name.toLowerCase()}`}>
                    <div
                      className={`bg-[#161b22] border ${agent.borderColor} rounded-lg p-5 space-y-3 hover:bg-[#1c2128] transition-colors cursor-pointer`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${agent.badgeBg} flex items-center justify-center ${agent.color} font-bold text-sm`}
                        >
                          {agent.name.slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${agent.color}`}>{agent.name}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${statusColors[stats.status]}`}
                            >
                              {stats.status}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 truncate">{agent.role}</div>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        UUID: <span className="font-mono text-gray-400">{agent.uuid}</span>
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Tasks</span>
                          <span className="text-gray-400">
                            {stats.doneTasks}/{stats.totalTasks} done
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#21262d]">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              progressPct === 100
                                ? 'bg-[#00c853]'
                                : progressPct > 50
                                ? 'bg-[#00d4ff]'
                                : 'bg-[#ffab00]'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Last completed */}
                      {stats.lastCompletedTitle && (
                        <div className="text-xs text-gray-500 border-t border-[#30363d] pt-2">
                          <span className="text-gray-600">Last: </span>
                          <span className="text-gray-400">{stats.lastCompletedTitle}</span>
                          {stats.lastCompletedTime && (
                            <span className="text-gray-600"> · {timeAgo(stats.lastCompletedTime)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </DashboardLayout>
  );
}
