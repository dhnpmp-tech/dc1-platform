#!/usr/bin/env python3
"""
DC1 P2P Provider Node — Phase C Job Routing Prototype

Joins the DC1 P2P mesh via the bootstrap relay, announces GPU capacity,
bids on incoming job requests, executes accepted jobs, and delivers results
directly to the renter (P2P) with a relay fallback.

The central VPS API at 76.13.179.86:8083 is NOT involved in job data transfer.
It is only notified after job completion for billing (optional in Phase C).

Usage:
  python3 provider_node.py --gpu "RTX 4090" --vram 24 --price 45.0

Environment Variables:
  DC1_P2P_BOOTSTRAP    Bootstrap WS address (default: ws://127.0.0.1:8765)
  DC1_P2P_HOST         Externally reachable hostname/IP for this provider
  DC1_P2P_PORT         WebSocket port for direct P2P connections (default: 8766)
  DC1_GPU_MODEL        GPU model name
  DC1_VRAM_GB          GPU VRAM in gigabytes
  DC1_PRICE_SAR        Price in SAR per GPU-hour
  DC1_PEER_ID          Stable peer ID (auto-generated if unset)
"""

import argparse
import asyncio
import json
import logging
import os
import socket
import uuid
from datetime import datetime, timezone

import websockets
import websockets.server

