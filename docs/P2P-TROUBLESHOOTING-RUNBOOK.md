# P2P Network Troubleshooting Runbook

**Status:** Phase 1 Production Support Reference
**Purpose:** Quick resolution guide for P2P issues during and after launch
**Audience:** Operators, DevOps, Support Engineers, SREs
**Created:** 2026-03-23
**Last Updated:** 2026-03-23

---

## Quick Diagnosis Tree

```
P2P Issue Detected
    ↓
Is heartbeat endpoint responding? (HTTP 200)
    ├─ NO → Go to: HEARTBEAT ENDPOINT FAILURES
    ├─ YES: Is provider peer ID being stored?
    │       ├─ NO → Go to: PEER ID NOT STORING
    │       ├─ YES: Are providers discoverable via DHT?
    │               ├─ NO → Go to: DHT DISCOVERY FAILURES
    │               ├─ YES: Is bootstrap node stable?
    │                       ├─ NO → Go to: BOOTSTRAP NODE ISSUES
    │                       ├─ YES: P2P working normally
```

---

## Category 1: HEARTBEAT ENDPOINT FAILURES

### Issue 1.1: Heartbeat Returns HTTP 403 (Unapproved Provider)

**Symptoms:**
```
HTTP 403: Provider is not approved yet
```

**Root Cause:**
- Provider approval_status is `pending` or `rejected`, not `approved`
- Production mode (not test mode)
- Backend ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT flag not set

**Resolution (2 minutes):**

```bash
# Option A: Approve provider in database
sqlite3 /path/to/dcp.db \
  "UPDATE providers SET approval_status='approved' WHERE api_key='pk_xxx';"

# Option B: Enable test mode for this provider (dev only)
export ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT=1
pm2 restart dc1-provider-onboarding

# Verify
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -d '{"api_key":"pk_xxx","gpu_status":{"status":"online"}}'
# Should return HTTP 200
```

**Prevention:**
- Approve all providers before launch day
- Use ALLOW_UNAPPROVED_PROVIDER_HEARTBEAT only in dev/test environments

---

### Issue 1.2: Heartbeat Returns HTTP 401 (Invalid Key)

**Symptoms:**
```
HTTP 401: Invalid API key
```

**Root Cause:**
- Provider API key doesn't exist in database
- Typo in API key
- Provider record deleted

**Resolution (5 minutes):**

```bash
# Verify key exists
sqlite3 /path/to/dcp.db \
  "SELECT id, name, api_key FROM providers WHERE api_key='pk_xxx';"

# If empty, provider doesn't exist - create one
# If exists, verify key exactly matches

# Check for typos - look for similar keys
sqlite3 /path/to/dcp.db \
  "SELECT api_key FROM providers WHERE api_key LIKE 'pk_%' LIMIT 20;"

# Regenerate key if needed
sqlite3 /path/to/dcp.db \
  "UPDATE providers SET api_key='pk_newkey_12345' WHERE id=1;"
```

**Prevention:**
- Store API keys securely (secrets manager, not git)
- Test keys before deployment
- Use consistent key format validation

---

### Issue 1.3: Heartbeat Endpoint Returns 500 (Server Error)

**Symptoms:**
```
HTTP 500: Internal Server Error
```

**Root Cause:**
- Backend service crashed or not running
- Database connection failed
- P2P DHT announcement service crashed

**Resolution (5 minutes):**

```bash
# Check backend service status
pm2 status dc1-provider-onboarding

# If not running, start it
pm2 start ecosystem.config.js --only dc1-provider-onboarding

# Check logs for errors
pm2 logs dc1-provider-onboarding | grep -i "error\|fail" | tail -20

# Check database connectivity
sqlite3 /path/to/dcp.db "SELECT COUNT(*) FROM providers;"

# If database error, restart backend
pm2 restart dc1-provider-onboarding

# Test again
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -d '{"api_key":"pk_xxx"}'
```

**Prevention:**
- Monitor backend service: `watch -n 5 'pm2 status'`
- Set up alerting for crashed services
- Regular database backups

---

### Issue 1.4: Heartbeat Accepted But No P2P Announcement Logs

**Symptoms:**
- HTTP 200 response ✓
- But no P2P logs in backend
- Provider not appearing in DHT

**Root Cause:**
- P2P discovery service not initialized
- announceFromProviderHeartbeat() function disabled/commented
- Network connectivity to bootstrap node lost

**Resolution (10 minutes):**

