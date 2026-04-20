"""Tests for setup script version strings (v4.1.0 Task A12).

Guards against stale version strings regressing into the installer
scripts. All banners and daemon_version config entries must reflect
the canonical v4.1.0 release.

Stdlib only.
"""

import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
INSTALLER_DIR = os.path.dirname(HERE)
UNIX_SCRIPT = os.path.join(INSTALLER_DIR, "dcp-setup-unix.sh")
WIN_SCRIPT = os.path.join(INSTALLER_DIR, "dcp-setup-windows.ps1")

EXPECTED_VERSION = "4.1.0"
STALE_PATTERNS = [
    r"v?3\.3\.0",
    r"v?4\.0\.0-alpha",
]


class TestSetupVersions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(UNIX_SCRIPT) as f:
            cls.unix = f.read()
        with open(WIN_SCRIPT) as f:
            cls.win = f.read()

    def test_unix_banner_shows_v410(self):
        self.assertIn(f"DCP Provider Setup v{EXPECTED_VERSION}", self.unix)

    def test_unix_installed_banner_shows_v410(self):
        self.assertIn(f"DCP Provider Daemon v{EXPECTED_VERSION}", self.unix)

    def test_unix_config_daemon_version(self):
        self.assertIn(f'"daemon_version": "{EXPECTED_VERSION}"', self.unix)

    def test_windows_header_shows_v410(self):
        self.assertIn(f"DCP Provider Setup v{EXPECTED_VERSION}", self.win)

    def test_windows_banner_shows_v410(self):
        self.assertIn(f"DCP Provider Daemon v{EXPECTED_VERSION}", self.win)

    def test_windows_config_daemon_version(self):
        self.assertIn(f'daemon_version = "{EXPECTED_VERSION}"', self.win)

    def test_no_stale_version_strings_in_unix(self):
        for pat in STALE_PATTERNS:
            self.assertIsNone(
                re.search(pat, self.unix),
                f"Stale version pattern {pat!r} found in unix script",
            )

    def test_no_stale_version_strings_in_windows(self):
        for pat in STALE_PATTERNS:
            self.assertIsNone(
                re.search(pat, self.win),
                f"Stale version pattern {pat!r} found in windows script",
            )


if __name__ == "__main__":
    unittest.main()
