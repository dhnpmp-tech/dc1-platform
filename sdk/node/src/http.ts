/**
 * Minimal HTTP client using Node.js built-in `https`/`http` (no third-party deps).
 */
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { APIError, AuthError } from './errors';

export class HttpClient {
  /** Exposed so resources can inject it as a query param for endpoints that require ?key= */
  readonly apiKey: string;

  constructor(
    apiKey: string,
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
  ) {
    this.apiKey = apiKey;
  }

  private request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v);
        }
      }

      const payload = body != null ? JSON.stringify(body) : undefined;
      const options: http.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'x-renter-key': this.apiKey,
          'User-Agent': 'dc1-renter-sdk/0.1.0',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        timeout: this.timeoutMs,
      };

      const transport = url.protocol === 'https:' ? https : http;
      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          let parsed: unknown;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { error: raw };
          }

          const statusCode = res.statusCode ?? 0;
          if (statusCode >= 200 && statusCode < 300) {
            resolve(parsed as T);
          } else if (statusCode === 401) {
            reject(new AuthError((parsed as Record<string, string>)?.error));
          } else {
            const resp = (parsed ?? {}) as Record<string, unknown>;
            reject(new APIError(
              (resp.error as string) ?? `HTTP ${statusCode}`,
              statusCode,
              resp,
            ));
          }
        });
      });

      req.on('error', (e) => reject(new APIError(`Connection error: ${e.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new APIError(`Request timed out after ${this.timeoutMs}ms`));
      });

      if (payload) req.write(payload);
      req.end();
    });
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }
}