```bash
# Check if P2P discovery service is loaded
grep -n "announceFromProviderHeartbeat" \
  backend/src/routes/providers.js | head -5

# Should show lines 26, 813+

# Check if service code is commented out (line 812-824)
sed -n '812,824p' backend/src/routes/providers.js | grep -i "comment\|//"

# If commented, uncomment it and restart
pm2 restart dc1-provider-onboarding

# Check logs for P2P initialization
pm2 logs dc1-provider-onboarding | grep -i "p2p\|discovery" | head -10

# If no P2P logs appear at all, service might not be loading
# Check npm dependencies
cd backend
npm list | grep p2p

# If missing, reinstall
npm install
pm2 restart dc1-provider-onboarding
```

**Prevention:**
- Don't comment out P2P code for debugging
- Use feature flags instead
- Code review to catch P2P disabling

---

## Category 2: PEER ID NOT STORING

### Issue 2.1: Provider Has No p2p_peer_id in Database

**Symptoms:**
```sql
SELECT p2p_peer_id FROM providers WHERE api_key='pk_xxx';
-- Result: NULL
```

**Root Cause:**
- Provider heartbeat doesn't include peer_id field
- Provider daemon not sending peer_id
- Database column doesn't exist

**Resolution (5 minutes):**

```bash
# Check database schema
sqlite3 /path/to/dcp.db ".schema providers" | grep p2p_peer_id

# If column missing, add it (database migration)
sqlite3 /path/to/dcp.db \
  "ALTER TABLE providers ADD COLUMN p2p_peer_id TEXT;"

# Test heartbeat with peer_id field
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "api_key":"pk_xxx",
    "peer_id":"12D3KooWE55RVrViP9VZRDTnE6nav8ubuCcFmGV8Kxg3HHQWRzkh",
    "gpu_status":{"status":"online"}
  }'

# Verify it's stored
sqlite3 /path/to/dcp.db \
  "SELECT p2p_peer_id FROM providers WHERE api_key='pk_xxx';"
```

**Provider Daemon Issue:**

If provider daemon not sending peer_id:

```bash
# Check provider daemon code
grep -n "peer_id\|emit_p2p_heartbeat" \
  backend/installers/dc1_daemon.py | head -10

# Verify peer_id is being generated
python3 backend/installers/dc1_daemon.py 2>&1 | grep -i "peer\|p2p" | head -5

# Check logs
tail -f /var/log/dc1_daemon.log | grep -i "peer_id\|announce"
```

**Prevention:**
- Ensure database schema migration is applied before launch
- Validate heartbeat includes peer_id in tests

---

## Category 3: DHT DISCOVERY FAILURES

### Issue 3.1: Providers Not Appearing in DHT

**Symptoms:**
- Heartbeat endpoint accepts requests ✓
- Peer ID is stored ✓
- But renters can't discover provider via DHT

**Root Cause:**
- Bootstrap node not running
- Provider can't reach bootstrap node (firewall/network)
- DHT protocol namespace mismatch

**Resolution (15 minutes):**

```bash
# Check bootstrap node is running
ssh root@76.13.179.86
pm2 status | grep bootstrap

# If not running, start it
pm2 start p2p/bootstrap.js --name dc1-p2p-bootstrap

# Check connectivity from provider machine
nc -zv 76.13.179.86 4001
# Should show "succeeded" or "open"

# If blocked, check firewall
ssh root@76.13.179.86
sudo ufw status
sudo ufw allow 4001/tcp

# Verify provider is using correct bootstrap address
grep -i "bootstrap" /path/to/provider/config

# Should match: /ip4/76.13.179.86/tcp/4001/p2p/...

# Test DHT query (from renter)
node -e "
  import { resolveHeartbeats } from './p2p/heartbeat-protocol.js'
  const results = await resolveHeartbeats(node, ['12D3KooWProvider...'])
  console.log(results)
"
```

**Prevention:**
- Start bootstrap node before launching providers
- Pre-test firewall rules
- Validate bootstrap address in all configurations

---

### Issue 3.2: DHT Query Timeout

**Symptoms:**
```
DHT query timeout after 30s
Provider exists but can't be queried
```

**Root Cause:**
- Bootstrap node unreachable
- Network latency too high
- DHT routing table empty

**Resolution (10 minutes):**

```bash
# Check bootstrap node reachability
ping 76.13.179.86

# Check network latency
mtr -r -c 10 76.13.179.86

# If latency > 500ms, investigate network path
traceroute 76.13.179.86

# Increase DHT query timeout (temporary)
export DCP_DHT_QUERY_TIMEOUT_MS=60000  # 60 seconds instead of 30

# Check bootstrap node routing table size
ssh root@76.13.179.86
pm2 logs dc1-p2p-bootstrap | grep "routing table size"

# If size is 0, bootstrap node has no peers connected
# Wait 30+ seconds for providers to connect
```

