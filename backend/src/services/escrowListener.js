'use strict';

/**
 * Escrow Event Listener — DCP-858 / DCP-903
 *
 * Polls the Base Sepolia Escrow contract for on-chain settlement events and
 * reconciles them with the off-chain payment ledger (SQLite).
 *
 * Activated only when ESCROW_ENABLED=true (env var). Safe to import at any
 * time — if disabled, all public methods are no-ops and return immediately.
 *
 * Events handled:
 *   Claimed(jobId, provider, providerAmount, feeAmount)
 *     → updates payment_events.escrow_tx_hash + payment_events.settled_at
 *     → marks matching payout_requests as 'processing' (awaiting admin confirm)
 *
 *   Cancelled(jobId, renter, amount)
 *     → logs the on-chain cancellation for audit purposes
 *
 *   PaymentReleased(jobId, provider, amount) — DCP-903 bridge event
 *     → marks matching job as 'payment_released' in jobs table
 *     → creates a payout_request record for the provider
 *
 *   DisputeRaised(jobId, renter) — DCP-903 bridge event
 *     → marks matching job as 'disputed' in jobs table
 *     → writes an alert to admin_alerts table for ops review
 *
 *   PayoutReleased(provider, amount) — future event, stub ready
 *     → marks provider payout record as confirmed when contract supports it
 *
 * Block cursor: persisted in escrow_listener_cursor table so the listener
 * resumes from where it left off across restarts.
 *
 * Usage:
 *   const listener = require('./escrowListener');
 *   listener.start();    // start polling loop
 *   listener.stop();     // graceful shutdown
 *   listener.runOnce();  // single pass (for tests / CI)
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ── ethers graceful fallback ─────────────────────────────────────────────────
let ethers;
try {
  ethers = require('ethers');
} catch (_) {
  try {
    ethers = require('../../../contracts/node_modules/ethers');
    console.warn('[escrow-listener] using ethers from contracts/node_modules');
  } catch (__) {
    console.warn('[escrow-listener] ethers not installed — escrow listener disabled');
  }
}

// ── ABI ──────────────────────────────────────────────────────────────────────
const ESCROW_ABI_PATH = path.resolve(__dirname, '../../../contracts/abis/Escrow.json');

function loadEscrowAbi() {
  if (!fs.existsSync(ESCROW_ABI_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(ESCROW_ABI_PATH, 'utf8'));
    return parsed.abi || null;
  } catch (err) {
    console.error('[escrow-listener] failed to parse Escrow ABI:', err.message);
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS     = 15_000;   // poll every 15 s (≈ 1 Base Sepolia block)
const BLOCK_CHUNK_SIZE     = 500;      // max blocks per getLogs call
const CONFIRMATION_BLOCKS  = 2;        // wait 2 blocks before treating event as final
const CURSOR_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS escrow_listener_cursor (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    last_block  INTEGER NOT NULL DEFAULT 0,
    updated_at  TEXT    NOT NULL
  )
`;
const PAYOUT_TX_COL_SQL = `
  ALTER TABLE payout_requests ADD COLUMN escrow_tx_hash TEXT
`;
const ADMIN_ALERTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS admin_alerts (
    id          TEXT PRIMARY KEY,
    alert_type  TEXT NOT NULL,
    job_id      TEXT,
    payload     TEXT,
    created_at  TEXT NOT NULL
  )
`;

// ── Module state ──────────────────────────────────────────────────────────────
let _timer    = null;
let _running  = false;
let _provider = null;
let _contract = null;
let _db       = null;

// ── Enabled check ─────────────────────────────────────────────────────────────
function isEnabled() {
  return !!(
    ethers &&
    process.env.ESCROW_ENABLED === 'true' &&
    process.env.ESCROW_CONTRACT_ADDRESS
  );
}

// ── DB bootstrap ─────────────────────────────────────────────────────────────
function ensureSchema(db) {
  db.exec(CURSOR_TABLE_SQL);

  // Add escrow_tx_hash to payout_requests if missing (idempotent).
  try {
    db.exec(PAYOUT_TX_COL_SQL);
  } catch (_) {
    // Column already exists — sqlite throws on duplicate ADD COLUMN
  }

  // Ensure admin_alerts table exists for DisputeRaised events.
  db.exec(ADMIN_ALERTS_TABLE_SQL);

  const row = db.prepare('SELECT id FROM escrow_listener_cursor WHERE id = 1').get();
  if (!row) {
    db.prepare(
      "INSERT INTO escrow_listener_cursor (id, last_block, updated_at) VALUES (1, 0, ?)"
    ).run(new Date().toISOString());
  }
}

function getLastBlock(db) {
  const row = db.prepare('SELECT last_block FROM escrow_listener_cursor WHERE id = 1').get();
  return row ? Number(row.last_block) : 0;
}

function saveLastBlock(db, blockNumber) {
  db.prepare(
    'UPDATE escrow_listener_cursor SET last_block = ?, updated_at = ? WHERE id = 1'
  ).run(blockNumber, new Date().toISOString());
}

// ── Event handlers ────────────────────────────────────────────────────────────

/**
 * Handle Claimed(jobId bytes32, provider address, providerAmount uint256, feeAmount uint256)
 *
 * This fires when a provider successfully claims their locked funds on-chain.
 * We treat it as equivalent to a "JobSettled" confirmation — the escrow for
 * that job is now finalised on-chain.
 */
