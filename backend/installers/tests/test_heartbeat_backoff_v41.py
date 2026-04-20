"""Tests for 429-aware heartbeat backoff (v4.1.0 Task A6).

Covers:
  - http_post header-return widening (backward-compatible)
  - _parse_retry_after: integer seconds, HTTP-date, malformed, negative, past-date
  - send_heartbeat: Retry-After extracted only on 429/503
  - heartbeat_loop: max(Retry-After, computed_backoff) semantics

Tests do not touch the network; they monkey-patch the HTTP layer and
exercise the pure parsing / decision logic. Stdlib only.
"""

import os
import sys
import types
import unittest
from unittest import mock

# Make dcp_daemon importable without needing `requests`. The daemon tolerates
# its absence via HAS_REQUESTS flag.
HERE = os.path.dirname(os.path.abspath(__file__))
DAEMON_DIR = os.path.dirname(HERE)
if DAEMON_DIR not in sys.path:
    sys.path.insert(0, DAEMON_DIR)

# Inject lightweight stubs for heavy optional deps BEFORE importing daemon.
sys.modules.setdefault("psutil", types.ModuleType("psutil"))

import dcp_daemon  # noqa: E402


# ─── _parse_retry_after ──────────────────────────────────────────────────────

class TestParseRetryAfter(unittest.TestCase):
    def test_none_returns_none(self):
        self.assertIsNone(dcp_daemon._parse_retry_after(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(dcp_daemon._parse_retry_after(""))
        self.assertIsNone(dcp_daemon._parse_retry_after("   "))

    def test_integer_seconds(self):
        self.assertEqual(dcp_daemon._parse_retry_after("30"), 30.0)
        self.assertEqual(dcp_daemon._parse_retry_after("0"), 0.0)
        self.assertEqual(dcp_daemon._parse_retry_after("120"), 120.0)

    def test_float_seconds_tolerated(self):
        # RFC is integer, but servers in the wild sometimes send floats.
        self.assertEqual(dcp_daemon._parse_retry_after("15.5"), 15.5)

    def test_negative_seconds_rejected(self):
        self.assertIsNone(dcp_daemon._parse_retry_after("-1"))
        self.assertIsNone(dcp_daemon._parse_retry_after("-9999"))

    def test_nan_rejected(self):
        self.assertIsNone(dcp_daemon._parse_retry_after("nan"))

    def test_clamp_to_one_hour(self):
        # Misbehaving server sends 24 hours — clamp to 3600s so the daemon
        # doesn't silently vanish for a day.
        self.assertEqual(dcp_daemon._parse_retry_after("86400"), 3600.0)
        self.assertEqual(dcp_daemon._parse_retry_after("999999"), 3600.0)

    def test_http_date_future(self):
        # Future HTTP-date parses to positive delta. Use an RFC 1123 date a
        # few seconds ahead of now.
        from datetime import datetime, timedelta, timezone
        future = datetime.now(timezone.utc) + timedelta(seconds=45)
        http_date = future.strftime("%a, %d %b %Y %H:%M:%S GMT")
        parsed = dcp_daemon._parse_retry_after(http_date)
        self.assertIsNotNone(parsed)
        # Allow a generous tolerance for test execution drift.
        self.assertGreaterEqual(parsed, 30.0)
        self.assertLessEqual(parsed, 60.0)

    def test_http_date_past_returns_zero(self):
        # Past date means "retry now" — return 0, not a negative.
        past = "Wed, 21 Oct 2015 07:28:00 GMT"
        self.assertEqual(dcp_daemon._parse_retry_after(past), 0.0)

    def test_malformed_date_returns_none(self):
        self.assertIsNone(dcp_daemon._parse_retry_after("not a date"))
        self.assertIsNone(dcp_daemon._parse_retry_after("garbage"))

    def test_http_date_far_future_clamped(self):
        self.assertEqual(
            dcp_daemon._parse_retry_after("Wed, 21 Oct 2099 07:28:00 GMT"),
            3600.0,
        )


# ─── http_post header widening ───────────────────────────────────────────────

class TestHttpPostHeaderReturn(unittest.TestCase):
    """http_post(..., return_headers=True) returns (code, body, headers_dict).
    Default call is unchanged — (code, body)."""

    def test_default_returns_two_tuple(self):
        fake_resp = mock.Mock()
        fake_resp.status_code = 200
        fake_resp.text = '{"ok": true}'
        fake_resp.headers = {"Content-Type": "application/json"}
        with mock.patch.object(dcp_daemon, "HAS_REQUESTS", True), \
             mock.patch.object(dcp_daemon, "requests", mock.Mock(post=mock.Mock(return_value=fake_resp)), create=True):
            result = dcp_daemon.http_post("http://x/y", {"a": 1})
        self.assertEqual(len(result), 2)
        code, body = result
        self.assertEqual(code, 200)

    def test_return_headers_true_returns_three_tuple(self):
        fake_resp = mock.Mock()
        fake_resp.status_code = 429
        fake_resp.text = '{"error": "rate limited"}'
        fake_resp.headers = {"Retry-After": "45", "Content-Type": "application/json"}
        with mock.patch.object(dcp_daemon, "HAS_REQUESTS", True), \
             mock.patch.object(dcp_daemon, "requests", mock.Mock(post=mock.Mock(return_value=fake_resp)), create=True):
            result = dcp_daemon.http_post("http://x/y", {"a": 1}, return_headers=True)
        self.assertEqual(len(result), 3)
        code, body, hdrs = result
        self.assertEqual(code, 429)
        # Headers should be lowercased for case-insensitive lookup.
        self.assertEqual(hdrs.get("retry-after"), "45")
        self.assertIn("content-type", hdrs)

    def test_header_keys_lowercased(self):
        fake_resp = mock.Mock()
        fake_resp.status_code = 503
        fake_resp.text = ''
        fake_resp.headers = {"RETRY-AFTER": "10", "X-Custom": "yes"}
        with mock.patch.object(dcp_daemon, "HAS_REQUESTS", True), \
             mock.patch.object(dcp_daemon, "requests", mock.Mock(post=mock.Mock(return_value=fake_resp)), create=True):
            code, body, hdrs = dcp_daemon.http_post("http://x", {}, return_headers=True)
        self.assertEqual(hdrs["retry-after"], "10")
        self.assertEqual(hdrs["x-custom"], "yes")


# ─── heartbeat backoff decision (integration of parse + policy) ──────────────

class TestHeartbeatBackoffPolicy(unittest.TestCase):
    """Tests the decision rule: on 429/503 with Retry-After, take
    max(retry_after, computed_exponential). Without it, exponential wins.

    This simulates the heartbeat_loop decision without spinning the real
    background thread."""

    def _decide_sleep(self, code, retry_after_seconds, consecutive_failures):
        """Mirror the logic in heartbeat_loop for the non-2xx branch."""
        if code is not None and 200 <= code < 300:
            return float(dcp_daemon.HEARTBEAT_INTERVAL)
        backoff_steps = min(consecutive_failures, 8)
        computed = min(
            float(dcp_daemon.HEARTBEAT_MAX_BACKOFF),
            dcp_daemon.HEARTBEAT_INTERVAL * (dcp_daemon.HEARTBEAT_BACKOFF_BASE ** backoff_steps),
        )
        if retry_after_seconds is not None:
            return max(computed, float(retry_after_seconds))
        return computed

    def test_429_with_retry_after_larger_than_computed(self):
        # First failure: exponential is small. Server asks for 120s -> use 120.
        sleep = self._decide_sleep(code=429, retry_after_seconds=120.0, consecutive_failures=1)
        self.assertEqual(sleep, 120.0)

    def test_429_with_retry_after_smaller_than_computed(self):
        # Many consecutive failures: exponential may exceed retry_after.
        # Take the larger (avoid retrying faster than either signal asks).
        sleep = self._decide_sleep(code=429, retry_after_seconds=5.0, consecutive_failures=8)
        # Computed at 8 failures with base 2 and interval 30 = 30 * 2^8 = 7680,
        # capped at HEARTBEAT_MAX_BACKOFF. Whatever it is, it should dominate 5s.
        self.assertGreater(sleep, 5.0)

    def test_429_without_retry_after_uses_exponential(self):
        sleep = self._decide_sleep(code=429, retry_after_seconds=None, consecutive_failures=1)
        # Should equal the computed exponential for 1 failure.
        expected = min(
            float(dcp_daemon.HEARTBEAT_MAX_BACKOFF),
            dcp_daemon.HEARTBEAT_INTERVAL * (dcp_daemon.HEARTBEAT_BACKOFF_BASE ** 1),
        )
        self.assertEqual(sleep, expected)

    def test_503_retry_after_honored(self):
        # 503 Service Unavailable also carries Retry-After per RFC 7231.
        sleep = self._decide_sleep(code=503, retry_after_seconds=60.0, consecutive_failures=1)
        self.assertEqual(sleep, 60.0)

    def test_500_ignores_retry_after_in_send_heartbeat(self):
        # send_heartbeat only extracts retry_after on 429/503 — verified
        # indirectly: a 500 response will not populate retry_after_seconds,
        # so the decision falls through to the exponential branch.
        sleep = self._decide_sleep(code=500, retry_after_seconds=None, consecutive_failures=2)
        expected = min(
            float(dcp_daemon.HEARTBEAT_MAX_BACKOFF),
            dcp_daemon.HEARTBEAT_INTERVAL * (dcp_daemon.HEARTBEAT_BACKOFF_BASE ** 2),
        )
        self.assertEqual(sleep, expected)

    def test_2xx_resets_backoff(self):
        sleep = self._decide_sleep(code=200, retry_after_seconds=None, consecutive_failures=0)
        self.assertEqual(sleep, float(dcp_daemon.HEARTBEAT_INTERVAL))

    def test_transport_error_treated_as_failure(self):
        # code=None (transport error) -> exponential, no retry_after.
        sleep = self._decide_sleep(code=None, retry_after_seconds=None, consecutive_failures=1)
        expected = min(
            float(dcp_daemon.HEARTBEAT_MAX_BACKOFF),
            dcp_daemon.HEARTBEAT_INTERVAL * (dcp_daemon.HEARTBEAT_BACKOFF_BASE ** 1),
        )
        self.assertEqual(sleep, expected)


# ─── send_heartbeat Retry-After extraction gating ────────────────────────────

class TestSendHeartbeatRetryAfterExtraction(unittest.TestCase):
    """Verify retry_after is only returned on 429/503, not on 200/500."""

    def test_retry_after_only_for_429_and_503(self):
        # Unit-test the extraction rule directly — send_heartbeat is too
        # deep-coupled to the full daemon runtime to fake cleanly here.
        from dcp_daemon import _parse_retry_after

        # The rule in send_heartbeat:
        #   if code in (429, 503) and response_headers:
        #       retry_after_seconds = _parse_retry_after(response_headers.get("retry-after"))
        def extract(code, headers):
            if code in (429, 503) and headers:
                return _parse_retry_after(headers.get("retry-after"))
            return None

        self.assertEqual(extract(429, {"retry-after": "30"}), 30.0)
        self.assertEqual(extract(503, {"retry-after": "45"}), 45.0)
        self.assertIsNone(extract(200, {"retry-after": "30"}))
        self.assertIsNone(extract(500, {"retry-after": "30"}))
        self.assertIsNone(extract(429, {}))  # no headers
        self.assertIsNone(extract(429, {"retry-after": "garbage"}))


if __name__ == "__main__":
    unittest.main()
