import { HttpClient } from '../http';
import { Wallet, Balance } from '../types';

export class WalletResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch detailed wallet balance: available, held, and total spent.
   * Uses GET /api/renters/balance (accepts x-renter-key header).
   */
  async balance(): Promise<Balance> {
    const data = await this.http.get<Record<string, unknown>>('/api/renters/balance');
    return {
      balanceHalala: (data.balance_halala as number) ?? 0,
      balanceSar: (data.balance_sar as number) ?? ((data.balance_halala as number) ?? 0) / 100,
      heldHalala: (data.held_halala as number) ?? 0,
      heldSar: (data.held_sar as number) ?? 0,
      availableHalala: (data.available_halala as number) ?? (data.balance_halala as number) ?? 0,
      totalSpentHalala: (data.total_spent_halala as number) ?? 0,
      totalSpentSar: (data.total_spent_sar as number) ?? 0,
      totalJobs: (data.total_jobs as number) ?? 0,
    };
  }

  /**
   * Fetch the authenticated renter's profile.
   * Uses GET /api/renters/me?key=... (this endpoint requires key as query param).
   */
  async me(): Promise<Wallet> {
    const data = await this.http.get<Record<string, unknown>>(
      '/api/renters/me',
      { key: this.http.apiKey },
    );
    const renter = (data.renter as Record<string, unknown>) ?? data;
    const balanceHalala = (renter.balance_halala as number) ?? 0;
    return {
      balanceHalala,
      balanceSar: balanceHalala / 100,
      name: (renter.name as string) ?? '',
      email: (renter.email as string) ?? '',
      apiKey: this.http.apiKey,
    };
  }
}
