"""
GUARDIAN-ISOLATION: Billing integrity tests.
Ensures proof hashes, 75/25 splits, and halala display are tamper-proof.
"""

import hashlib
import pytest


class TestProofHash:
    """Billing proof = SHA-256(jobId|sessionId|amount|timestamp)."""

    def test_correct_hash(self, billing_helpers):
        h = billing_helpers["compute_proof_hash"]
        result = h("job-1", "sess-1", 10000, 1700000000)
        expected = hashlib.sha256(b"job-1|sess-1|10000|1700000000").hexdigest()
        assert result == expected

    def test_different_inputs_different_hash(self, billing_helpers):
        h = billing_helpers["compute_proof_hash"]
        h1 = h("job-1", "sess-1", 10000, 1700000000)
        h2 = h("job-2", "sess-1", 10000, 1700000000)
        assert h1 != h2


class TestTamperDetection:
    """Tampered proof hash must be rejected."""

    def test_valid_proof_passes(self, billing_helpers):
        v = billing_helpers["verify_billing_integrity"]
        h = billing_helpers["compute_proof_hash"]
        proof = h("job-1", "sess-1", 10000, 1700000000)
        assert v("job-1", "sess-1", 10000, 1700000000, proof) is True

    def test_tampered_amount_detected(self, billing_helpers):
        v = billing_helpers["verify_billing_integrity"]
        h = billing_helpers["compute_proof_hash"]
        proof = h("job-1", "sess-1", 10000, 1700000000)
        # Attacker changes amount
        assert v("job-1", "sess-1", 99999, 1700000000, proof) is False, (
            "Tampered amount must be detected"
        )

    def test_tampered_hash_detected(self, billing_helpers):
        v = billing_helpers["verify_billing_integrity"]
        assert v("job-1", "sess-1", 10000, 1700000000, "deadbeef" * 8) is False


class TestSplitIntegrity:
    """75/25 split must sum to total with zero rounding leaks."""

    @pytest.mark.parametrize("total", [100, 1, 3, 7, 999, 10000, 99999, 1234567])
    def test_split_sums_to_total(self, billing_helpers, total):
        provider, dc1 = billing_helpers["split_payment"](total)
        assert provider + dc1 == total, (
            f"Rounding leak! {provider} + {dc1} != {total}"
        )

    @pytest.mark.parametrize("total", [100, 1000, 10000])
    def test_provider_gets_75_percent(self, billing_helpers, total):
        provider, _ = billing_helpers["split_payment"](total)
        assert provider == (total * 75) // 100

    def test_single_halala_no_crash(self, billing_helpers):
        provider, dc1 = billing_helpers["split_payment"](1)
        assert provider + dc1 == 1


class TestHalalaDisplay:
    """SAR display must use integer math — no floating point."""

    def test_basic_conversion(self, billing_helpers):
        display = billing_helpers["halala_to_sar_display"]
        assert display(10050) == "100.50 SAR"

    def test_zero_halala(self, billing_helpers):
        assert billing_helpers["halala_to_sar_display"](0) == "0.00 SAR"

    def test_single_halala(self, billing_helpers):
        assert billing_helpers["halala_to_sar_display"](1) == "0.01 SAR"

    def test_no_float_in_implementation(self):
        """Verify the display function source uses integer division only."""
        from .conftest import halala_to_sar_display
        import inspect
        source = inspect.getsource(halala_to_sar_display)
        assert "float(" not in source, "halala_to_sar_display must not use float()"
        # Ensure integer division operators used
        assert "//" in source, "Must use integer division (//)"
