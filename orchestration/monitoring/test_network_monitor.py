#!/usr/bin/env python3
"""
Unit tests for network_monitor module.

Run with: pytest test_network_monitor.py -v
"""

import os
import sys
import time
import json
import sqlite3
import tempfile
import pytest
from unittest.mock import patch, MagicMock, call
from pathlib import Path

# Import the module to test
import network_monitor as nm


class TestConfigValidation:
    """Test configuration validation."""

    def test_validate_config_valid(self):
        """Test validation passes with valid config."""
        config = {
            "ping": {"interval_s": 10, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": 5.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": 7},
            "status": {"port": 8085}
        }
        # Should not raise
        nm.validate_config(config)

    def test_validate_config_negative_interval(self):
        """Test validation fails with negative ping interval."""
        config = {
            "ping": {"interval_s": -1, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": 5.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": 7},
            "status": {"port": 8085}
        }
        with pytest.raises(nm.ConfigValidationError):
            nm.validate_config(config)

    def test_validate_config_loss_pct_too_high(self):
        """Test validation fails with loss_pct > 100."""
        config = {
            "ping": {"interval_s": 10, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": 150.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": 7},
            "status": {"port": 8085}
        }
        with pytest.raises(nm.ConfigValidationError):
            nm.validate_config(config)

    def test_validate_config_loss_pct_negative(self):
        """Test validation fails with negative loss_pct."""
        config = {
            "ping": {"interval_s": 10, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": -1.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": 7},
            "status": {"port": 8085}
        }
        with pytest.raises(nm.ConfigValidationError):
            nm.validate_config(config)

    def test_validate_config_invalid_port(self):
        """Test validation fails with invalid port number."""
        config = {
            "ping": {"interval_s": 10, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": 5.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": 7},
            "status": {"port": 99999}
        }
        with pytest.raises(nm.ConfigValidationError):
            nm.validate_config(config)

    def test_validate_config_negative_retention(self):
        """Test validation fails with negative retention days."""
        config = {
            "ping": {"interval_s": 10, "timeout_s": 5},
            "thresholds": {
                "loss_pct_alert": 5.0,
                "outage_consecutive_s": 5,
                "rolling_window_s": 60
            },
            "storage": {"retention_days": -1},
            "status": {"port": 8085}
        }
        with pytest.raises(nm.ConfigValidationError):
            nm.validate_config(config)


class TestEnvironmentVariables:
    """Test environment variable handling."""

    def test_get_required_env_var_present(self):
        """Test retrieving environment variable that exists."""
        with patch.dict(os.environ, {"TEST_VAR": "test_value"}):
            result = nm.get_required_env_var("TEST_VAR", "Test variable")
            assert result == "test_value"

    def test_get_required_env_var_missing(self):
        """Test error when required env var is missing."""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(RuntimeError) as excinfo:
                nm.get_required_env_var("MISSING_VAR", "Missing variable")
            assert "MISSING_VAR" in str(excinfo.value)
            assert "Missing variable" in str(excinfo.value)

    def test_get_required_env_var_empty(self):
        """Test error when env var is empty string."""
        with patch.dict(os.environ, {"EMPTY_VAR": ""}):
            with pytest.raises(RuntimeError):
                nm.get_required_env_var("EMPTY_VAR", "Empty variable")


