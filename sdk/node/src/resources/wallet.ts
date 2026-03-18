import { HttpClient } from '../http';
import { Wallet } from '../types';

export class WalletResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Fetch the current wallet balance and account info.
   */
  async balance(): Promise<Wallet> {
    const data = await this.http.get<Record<string, unknown>>('/api/renters/me');
    const balanceHalala = (data.balance_halala as number) ?? 0;
    return {
      balanceHalala,
      balanceSar: balanceHalala / 100,
      name: (data.name as string) ?? '',
      email: (data.email as string) ?? '',
      apiKey: (data.api_key as string) ?? '',
    };
  }
}
