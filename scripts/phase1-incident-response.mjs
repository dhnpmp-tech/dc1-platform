#!/usr/bin/env node
/**
 * Phase 1 Incident Response Automation
 *
 * Monitors for specific failure patterns and triggers automated responses
 * integrates with escalation matrix from ML-INFRA-PHASE1-EXECUTION-PROCEDURES.md
 *
 * Incident Types:
 * - CRITICAL: vLLM down, disk full
 * - HIGH: Job failures, token metering issues
 * - MEDIUM: Provider offline, cold-start degradation
 */

const BASE_URL = 'https://api.dcp.sa';
const CHECK_INTERVAL = 60000; // 1 minute

// Incident history to prevent duplicate alerts
const incidentHistory = new Map();
const INCIDENT_COOLDOWN = 300000; // 5 minutes

/**
 * Escalation Matrix
 * Maps incident type → severity, action, escalation target
 */
const escalationMatrix = {
  VLLM_DOWN: {
    severity: 'CRITICAL',
    name: 'vLLM Endpoint Down',
    action: 'Restart service via PM2, notify P2P + DevOps',
    escalateTo: ['p2p-network-engineer', 'devops'],
    responseTimeMinutes: 5,
  },
  DISK_FULL: {
    severity: 'CRITICAL',
    name: 'Model Cache Disk Full',
    action: 'Clear oldest models, reduce prefetch, notify DevOps',
    escalateTo: ['devops'],
    responseTimeMinutes: 5,
  },
  JOB_FAILURES_HIGH: {
    severity: 'HIGH',
    name: 'Job Failure Rate > 5%',
    action: 'Check provider heartbeats, notify P2P Engineer',
    escalateTo: ['p2p-network-engineer'],
    responseTimeMinutes: 15,
  },
  TOKEN_METERING_ERROR: {
    severity: 'HIGH',
    name: 'Token Metering Inaccuracy',
    action: 'Validate vLLM counts vs API, notify Backend Architect',
    escalateTo: ['backend-architect'],
    responseTimeMinutes: 15,
  },
  PROVIDER_OFFLINE: {
    severity: 'MEDIUM',
    name: 'Provider Offline > 30min',
    action: 'Check network, restart docker, notify P2P Engineer',
    escalateTo: ['p2p-network-engineer'],
    responseTimeMinutes: 30,
  },
  COLDSTART_DEGRADED: {
    severity: 'MEDIUM',
    name: 'Model Cold-Start > 30s',
    action: 'Monitor VRAM pressure, optimize prefetch',
    escalateTo: ['ml-infra-engineer'],
    responseTimeMinutes: 30,
  },
};

class IncidentDetector {
  constructor() {
    this.activeIncidents = [];
    this.metrics = {
      startTime: new Date().toISOString(),
      totalIncidents: 0,
      resolvedIncidents: 0,
      averageResponseTime: 0,
    };
  }

