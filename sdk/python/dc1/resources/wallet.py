"""Wallet resource."""
from __future__ import annotations
from ..models import Wallet


class WalletResource:
    def __init__(self, http):
        self._http = http

    def balance(self) -> Wallet:
        """Fetch the current wallet balance and account info.

        Returns:
            Wallet object with balance_halala, balance_sar, name, email.
        """
        data = self._http.get('/api/renters/me')
        return Wallet.from_api(data)
