"""Tests for v4.1.0 driver / CUDA compatibility checks.

evaluate_driver_compatibility() surfaces structured warnings when the
detected NVIDIA driver or CUDA runtime is too old for the installed GPU
architecture, so the backend router can downrank affected providers
before a renter hits them.
"""
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import dcp_daemon as d


# ─── Version parsing / comparison ──────────────────────────────────────────

def test_parse_version_tuple_basic():
    assert d._parse_version_tuple("535.129.03") == (535, 129, 3)
    assert d._parse_version_tuple("12.2") == (12, 2)
    assert d._parse_version_tuple("550") == (550,)


def test_parse_version_tuple_bad_input():
    assert d._parse_version_tuple(None) == (0,)
    assert d._parse_version_tuple("") == (0,)
    assert d._parse_version_tuple("nvidia-none") == (0,)


def test_version_lt_padding():
    assert d._version_lt("470", "535") is True
    assert d._version_lt("535", "470") is False
    assert d._version_lt("535.0", "535") is False
    assert d._version_lt("535.0.0", "535.1") is True


# ─── Happy path: no warnings on compatible hardware ────────────────────────

def test_modern_h100_with_modern_driver_no_warnings():
    info = {
        "driver_version": "535.129.03",
        "cuda_version": "12.4",
        "all_gpus": [{"gpu_name": "NVIDIA H100 PCIe",
                      "driver_version": "535.129.03",
                      "cuda_version": "12.4"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["warnings"] == []
    assert out["compatible"] is True


def test_modern_rtx_4090_on_driver_525_no_warnings():
    info = {
        "driver_version": "525.85",
        "cuda_version": "12.0",
        "all_gpus": [{"gpu_name": "NVIDIA GeForce RTX 4090"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["compatible"] is True


# ─── Critical: driver too old for Blackwell ─────────────────────────────────

def test_rtx_5090_on_driver_535_flags_critical():
    """RTX 5090 (Blackwell) requires driver >= 550; 535 must flag critical."""
    info = {
        "driver_version": "535.129.03",
        "cuda_version": "12.2",
        "all_gpus": [{"gpu_name": "NVIDIA GeForce RTX 5090"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["compatible"] is False
    driver_warnings = [w for w in out["warnings"] if w["issue"] == "driver_too_old"]
    assert len(driver_warnings) == 1
    w = driver_warnings[0]
    assert w["severity"] == "critical"
    assert "550" in w["required"]
    assert w["detected"] == "535.129.03"
    assert w["arch"] == "Blackwell"
    assert "remedy" in w


def test_h200_on_driver_470_flags_critical():
    info = {
        "driver_version": "470.57.02",
        "cuda_version": "11.4",
        "all_gpus": [{"gpu_name": "NVIDIA H200"}],
    }
    out = d.evaluate_driver_compatibility(info)
    critical = [w for w in out["warnings"] if w["severity"] == "critical"]
    assert len(critical) >= 1
    assert any(w["arch"] == "Hopper" for w in critical)


# ─── Warning: CUDA too old even if driver is OK ────────────────────────────

def test_cuda_too_old_emits_warning_not_critical():
    """Driver OK but CUDA toolkit too old — warning severity, not critical."""
    info = {
        "driver_version": "535.129.03",  # OK for Hopper
        "cuda_version": "11.8",          # too old for Hopper min 12.2
        "all_gpus": [{"gpu_name": "NVIDIA H100 PCIe"}],
    }
    out = d.evaluate_driver_compatibility(info)
    cuda_warnings = [w for w in out["warnings"] if w["issue"] == "cuda_too_old"]
    assert len(cuda_warnings) == 1
    assert cuda_warnings[0]["severity"] == "warning"


# ─── Multi-GPU: each mismatched card gets its own warning ──────────────────

def test_multigpu_mixed_generations_reports_per_gpu():
    """Rig with RTX 5090 + H100 on old driver → two critical warnings."""
    info = {
        "driver_version": "470.57.02",
        "cuda_version": "11.4",
        "all_gpus": [
            {"gpu_name": "NVIDIA GeForce RTX 5090"},
            {"gpu_name": "NVIDIA H100 PCIe"},
        ],
    }
    out = d.evaluate_driver_compatibility(info)
    critical = [w for w in out["warnings"] if w["severity"] == "critical"]
    gpu_names = {w["gpu_name"] for w in critical}
    assert "NVIDIA GeForce RTX 5090" in gpu_names
    assert "NVIDIA H100 PCIe" in gpu_names


# ─── Fallbacks: Apple Silicon, CPU, unknown ────────────────────────────────

def test_apple_silicon_skips_cuda_checks():
    info = {
        "driver_version": "Metal",
        "cuda_version": None,
        "all_gpus": [{"gpu_name": "Apple M2 Ultra"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["warnings"] == []
    assert out["compatible"] is True


def test_no_gpu_info_returns_clean():
    assert d.evaluate_driver_compatibility(None)["warnings"] == []
    assert d.evaluate_driver_compatibility({})["warnings"] == []


def test_unknown_gpu_model_produces_no_warnings():
    """GPU we don't have a compatibility record for → no false-positive warnings."""
    info = {
        "driver_version": "470.00",
        "cuda_version": "11.4",
        "all_gpus": [{"gpu_name": "NVIDIA Mystery GPU 9000"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["warnings"] == []
    assert out["compatible"] is True


def test_driver_version_passed_through_to_output():
    info = {
        "driver_version": "535.129.03",
        "cuda_version": "12.2",
        "all_gpus": [{"gpu_name": "NVIDIA H100 PCIe"}],
    }
    out = d.evaluate_driver_compatibility(info)
    assert out["driver_version"] == "535.129.03"
    assert out["cuda_version"] == "12.2"