class TestDatabaseManager:
    """Test database operations."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            yield db_path

    def test_database_init(self, temp_db):
        """Test database initialization."""
        db = nm.DatabaseManager(temp_db)
        assert os.path.exists(temp_db)

        # Verify schema
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = [row[0] for row in cursor.fetchall()]
            assert "metrics" in tables

    def test_insert_metric(self, temp_db):
        """Test inserting metrics into database."""
        db = nm.DatabaseManager(temp_db)
        db.insert_metric(12.5, 0.5, "8.8.8.8", "healthy")

        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT latency_ms, packet_loss_pct, target, status FROM metrics"
            )
            row = cursor.fetchone()
            assert row[0] == 12.5
            assert row[1] == 0.5
            assert row[2] == "8.8.8.8"
            assert row[3] == "healthy"

    def test_get_latest_metrics(self, temp_db):
        """Test retrieving latest metrics."""
        db = nm.DatabaseManager(temp_db)

        # Insert test data
        now = int(time.time())
        with sqlite3.connect(temp_db) as conn:
            conn.execute(
                "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
                (now - 3600, 10.0, 1.0, "8.8.8.8", "healthy")
            )
            conn.execute(
                "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
                (now, 12.5, 0.5, "8.8.8.8", "healthy")
            )
            conn.commit()

        metrics = db.get_latest_metrics(hours=24)
        assert len(metrics) == 2

    def test_cleanup_old_metrics(self, temp_db):
        """Test cleanup of old metrics."""
        db = nm.DatabaseManager(temp_db)

        # Insert old and new data
        now = int(time.time())
        old_time = now - (10 * 86400)  # 10 days ago

        with sqlite3.connect(temp_db) as conn:
            conn.execute(
                "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
                (old_time, 10.0, 1.0, "8.8.8.8", "healthy")
            )
            conn.execute(
                "INSERT INTO metrics VALUES (?, ?, ?, ?, ?)",
                (now, 12.5, 0.5, "8.8.8.8", "healthy")
            )
            conn.commit()

        # Cleanup with 7-day retention
        db.cleanup_old_metrics(retention_days=7)

        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM metrics")
            count = cursor.fetchone()[0]
            assert count == 1  # Old metric should be deleted


class TestPingMonitor:
    """Test ping monitoring functionality."""

    @pytest.fixture
    def mock_config(self):
        """Create mock configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield {
                "targets": {"primary": "8.8.8.8", "fallback": "1.1.1.1"},
                "ping": {"interval_s": 1, "timeout_s": 5},
                "thresholds": {
                    "loss_pct_alert": 5.0,
                    "outage_consecutive_s": 5,
                    "rolling_window_s": 60
                },
                "storage": {
                    "db_path": os.path.join(tmpdir, "metrics.db"),
                    "retention_days": 7
                },
                "logging": {"log_path": os.path.join(tmpdir, "test.log")},
                "alerts": {"cooldown_s": 10},
                "status": {"port": 8085}
            }

    def test_monitor_init(self, mock_config):
        """Test monitor initialization."""
        monitor = nm.PingMonitor(mock_config)
        assert monitor.primary_target == "8.8.8.8"
        assert monitor.fallback_target == "1.1.1.1"
        assert monitor.running is False

    def test_calculate_loss_pct_empty(self, mock_config):
        """Test loss percentage with empty data."""
        monitor = nm.PingMonitor(mock_config)
        loss = monitor._calculate_loss_pct()
        assert loss == 100.0

    def test_calculate_loss_pct_with_data(self, mock_config):
        """Test loss percentage calculation."""
        monitor = nm.PingMonitor(mock_config)
        monitor.latencies.append(10.0)
        monitor.latencies.append(None)
        monitor.latencies.append(12.0)

        loss = monitor._calculate_loss_pct()
        assert loss == pytest.approx(33.33, 0.1)

    def test_should_alert_cooldown(self, mock_config):
        """Test alert cooldown logic."""
        monitor = nm.PingMonitor(mock_config)
        monitor.alert_cooldown_s = 100

        # First alert should be allowed
        assert monitor._should_alert() is True

        # Set last alert time to now
        monitor.last_alert_time = time.time()

        # Second alert should be blocked due to cooldown
        assert monitor._should_alert() is False

    @patch('network_monitor.get_required_env_var')
    def test_send_alert_to_mc(self, mock_get_env, mock_config):
        """Test sending alert to Mission Control."""
        mock_get_env.side_effect = lambda x, y: f"test_{x}"

        monitor = nm.PingMonitor(mock_config)
        monitor.alert_cooldown_s = 0  # Disable cooldown for testing

        # Should not raise
        monitor._send_alert_to_mc("TEST_ALERT", "Test message")

    @patch('network_monitor.get_required_env_var')
    def test_send_alert_missing_credentials(self, mock_get_env, mock_config):
        """Test alert handling with missing credentials."""
        mock_get_env.side_effect = RuntimeError("Missing env var")

        monitor = nm.PingMonitor(mock_config)
        # Should not raise, just log error
        monitor._send_alert_to_mc("TEST_ALERT", "Test message")


class TestStatusHandler:
    """Test HTTP status endpoint."""

    def test_status_handler_rate_limit(self):
        """Test rate limiting on status endpoint."""
        handler = nm.StatusHandler

        # Create mock request context
        with tempfile.TemporaryDirectory() as tmpdir:
            config = {
                "targets": {"primary": "8.8.8.8", "fallback": "1.1.1.1"},
                "ping": {"interval_s": 1, "timeout_s": 5},
                "thresholds": {
                    "loss_pct_alert": 5.0,
                    "outage_consecutive_s": 5,
                    "rolling_window_s": 60
                },
                "storage": {
                    "db_path": os.path.join(tmpdir, "metrics.db"),
                    "retention_days": 7
                },
                "logging": {"log_path": os.path.join(tmpdir, "test.log")},
                "alerts": {"cooldown_s": 10},
                "status": {"port": 8085}
            }

            monitor = nm.PingMonitor(config)
            handler.monitor = monitor

            # Fill request times with 61 requests
            now = time.time()
            handler.request_times = nm.deque([now - i for i in range(61)], maxlen=60)

            # Verify rate limit tracking works
            assert len(handler.request_times) == 60


class TestIntegration:
    """Integration tests."""

    def test_config_load_and_validate(self):
        """Test loading and validating configuration."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config_path = os.path.join(tmpdir, "config.yaml")

            # Create valid config
            config_content = """
targets:
  primary: "8.8.8.8"
  fallback: "1.1.1.1"
ping:
  interval_s: 10
  timeout_s: 5
thresholds:
  loss_pct_alert: 5.0
  outage_consecutive_s: 5
  rolling_window_s: 60
storage:
  db_path: "data/network_metrics.db"
  retention_days: 7
logging:
  log_path: "logs/network_monitor.log"
alerts:
  cooldown_s: 300
status:
  port: 8085
"""

            with open(config_path, 'w') as f:
                f.write(config_content)

            # Load config
            config = nm.load_config(config_path)

            # Validate config
            nm.validate_config(config)

            # Verify values
            assert config["targets"]["primary"] == "8.8.8.8"
            assert config["ping"]["interval_s"] == 10


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