  async detectVLLMDown() {
    try {
      const response = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 });
      const data = await response.json();
      if (response.status !== 200 || data.status !== 'ok') {
        return this.createIncident('VLLM_DOWN', 'vLLM endpoint not responding');
      }
    } catch (err) {
      return this.createIncident('VLLM_DOWN', `vLLM check failed: ${err.message}`);
    }
  }

  async detectDiskPressure() {
    // This would normally check actual disk usage via SSH
    // For now, we can check if model cache API reports high usage
    try {
      const response = await fetch(`${BASE_URL}/api/models`, { timeout: 5000 });
      if (response.status === 507) { // Insufficient Storage
        return this.createIncident('DISK_FULL', 'Disk space critical');
      }
    } catch (err) {
      console.error('Disk check error:', err.message);
    }
  }

  async detectJobFailures() {
    try {
      const response = await fetch(`${BASE_URL}/api/metrics/jobs?window=1h`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const failureRate = data.failed / (data.completed + data.failed);

        if (failureRate > 0.05) { // > 5%
          return this.createIncident(
            'JOB_FAILURES_HIGH',
            `Job failure rate: ${(failureRate * 100).toFixed(1)}%`
          );
        }
      }
    } catch (err) {
      console.error('Job metrics check error:', err.message);
    }
  }

  async detectTokenMeteringIssues() {
    try {
      const response = await fetch(`${BASE_URL}/api/jobs?status=completed&limit=10`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const jobs = await response.json();
        const inaccuracies = jobs.filter(job => {
          const apiTotal = job.metering?.input_tokens + job.metering?.output_tokens;
          const providerTotal = job.provider_metering?.total_tokens;
          return Math.abs(apiTotal - providerTotal) > 0;
        });

        if (inaccuracies.length > 0) {
          return this.createIncident(
            'TOKEN_METERING_ERROR',
            `${inaccuracies.length}/${jobs.length} jobs have metering discrepancies`
          );
        }
      }
    } catch (err) {
      console.error('Token metering check error:', err.message);
    }
  }

  async detectProviderOffline() {
    try {
      const response = await fetch(`${BASE_URL}/api/providers/status`, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const offlineProviders = data.providers?.filter(p => {
          const lastHeartbeat = new Date(p.last_heartbeat);
          const minutesAgo = (Date.now() - lastHeartbeat) / 60000;
          return minutesAgo > 30;
        }) || [];

        if (offlineProviders.length > 0) {
          return this.createIncident(
            'PROVIDER_OFFLINE',
            `${offlineProviders.length} providers offline > 30 minutes`
          );
        }
      }
    } catch (err) {
      console.error('Provider status check error:', err.message);
    }
  }

  createIncident(type, details) {
    // Check cooldown to avoid duplicate alerts
    const lastIncident = incidentHistory.get(type);
    if (lastIncident && Date.now() - lastIncident < INCIDENT_COOLDOWN) {
      return null; // Skip if in cooldown
    }

    incidentHistory.set(type, Date.now());

    const config = escalationMatrix[type];
    if (!config) {
      console.warn(`Unknown incident type: ${type}`);
      return null;
    }

    const incident = {
      id: `${type}-${Date.now()}`,
      type,
      severity: config.severity,
      name: config.name,
      details,
      action: config.action,
      escalateTo: config.escalateTo,
      responseTimeMinutes: config.responseTimeMinutes,
      detectedAt: new Date().toISOString(),
      status: 'OPEN',
    };

    this.activeIncidents.push(incident);
    this.metrics.totalIncidents++;

    return incident;
  }

  async checkAllIncidents() {
    const newIncidents = [];

    // Run all detection methods
    const checks = [
      this.detectVLLMDown(),
      this.detectDiskPressure(),
      this.detectJobFailures(),
      this.detectTokenMeteringIssues(),
      this.detectProviderOffline(),
    ];

    const results = await Promise.all(checks);
    results.forEach(incident => {
      if (incident) newIncidents.push(incident);
    });

    return newIncidents;
  }

  formatIncident(incident) {
    const icons = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
    };

    return `
${icons[incident.severity]} [${incident.severity}] ${incident.name}
   Details: ${incident.details}
   Action: ${incident.action}
   Escalate to: ${incident.escalateTo.join(', ')}
   Response SLA: ${incident.responseTimeMinutes} minutes
   Detected: ${incident.detectedAt}
`;
  }

  printActiveIncidents() {
    if (this.activeIncidents.length === 0) {
      console.log('✅ No active incidents');
      return;
    }

    console.log(`\n🚨 Active Incidents (${this.activeIncidents.length}):`);
    this.activeIncidents.forEach(incident => {
      console.log(this.formatIncident(incident));
    });
  }
}

async function runMonitoring() {
  const detector = new IncidentDetector();

  console.log('🚀 Phase 1 Incident Response Automation Started');
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`⏱️  Check Interval: ${CHECK_INTERVAL / 1000} seconds\n`);

  // Initial check
  console.log('Running initial incident detection...');
  let incidents = await detector.checkAllIncidents();
  if (incidents.length > 0) {
    incidents.forEach(incident => {
      console.log(detector.formatIncident(incident));
    });
  }

  // Set up recurring checks
  const intervalId = setInterval(async () => {
    const newIncidents = await detector.checkAllIncidents();

    if (newIncidents.length > 0) {
      console.log(`\n🚨 New incidents detected at ${new Date().toISOString()}:`);
      newIncidents.forEach(incident => {
        console.log(detector.formatIncident(incident));
      });
    }

    detector.printActiveIncidents();
  }, CHECK_INTERVAL);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n📊 Incident Response Summary:');
    console.log(`Total incidents: ${detector.metrics.totalIncidents}`);
    console.log(`Start time: ${detector.metrics.startTime}`);
    console.log(`End time: ${new Date().toISOString()}`);

    clearInterval(intervalId);
    process.exit(0);
  });
}

runMonitoring().catch(err => {
  console.error('Incident response automation failed:', err);
  process.exit(1);
});
