"""Providers resource."""
from __future__ import annotations
from ..models import Provider
from ..exceptions import APIError


class ProvidersResource:
    def __init__(self, http):
        self._http = http

    def list(self) -> list[Provider]:
        """List all online GPU providers available for job submission.

        Returns:
            List of Provider objects with GPU specs and reliability scores.
        """
        data = self._http.get('/api/renters/available-providers')
        raw_list = data if isinstance(data, list) else data.get('providers', [])
        return [Provider.from_api(p) for p in raw_list]

    def get(self, provider_id: int) -> Provider:
        """Fetch a single provider by ID.

        Args:
            provider_id: The provider's numeric ID.

        Returns:
            Provider object.
        """
        providers = self.list()
        for provider in providers:
            if provider.id == provider_id:
                return provider
        raise APIError(
            f'Provider {provider_id} not found in available providers',
            status_code=404,
            response={'provider_id': provider_id},
        )