function handleClaimed(db, log, contract) {
  try {
    const parsed = contract.interface.parseLog(log);
    const jobId32       = parsed.args[0];                     // bytes32
    const providerAddr  = parsed.args[1];                     // address
    const providerAmt   = parsed.args[2].toString();          // uint256 (USDC micro-units)
    const txHash        = log.transactionHash;
    const blockTs       = new Date().toISOString();           // approximate; replace with block.timestamp if needed

    // Reverse the keccak jobId bytes32 → we store the original DC1 job_id in
    // payment_events. The escrow contract hashes with keccak256(utf8(jobId)),
    // so we cannot reverse — instead match by scanning for the same hash.
    const jobId32Lower = jobId32.toLowerCase();

    // Update payment_events rows that share this on-chain jobId hash.
    // escrow-chain.js stores _toBytes32(jobId) = keccak256(utf8(jobId)) as the
    // contract key; we replicate the same logic here to find the matching row.
    // Because payment_events.job_id is the original DC1 string, we must hash
    // each candidate or store the bytes32 key on insert. For now we update all
    // unsettled rows whose keccak256 hash matches jobId32.
    //
    // Practical approach: scan unsettled payment_events and match by hash.
    const unsettled = db.prepare(
      'SELECT id, job_id FROM payment_events WHERE escrow_tx_hash IS NULL AND settled_at IS NULL LIMIT 200'
    ).all();

    let matched = false;
    for (const row of unsettled) {
      const candidate32 = ethers.keccak256(ethers.toUtf8Bytes(row.job_id)).toLowerCase();
      if (candidate32 === jobId32Lower) {
        db.prepare(
          'UPDATE payment_events SET escrow_tx_hash = ?, settled_at = ? WHERE id = ?'
        ).run(txHash, blockTs, row.id);
        matched = true;
        console.log(`[escrow-listener] Claimed: payment_event=${row.id} job=${row.job_id} tx=${txHash}`);
        break;
      }
    }

    if (!matched) {
      console.warn(`[escrow-listener] Claimed: no payment_event found for jobId32=${jobId32} tx=${txHash}`);
    }

    // Mark any pending payout_requests for this provider as 'processing'.
    // This signals that on-chain settlement has occurred and admin can confirm.
    db.prepare(`
      UPDATE payout_requests
      SET status = 'processing', escrow_tx_hash = ?
      WHERE provider_id IN (
        SELECT id FROM providers WHERE eth_address = ? AND deleted_at IS NULL
      )
      AND status = 'pending'
    `).run(txHash, providerAddr.toLowerCase());

    console.log(`[escrow-listener] Claimed provider=${providerAddr} amount=${providerAmt} tx=${txHash}`);
  } catch (err) {
    console.error('[escrow-listener] handleClaimed error:', err.message);
  }
}

/**
 * Handle Cancelled(jobId bytes32, renter address, amount uint256)
 *
 * Fired when an expired or failed escrow is cancelled on-chain.
 * Logs for audit; no balance adjustments needed (already handled off-chain).
 */
function handleCancelled(db, log, contract) {
  try {
    const parsed   = contract.interface.parseLog(log);
    const jobId32  = parsed.args[0];
    const renter   = parsed.args[1];
    const amount   = parsed.args[2].toString();
    const txHash   = log.transactionHash;
    console.log(`[escrow-listener] Cancelled: jobId32=${jobId32} renter=${renter} amount=${amount} tx=${txHash}`);
    // Future: write to an audit log table or set a 'cancelled' flag on payment_events
  } catch (err) {
    console.error('[escrow-listener] handleCancelled error:', err.message);
  }
}

