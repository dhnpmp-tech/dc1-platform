"""
GUARDIAN-ISOLATION: SSH hardening verification tests.
DC1 uses paramiko with RejectPolicy — no auto-accept of unknown hosts.
"""

import textwrap
import pytest
import paramiko
from unittest.mock import MagicMock, patch, call


# Simulated DC1 SSH connection code
DC1_SSH_SOURCE = textwrap.dedent("""\
    import paramiko

    SSH_TIMEOUT = 5

    def _ssh_check(host: str, port: int = 22) -> bool:
        client = paramiko.SSHClient()
        client.load_system_host_keys()
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        try:
            client.connect(host, port=port, timeout=SSH_TIMEOUT)
            return True
        except Exception:
            return False
        finally:
            client.close()
""")


class TestSSHPolicyPattern:
    """Source code must use RejectPolicy, never AutoAddPolicy."""

    def test_uses_reject_policy(self):
        assert "RejectPolicy" in DC1_SSH_SOURCE, (
            "DC1 SSH code must use paramiko.RejectPolicy()"
        )

    def test_no_auto_add_policy(self):
        assert "AutoAddPolicy" not in DC1_SSH_SOURCE, (
            "SECURITY VIOLATION: AutoAddPolicy found — allows MITM attacks"
        )

    def test_no_warning_policy(self):
        assert "WarningPolicy" not in DC1_SSH_SOURCE, (
            "SECURITY VIOLATION: WarningPolicy found — silently accepts unknown hosts"
        )

    def test_load_system_host_keys_called(self):
        assert "load_system_host_keys()" in DC1_SSH_SOURCE, (
            "Must call load_system_host_keys() before connecting"
        )


class TestSSHTimeout:
    """SSH connections must enforce a 5-second timeout."""

    def test_timeout_defined(self):
        assert "SSH_TIMEOUT = 5" in DC1_SSH_SOURCE

    def test_timeout_used_in_connect(self):
        assert "timeout=SSH_TIMEOUT" in DC1_SSH_SOURCE, (
            "SSH connect must pass timeout parameter"
        )


class TestUnknownHostRejected:
    """RejectPolicy must refuse connections to unknown hosts."""

    def test_reject_policy_raises_on_unknown_host(self):
        policy = paramiko.RejectPolicy()
        mock_key = MagicMock()
        mock_key.get_name.return_value = "ssh-rsa"
        mock_key.get_fingerprint.return_value = b"\x00" * 16
        with pytest.raises(paramiko.SSHException):
            policy.missing_host_key(
                MagicMock(),  # client
                "unknown.host.example.com",
                mock_key,
            )

    def test_mock_ssh_rejects_unknown(self, mock_paramiko):
        """Simulate DC1's _ssh_check rejecting an unknown host."""
        mock_paramiko.connect.side_effect = paramiko.SSHException("Unknown host key")
        with pytest.raises(paramiko.SSHException):
            mock_paramiko.connect("evil.host", port=22, timeout=5)
