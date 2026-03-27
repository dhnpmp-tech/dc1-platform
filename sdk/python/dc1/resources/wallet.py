"""Wallet resource."""
from __future__ import annotations
from ..models import Balance


class WalletResource:
    def __init__(self, http):
        self._http = http

    def balance(self) -> Balance:
        """Fetch detailed wallet balance: available, held, and total spent.

        Calls GET /api/renters/balance.

        Returns:
            Balance object with available, held, and total spent breakdown in halala and SAR.
        """
        data = self._http.get('/api/renters/balance', params={'key': self._http.api_key})
        return Balance.from_api(data)
