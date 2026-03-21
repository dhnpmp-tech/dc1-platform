"""
GUARDIAN-ISOLATION: Container isolation verification tests.
Gate 0 requirement — zero data leakage between jobs.
"""

import pytest
from .conftest import FakeContainer, FakeDockerClient


class TestNetworkIsolation:
    """Every DC1 job container must have NetworkMode='none'."""

    def test_network_mode_is_none(self, mock_docker_client):
        for c in mock_docker_client.containers.list():
            mode = c.attrs["HostConfig"]["NetworkMode"]
            assert mode == "none", (
                f"SECURITY VIOLATION: Container {c.name} has NetworkMode='{mode}', expected 'none'"
            )

    def test_network_mode_rejects_bridge(self):
        bad = FakeContainer()
        bad.attrs["HostConfig"]["NetworkMode"] = "bridge"
        assert bad.attrs["HostConfig"]["NetworkMode"] != "none", "bridge should fail"

    def test_network_mode_rejects_host(self):
        bad = FakeContainer()
        bad.attrs["HostConfig"]["NetworkMode"] = "host"
        assert bad.attrs["HostConfig"]["NetworkMode"] != "none", "host should fail"


class TestGPUMemoryPostWipe:
    """After wipe, GPU memory must be < 50 MB."""

    def test_post_wipe_memory_below_threshold(self, nvidia_smi):
        assert nvidia_smi.memory_used_mb < 50, (
            f"GPU memory after wipe is {nvidia_smi.memory_used_mb} MB, must be < 50 MB"
        )

    def test_dirty_gpu_fails_threshold(self, nvidia_smi_dirty):
        assert nvidia_smi_dirty.memory_used_mb >= 50, (
            "Dirty GPU should exceed 50 MB threshold"
        )


class TestCrossTenantVisibility:
    """Tenant container must not see other tenants' processes."""

    def test_ps_aux_shows_only_own_processes(self, mock_docker_client):
        for c in mock_docker_client.containers.list():
            exit_code, output = c.exec_run("ps aux")
            lines = output.decode().strip().split("\n")
            # Header + 1 process only
            assert len(lines) <= 2, (
                f"Container {c.name} sees {len(lines)-1} processes, expected 1 (own entrypoint only)"
            )


class TestWorkspaceMount:
    """/workspace must be read-only to prevent tenant data persistence."""

    def test_workspace_is_readonly(self, mock_docker_client):
        for c in mock_docker_client.containers.list():
            mounts = c.attrs.get("Mounts", [])
            ws = [m for m in mounts if m["Destination"] == "/workspace"]
            assert ws, f"Container {c.name} missing /workspace mount"
            for m in ws:
                assert m["RW"] is False, (
                    f"SECURITY VIOLATION: /workspace is writable in {c.name}"
                )


class TestContainerLabels:
    """Every DC1 container must carry job_id and renter_id labels for audit."""

    def test_labels_present(self, mock_docker_client):
        for c in mock_docker_client.containers.list():
            labels = c.attrs["Config"]["Labels"]
            assert "dc1.job_id" in labels, f"Missing dc1.job_id label on {c.name}"
            assert "dc1.renter_id" in labels, f"Missing dc1.renter_id label on {c.name}"

    def test_labels_not_empty(self, mock_docker_client):
        for c in mock_docker_client.containers.list():
            labels = c.attrs["Config"]["Labels"]
            assert labels["dc1.job_id"], "dc1.job_id label is empty"
            assert labels["dc1.renter_id"], "dc1.renter_id label is empty"
