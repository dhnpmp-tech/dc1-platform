#!/usr/bin/env python3
"""
DC1 P2P Renter Client — Phase C Job Routing Prototype

Discovers GPU providers via the DC1 P2P mesh (without querying the central
VPS API), broadcasts a job request, collects bids from competing providers,
accepts the lowest-cost bid, and waits for the job result delivered P2P.

The VPS API at 76.13.179.86:8083 is NOT involved in job data transfer.
A billing notification may be sent after completion (Phase D).

Usage:
  python3 renter_client.py \
    --job-type llm_inference \
    --image dc1/simulate \
    --command "echo hello" \
    --min-vram 8 \
    --max-price 50.0

Environment Variables:
  DC1_P2P_BOOTSTRAP    Bootstrap WS address (default: ws://127.0.0.1:8765)
  DC1_RENTER_HOST      Externally reachable hostname for result delivery
  DC1_RENTER_PORT      WebSocket port for receiving results (default: 8767)
"""

import argparse
import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone

import websockets
import websockets.server

from config import (
    BOOTSTRAP_NODES,
    RENTER_WS_PORT,
    MsgType,
    BID_WINDOW_SECS,
    PROTOCOL_JOB,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [renter]   %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("renter")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class RenterClient:
    def __init__(self, args: argparse.Namespace):
        self.peer_id         = f"renter-{uuid.uuid4().hex[:8]}"
        self.job_type        = args.job_type
        self.docker_image    = args.image
        self.command         = args.command
        self.min_vram_gb     = args.min_vram
        self.max_price_sar   = args.max_price
        self.max_price_halala= int(args.max_price * 100)
        self.timeout_secs    = args.timeout

        # State
        self._providers: dict[str, dict] = {}
        self._bids:      dict[str, list] = {}   # job_id → [bid, ...]
        self._results:   dict[str, dict] = {}   # job_id → result payload
        self._events:    dict[str, asyncio.Event] = {}
        self._bootstrap_ws = None

    # ── Wire helper ───────────────────────────────────────────────────────────

    async def _send(self, ws, msg: dict) -> None:
        await ws.send(json.dumps(msg))

    # ── Direct result server ──────────────────────────────────────────────────

    async def _result_server(self) -> None:
        """Accept direct P2P JOB_RESULT deliveries from providers."""
        log.info("Result server: ws://0.0.0.0:%d", RENTER_WS_PORT)
        async with websockets.serve(self._result_handler, "0.0.0.0", RENTER_WS_PORT):
            await asyncio.Future()

    async def _result_handler(self, ws) -> None:
        async for raw in ws:
            try:
                await self._dispatch(json.loads(raw))
            except Exception as e:
                log.warning("Result handler error: %s", e)

    # ── Message dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, msg: dict) -> None:
        msg_type = msg.get("type")
        payload  = msg.get("payload", {})

        if msg_type == MsgType.PEER_LIST:
            for p in payload.get("providers", []):
                pid = p.get("peer_id")
                if pid:
                    self._providers[pid] = p
                    log.info(
                        "Provider discovered  %-20s  GPU=%-12s  Price=%.2f SAR/hr",
                        pid[:20], p.get("gpu_model"), p.get("price_sar_per_hr"),
                    )

        elif msg_type == MsgType.ANNOUNCE_CAPACITY:
            pid = payload.get("peer_id")
            if pid:
                self._providers[pid] = payload
                log.info(
                    "ANNOUNCE_CAPACITY    %-20s  GPU=%-12s  Price=%.2f SAR/hr",
                    pid[:20], payload.get("gpu_model"), payload.get("price_sar_per_hr"),
                )

        elif msg_type == MsgType.PEER_BYE:
            pid = payload.get("peer_id")
            if pid and pid in self._providers:
                del self._providers[pid]
                log.info("Provider left: %s", pid[:20])

        elif msg_type == MsgType.JOB_BID:
            job_id = payload.get("job_id")
            if job_id and job_id in self._bids:
                self._bids[job_id].append(payload)
                log.info(
                    "JOB_BID  job=%.8s  provider=%-20s  price=%d h/hr",
                    job_id,
                    payload.get("provider_peer_id", "?")[:20],
                    payload.get("price_halala_hr", 0),
                )

        elif msg_type == MsgType.JOB_RESULT:
            job_id = payload.get("job_id")
            if job_id:
                self._results[job_id] = payload
                if job_id in self._events:
                    self._events[job_id].set()
                log.info(
                    "JOB_RESULT  job=%.8s  success=%s  dur=%ds  cost=%d h",
                    job_id, payload.get("success"),
                    payload.get("duration_secs"), payload.get("cost_halala"),
                )

    # ── Job submission ────────────────────────────────────────────────────────

    async def submit_job(self) -> dict | None:
        """
        Full job lifecycle:
          1. Broadcast JOB_REQUEST
          2. Wait BID_WINDOW_SECS for bids
          3. Accept lowest-cost bid
          4. Wait for JOB_RESULT
          5. Return result payload or None on failure
        """
        if not self._providers:
            log.info("No providers in mesh yet — waiting 3s for announcements...")
            await asyncio.sleep(3)

        if not self._bootstrap_ws:
            log.error("Not connected to bootstrap")
            return None

        job_id = str(uuid.uuid4())
        event  = asyncio.Event()
        self._events[job_id] = event
        self._bids[job_id]   = []

        # Renter's externally reachable WS address for direct result delivery
        renter_host = os.environ.get("DC1_RENTER_HOST", "127.0.0.1")
        renter_ws   = f"ws://{renter_host}:{RENTER_WS_PORT}"

        log.info(
            "Submitting job  id=%.8s  type=%s  image=%s",
            job_id, self.job_type, self.docker_image,
        )
        log.info(
            "  min_vram=%dGB  max_price=%.2f SAR/hr  timeout=%ds",
            self.min_vram_gb, self.max_price_sar, self.timeout_secs,
        )

        # Broadcast JOB_REQUEST to all providers via bootstrap
        await self._send(self._bootstrap_ws, {
            "type":      MsgType.JOB_REQUEST,
            "from_peer": self.peer_id,
            "to_peer":   "broadcast",
            "timestamp": _now(),
            "protocol":  PROTOCOL_JOB,
            "payload": {
                "job_id":               job_id,
                "renter_peer_id":       self.peer_id,
                "renter_ws_addr":       renter_ws,
                "job_type":             self.job_type,
                "docker_image":         self.docker_image,
                "command":              self.command,
                "min_vram_gb":          self.min_vram_gb,
                "max_price_halala_hr":  self.max_price_halala,
                "timeout_secs":         self.timeout_secs,
            },
        })

        log.info("JOB_REQUEST broadcast — waiting %.0fs for bids...", BID_WINDOW_SECS)
        await asyncio.sleep(BID_WINDOW_SECS)

        bids = self._bids.get(job_id, [])
        if not bids:
            log.error("No bids received for job %.8s", job_id)
            return None

        log.info("Received %d bid(s):", len(bids))
        for b in sorted(bids, key=lambda x: x["price_halala_hr"]):
            log.info(
                "  %-20s  GPU=%-12s  %d h/hr  est_cost=%d h",
                b.get("provider_peer_id", "?")[:20],
                b.get("gpu_model"),
                b.get("price_halala_hr"),
                b.get("estimated_cost_halala", 0),
            )

        # Select lowest-cost bid (automatic routing decision)
        winning_bid = min(bids, key=lambda b: b["price_halala_hr"])
        log.info(
            ">>> Winning bid: %s  GPU=%s  %d h/hr  est_cost=%d h",
            winning_bid["provider_peer_id"][:20],
            winning_bid["gpu_model"],
            winning_bid["price_halala_hr"],
            winning_bid.get("estimated_cost_halala", 0),
        )

        # Send JOB_ACCEPT to winning provider via bootstrap relay
        await self._send(self._bootstrap_ws, {
            "type":      MsgType.JOB_ACCEPT,
            "from_peer": self.peer_id,
            "to_peer":   winning_bid["provider_peer_id"],
            "timestamp": _now(),
            "protocol":  PROTOCOL_JOB,
            "payload": {
                "job_id":                  job_id,
                "provider_peer_id":        winning_bid["provider_peer_id"],
                "renter_peer_id":          self.peer_id,
                "renter_ws_addr":          renter_ws,
                "agreed_price_halala_hr":  winning_bid["price_halala_hr"],
                "docker_image":            self.docker_image,
                "command":                 self.command,
            },
        })
        log.info("JOB_ACCEPT sent — waiting for result (timeout=%ds)...", self.timeout_secs)

        # Wait for JOB_RESULT (direct P2P or relayed)
        try:
            await asyncio.wait_for(event.wait(), timeout=self.timeout_secs + 10)
        except asyncio.TimeoutError:
            log.error("Timed out waiting for job result")
            return None

        result = self._results.get(job_id)
        if result:
            log.info("=" * 60)
            log.info("JOB COMPLETE")
            log.info("  Success   : %s", result.get("success"))
            log.info("  Duration  : %ds", result.get("duration_secs"))
            log.info("  Cost      : %d h  (%.4f SAR)", result.get("cost_halala", 0),
                     result.get("cost_halala", 0) / 100)
            if result.get("output"):
                log.info("  Output    :\n%s", result["output"].strip())
            if result.get("error"):
                log.info("  Error     : %s", result["error"])
            log.info("=" * 60)

        return result

    # ── Bootstrap connection + message loop ───────────────────────────────────

    async def _run_with_bootstrap(self) -> dict | None:
        bootstrap_url = BOOTSTRAP_NODES[0]
        log.info("Connecting to bootstrap: %s", bootstrap_url)
        async with websockets.connect(bootstrap_url) as ws:
            self._bootstrap_ws = ws

            # Register as renter
            await self._send(ws, {
                "type":      MsgType.PEER_HELLO,
                "from_peer": self.peer_id,
                "to_peer":   "bootstrap",
                "timestamp": _now(),
                "payload":   {"role": "renter"},
            })
            log.info("Registered — peer_id=%s", self.peer_id)

            # Start message loop in background
            msg_loop = asyncio.create_task(self._message_loop(ws))

            # Brief wait for PEER_LIST and initial ANNOUNCE_CAPACITY messages
            await asyncio.sleep(2)

            result = await self.submit_job()
            msg_loop.cancel()
            return result

    async def _message_loop(self, ws) -> None:
        async for raw in ws:
            try:
                await self._dispatch(json.loads(raw))
            except json.JSONDecodeError:
                continue

    # ── Entry point ───────────────────────────────────────────────────────────

    async def run(self) -> int:
        """Returns 0 on success, 1 on failure."""
        log.info("DC1 P2P Renter Client — peer_id=%s", self.peer_id)

        result_server_task = asyncio.create_task(self._result_server())
        try:
            result = await self._run_with_bootstrap()
            return 0 if (result and result.get("success")) else 1
        finally:
            result_server_task.cancel()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="DC1 P2P Renter Client — Phase C")
    p.add_argument("--job-type",  default=os.environ.get("DC1_JOB_TYPE", "llm_inference"),
                   choices=["llm_inference", "image_gen", "training", "custom"])
    p.add_argument("--image",     default=os.environ.get("DC1_DOCKER_IMAGE", "dc1/simulate"))
    p.add_argument("--command",   default=os.environ.get("DC1_COMMAND", "echo hello"))
    p.add_argument("--min-vram",  type=int,   default=int(os.environ.get("DC1_MIN_VRAM_GB", "8")))
    p.add_argument("--max-price", type=float, default=float(os.environ.get("DC1_MAX_PRICE_SAR", "100.0")))
    p.add_argument("--timeout",   type=int,   default=int(os.environ.get("DC1_JOB_TIMEOUT_SECS", "60")))
    return p.parse_args()


if __name__ == "__main__":
    import sys
    args = parse_args()
    client = RenterClient(args)
    sys.exit(asyncio.run(client.run()))
