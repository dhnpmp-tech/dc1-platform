'use client';

import { useState, useEffect } from 'react';

// TODO: wire to GET /api/agents/:id/tokens

// MOCKED DATA
interface AgentTokenUsage {
  name: string;
  role: string;
  dailyBudget: number;
  usedToday: number;
  modelMix: { sonnet: number; haiku: number; opus: number; minimax: number };
}

const MODEL_RATES: Record<string, number> = {
  sonnet: 0.003, // per 1K tokens
  haiku: 0.00025,
  opus: 0.015,
  minimax: 0.0004,
};

const mockAgents: AgentTokenUsage[] = [
  { name: 'VOLT', role: 'Backend', dailyBudget: 50000, usedToday: 38200, modelMix: { sonnet: 25000, haiku: 8000, opus: 3200, minimax: 2000 } },
  { name: 'SPARK', role: 'Frontend', dailyBudget: 20000, usedToday: 14800, modelMix: { sonnet: 10000, haiku: 3000, opus: 800, minimax: 1000 } },
  { name: 'GUARDIAN', role: 'Security', dailyBudget: 30000, usedToday: 12500, modelMix: { sonnet: 8000, haiku: 3500, opus: 500, minimax: 500 } },
  { name: 'ATLAS', role: 'DevOps', dailyBudget: 15000, usedToday: 4200, modelMix: { sonnet: 2000, haiku: 1800, opus: 200, minimax: 200 } },
  { name: 'SYNC', role: 'QA', dailyBudget: 25000, usedToday: 19800, modelMix: { sonnet: 12000, haiku: 5000, opus: 1800, minimax: 1000 } },
  { name: 'NEXUS', role: 'PM', dailyBudget: 10000, usedToday: 9600, modelMix: { sonnet: 6000, haiku: 2000, opus: 1200, minimax: 400 } },
];

function calcCost(mix: AgentTokenUsage['modelMix']): number {
  return Object.entries(mix).reduce((sum, [model, tokens]) => {
    return sum + (tokens / 1000) * (MODEL_RATES[model] || 0);
  }, 0);
}

function usageColor(pct: number): string {
  if (pct >= 95) return 'bg-[#ff5252]';
  if (pct >= 80) return 'bg-[#ffab00]';
  if (pct >= 50) return 'bg-[#ffab00]';
  return 'bg-[#00c853]';
}

function usageBarBg(pct: number): string {
  if (pct >= 95) return 'bg-[#ff5252]/20';
  if (pct >= 50) return 'bg-[#ffab00]/20';
  return 'bg-[#00c853]/20';
}

function alertBadge(pct: number): string | null {
  if (pct >= 95) return '🔴 Over budget';
  if (pct >= 70) return '⚠️ High usage';
  return null;
}

export default function TokensPage() {
  const totalBudget = mockAgents.reduce((s, a) => s + a.dailyBudget, 0);
  const totalUsed = mockAgents.reduce((s, a) => s + a.usedToday, 0);
  const totalCost = mockAgents.reduce((s, a) => s + calcCost(a.modelMix), 0);
  const totalPct = Math.round((totalUsed / totalBudget) * 100);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[#00d4ff]">🪙 Token Usage Dashboard</h1>

      {/* Aggregate header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-gray-400 text-sm">Daily Aggregate</span>
            <div className="text-2xl font-bold">{totalUsed.toLocaleString()} <span className="text-gray-500 text-lg">/ {totalBudget.toLocaleString()}</span></div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Cost Today</div>
            <div className="text-xl font-bold text-[#00d4ff]">${totalCost.toFixed(2)}</div>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-[#21262d]">
          <div className={`h-3 rounded-full ${usageColor(totalPct)} transition-all`} style={{ width: `${Math.min(totalPct, 100)}%` }} />
        </div>
        <div className="text-xs text-gray-500 mt-1">{totalPct}% used</div>
      </div>

      {/* Per-agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAgents.map(agent => {
          const pct = Math.round((agent.usedToday / agent.dailyBudget) * 100);
          const remaining = agent.dailyBudget - agent.usedToday;
          const cost = calcCost(agent.modelMix);
          const badge = alertBadge(pct);

          return (
            <div key={agent.name} className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[#00d4ff] font-bold">{agent.name}</span>
                  <span className="text-gray-500 text-xs ml-2">{agent.role}</span>
                </div>
                {badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pct >= 95 ? 'bg-[#ff5252]/10 text-[#ff5252]' : 'bg-[#ffab00]/10 text-[#ffab00]'}`}>
                    {badge}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-gray-500">Budget</div>
                  <div className="font-semibold">{(agent.dailyBudget / 1000).toFixed(0)}K</div>
                </div>
                <div>
                  <div className="text-gray-500">Used</div>
                  <div className="font-semibold">{(agent.usedToday / 1000).toFixed(1)}K</div>
                </div>
                <div>
                  <div className="text-gray-500">Remaining</div>
                  <div className={`font-semibold ${remaining < 0 ? 'text-[#ff5252]' : ''}`}>{(remaining / 1000).toFixed(1)}K</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-[#21262d]">
                <div className={`h-2 rounded-full ${usageColor(pct)} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>

              {/* Model mix */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="font-semibold text-gray-400">Model Mix</div>
                <div className="grid grid-cols-2 gap-1">
                  <span>Sonnet: {(agent.modelMix.sonnet / 1000).toFixed(1)}K</span>
                  <span>Haiku: {(agent.modelMix.haiku / 1000).toFixed(1)}K</span>
                  <span>Opus: {(agent.modelMix.opus / 1000).toFixed(1)}K</span>
                  <span>MiniMax: {(agent.modelMix.minimax / 1000).toFixed(1)}K</span>
                </div>
                <div className="text-[#00d4ff]">Cost: ${cost.toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
