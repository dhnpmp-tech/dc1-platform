"""Async S3 client wrapper for checkpoint storage."""

from __future__ import annotations

import json
import logging
from typing import Any

import aioboto3

from .config import CheckpointConfig

logger = logging.getLogger("dc1.checkpoint.s3")


class S3Client:
    """Thin async wrapper around S3 (compatible with AWS S3 and Cloudflare R2)."""

    def __init__(self, config: CheckpointConfig) -> None:
        self._config = config
        self._session = aioboto3.Session(
            aws_access_key_id=config.s3_access_key,
            aws_secret_access_key=config.s3_secret_key,
            region_name=config.s3_region,
        )
        self._extra: dict[str, str] = {}
        if config.s3_endpoint_url:
            self._extra["endpoint_url"] = config.s3_endpoint_url

    # -- public API -----------------------------------------------------------

    async def upload_json(self, key: str, data: dict[str, Any]) -> int:
        """Upload *data* as JSON. Returns size in bytes."""
        body = json.dumps(data, default=str, ensure_ascii=False).encode()
        async with self._session.client("s3", **self._extra) as s3:
            await s3.put_object(
                Bucket=self._config.s3_bucket,
                Key=key,
                Body=body,
                ContentType="application/json",
            )
        return len(body)

    async def download_json(self, key: str) -> dict[str, Any]:
        """Download and parse a JSON object from S3."""
        async with self._session.client("s3", **self._extra) as s3:
            resp = await s3.get_object(Bucket=self._config.s3_bucket, Key=key)
            body = await resp["Body"].read()
        return json.loads(body)

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all keys under *prefix*. Returns count deleted."""
        deleted = 0
        async with self._session.client("s3", **self._extra) as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=self._config.s3_bucket, Prefix=prefix):
                keys = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
                if keys:
                    await s3.delete_objects(
                        Bucket=self._config.s3_bucket,
                        Delete={"Objects": keys},
                    )
                    deleted += len(keys)
        return deleted

    async def list_keys(self, prefix: str) -> list[dict[str, Any]]:
        """List keys under *prefix* with metadata (Key, Size, LastModified)."""
        results: list[dict[str, Any]] = []
        async with self._session.client("s3", **self._extra) as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=self._config.s3_bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    results.append({
                        "key": obj["Key"],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    })
        return results
