"""DC1 P2P Network Configuration — Phase C Job Routing Prototype"""

import os

# ── Bootstrap nodes ──────────────────────────────────────────────────────────
# Production: set DC1_P2P_BOOTSTRAP to the VPS bootstrap WS address.
# Docker Compose: override to ws://bootstrap:8765 via environment.
BOOTSTRAP_NODES = [
    s.strip()
    for s in os.environ.get("DC1_P2P_BOOTSTRAP", "ws://127.0.0.1:8765").split(",")
    if s.strip()
]

BOOTSTRAP_PORT = int(os.environ.get("DC1_P2P_BOOTSTRAP_PORT", "8765"))

# ── Provider node ────────────────────────────────────────────────────────────
PROVIDER_WS_PORT = int(os.environ.get("DC1_P2P_PORT", "8766"))
PROVIDER_WS_HOST = os.environ.get("DC1_P2P_HOST", "0.0.0.0")

# ── Renter node ──────────────────────────────────────────────────────────────
RENTER_WS_PORT = int(os.environ.get("DC1_RENTER_PORT", "8767"))

# ── Timeouts ─────────────────────────────────────────────────────────────────
# How long renter waits to collect bids before choosing
BID_WINDOW_SECS = float(os.environ.get("DC1_BID_WINDOW_SECS", "5"))
# Maximum job execution time
JOB_TIMEOUT_SECS = int(os.environ.get("DC1_JOB_TIMEOUT_SECS", "300"))
# Provider heartbeat interval (re-announces capacity)
HEARTBEAT_INTERVAL_SECS = float(os.environ.get("DC1_P2P_HEARTBEAT_SECS", "15"))

# ── Protocol IDs (libp2p-style path strings) ─────────────────────────────────
PROTOCOL_ANNOUNCE = "/dc1/announce/1.0.0"
PROTOCOL_JOB      = "/dc1/job/1.0.0"
PROTOCOL_RELAY    = "/dc1/relay/1.0.0"


class MsgType:
    """Message type constants for the DC1 P2P wire protocol."""
    ANNOUNCE_CAPACITY = "ANNOUNCE_CAPACITY"  # provider → bootstrap → renters
    JOB_REQUEST       = "JOB_REQUEST"        # renter   → bootstrap → providers
    JOB_BID           = "JOB_BID"            # provider → bootstrap → renter
    JOB_ACCEPT        = "JOB_ACCEPT"         # renter   → bootstrap → provider
    JOB_RESULT        = "JOB_RESULT"         # provider → renter (direct or relayed)
    PEER_HELLO        = "PEER_HELLO"         # peer registration on connect
    PEER_BYE          = "PEER_BYE"           # peer disconnect notification
    PEER_LIST         = "PEER_LIST"          # bootstrap sends current provider list
