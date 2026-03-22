"""
Example: Register a new DC1 provider account.

Run this once to create your provider account and receive an API key.
Store the returned api_key — you will need it for all subsequent calls.

Usage:
    python examples/register.py
"""

from dc1_provider import DC1ProviderClient

# No api_key needed for registration — pass None or omit it
client = DC1ProviderClient()

# Auto-detect your GPU and system specs
spec = client.build_resource_spec()
print("Detected resource spec:", spec)

result = client.register(
    name="My GPU Farm",
    email="provider@example.com",
    gpu_model=spec.get("gpu_model", "RTX 4090"),
    resource_spec=spec,
)

print("\nRegistration successful!")
print(f"  Provider ID : {result['provider_id']}")
print(f"  API key     : {result['api_key']}")
print(f"  Installer   : https://api.dcp.sa{result['installer_url']}")
print(f"\n{result['message']}")
print("\nSave your API key — you will need it for heartbeats and job polling.")
