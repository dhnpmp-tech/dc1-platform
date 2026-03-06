# Building the DC1 Windows Installer

## Requirements

- NSIS 3.x ([download](https://nsis.sourceforge.io/Download))
- The files in this directory

## Build

Run from `backend/installers/`:

```bash
makensis dc1-provider-Windows.nsi
```

## Output

`dc1-provider-setup-Windows.exe`

## What's bundled

| File | Purpose |
|------|---------|
| `dc1_daemon.py` | Python daemon template (API key/URL replaced at install time) |
| `dc1-setup-helper.ps1` | Setup automation (Python detection, pip, scheduled task) |
| `dc1-uninstall-helper.ps1` | Clean uninstall (remove task, shortcuts) |

## Installer pages

1. **Welcome** — DC1 branding
2. **API Key** — Text input (can be pre-filled via `/KEY=dc1-provider-xxx` CLI arg)
3. **Run Mode** — Always On / Scheduled / Manual
4. **Schedule** — Start/end times (only if Scheduled selected)
5. **Install** — Progress bar
6. **Finish** — "Open My Dashboard" button

## No admin required

Installs to `%LOCALAPPDATA%\dc1-provider`. Uses `HKCU` registry. No elevation prompt.

## Pre-fill API key

```bash
dc1-provider-setup-Windows.exe /KEY=dc1-provider-abc123
```
