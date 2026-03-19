# Build Windows Installer (.exe)

## Output
- `backend/installers/dc1-provider-setup-Windows.exe`

## Prerequisites
- NSIS installed (`makensis` in PATH)
- Source script: `backend/installers/dc1-provider-Windows.nsi`

## Build command
```bash
cd backend/installers
makensis dc1-provider-Windows.nsi
```

## Verify
```bash
ls -lh backend/installers/dc1-provider-setup-Windows.exe
```

## Notes
- In this Paperclip runtime (`2026-03-19`), `makensis` is not installed.
- The backend route `GET /api/providers/daemon/windows` serves the existing installer if present and returns a JSON error with this doc path when missing.