/**
 * Handle PayoutReleased(provider address, amount uint256)
 *
 * Stub — this event does not exist in the current Escrow.sol ABI but is
 * planned for a future contract upgrade that supports direct provider payouts.
 * When the contract adds this event, wire its topic hash here.
 *
 * When active: marks the corresponding payout_requests row as 'paid' and
 * records the on-chain tx_hash.
 */
function handlePayoutReleased(db, txHash, providerAddr, amountWei) {
  try {
    // Find the most recent 'processing' payout for this provider address.
    const payout = db.prepare(`
      SELECT pr.id FROM payout_requests pr
      JOIN providers p ON p.id = pr.provider_id
      WHERE LOWER(p.eth_address) = LOWER(?)
        AND pr.status = 'processing'
      ORDER BY pr.requested_at DESC
      LIMIT 1
    `).get(providerAddr);

    if (!payout) {
      console.warn(`[escrow-listener] PayoutReleased: no processing payout for ${providerAddr} tx=${txHash}`);
      return;
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE payout_requests
      SET status = 'paid', processed_at = ?, escrow_tx_hash = ?, payment_ref = ?
      WHERE id = ?
    `).run(now, txHash, `on-chain:${txHash}`, payout.id);

    console.log(`[escrow-listener] PayoutReleased: payout_id=${payout.id} provider=${providerAddr} tx=${txHash}`);
  } catch (err) {
    console.error('[escrow-listener] handlePayoutReleased error:', err.message);
  }
}

/**
 * Handle PaymentReleased(jobId bytes32, provider address, amount uint256) — DCP-903
 *
 * Emitted when the escrow settles payment to a provider for a completed job.
 * This is the primary "job done, money moved" confirmation event.
 *
 * Actions:
 *   1. Marks the matching job row as `payment_released` in the jobs table.
 *   2. Creates a `payout_request` record for the provider so the admin
 *      can confirm off-chain disbursement.
 */
function handlePaymentReleased(db, log, contract) {
  try {
    const parsed       = contract.interface.parseLog(log);
    const jobId32      = parsed.args[0].toLowerCase();
    const providerAddr = parsed.args[1];
    const amount       = parsed.args[2].toString();
    const txHash       = log.transactionHash;
    const now          = new Date().toISOString();

    // Find the matching job by scanning and comparing keccak256 hashes.
    const candidateJobs = db.prepare(
      "SELECT id, job_id, provider_id FROM jobs WHERE status NOT IN ('payment_released', 'cancelled') LIMIT 200"
    ).all();

    let matchedJob = null;
    for (const row of candidateJobs) {
      const candidate32 = ethers.keccak256(ethers.toUtf8Bytes(row.job_id)).toLowerCase();
      if (candidate32 === jobId32) {
        matchedJob = row;
        break;
      }
    }

    if (!matchedJob) {
      console.warn(`[escrow-listener] PaymentReleased: no matching job for jobId32=${jobId32} tx=${txHash}`);
    } else {
      db.prepare("UPDATE jobs SET status = 'payment_released' WHERE id = ?").run(matchedJob.id);
      console.log(`[escrow-listener] PaymentReleased: job=${matchedJob.job_id} status→payment_released tx=${txHash}`);
    }

    // Look up provider by eth_address to get provider_id.
    const provider = db.prepare(
      'SELECT id FROM providers WHERE LOWER(eth_address) = LOWER(?) AND deleted_at IS NULL LIMIT 1'
    ).get(providerAddr);

    if (!provider) {
      console.warn(`[escrow-listener] PaymentReleased: no provider found for address=${providerAddr} tx=${txHash}`);
      return;
    }

    // Create a payout_request for the provider (USDC 6 decimals → SAR at 3.75 rate).
    const amountUsd    = Number(amount) / 1_000_000;
    const amountSar    = amountUsd * 3.75;
    const amountHalala = Math.round(amountSar * 100);
    const payoutId     = randomUUID();

    db.prepare(`
      INSERT INTO payout_requests
        (id, provider_id, amount_usd, amount_sar, amount_halala, status, requested_at, escrow_tx_hash)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(payoutId, provider.id, amountUsd, amountSar, amountHalala, now, txHash);

    console.log(
      `[escrow-listener] PaymentReleased: payout_request=${payoutId} provider=${providerAddr} amount=${amount} tx=${txHash}`
    );
  } catch (err) {
    console.error('[escrow-listener] handlePaymentReleased error:', err.message);
  }
}

/**
 * Handle DisputeRaised(jobId bytes32, renter address) — DCP-903
 *
 * Emitted when a renter raises an on-chain dispute against a completed job.
 *
 * Actions:
 *   1. Marks the matching job row as `disputed` in the jobs table.
 *   2. Writes an admin alert to the `admin_alerts` table so the ops team
 *      is notified for manual review.
 */
function handleDisputeRaised(db, log, contract) {
  try {
    const parsed     = contract.interface.parseLog(log);
    const jobId32    = parsed.args[0].toLowerCase();
    const renterAddr = parsed.args[1];
    const txHash     = log.transactionHash;
    const now        = new Date().toISOString();

    // Find the matching job by scanning and comparing keccak256 hashes.
    const candidateJobs = db.prepare(
      "SELECT id, job_id FROM jobs WHERE status NOT IN ('disputed', 'cancelled') LIMIT 200"
    ).all();

    let matchedJobId = null;
    for (const row of candidateJobs) {
      const candidate32 = ethers.keccak256(ethers.toUtf8Bytes(row.job_id)).toLowerCase();
      if (candidate32 === jobId32) {
        db.prepare("UPDATE jobs SET status = 'disputed' WHERE id = ?").run(row.id);
        matchedJobId = row.job_id;
        console.log(`[escrow-listener] DisputeRaised: job=${row.job_id} status→disputed tx=${txHash}`);
        break;
      }
    }

    if (!matchedJobId) {
      console.warn(`[escrow-listener] DisputeRaised: no matching job for jobId32=${jobId32} tx=${txHash}`);
    }

    // Write admin alert regardless — disputes always need ops attention.
    const alertId = randomUUID();
    const payload = JSON.stringify({ jobId32, renter: renterAddr, txHash, matchedJobId });
    db.prepare(
      'INSERT INTO admin_alerts (id, alert_type, job_id, payload, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(alertId, 'dispute_raised', matchedJobId, payload, now);

    console.log(`[escrow-listener] DisputeRaised: alert=${alertId} renter=${renterAddr} tx=${txHash}`);
  } catch (err) {
    console.error('[escrow-listener] handleDisputeRaised error:', err.message);
  }
}

// ── Core poll loop ────────────────────────────────────────────────────────────

/**
 * Fetch and process all new escrow events from `fromBlock` to `toBlock`.
 */
async function processBlockRange(fromBlock, toBlock) {
  if (fromBlock > toBlock) return;

  // Fetch all logs from the contract in this range.
  const filter = { address: _contract.target, fromBlock, toBlock };
  const logs   = await _provider.getLogs(filter);

  if (logs.length === 0) return;

  const iface = _contract.interface;

  // Topic hashes for events we care about.
  const CLAIMED_TOPIC          = iface.getEvent('Claimed').topicHash;
  const CANCELLED_TOPIC        = iface.getEvent('Cancelled').topicHash;
  const PAYMENT_RELEASED_TOPIC = iface.getEvent('PaymentReleased').topicHash;
  const DISPUTE_RAISED_TOPIC   = iface.getEvent('DisputeRaised').topicHash;
  // PayoutReleased topic — not in current ABI; placeholder for future contract.
  const PAYOUT_TOPIC           = process.env.PAYOUT_RELEASED_TOPIC || null;

  for (const log of logs) {
    const topic0 = log.topics[0];
    if (topic0 === CLAIMED_TOPIC) {
      handleClaimed(_db, log, _contract);
    } else if (topic0 === CANCELLED_TOPIC) {
      handleCancelled(_db, log, _contract);
    } else if (topic0 === PAYMENT_RELEASED_TOPIC) {
      handlePaymentReleased(_db, log, _contract);
    } else if (topic0 === DISPUTE_RAISED_TOPIC) {
      handleDisputeRaised(_db, log, _contract);
    } else if (PAYOUT_TOPIC && topic0 === PAYOUT_TOPIC) {
      // Decode manually: PayoutReleased(address indexed provider, uint256 amount)
      const providerAddr = ethers.AbiCoder.defaultAbiCoder()
        .decode(['address'], log.topics[1])[0];
      const amountWei    = ethers.AbiCoder.defaultAbiCoder()
        .decode(['uint256'], log.data)[0];
      handlePayoutReleased(_db, log.transactionHash, providerAddr, amountWei.toString());
    }
  }
}

/**
 * Single poll pass: determine block range, chunk getLogs calls, save cursor.
 */
async function poll() {
  try {
    const latestBlock   = Number(await _provider.getBlockNumber());
    const safeBlock     = Math.max(0, latestBlock - CONFIRMATION_BLOCKS);
    let   fromBlock     = getLastBlock(_db);

    if (fromBlock === 0) {
      // First run — start listening from ESCROW_LISTENER_START_BLOCK or safeBlock
      fromBlock = Number(process.env.ESCROW_LISTENER_START_BLOCK || safeBlock);
      console.log(`[escrow-listener] first run, starting from block ${fromBlock}`);
    } else {
      fromBlock = fromBlock + 1;
    }

    if (fromBlock > safeBlock) return; // nothing new yet

    // Process in chunks to avoid getLogs range limits.
    let cursor = fromBlock;
    while (cursor <= safeBlock) {
      const end = Math.min(cursor + BLOCK_CHUNK_SIZE - 1, safeBlock);
      await processBlockRange(cursor, end);
      saveLastBlock(_db, end);
      cursor = end + 1;
    }
  } catch (err) {
    console.error('[escrow-listener] poll error:', err.message);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start the escrow event listener polling loop.
 *
 * @param {object} db - better-sqlite3 db handle (or compatible wrapper with .prepare/.exec)
 */
function start(db) {
  if (!isEnabled()) {
    console.log('[escrow-listener] disabled (ESCROW_ENABLED != true or contract address missing)');
    return;
  }
  if (_running) {
    console.warn('[escrow-listener] already running');
    return;
  }

  const abi = loadEscrowAbi();
  if (!abi) {
    console.error('[escrow-listener] could not load Escrow ABI — aborting');
    return;
  }

  const rpcUrl = process.env.BASE_RPC_URL || 'https://sepolia.base.org';
  _provider = new ethers.JsonRpcProvider(rpcUrl);
  _contract = new ethers.Contract(process.env.ESCROW_CONTRACT_ADDRESS, abi, _provider);
  _db       = db;
  _running  = true;

  ensureSchema(_db);

  console.log(
    `[escrow-listener] started — contract=${process.env.ESCROW_CONTRACT_ADDRESS} rpc=${rpcUrl} poll=${POLL_INTERVAL_MS}ms`
  );

  // Run immediately, then on interval.
  poll().then(() => {
    if (_running) {
      _timer = setInterval(poll, POLL_INTERVAL_MS);
    }
  });
}

/**
 * Stop the polling loop gracefully.
 */
function stop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _running = false;
  console.log('[escrow-listener] stopped');
}

/**
 * Run a single poll pass (useful for tests and CI smoke checks).
 * Does NOT start the interval loop. Requires start() to have been called first,
 * OR accepts explicit db + contractAddress overrides.
 *
 * @param {object} [opts]
 * @param {object} [opts.db]               - db handle (uses module state if omitted)
 * @param {string} [opts.contractAddress]  - override contract address
 * @param {string} [opts.rpcUrl]           - override RPC URL
 * @returns {Promise<void>}
 */
async function runOnce(opts = {}) {
  if (!isEnabled() && !opts.contractAddress) {
    console.log('[escrow-listener] runOnce: disabled and no override — skipping');
    return;
  }

  const abi = loadEscrowAbi();
  if (!abi) throw new Error('Could not load Escrow ABI');

  const rpcUrl    = opts.rpcUrl    || process.env.BASE_RPC_URL || 'https://sepolia.base.org';
  const address   = opts.contractAddress || process.env.ESCROW_CONTRACT_ADDRESS;
  const db        = opts.db || _db;

  if (!db) throw new Error('runOnce: db handle required');

  _provider = new ethers.JsonRpcProvider(rpcUrl);
  _contract = new ethers.Contract(address, abi, _provider);
  _db       = db;

  ensureSchema(_db);
  await poll();
}

module.exports = {
  isEnabled,
  start,
  stop,
  runOnce,
  // Exported for unit testing only:
  _handleClaimed:         handleClaimed,
  _handleCancelled:       handleCancelled,
  _handlePayoutReleased:  handlePayoutReleased,
  _handlePaymentReleased: handlePaymentReleased,
  _handleDisputeRaised:   handleDisputeRaised,
};
