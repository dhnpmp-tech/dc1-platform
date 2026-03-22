import { HttpClient } from '../http';
import { Provider } from '../types';

function parseProvider(data: Record<string, unknown>): Provider {
  const vramMib = (data.vram_mib as number) ?? 0;
  return {
    id: (data.id as number) ?? 0,
    name: (data.name as string) ?? '',
    gpuModel: (data.gpu_model as string) ?? '',
    vramMib,
    vramGb: Math.round((vramMib / 1024) * 10) / 10,
    status: (data.status as Provider['status']) ?? 'offline',
    reliabilityScore: (data.reliability_score as number) ?? 0,
  };
}

export class ProvidersResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List all online GPU providers available for job submission.
   */
  async list(): Promise<Provider[]> {
    const data = await this.http.get<Record<string, unknown> | unknown[]>('/api/renters/available-providers');
    const raw = Array.isArray(data) ? data : ((data as Record<string, unknown>).providers as unknown[]) ?? [];
    return (raw as Record<string, unknown>[]).map(parseProvider);
  }

  /**
   * Fetch a single provider by ID.
   */
  async get(providerId: number): Promise<Provider> {
    const data = await this.http.get<Record<string, unknown>>(`/api/providers/${providerId}`);
    return parseProvider(data);
  }
}
