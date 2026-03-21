# DCP VS Code Extension Demo Script

## Goal

Show end-to-end IDE-native renter flow: authenticate, run inference, stream logs, and confirm billing/job visibility.

## Prep (2 minutes)

1. Open VS Code with the extension installed.
2. Ensure API is reachable at `https://api.dcp.sa`.
3. Have a valid renter API key ready.

Expected output:
- `Available GPUs` tree loads at least one provider or shows an explicit "No GPUs online right now" state.

## Live Demo Steps (6–8 minutes)

1. Run command: `DCP: Set Renter API Key`.
   - Enter renter key when prompted.

Expected output:
- Success toast confirming renter identity and current SAR balance.

2. Open command: `DCP: Run AI Inference`.
   - Pick an available model.
   - Prompt example: `Summarize why low-latency GPU inference matters for enterprise copilots.`
   - Keep defaults (`max_tokens=512`, `temperature=0.7`), then submit.

Expected output:
- Response appears in panel.
- Toast shows token count and SAR cost.
- Job/result metadata visible in panel footer.

3. Click `Watch Logs` from the completion toast (or run `DCP: Watch Job Logs`).

Expected output:
- Output channel opens for that job.
- Live logs stream via SSE.
- If SSE is unavailable, channel shows fallback message and continues with polling updates.
- Final line shows `Job completed` (or explicit terminal error state).

4. Open `My Jobs` tree and refresh (`DCP: Refresh My Jobs`).

Expected output:
- Newly created job appears with correct status icon and type.

5. Click status bar item (wallet shortcut) to open billing page.

Expected output:
- Browser opens `https://dcp.sa/renter/billing`.

## Recovery Cues (if something fails)

- Model list empty: click `Reload Models` in inference panel.
- Log stream error: verify fallback polling messages continue in output channel.
- Auth failure: rerun `DCP: Set Renter API Key`.

## Close

Highlight that the extension delivers:
- IDE-native job submission,
- real-time job observability,
- and billing-aware workflow without leaving editor context.
