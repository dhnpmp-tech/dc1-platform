"""
Example: Send heartbeats to keep provider status online.

DCP expects a heartbeat every 30 seconds.  The daemon (dcp_daemon.py)
handles this automatically, but you can use this script for custom
integrations or testing.

Usage:
    DC1_PROVIDER_KEY=dc1-provider-<your-key> python examples/heartbeat.py
"""

import os
import time

from dc1_provider import DC1ProviderClient

API_KEY = os.environ.get("DC1_PROVIDER_KEY") or input("Enter your provider API key: ").strip()

client = DC1ProviderClient(api_key=API_KEY)

# Check current profile
me = client.me()
print(f"Provider  : {me.name}")
print(f"GPU       : {me.gpu_model}")
print(f"Status    : {me.status}")
print(f"Reputation: {me.reputation_score:.1f}/100")
print(f"Uptime    : {me.uptime_pct:.1f}%")
print()

# Build a resource spec and announce to advertise capacity
spec = client.build_resource_spec()
print("Announcing with resource spec:", spec)

HEARTBEAT_INTERVAL = 30  # seconds

print(f"\nSending heartbeats every {HEARTBEAT_INTERVAL}s — Ctrl+C to stop.\n")
try:
    while True:
        # Re-detect live GPU metrics each cycle
        live_spec = client.build_resource_spec()
        response = client.announce(live_spec)

        status = response.get("status", "ok")
        update_flag = " [UPDATE AVAILABLE]" if response.get("update_available") else ""
        print(f"[{time.strftime('%H:%M:%S')}] Heartbeat sent — {status}{update_flag}")

        if response.get("task"):
            print(f"  *** Task assigned: {response['task']}")

        time.sleep(HEARTBEAT_INTERVAL)
except KeyboardInterrupt:
    print("\nHeartbeat loop stopped.")
