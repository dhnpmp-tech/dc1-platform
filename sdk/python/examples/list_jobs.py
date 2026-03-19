"""
Example: List compute jobs assigned to your provider.

Shows pending (queued), running, and recently completed jobs.

Usage:
    DC1_PROVIDER_KEY=dc1-provider-<your-key> python examples/list_jobs.py
"""

import os

from dc1_provider import DC1ProviderClient

API_KEY = os.environ.get("DC1_PROVIDER_KEY") or input("Enter your provider API key: ").strip()

client = DC1ProviderClient(api_key=API_KEY)

# ── Earnings summary ──────────────────────────────────────────────────
earnings = client.get_earnings()
print(f"Earnings summary")
print(f"  Available : {earnings.available_sar:.2f} SAR")
print(f"  Total     : {earnings.total_earned_sar:.2f} SAR")
print(f"  Completed : {earnings.total_jobs} jobs")
print()

# ── Queued jobs (ready to run) ────────────────────────────────────────
queued = client.get_jobs(status="queued")
if queued:
    print(f"Queued jobs ({len(queued)})")
    for job in queued:
        print(f"  [{job.id}] {job.job_type:<20} {job.earnings_sar:.2f} SAR  submitted={job.submitted_at}")
else:
    print("No queued jobs.")
print()

# ── Running jobs ──────────────────────────────────────────────────────
running = client.get_jobs(status="running")
if running:
    print(f"Running jobs ({len(running)})")
    for job in running:
        print(f"  [{job.id}] {job.job_type:<20} started={job.started_at}")
else:
    print("No running jobs.")
print()

# ── Recently completed jobs ───────────────────────────────────────────
completed = client.get_jobs(status="completed")
recent = completed[:5]
if recent:
    print(f"Recently completed ({len(completed)} total, showing last {len(recent)})")
    for job in recent:
        print(f"  [{job.id}] {job.job_type:<20} {job.earnings_sar:.2f} SAR  done={job.completed_at}")
else:
    print("No completed jobs yet.")
