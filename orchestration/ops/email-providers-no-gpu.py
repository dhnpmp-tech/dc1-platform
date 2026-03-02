#!/usr/bin/env python3
"""
DC1 — Email providers who registered without GPU details.
Sends them a personalised link to auto-detect their GPU via daemon.sh.

Usage:
    python3 email-providers-no-gpu.py [--dry-run]

Requirements (set as env vars or in .env):
    SUPABASE_URL          https://fvvxqp-qqjszv6vweybvjfpc.supabase.co
    SUPABASE_SERVICE_KEY  <service role key>
    SMTP_HOST             smtp.gmail.com
    SMTP_PORT             587
    SMTP_USER             nex@dc1st.com
    SMTP_PASS             <Google Workspace App Password>
    DC1_API_BASE          http://76.13.179.86:8083   (or public URL when live)
"""

import os
import sys
import json
import smtplib
import argparse
import requests
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

# ── Config ──────────────────────────────────────────────────────────────────
SUPABASE_URL     = os.getenv("SUPABASE_URL",     "https://fvvxqp-qqjszv6vweybvjfpc.supabase.co")
SUPABASE_SVC_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
DC1_API_BASE     = os.getenv("DC1_API_BASE",     "http://76.13.179.86:8083")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "nex@dc1st.com")
SMTP_PASS = os.getenv("SMTP_PASS", "")

# ── Email template ───────────────────────────────────────────────────────────

