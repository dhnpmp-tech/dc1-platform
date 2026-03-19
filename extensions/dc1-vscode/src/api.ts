/**
 * DCP API client for VS Code extension.
 * Wraps all REST calls to dcp.sa backend.
 */

import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

export interface Provider {
  id: string;
  gpu_model: string;
  vram_gb: number;
  status: 'online' | 'offline' | 'busy';
  location?: string;
  price_per_hour_sar?: number;
  cpu_cores?: number;
  ram_gb?: number;
}

export interface Job {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  container_image: string;
  provider_id?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  cost_halala?: number;
  output?: string;
  error?: string;
}

export interface JobSubmitRequest {
  container_image: string;
  command?: string;
  env?: Record<string, string>;
  provider_id?: string;
  max_duration_seconds?: number;
}

export interface WalletInfo {
  balance_halala: number;
  balance_sar: number;
  total_spent_halala: number;
}

export interface AvailableModel {
  model_id: string;
  display_name: string;
  providers_count: number;
}

function getBaseUrl(): string {
  const cfg = vscode.workspace.getConfiguration('dc1');
  return cfg.get<string>('apiBaseUrl', 'https://dcp.sa');
}

function makeRequest<T>(
  method: string,
  path: string,
  apiKey: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    const url = new URL(`/api/dc1${path}`, baseUrl);

    const options: http.RequestOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'x-renter-key': apiKey,
      },
    };

    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) {
      options.headers!['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            resolve(data as unknown as T);
          }
        } else {
          let errMsg = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(data);
            errMsg = parsed.error || parsed.message || errMsg;
          } catch {
            // ignore parse error
          }
          reject(new Error(errMsg));
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export class Dc1ApiClient {
  constructor(private readonly apiKey: string) {}

  async getAvailableProviders(): Promise<Provider[]> {
    const result = await makeRequest<{ providers: Provider[] } | Provider[]>(
      'GET',
      '/renters/available-providers',
      this.apiKey
    );
    if (Array.isArray(result)) {
      return result;
    }
    return (result as { providers: Provider[] }).providers || [];
  }

  async getMyJobs(): Promise<Job[]> {
    const result = await makeRequest<{ jobs: Job[] } | Job[]>(
      'GET',
      '/renters/jobs',
      this.apiKey
    );
    if (Array.isArray(result)) {
      return result;
    }
    return (result as { jobs: Job[] }).jobs || [];
  }

  async getJobById(jobId: string): Promise<Job> {
    return makeRequest<Job>('GET', `/jobs/${jobId}`, this.apiKey);
  }

  async getJobOutput(jobId: string): Promise<string> {
    const result = await makeRequest<{ output: string } | string>(
      'GET',
      `/jobs/${jobId}/output`,
      this.apiKey
    );
    if (typeof result === 'string') {
      return result;
    }
    return (result as { output: string }).output || '';
  }

  async submitJob(req: JobSubmitRequest): Promise<Job> {
    return makeRequest<Job>('POST', '/jobs/submit', this.apiKey, req);
  }

  async getWallet(): Promise<WalletInfo> {
    const result = await makeRequest<WalletInfo>('GET', '/renters/me', this.apiKey);
    return result;
  }

  async getAvailableModels(): Promise<AvailableModel[]> {
    const result = await makeRequest<{ models: AvailableModel[] } | AvailableModel[]>(
      'GET',
      '/providers/models',
      this.apiKey
    );
    if (Array.isArray(result)) {
      return result;
    }
    return (result as { models: AvailableModel[] }).models || [];
  }

  async getInProgressJobs(): Promise<Job[]> {
    const result = await makeRequest<{ jobs: Job[] } | Job[]>(
      'GET',
      '/renters/jobs?status=in_progress',
      this.apiKey
    );
    if (Array.isArray(result)) {
      return result;
    }
    return (result as { jobs: Job[] }).jobs || [];
  }

  async cancelJob(jobId: string): Promise<void> {
    await makeRequest<unknown>('DELETE', `/jobs/${jobId}`, this.apiKey);
  }
}
