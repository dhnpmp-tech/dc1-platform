"""DC1 Gate 0 — Checkpoint Manager.

Dual-redundancy checkpoints: local NAS + S3 Saudi bucket.
All operations are atomic: verify-before-use, never delete until new copy confirmed.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import boto3
from botocore.exceptions import ClientError

from .models import CheckpointRef

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
S3_BUCKET = os.getenv("S3_BUCKET", "dc1-gate0-checkpoints")
S3_REGION = os.getenv("S3_REGION", "me-south-1")  # Bahrain (closest to Saudi)
NAS_PATH = os.getenv("NAS_PATH", "/mnt/nas/dc1/checkpoints")
KEEP_N = int(os.getenv("CHECKPOINT_KEEP_N", "3"))

_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            region_name=S3_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        )
    return _s3


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _nas_dir(job_id: str) -> Path:
    p = Path(NAS_PATH) / job_id
    p.mkdir(parents=True, exist_ok=True)
    return p


def _s3_key(job_id: str, num: int) -> str:
    return f"checkpoints/{job_id}/{num:06d}.ckpt"


def _meta_path(job_id: str) -> Path:
    return _nas_dir(job_id) / "meta.json"


def _load_meta(job_id: str) -> list:
    mp = _meta_path(job_id)
    if mp.exists():
        return json.loads(mp.read_text())
    return []


def _save_meta(job_id: str, entries: list):
    _meta_path(job_id).write_text(json.dumps(entries, default=str, indent=2))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_checkpoint(job_id: str, checkpoint_data: bytes, checkpoint_num: int) -> CheckpointRef:
    """Save checkpoint to NAS + S3 with SHA-256 verification."""
    checksum = _sha256(checkpoint_data)
    size = len(checkpoint_data)
    now = datetime.utcnow()

    # 1. Write to NAS
    nas_file = _nas_dir(job_id) / f"{checkpoint_num:06d}.ckpt"
    nas_file.write_bytes(checkpoint_data)
    assert _sha256(nas_file.read_bytes()) == checksum, "NAS write integrity failed"

    # 2. Write to S3
    key = _s3_key(job_id, checkpoint_num)
    _get_s3().put_object(Bucket=S3_BUCKET, Key=key, Body=checkpoint_data)
    # Verify S3 round-trip
    resp = _get_s3().get_object(Bucket=S3_BUCKET, Key=key)
    s3_data = resp["Body"].read()
    assert _sha256(s3_data) == checksum, "S3 write integrity failed"

    ref = CheckpointRef(
        job_id=job_id,
        checkpoint_num=checkpoint_num,
        nas_path=str(nas_file),
        s3_key=key,
        checksum_sha256=checksum,
        size_bytes=size,
        saved_at=now,
    )

    # Update meta
    meta = _load_meta(job_id)
    meta.append({
        "num": checkpoint_num, "checksum": checksum,
        "nas_path": str(nas_file), "s3_key": key,
        "size": size, "saved_at": now.isoformat(),
    })
    _save_meta(job_id, meta)

    # Auto-prune old checkpoints
    delete_old_checkpoints(job_id, keep_n=KEEP_N)
    return ref


def load_checkpoint(job_id: str, checkpoint_num: int = -1) -> Optional[CheckpointRef]:
    """Load checkpoint — NAS first (faster), S3 fallback. Verifies checksum."""
    meta = _load_meta(job_id)
    if not meta:
        return None

    entry = meta[-1] if checkpoint_num == -1 else next((e for e in meta if e["num"] == checkpoint_num), None)
    if not entry:
        return None

    nas_file = Path(entry["nas_path"])
    expected = entry["checksum"]

    # Try NAS
    if nas_file.exists():
        data = nas_file.read_bytes()
        if _sha256(data) == expected:
            return CheckpointRef(
                job_id=job_id, checkpoint_num=entry["num"],
                nas_path=str(nas_file), s3_key=entry["s3_key"],
                checksum_sha256=expected, size_bytes=entry["size"],
                saved_at=datetime.fromisoformat(entry["saved_at"]),
            )

    # Fallback to S3
    try:
        resp = _get_s3().get_object(Bucket=S3_BUCKET, Key=entry["s3_key"])
        data = resp["Body"].read()
        if _sha256(data) != expected:
            return None
        # Restore NAS copy
        nas_file.parent.mkdir(parents=True, exist_ok=True)
        nas_file.write_bytes(data)
        return CheckpointRef(
            job_id=job_id, checkpoint_num=entry["num"],
            nas_path=str(nas_file), s3_key=entry["s3_key"],
            checksum_sha256=expected, size_bytes=entry["size"],
            saved_at=datetime.fromisoformat(entry["saved_at"]),
        )
    except ClientError:
        return None


def list_checkpoints(job_id: str) -> List[CheckpointRef]:
    meta = _load_meta(job_id)
    return [
        CheckpointRef(
            job_id=job_id, checkpoint_num=e["num"],
            nas_path=e["nas_path"], s3_key=e["s3_key"],
            checksum_sha256=e["checksum"], size_bytes=e["size"],
            saved_at=datetime.fromisoformat(e["saved_at"]),
        )
        for e in meta
    ]


def delete_old_checkpoints(job_id: str, keep_n: int = 3):
    """Delete checkpoints beyond keep_n. Never deletes until confirmed."""
    meta = _load_meta(job_id)
    if len(meta) <= keep_n:
        return

    to_delete = meta[:-keep_n]
    remaining = meta[-keep_n:]

    for entry in to_delete:
        # Delete NAS
        nas_file = Path(entry["nas_path"])
        if nas_file.exists():
            nas_file.unlink()
        # Delete S3
        try:
            _get_s3().delete_object(Bucket=S3_BUCKET, Key=entry["s3_key"])
        except ClientError:
            pass

    _save_meta(job_id, remaining)