**Prevention:**
- Monitor network latency to bootstrap node
- Set up geographic redundancy for bootstrap nodes (Phase 2)

---

## Category 4: BOOTSTRAP NODE ISSUES

### Issue 4.1: Bootstrap Node Won't Start

**Symptoms:**
```
pm2 start p2p/bootstrap.js fails
Port already in use
```

**Root Cause:**
- Port 4001 already in use
- Node.js version incompatible
- Dependencies not installed

**Resolution (10 minutes):**

```bash
# Check port usage
lsof -i :4001
netstat -tlnp | grep 4001

# Kill existing process if needed
kill -9 $(lsof -t -i :4001)

# Check Node.js version
node --version
# Should be 18.x or higher

# Check dependencies
cd /home/node/dc1-platform/p2p
npm list | grep -i error

# If errors, reinstall
npm install

# Start bootstrap node
pm2 start bootstrap.js --name dc1-p2p-bootstrap

# Check logs
pm2 logs dc1-p2p-bootstrap | head -20
```

**Prevention:**
- Reserve port 4001 before launch
- Pre-test Node.js version requirements
- Test bootstrap startup in staging

---

### Issue 4.2: Bootstrap Node Crashes Frequently

**Symptoms:**
```
pm2 status shows "stopped" or "errored"
Log shows crashes every few minutes
```

**Root Cause:**
- Memory leak in bootstrap node
- Unhandled exception in peer connection handling
- Port conflicts after restart

**Resolution (15 minutes):**

```bash
# Check logs for error pattern
pm2 logs dc1-p2p-bootstrap --err | tail -50

# Common errors:
# - "EADDRINUSE": port still in use (restart helps)
# - "Out of memory": increase VM memory
# - "connection refused": network issue

# Increase PM2 log retention
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M

# Enable memory monitoring
pm2 start bootstrap.js --max-memory-restart 500M

# Restart with debug logging
pm2 restart dc1-p2p-bootstrap --update-env
DEBUG=* pm2 logs dc1-p2p-bootstrap
```

**Prevention:**
- Monitor bootstrap node memory usage
- Set memory limits on PM2
- Weekly restarts to clear memory

---

### Issue 4.3: Bootstrap Peer ID Changed After Restart

**Symptoms:**
```
Bootstrap restarts with different peer ID
Providers can't reconnect
DHT breaks
```

**Root Cause:**
- libp2p generates random peer ID each startup
- No persistent peer ID storage

**Solution (Phase 2):**

For Phase 1, use environment variable override:

```bash
# When bootstrap restarts, capture new peer ID
pm2 logs dc1-p2p-bootstrap | grep "Peer ID"
# Output: [Bootstrap] Peer ID  : 12D3KooW...NEW_PEER_ID

# Update configuration
export DCP_P2P_BOOTSTRAP='/ip4/76.13.179.86/tcp/4001/p2p/12D3KooW...NEW_PEER_ID'

# Restart backend to use new bootstrap address
pm2 restart dc1-provider-onboarding

# Notify all providers to update configuration
# Or redeploy provider daemon with updated env var
```

**Permanent Fix (Phase 2):**
- Implement persistent peer ID storage (key file in ~/.libp2p)
- Automate peer ID updates in CI/CD
- Use DNS-based bootstrap (dynamic peer ID resolution)

**Prevention:**
- Minimize bootstrap node restarts
- Plan maintenance windows
- Automate configuration updates

---

## Category 5: PROVIDER DAEMON ISSUES

### Issue 5.1: Provider Daemon Not Emitting Heartbeats

**Symptoms:**
```
Provider daemon running but no heartbeat logs
Backend shows no recent last_heartbeat
```

**Root Cause:**
- P2P_DISCOVERY_ENABLED not set
- Heartbeat thread not starting
- Bootstrap address misconfigured

**Resolution (10 minutes):**

```bash
# Check environment variables
printenv | grep -i "p2p\|heartbeat"

# Should show:
# P2P_DISCOVERY_ENABLED=true
# DEFAULT_HEARTBEAT_INTERVAL_MS=30000

# If missing, set and restart
export P2P_DISCOVERY_ENABLED=true
export DCP_P2P_BOOTSTRAP='/ip4/76.13.179.86/tcp/4001/p2p/...'

# Restart provider daemon
python3 /backend/installers/dc1_daemon.py

# Check logs for heartbeat emission
tail -f /var/log/dc1_daemon.log | grep -i "heartbeat\|p2p"

# Expected output every 30 seconds:
# P2P heartbeat emitted (seq=0), status=healthy
```

