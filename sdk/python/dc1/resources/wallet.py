"""Wallet resource."""
from __future__ import annotations
from ..models import Wallet


class WalletResource:
    def __init__(self, http):
        self._http = http

    def balance(self) -> Wallet:
        """Fetch the current renter profile and balance fields.

        Returns:
            Wallet object with balance_halala, balance_sar, name, email.
        """
        data = self._http.get('/api/renters/me', params={'key': self._http.api_key})
        renter = data.get('renter') if isinstance(data, dict) and isinstance(data.get('renter'), dict) else data
        # Backend does not echo API key in this response; preserve the configured key in the model.
        renter = {**renter, 'api_key': self._http.api_key}
        return Wallet.from_api(renter)
