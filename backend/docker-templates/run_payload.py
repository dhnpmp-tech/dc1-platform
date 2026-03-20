#!/usr/bin/env python3
"""Minimal, template-agnostic payload runner for DCP Docker environments."""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run DCP container payload")
    parser.add_argument("--container-type", required=True)
    parser.add_argument("--payload", required=True)
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--output-dir", required=True)
    return parser.parse_args()


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()

    payload_path = Path(args.payload)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        payload = json.loads(payload_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        write_json(output_dir / "result.json", {
            "status": "error",
            "error": f"Invalid payload JSON: {exc}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return 2

    env = os.environ.copy()
    env["DCP_CONTAINER_TYPE"] = args.container_type
    env["DCP_MODEL_PATH"] = args.model_path
    env["DCP_OUTPUT_DIR"] = str(output_dir)

    command = payload.get("command")
    if isinstance(command, list):
        command_str = " ".join(shlex.quote(str(part)) for part in command)
    elif isinstance(command, str):
        command_str = command.strip()
    else:
        command_str = ""

    if not command_str:
        # No explicit command provided. Emit metadata artifact and exit successfully.
        write_json(output_dir / "result.json", {
            "status": "ok",
            "container_type": args.container_type,
            "message": "No command provided in payload; emitted metadata only.",
            "model_path": args.model_path,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        return 0

    proc = subprocess.run(
      command_str,
      shell=True,
      cwd=output_dir,
      env=env,
      text=True,
      capture_output=True,
      check=False,
    )

    (output_dir / "stdout.log").write_text(proc.stdout or "", encoding="utf-8")
    (output_dir / "stderr.log").write_text(proc.stderr or "", encoding="utf-8")

    write_json(output_dir / "result.json", {
        "status": "ok" if proc.returncode == 0 else "error",
        "container_type": args.container_type,
        "return_code": proc.returncode,
        "command": command_str,
        "model_path": args.model_path,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