**Prevention:**
- Document all required environment variables
- Validate env vars at daemon startup
- Log env var initialization

---

### Issue 5.2: Provider Daemon Heartbeat Submission Fails

**Symptoms:**
```
Heartbeat emission shows error
curl tests work but daemon fails
```

**Root Cause:**
- Daemon has wrong API endpoint URL
- TLS/SSL certificate validation failing
- Daemon API key not set

**Resolution (10 minutes):**

```bash
# Check daemon configuration
grep -i "api.*url\|endpoint\|host" \
  /path/to/provider/config.env

# Should point to: https://api.dcp.sa

# Test connectivity from provider
curl -I https://api.dcp.sa/api/health
# Should return HTTP 200

# Check certificate validation
openssl s_client -connect api.dcp.sa:443 -showcerts

# If cert issue, update CA bundle
update-ca-certificates

# Check daemon API key
grep -i "api_key\|provider_key" /path/to/provider/config.env

# Test heartbeat manually
curl -X POST https://api.dcp.sa/api/providers/heartbeat \
  -d '{"api_key":"<daemon_key>","gpu_status":{"status":"online"}}'
```

**Prevention:**
- Pre-test daemon on staging with same config
- Validate certificates before launch
- Document all configuration parameters

---

## Category 6: MONITORING AND HEALTH CHECKS

### Real-Time P2P Health Dashboard

```bash
#!/bin/bash
# Monitor P2P health during launch

while true; do
  clear
  echo "=== DCP P2P Health Dashboard ==="
  echo "Time: $(date)"
  echo ""

  # Bootstrap node status
  echo "Bootstrap Node:"
  ssh root@76.13.179.86 "pm2 status | grep bootstrap"
  echo ""

  # Provider count
  echo "Online Providers (< 5min heartbeat):"
  sqlite3 /path/to/dcp.db \
    "SELECT COUNT(*) FROM providers WHERE status='online' AND last_heartbeat > datetime('now', '-5 minutes');"
  echo ""

  # Stale providers
  echo "Stale Providers (> 90s no heartbeat):"
  sqlite3 /path/to/dcp.db \
    "SELECT COUNT(*) FROM providers WHERE last_heartbeat < datetime('now', '-90 seconds') AND last_heartbeat IS NOT NULL;"
  echo ""

  # P2P peer ID coverage
  echo "Providers with Peer ID (DHT registered):"
  sqlite3 /path/to/dcp.db \
    "SELECT COUNT(*) FROM providers WHERE p2p_peer_id IS NOT NULL;"
  echo ""

  # Backend P2P logs (last 5 errors)
  echo "Recent P2P Errors:"
  pm2 logs dc1-provider-onboarding --err | grep -i "p2p\|announce" | tail -5
  echo ""

  sleep 10
done
```

### Critical Alerts

Set up monitoring for:
- Bootstrap node down (HTTP 500 from /api/health endpoint)
- No heartbeats received in 5 minutes
- > 50% of providers showing as offline
- P2P announcement failures > 10% of requests

---

## Escalation Path

1. **First Response (5 min):** Use Quick Diagnosis Tree above
2. **Check Runbook (10 min):** Follow resolution for matching issue
3. **Verify Fixes (5 min):** Test with validation script
4. **Escalate (if needed):**
   - P2P issues → P2P Network Engineer
   - Backend issues → Backend Engineer
   - Infrastructure issues → DevOps / SRE

---

## Reference Documents

- **Configuration:** `docs/P2P-OPERATOR-CONFIG-GUIDE.md`
- **Deployment:** `docs/P2P-BOOTSTRAP-DEPLOYMENT.md`
- **E2E Support:** `docs/P2P-E2E-SMOKE-TEST-GUIDE.md`
- **Status:** `docs/P2P-STATUS-PHASE-1.md`
- **Validation:** `scripts/validate-p2p-setup.sh`

---

## Contact

- **P2P Network Engineer:** Agent 5978b3b2-af54-4650-8443-db0a105fc385
- **On-Call SRE:** See `/etc/on-call-schedule.txt`
- **Slack:** #dcp-p2p-support

---

*Last Updated: 2026-03-23 10:45 UTC*
*For Phase 1 Production Launch*
