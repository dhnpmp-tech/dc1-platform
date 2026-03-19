#!/usr/bin/env python3
"""
DC1 P2P Bootstrap Server — Phase C Job Routing Prototype

Acts as:
  - Peer rendezvous point: providers register, renters discover
  - Message relay (Circuit Relay pattern): routes messages between peers
    that may be behind NAT and cannot reach each other directly

In Phase D this is replaced by Kademlia DHT routing (dc1-node.js / bootstrap.js).
This Python bootstrap is used exclusively for the Docker Compose 3-node test.

Usage:
  python3 bootstrap_server.py
  DC1_P2P_BOOTSTRAP_PORT=8765 python3 bootstrap_server.py

Protocol: /dc1/relay/1.0.0
"""

import asyncio
import json
import logging
import uuid

import websockets
import websockets.server
from datetime import datetime, timezone

from config import BOOTSTRAP_PORT, MsgType

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [bootstrap] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("bootstrap")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class BootstrapServer:
    """
    Central relay for the Phase C 3-node test.

    Maintains a registry of connected peers and routes messages based on
    MsgType.  Provider capacity is cached so new renters get immediate
    PEER_LIST on join without waiting for the next provider heartbeat.
    """

    def __init__(self):
        # peer_id → {"ws": WebSocket, "role": "provider"|"renter", "capacity": dict}
        self._peers: dict[str, dict] = {}

    # ── Peer accessors ────────────────────────────────────────────────────────

    def _providers(self) -> dict[str, dict]:
        return {pid: p for pid, p in self._peers.items() if p["role"] == "provider"}

    def _renters(self) -> dict[str, dict]:
        return {pid: p for pid, p in self._peers.items() if p["role"] == "renter"}

    # ── Send helpers ──────────────────────────────────────────────────────────

    async def _send(self, ws, msg: dict) -> None:
        try:
            await ws.send(json.dumps(msg))
        except Exception as e:
            log.warning("Send failed: %s", e)

    async def _broadcast(self, msg: dict, targets: dict[str, dict], exclude: str = "") -> None:
        for pid, peer in list(targets.items()):
            if pid == exclude:
                continue
            await self._send(peer["ws"], msg)

    # ── PEER_HELLO handler ────────────────────────────────────────────────────

    async def _handle_hello(self, peer_id: str, payload: dict, ws) -> None:
        role = payload.get("role", "renter")
        capacity = payload.get("capacity", {})

        self._peers[peer_id] = {"ws": ws, "role": role, "capacity": capacity}
        log.info("PEER_HELLO  %-20s  role=%s  peers=%d", peer_id[:20], role, len(self._peers))

        # Send current provider list immediately to the new peer
        provider_list = [
            {"peer_id": pid, **p["capacity"]}
            for pid, p in self._providers().items()
            if pid != peer_id
        ]
        await self._send(ws, {
            "type": MsgType.PEER_LIST,
            "from_peer": "bootstrap",
            "to_peer": peer_id,
            "timestamp": _now(),
            "payload": {"providers": provider_list},
        })

        # If the new peer is a provider, broadcast its capacity to all renters now
        if role == "provider" and capacity:
            announce = {
                "type": MsgType.ANNOUNCE_CAPACITY,
                "from_peer": peer_id,
                "to_peer": "broadcast",
                "timestamp": _now(),
                "payload": capacity,
            }
            await self._broadcast(announce, self._renters())

    # ── Message router ────────────────────────────────────────────────────────

    async def _route(self, msg: dict, sender_id: str) -> None:
        msg_type = msg.get("type")
        payload  = msg.get("payload", {})
        to_peer  = msg.get("to_peer", "broadcast")

        log.info(
            "ROUTE  %-25s  from=%-20s  to=%s",
            msg_type, sender_id[:20], to_peer[:20],
        )

        if msg_type == MsgType.ANNOUNCE_CAPACITY:
            # Refresh stored capacity, relay to all renters
            if sender_id in self._peers:
                self._peers[sender_id]["capacity"] = payload
            await self._broadcast(msg, self._renters(), exclude=sender_id)

        elif msg_type == MsgType.JOB_REQUEST:
            # Relay to all providers
            await self._broadcast(msg, self._providers(), exclude=sender_id)

        elif msg_type == MsgType.JOB_BID:
            # Route to the specific renter that issued the request
            renter_id = payload.get("renter_peer_id", to_peer)
            if renter_id in self._peers:
                await self._send(self._peers[renter_id]["ws"], msg)
            else:
                log.warning("JOB_BID: renter %s not connected", renter_id[:20])

        elif msg_type == MsgType.JOB_ACCEPT:
            # Route to the winning provider
            provider_id = payload.get("provider_peer_id", to_peer)
            if provider_id in self._peers:
                await self._send(self._peers[provider_id]["ws"], msg)
            else:
                log.warning("JOB_ACCEPT: provider %s not connected", provider_id[:20])

        elif msg_type == MsgType.JOB_RESULT:
            # Relay to renter (fallback when direct P2P fails)
            renter_id = payload.get("renter_peer_id", to_peer)
            if renter_id in self._peers:
                await self._send(self._peers[renter_id]["ws"], msg)
            else:
                log.warning("JOB_RESULT: renter %s not connected", renter_id[:20])

    # ── Connection handler ────────────────────────────────────────────────────

    async def handler(self, ws) -> None:
        peer_id: str | None = None
        try:
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    log.warning("Received invalid JSON — ignoring")
                    continue

                # First message from any peer must be PEER_HELLO
                peer_id = msg.get("from_peer") or str(uuid.uuid4())

                if msg.get("type") == MsgType.PEER_HELLO:
                    await self._handle_hello(peer_id, msg.get("payload", {}), ws)
                else:
                    await self._route(msg, peer_id)

        except websockets.exceptions.ConnectionClosedOK:
            pass
        except websockets.exceptions.ConnectionClosedError as e:
            log.debug("Connection error: %s", e)
        finally:
            if peer_id and peer_id in self._peers:
                role = self._peers[peer_id]["role"]
                del self._peers[peer_id]
                log.info(
                    "PEER_BYE   %-20s  role=%s  remaining=%d",
                    peer_id[:20], role, len(self._peers),
                )
                # Notify renters that this provider left so they can prune their list
                if role == "provider":
                    bye_msg = {
                        "type": MsgType.PEER_BYE,
                        "from_peer": peer_id,
                        "to_peer": "broadcast",
                        "timestamp": _now(),
                        "payload": {"peer_id": peer_id},
                    }
                    await self._broadcast(bye_msg, self._renters())


async def main() -> None:
    server = BootstrapServer()
    log.info("DC1 P2P Bootstrap Server — ws://0.0.0.0:%d", BOOTSTRAP_PORT)
    log.info("Protocol: %s", "/dc1/relay/1.0.0")
    async with websockets.serve(server.handler, "0.0.0.0", BOOTSTRAP_PORT):
        log.info("Ready — waiting for peers")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