from config import (
    BOOTSTRAP_NODES,
    PROVIDER_WS_PORT,
    PROVIDER_WS_HOST,
    MsgType,
    HEARTBEAT_INTERVAL_SECS,
    JOB_TIMEOUT_SECS,
    PROTOCOL_ANNOUNCE,
    PROTOCOL_JOB,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [provider] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("provider")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_local_ip() -> str:
    """Best-effort detection of the machine's outbound IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class ProviderNode:
    def __init__(self, args: argparse.Namespace):
        self.peer_id        = args.peer_id or f"provider-{uuid.uuid4().hex[:8]}"
        self.gpu_model      = args.gpu
        self.vram_gb        = args.vram
        self.price_sar      = args.price
        self.price_halala   = int(args.price * 100)
        self.cuda_version   = args.cuda
        self.driver_version = args.driver
        self.location       = args.location

        # Direct P2P WS address (providers listen here for result delivery acks)
        host = os.environ.get("DC1_P2P_HOST") or _get_local_ip()
        self.ws_addr = f"ws://{host}:{PROVIDER_WS_PORT}"

        self._bootstrap_ws  = None          # websockets connection to bootstrap
        self._active_jobs: dict[str, asyncio.Task] = {}

    # ── Capacity dict ─────────────────────────────────────────────────────────

    @property
    def _capacity(self) -> dict:
        return {
            "peer_id":          self.peer_id,
            "gpu_model":        self.gpu_model,
            "vram_gb":          self.vram_gb,
            "price_sar_per_hr": self.price_sar,
            "price_halala_hr":  self.price_halala,
            "cuda_version":     self.cuda_version,
            "driver_version":   self.driver_version,
            "location":         self.location,
            "ws_addr":          self.ws_addr,
            "announced_at":     _now(),
        }

    # ── Wire helpers ──────────────────────────────────────────────────────────

    async def _send(self, ws, msg: dict) -> None:
        await ws.send(json.dumps(msg))

    # ── Bootstrap connection (with auto-reconnect) ────────────────────────────

    async def _connect_bootstrap(self) -> None:
        bootstrap_url = BOOTSTRAP_NODES[0]
        log.info("Connecting to bootstrap: %s", bootstrap_url)
        while True:
            try:
                async with websockets.connect(bootstrap_url) as ws:
                    self._bootstrap_ws = ws
                    log.info("Connected — peer_id=%s", self.peer_id)

                    # Register with bootstrap
                    await self._send(ws, {
                        "type":      MsgType.PEER_HELLO,
                        "from_peer": self.peer_id,
                        "to_peer":   "bootstrap",
                        "timestamp": _now(),
                        "payload":   {"role": "provider", "capacity": self._capacity},
                    })
                    log.info(
                        "Registered — GPU=%s  VRAM=%dGB  Price=%.2f SAR/hr",
                        self.gpu_model, self.vram_gb, self.price_sar,
                    )

                    # Heartbeat + message loop run concurrently
                    await asyncio.gather(
                        self._heartbeat_loop(ws),
                        self._message_loop(ws),
                    )
            except (
                websockets.exceptions.ConnectionClosedError,
                OSError,
                ConnectionRefusedError,
            ) as e:
                log.warning("Bootstrap disconnected: %s — reconnecting in 5s", e)
                self._bootstrap_ws = None
                await asyncio.sleep(5)

    async def _heartbeat_loop(self, ws) -> None:
        """Re-announce capacity every HEARTBEAT_INTERVAL_SECS seconds."""
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_SECS)
            try:
                await self._send(ws, {
                    "type":      MsgType.ANNOUNCE_CAPACITY,
                    "from_peer": self.peer_id,
                    "to_peer":   "broadcast",
                    "timestamp": _now(),
                    "protocol":  PROTOCOL_ANNOUNCE,
                    "payload":   self._capacity,
                })
                log.debug("Heartbeat sent")
            except Exception as e:
                log.warning("Heartbeat failed: %s", e)
                return  # let outer reconnect loop handle it

    async def _message_loop(self, ws) -> None:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await self._dispatch(msg)

    # ── Message dispatch ──────────────────────────────────────────────────────

    async def _dispatch(self, msg: dict) -> None:
        msg_type = msg.get("type")
        payload  = msg.get("payload", {})

        if msg_type == MsgType.JOB_REQUEST:
            await self._handle_job_request(payload, msg.get("from_peer", ""))
        elif msg_type == MsgType.JOB_ACCEPT:
            await self._handle_job_accept(payload)
        elif msg_type == MsgType.PEER_LIST:
            log.debug("PEER_LIST — %d providers in mesh", len(payload.get("providers", [])))

    # ── Job request: evaluate and bid ────────────────────────────────────────

    async def _handle_job_request(self, req: dict, renter_id: str) -> None:
        job_id    = req.get("job_id", "?")
        min_vram  = req.get("min_vram_gb", 0)
        max_price = req.get("max_price_halala_hr", 10_000_000)

        log.info(
            "JOB_REQUEST  job=%.8s  min_vram=%dGB  max_price=%d h/hr",
            job_id, min_vram, max_price,
        )

        # Eligibility checks
        if self.vram_gb < min_vram:
            log.info("Skip job %.8s — VRAM %d < %d", job_id, self.vram_gb, min_vram)
            return
        if self.price_halala > max_price:
            log.info("Skip job %.8s — price %d > max %d", job_id, self.price_halala, max_price)
            return

        # Estimate total cost (assume full timeout duration as worst case)
        est_secs = req.get("timeout_secs", 60)
        est_cost = int(self.price_halala * est_secs / 3600)

        if self._bootstrap_ws is None:
            log.warning("Cannot bid — not connected to bootstrap")
            return

        await self._send(self._bootstrap_ws, {
            "type":      MsgType.JOB_BID,
            "from_peer": self.peer_id,
            "to_peer":   renter_id,
            "timestamp": _now(),
            "protocol":  PROTOCOL_JOB,
            "payload": {
                "job_id":                job_id,
                "provider_peer_id":      self.peer_id,
                "provider_ws_addr":      self.ws_addr,
                "renter_peer_id":        renter_id,
                "price_halala_hr":       self.price_halala,
                "gpu_model":             self.gpu_model,
                "vram_gb":               self.vram_gb,
                "estimated_cost_halala": est_cost,
            },
        })
        log.info(
            "JOB_BID sent  job=%.8s  price=%d h/hr  est_cost=%d h",
            job_id, self.price_halala, est_cost,
        )

    # ── Job accept: execute and return result ─────────────────────────────────

    async def _handle_job_accept(self, accept: dict) -> None:
        job_id = accept.get("job_id", "?")
        log.info(
            "JOB_ACCEPT  job=%.8s  renter=%s  price=%d h/hr",
            job_id,
            accept.get("renter_peer_id", "?")[:12],
            accept.get("agreed_price_halala_hr", self.price_halala),
        )
        task = asyncio.create_task(self._execute_job(accept))
        self._active_jobs[job_id] = task

    async def _execute_job(self, accept: dict) -> None:
        job_id         = accept.get("job_id", "?")
        renter_peer_id = accept.get("renter_peer_id", "")
        renter_ws_addr = accept.get("renter_ws_addr", "")
        price_halala   = accept.get("agreed_price_halala_hr", self.price_halala)
        docker_image   = accept.get("docker_image", "dc1/simulate")
        command        = accept.get("command", "echo DC1 job complete")

        start   = datetime.now(timezone.utc)
        success = False
        output  = ""
        error   = ""

        log.info("EXECUTING  job=%.8s  image=%s  cmd=%s", job_id, docker_image, command)

        try:
            if docker_image == "dc1/simulate":
                # Simulation mode: no Docker required (used in Docker Compose test)
                await asyncio.sleep(2)
                output  = (
                    f"[DC1 simulated result]\n"
                    f"Job      : {job_id}\n"
                    f"Provider : {self.peer_id}  ({self.gpu_model}, {self.vram_gb}GB VRAM)\n"
                    f"Command  : {command}\n"
                    f"Output   : Hello from DC1 P2P network!\n"
                )
                success = True
            else:
                # Real Docker execution with NVIDIA Container Toolkit
                proc = await asyncio.wait_for(
                    asyncio.create_subprocess_exec(
                        "docker", "run", "--rm",
                        "--gpus", "all",
                        docker_image,
                        *command.split(),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    ),
                    timeout=JOB_TIMEOUT_SECS,
                )
                stdout_b, stderr_b = await proc.communicate()
                if proc.returncode == 0:
                    output  = stdout_b.decode("utf-8", errors="replace")[:65_536]
                    success = True
                else:
                    error   = stderr_b.decode("utf-8", errors="replace")[:4_096]

        except asyncio.TimeoutError:
            error = f"Job timed out after {JOB_TIMEOUT_SECS}s"
            log.error("TIMEOUT  job=%.8s", job_id)
        except FileNotFoundError:
            # Docker not installed — fall back to simulation
            log.warning("Docker not found — simulating job %.8s", job_id)
            await asyncio.sleep(1)
            output  = f"[simulated] Job {job_id} complete on {self.gpu_model}"
            success = True
        except Exception as e:
            error = str(e)
            log.error("ERROR  job=%.8s  %s", job_id, e)
        finally:
            end           = datetime.now(timezone.utc)
            duration_secs = max(1, int((end - start).total_seconds()))
            cost_halala   = int(price_halala * duration_secs / 3600)

            result_msg = {
                "type":      MsgType.JOB_RESULT,
                "from_peer": self.peer_id,
                "to_peer":   renter_peer_id,
                "timestamp": _now(),
                "protocol":  PROTOCOL_JOB,
                "payload": {
                    "job_id":           job_id,
                    "provider_peer_id": self.peer_id,
                    "renter_peer_id":   renter_peer_id,
                    "success":          success,
                    "output":           output,
                    "error":            error,
                    "duration_secs":    duration_secs,
                    "cost_halala":      cost_halala,
                    "completed_at":     _now(),
                },
            }

            log.info(
                "JOB_RESULT  job=%.8s  success=%s  duration=%ds  cost=%d h",
                job_id, success, duration_secs, cost_halala,
            )

            # 1. Try direct P2P delivery to renter
            delivered = False
            if renter_ws_addr:
                try:
                    async with websockets.connect(renter_ws_addr, open_timeout=5) as rws:
                        await rws.send(json.dumps(result_msg))
                    log.info("JOB_RESULT delivered directly → %s", renter_ws_addr)
                    delivered = True
                except Exception as e:
                    log.warning("Direct delivery failed: %s — using relay", e)

            # 2. Fallback: relay via bootstrap
            if not delivered and self._bootstrap_ws:
                try:
                    await self._send(self._bootstrap_ws, result_msg)
                    log.info("JOB_RESULT relayed via bootstrap")
                except Exception as e:
                    log.error("Relay delivery failed: %s", e)

            self._active_jobs.pop(job_id, None)

    # ── Direct P2P server (for inbound connections) ───────────────────────────

    async def _direct_server(self) -> None:
        """Accept direct WebSocket connections from renters."""
        log.info("Direct P2P server: %s", self.ws_addr)
        async with websockets.serve(
            self._direct_handler, PROVIDER_WS_HOST, PROVIDER_WS_PORT
        ):
            await asyncio.Future()

    async def _direct_handler(self, ws) -> None:
        async for raw in ws:
            try:
                msg = json.loads(raw)
                await self._dispatch(msg)
            except Exception as e:
                log.warning("Direct handler error: %s", e)

    # ── Entry point ───────────────────────────────────────────────────────────

    async def run(self) -> None:
        log.info("DC1 Provider Node starting")
        log.info("  Peer ID  : %s", self.peer_id)
        log.info("  GPU      : %s  VRAM=%dGB", self.gpu_model, self.vram_gb)
        log.info("  Price    : %.2f SAR/hr  (%d h/hr)", self.price_sar, self.price_halala)
        log.info("  Location : %s", self.location)
        log.info("  WS Addr  : %s", self.ws_addr)
        await asyncio.gather(
            self._direct_server(),
            self._connect_bootstrap(),
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="DC1 P2P Provider Node — Phase C")
    p.add_argument("--gpu",      default=os.environ.get("DC1_GPU_MODEL", "RTX 4090"))
    p.add_argument("--vram",     type=int,   default=int(os.environ.get("DC1_VRAM_GB", "24")))
    p.add_argument("--price",    type=float, default=float(os.environ.get("DC1_PRICE_SAR", "45.0")))
    p.add_argument("--cuda",     default=os.environ.get("DC1_CUDA_VERSION", "12.3"))
    p.add_argument("--driver",   default=os.environ.get("DC1_DRIVER_VERSION", "545.23.08"))
    p.add_argument("--location", default=os.environ.get("DC1_LOCATION", "Riyadh, SA"))
    p.add_argument("--peer-id",  default=os.environ.get("DC1_PEER_ID"))
    return p.parse_args()


if __name__ == "__main__":
    asyncio.run(ProviderNode(parse_args()).run())