def make_email(provider_name: str, setup_url: str) -> tuple[str, str]:
    """Returns (subject, html_body)."""
    first_name = provider_name.split()[0] if provider_name else "Provider"
    subject = "Action Required: Connect Your GPU to DC1"
    html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: -apple-system, Arial, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 0; }}
    .container {{ max-width: 600px; margin: 40px auto; background: #111; border-radius: 12px; overflow: hidden; border: 1px solid #222; }}
    .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #00d4ff33; }}
    .logo {{ font-size: 28px; font-weight: 800; color: #fff; letter-spacing: 2px; }}
    .logo span {{ color: #00d4ff; }}
    .tagline {{ color: #888; font-size: 13px; margin-top: 6px; }}
    .body {{ padding: 40px; }}
    h2 {{ color: #fff; font-size: 22px; margin: 0 0 16px; }}
    p {{ color: #aaa; line-height: 1.7; margin: 0 0 16px; font-size: 15px; }}
    .cmd-box {{ background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 20px 24px; margin: 24px 0; font-family: monospace; font-size: 14px; color: #58a6ff; word-break: break-all; }}
    .btn {{ display: inline-block; background: #00d4ff; color: #000 !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 8px 0 24px; }}
    .steps {{ background: #0d1117; border-radius: 8px; padding: 24px; margin: 24px 0; }}
    .steps h3 {{ color: #fff; font-size: 15px; margin: 0 0 16px; }}
    .step {{ display: flex; gap: 12px; margin-bottom: 12px; align-items: flex-start; }}
    .step-num {{ background: #00d4ff22; color: #00d4ff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }}
    .step-text {{ color: #aaa; font-size: 14px; line-height: 1.5; }}
    .footer {{ border-top: 1px solid #222; padding: 24px 40px; text-align: center; }}
    .footer p {{ color: #555; font-size: 13px; margin: 0; }}
    a {{ color: #00d4ff; }}
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo">DC<span>1</span></div>
    <div class="tagline">Saudi Arabia's GPU Compute Marketplace</div>
  </div>
  <div class="body">
    <h2>Hi {first_name}, your GPU is missing 👋</h2>
    <p>
      You registered as a DC1 provider but we couldn't detect your GPU hardware yet.
      Without this, we can't activate your machine or start sending you earning jobs.
    </p>
    <p>
      <strong style="color:#fff">One command fixes this.</strong>
      Run the following on your machine and it will auto-detect your GPU, verify it meets
      our minimum spec (8 GB VRAM), and register you — all in under 2 minutes:
    </p>
    <div class="cmd-box">bash &lt;(curl -s "{setup_url}")</div>
    <a href="{setup_url}" class="btn">Download Setup Script →</a>
    <div class="steps">
      <h3>What the script does</h3>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Detects your GPU model, VRAM, and driver version automatically</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Validates your hardware meets DC1 minimum requirements</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Registers your machine and issues a unique provider ID</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Starts the DC1 monitoring agent as a background service</div>
      </div>
    </div>
    <p>
      <strong style="color:#fff">Requirements:</strong>
      Ubuntu 20.04+, NVIDIA drivers installed, 8 GB+ VRAM.
      <a href="https://dc1st.com/docs/providers/setup">Full setup guide →</a>
    </p>
    <p>
      Questions? Reply to this email or reach us at
      <a href="mailto:support@dc1st.com">support@dc1st.com</a>
    </p>
  </div>
  <div class="footer">
    <p>DC Power Solutions · Riyadh, Saudi Arabia · <a href="https://dc1st.com">dc1st.com</a></p>
    <p style="margin-top:8px">You're receiving this because you signed up as a GPU provider at DC1.</p>
  </div>
</div>
</body>
</html>
"""
    return subject, html


# ── Supabase query ────────────────────────────────────────────────────────────

def get_providers_without_gpu() -> list[dict]:
    """Query Supabase for providers whose machines have no gpu_type."""
    if not SUPABASE_SVC_KEY:
        print("❌ SUPABASE_SERVICE_KEY not set")
        sys.exit(1)

    # Join machines → users to get email + name, filtered on null gpu_type
    url = (
        f"{SUPABASE_URL}/rest/v1/machines"
        "?select=id,provider_id,gpu_type,users(id,name,email,api_key)"
        "&gpu_type=is.null"
        "&status=neq.offline"
    )
    headers = {
        "apikey": SUPABASE_SVC_KEY,
        "Authorization": f"Bearer {SUPABASE_SVC_KEY}",
        "Content-Type": "application/json",
    }
    resp = requests.get(url, headers=headers, timeout=15)
    resp.raise_for_status()
    machines = resp.json()

    # Deduplicate by user (one email per provider even if multiple machines)
    seen_users = set()
    providers = []
    for m in machines:
        user = m.get("users") or {}
        uid = user.get("id")
        if uid and uid not in seen_users:
            seen_users.add(uid)
            providers.append({
                "machine_id": m["id"],
                "user_id":    uid,
                "name":       user.get("name", ""),
                "email":      user.get("email", ""),
                "api_key":    user.get("api_key", "dc1-provider-test"),
            })
    return providers


# ── Email sender ──────────────────────────────────────────────────────────────

def send_email(to_email: str, subject: str, html_body: str, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"  [DRY RUN] Would send → {to_email}")
        return True

    if not SMTP_PASS:
        print("❌ SMTP_PASS not set — cannot send emails")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"]    = f"Nexus @ DC1 <{SMTP_USER}>"
    msg["To"]      = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"  ❌ Failed to send to {to_email}: {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Email DC1 providers without GPU info")
    parser.add_argument("--dry-run", action="store_true", help="Print emails, don't send")
    args = parser.parse_args()

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}DC1 Provider GPU Outreach — {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)

    print("🔍 Querying providers without GPU...")
    providers = get_providers_without_gpu()
    print(f"   Found {len(providers)} provider(s) without GPU info\n")

    if not providers:
        print("✅ All providers have GPU info. Nothing to send.")
        return

    sent = 0
    failed = 0
    for p in providers:
        email    = p["email"]
        name     = p["name"] or "Provider"
        api_key  = p["api_key"] or "dc1-provider-test"
        setup_url = f"{DC1_API_BASE}/api/providers/setup?key={api_key}"

        print(f"📧 {name} <{email}>")
        print(f"   Setup URL: {setup_url}")

        subject, html = make_email(name, setup_url)
        ok = send_email(email, subject, html, dry_run=args.dry_run)
        if ok:
            sent += 1
        else:
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"✅ Sent: {sent}  |  ❌ Failed: {failed}  |  Total: {len(providers)}")
    if args.dry_run:
        print("\nRun without --dry-run to actually send.")


if __name__ == "__main__":
    main()
