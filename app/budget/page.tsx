'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../components/DashboardLayout';

interface AgentBudget {
  name: string;
  color: string;
  inputUsed: number;
  outputUsed: number;
  inputLimit: number;
  outputLimit: number;
}

interface DailyTrend {
  day: string;
  inputTokens: number;
  outputTokens: number;
}

const INPUT_RATE = 3; // $/M tokens (Opus)
const OUTPUT_RATE = 15; // $/M tokens (Opus)

const AGENT_COLORS: Record<string, string> = {
  NEXUS: '#ffd700',
  ATLAS: '#4da6ff',
  VOLT: '#00c853',
  GUARDIAN: '#ff5252',
  SPARK: '#bb86fc',
  SYNC: '#00d4ff',
};

const AGENTS = ['NEXUS', 'ATLAS', 'VOLT', 'GUARDIAN', 'SPARK', 'SYNC'] as const;

// Generate mock weekly trend data
function getMockWeeklyTrend(): DailyTrend[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date().getDay();
  return days.map((day, i) => ({
    day,
    inputTokens: i <= today ? Math.floor(Math.random() * 200000 + 100000) : 0,
    outputTokens: i <= today ? Math.floor(Math.random() * 40000 + 20000) : 0,
  }));
}

function usageColor(pct: number): string {
  if (pct > 80) return '#ff5252';
  if (pct > 50) return '#ffab00';
  return '#00c853';
}

function usageBarClass(pct: number): string {
  if (pct > 80) return 'bg-[#ff5252]';
  if (pct > 50) return 'bg-[#ffab00]';
  return 'bg-[#00c853]';
}

function SkeletonRow() {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 bg-[#21262d] rounded w-20" />
        <div className="flex-1 h-2 bg-[#21262d] rounded" />
        <div className="h-4 bg-[#21262d] rounded w-16" />
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const [agents, setAgents] = useState<AgentBudget[]>([]);
  const [weeklyTrend, setWeeklyTrend] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricsAvailable, setMetricsAvailable] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      const MC_BASE = 'http://76.13.179.86:8084/api';
      const token = process.env.NEXT_PUBLIC_MC_TOKEN || 'dc1-mc-gate0-2026';
      const res = await fetch(`${MC_BASE}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMetricsAvailable(true);
        // If metrics API provides token data, parse it here
        // For now, fall through to placeholder data
      }
    } catch {
      // Metrics endpoint not available — use placeholder
    }

    // Placeholder data for Gate 0
    const agentData: AgentBudget[] = AGENTS.map((name) => ({
      name,
      color: AGENT_COLORS[name],
      inputUsed: 0,
      outputUsed: 0,
      inputLimit: 50000,
      outputLimit: 10000,
    }));
    setAgents(agentData);
    setWeeklyTrend(getMockWeeklyTrend());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const totalInput = agents.reduce((s, a) => s + a.inputUsed, 0);
  const totalOutput = agents.reduce((s, a) => s + a.outputUsed, 0);
  const totalInputLimit = 300000;
  const totalOutputLimit = 60000;
  const totalCost = (totalInput / 1_000_000) * INPUT_RATE + (totalOutput / 1_000_000) * OUTPUT_RATE;

  const maxTrend = Math.max(...weeklyTrend.map((d) => d.inputTokens + d.outputTokens), 1);
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-[#00d4ff]">💰 Token Budget</h1>
            <p className="text-sm text-gray-500">{today}</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Daily Cost Estimate</div>
            <div className="text-xl font-bold text-[#ffd700]">${totalCost.toFixed(2)}</div>
          </div>
        </div>

        {/* Gate 1 notice */}
        {!metricsAvailable && (
          <div className="bg-[#00d4ff]/5 border border-[#00d4ff]/20 rounded-lg px-4 py-3 text-sm text-[#00d4ff]">
            ℹ️ Live token data coming in Gate 1 — showing placeholder UI. Token tracking will connect to OpenClaw session stats.
          </div>
        )}

        {/* Aggregate Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
            <div className="text-xs text-gray-500 mb-1">Total Input Tokens</div>
            <div className="text-2xl font-bold">
              {totalInput.toLocaleString()}{' '}
              <span className="text-gray-500 text-lg">/ {totalInputLimit.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#21262d] mt-2">
              <div
                className={`h-2 rounded-full ${usageBarClass(
                  (totalInput / totalInputLimit) * 100
                )} transition-all`}
                style={{ width: `${Math.min((totalInput / totalInputLimit) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              ${((totalInput / 1_000_000) * INPUT_RATE).toFixed(2)} @ $3/M tokens
            </div>
          </div>
          <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
            <div className="text-xs text-gray-500 mb-1">Total Output Tokens</div>
            <div className="text-2xl font-bold">
              {totalOutput.toLocaleString()}{' '}
              <span className="text-gray-500 text-lg">/ {totalOutputLimit.toLocaleString()}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#21262d] mt-2">
              <div
                className={`h-2 rounded-full ${usageBarClass(
                  (totalOutput / totalOutputLimit) * 100
                )} transition-all`}
                style={{ width: `${Math.min((totalOutput / totalOutputLimit) * 100, 100)}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              ${((totalOutput / 1_000_000) * OUTPUT_RATE).toFixed(2)} @ $15/M tokens
            </div>
          </div>
        </div>

        {/* Per-agent rows */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Per-Agent Usage</h2>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            : agents.map((agent) => {
                const inputPct = agent.inputLimit > 0 ? (agent.inputUsed / agent.inputLimit) * 100 : 0;
                const outputPct = agent.outputLimit > 0 ? (agent.outputUsed / agent.outputLimit) * 100 : 0;
                const agentCost =
                  (agent.inputUsed / 1_000_000) * INPUT_RATE +
                  (agent.outputUsed / 1_000_000) * OUTPUT_RATE;

                return (
                  <div
                    key={agent.name}
                    className="bg-[#161b22] border border-[#30363d] rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="font-bold text-sm"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                      <span className="text-xs text-gray-600">
                        ${agentCost.toFixed(3)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Input</span>
                          <span className="text-gray-400">
                            {(agent.inputUsed / 1000).toFixed(1)}K / {(agent.inputLimit / 1000).toFixed(0)}K
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#21262d]">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(inputPct, 100)}%`,
                              backgroundColor: usageColor(inputPct),
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500">Output</span>
                          <span className="text-gray-400">
                            {(agent.outputUsed / 1000).toFixed(1)}K / {(agent.outputLimit / 1000).toFixed(0)}K
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#21262d]">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(outputPct, 100)}%`,
                              backgroundColor: usageColor(outputPct),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Weekly Trend */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Weekly Trend
          </h2>
          <div className="flex items-end gap-2 h-32">
            {weeklyTrend.map((day) => {
              const totalHeight = ((day.inputTokens + day.outputTokens) / maxTrend) * 100;
              const outputHeight = (day.outputTokens / maxTrend) * 100;
              return (
                <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-[#00d4ff]/30"
                      style={{ height: `${totalHeight}%` }}
                    />
                    <div
                      className="absolute bottom-0 w-full rounded-t bg-[#ffd700]/50"
                      style={{ height: `${outputHeight}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{day.day}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#00d4ff]/30" />
              Input
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-[#ffd700]/50" />
              Output
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
