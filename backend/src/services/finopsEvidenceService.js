const DEFAULT_CANDIDATE_LIMIT = 200;

function tableExists(db, tableName) {
  try {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
    return Boolean(row);
  } catch (_) {
    return false;
  }
}

function safeGet(db, sql, params = []) {
  try {
    return db.prepare(sql).get(...params);
  } catch (_) {
    return null;
  }
}

function safeAll(db, sql, params = []) {
  try {
    return db.prepare(sql).all(...params);
  } catch (_) {
    return [];
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
}

function chooseTopupCredit(credits, debitCreatedAt) {
  if (!Array.isArray(credits) || credits.length === 0) return null;
  if (!debitCreatedAt) return credits[0] || null;
  const debitTs = new Date(debitCreatedAt).getTime();
  const eligible = credits.filter((credit) => {
    const ts = new Date(credit.created_at || '').getTime();
    return Number.isFinite(ts) && ts <= debitTs;
  });
  return eligible[0] || credits[0] || null;
}

function scoreCandidate(candidate) {
  let score = 0;
  if (candidate.job) score += 2;
  if (candidate.payment) score += 3;
  if (candidate.jobDebitLedgerEntry) score += 2;
  if (candidate.topupLedgerEntry) score += 1;
  if (candidate.billingRecord) score += 2;
  if (candidate.jobSettlement) score += 1;
  if (candidate.payment && candidate.payment.status === 'paid') score += 2;
  return score;
}

function fetchCandidateForJob(db, capabilities, job) {
  const candidate = {
    job,
    jobSettlement: null,
    billingRecord: null,
    jobDebitLedgerEntry: null,
    topupLedgerEntry: null,
    payment: null,
    score: 0,
  };

  if (capabilities.job_settlements) {
    candidate.jobSettlement = safeGet(
      db,
      `SELECT id, job_id, provider_id, renter_id, duration_seconds, gpu_rate_per_second,
              gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at
         FROM job_settlements
        WHERE job_id = ?`,
      [job.job_id]
    );
  }

  if (capabilities.billing_records) {
    candidate.billingRecord = safeGet(
      db,
      `SELECT id, job_id, renter_id, provider_id, model_id, token_count, duration_ms, gross_cost_halala,
              platform_fee_halala, provider_earning_halala, currency, status, created_at, updated_at
         FROM billing_records
        WHERE job_id = ?`,
      [job.job_id]
    );
  }

  if (capabilities.renter_credit_ledger) {
    candidate.jobDebitLedgerEntry = safeGet(
      db,
      `SELECT id, renter_id, amount_halala, direction, source, job_id, payment_ref, note, created_at
         FROM renter_credit_ledger
        WHERE renter_id = ?
          AND job_id = ?
          AND direction = 'debit'
        ORDER BY created_at ASC
        LIMIT 1`,
      [job.renter_id, job.job_id]
    );

    const creditEntries = safeAll(
      db,
      `SELECT id, renter_id, amount_halala, direction, source, job_id, payment_ref, note, created_at
         FROM renter_credit_ledger
        WHERE renter_id = ?
          AND direction = 'credit'
          AND source IN ('topup', 'admin_topup', 'manual_adjustment')
        ORDER BY created_at DESC
        LIMIT 20`,
      [job.renter_id]
    );
    candidate.topupLedgerEntry = chooseTopupCredit(creditEntries, candidate.jobDebitLedgerEntry?.created_at || null);
  }

  if (capabilities.payments) {
    if (candidate.topupLedgerEntry?.payment_ref) {
      candidate.payment = safeGet(
        db,
        `SELECT id, payment_id, moyasar_id, renter_id, amount_sar, amount_halala, status, source_type,
                payment_method, description, created_at, confirmed_at, refunded_at
           FROM payments
          WHERE renter_id = ?
            AND (payment_id = ? OR moyasar_id = ?)
          ORDER BY COALESCE(confirmed_at, created_at) DESC
          LIMIT 1`,
        [job.renter_id, candidate.topupLedgerEntry.payment_ref, candidate.topupLedgerEntry.payment_ref]
      );
    }

    if (!candidate.payment) {
      const checkpointTs = candidate.jobDebitLedgerEntry?.created_at || job.completed_at || job.started_at || job.created_at;
      candidate.payment = safeGet(
        db,
        `SELECT id, payment_id, moyasar_id, renter_id, amount_sar, amount_halala, status, source_type,
                payment_method, description, created_at, confirmed_at, refunded_at
           FROM payments
          WHERE renter_id = ?
            AND (? IS NULL OR COALESCE(confirmed_at, created_at) <= ?)
          ORDER BY COALESCE(confirmed_at, created_at) DESC
          LIMIT 1`,
        [job.renter_id, checkpointTs, checkpointTs]
      );
    }
  }

  candidate.score = scoreCandidate(candidate);
  return candidate;
}

function deriveMeteringRecord(candidate) {
  if (candidate.billingRecord) {
    return {
      source_table: 'billing_records',
      usage_units: {
        token_count: candidate.billingRecord.token_count,
        duration_ms: candidate.billingRecord.duration_ms,
      },
      pricing_key: candidate.billingRecord.model_id || candidate.job.model || candidate.job.job_type || null,
      currency: candidate.billingRecord.currency || 'SAR',
      computed_amount_halala: candidate.billingRecord.gross_cost_halala,
      status: candidate.billingRecord.status || null,
      timestamps: {
        created_at: candidate.billingRecord.created_at || null,
        updated_at: candidate.billingRecord.updated_at || null,
      },
    };
  }

  if (candidate.jobSettlement) {
    return {
      source_table: 'job_settlements',
      usage_units: {
        duration_seconds: candidate.jobSettlement.duration_seconds,
      },
      pricing_key: candidate.job.job_type || candidate.job.model || null,
      currency: 'SAR',
      computed_amount_halala: candidate.jobSettlement.gross_amount_halala,
      status: candidate.jobSettlement.status || null,
      timestamps: {
        settled_at: candidate.jobSettlement.settled_at || null,
      },
      notes: ['Currency inferred as SAR because job_settlements has no explicit currency column.'],
    };
  }

  if (candidate.job?.cost_halala != null) {
    return {
      source_table: 'jobs',
      usage_units: {
        duration_minutes: candidate.job.duration_minutes || null,
      },
      pricing_key: candidate.job.model || candidate.job.job_type || null,
      currency: 'SAR',
      computed_amount_halala: candidate.job.cost_halala,
      status: candidate.job.status || null,
      timestamps: {
        started_at: candidate.job.started_at || null,
        completed_at: candidate.job.completed_at || null,
      },
      notes: ['Computed amount taken from jobs.cost_halala because no billing_records/job_settlements row was found.'],
    };
  }

  return null;
}

function deriveLedgerPostings(candidate) {
  const postings = [];
  if (candidate.topupLedgerEntry) {
    postings.push({
      posting_id: candidate.topupLedgerEntry.id,
      entry_type: 'credit',
      source: candidate.topupLedgerEntry.source,
      amount_halala: candidate.topupLedgerEntry.amount_halala,
      debit_account: 'external_payment_gateway',
      credit_account: 'renter_wallet_halala',
      payment_reference: candidate.topupLedgerEntry.payment_ref || null,
      created_at: candidate.topupLedgerEntry.created_at || null,
      settlement_status: candidate.payment?.status || null,
      inferred_accounts: true,
    });
  }

  if (candidate.jobDebitLedgerEntry) {
    postings.push({
      posting_id: candidate.jobDebitLedgerEntry.id,
      entry_type: 'debit',
      source: candidate.jobDebitLedgerEntry.source,
      amount_halala: candidate.jobDebitLedgerEntry.amount_halala,
      debit_account: 'renter_wallet_halala',
      credit_account: 'compute_revenue_pending_settlement',
      payment_reference: candidate.jobDebitLedgerEntry.payment_ref || null,
      job_id: candidate.jobDebitLedgerEntry.job_id || null,
      created_at: candidate.jobDebitLedgerEntry.created_at || null,
      settlement_status: candidate.jobSettlement?.status || candidate.billingRecord?.status || candidate.job?.status || null,
      inferred_accounts: true,
    });
  }

  return postings;
}

function collectMissingLinkages(capabilities, candidate) {
  const missing = [];
  const add = (table, field, message, recommendedFix) => {
    missing.push({ table, field, message, recommended_fix: recommendedFix });
  };

  if (!capabilities.job_settlements) {
    add(
      'job_settlements',
      'table',
      'Table is missing in this database; settlement-level gross/platform/provider split cannot be verified.',
      'Run settlementService.ensureSchema(db) during boot or add CREATE TABLE migration for job_settlements in backend/src/db.js.'
    );
  }

  if (!candidate.job?.job_id) {
    add('jobs', 'job_id', 'Job identifier is missing, so end-to-end joins cannot be trusted.', 'Ensure jobs.job_id is always populated and unique.');
  }

  if (!candidate.job?.started_at || !candidate.job?.completed_at) {
    add(
      'jobs',
      'started_at/completed_at',
      'Execution timestamps are incomplete for this candidate.',
      'Persist both started_at and completed_at for every billable inference request.'
    );
  }

  if (!candidate.jobDebitLedgerEntry) {
    add(
      'renter_credit_ledger',
      'job_id',
      'No debit entry was found for this job_id, so renter charge posting is not fully auditable.',
      'Insert debit entries with source=job_run and job_id=<jobs.job_id> when compute charge is applied.'
    );
  }

  if (!candidate.topupLedgerEntry) {
    add(
      'renter_credit_ledger',
      'payment_ref',
      'No top-up credit ledger entry was linked for the renter before this charge.',
      'Record top-up credit rows with source=topup and payment_ref=<payments.payment_id or payments.moyasar_id>.'
    );
  } else if (!candidate.topupLedgerEntry.payment_ref) {
    add(
      'renter_credit_ledger',
      'payment_ref',
      'Top-up ledger entry exists but payment_ref is null, so direct join to payments is unavailable.',
      'Populate renter_credit_ledger.payment_ref when credits originate from payment gateway confirmation.'
    );
  }

  if (!candidate.payment) {
    add(
      'payments',
      'payment_id/moyasar_id',
      'No payment row was linked to this transaction chain.',
      'Ensure payment gateway callbacks write payments rows and that ledger payment_ref uses payment_id or moyasar_id.'
    );
  }

  if (!candidate.billingRecord && !candidate.jobSettlement) {
    add(
      'billing_records or job_settlements',
      'job_id',
      'Neither billing_records nor job_settlements contains this job_id; metering-to-charge linkage is incomplete.',
      'Persist at least one canonical metering table keyed by job_id (billing_records preferred) for every completed job.'
    );
  }

  return missing;
}

function buildSqlPack(candidate) {
  const renterId = candidate.job?.renter_id != null ? String(candidate.job.renter_id) : '/* renter_id */';
  const jobId = candidate.job?.job_id ? `'${candidate.job.job_id.replace(/'/g, "''")}'` : '/* job_id */';
  const paymentRef = candidate.topupLedgerEntry?.payment_ref
    ? `'${String(candidate.topupLedgerEntry.payment_ref).replace(/'/g, "''")}'`
    : '/* payment_ref */';

  return [
    `-- 1) Inference request identifiers`,
    `SELECT job_id, renter_id, provider_id, model, status, started_at, completed_at`,
    `FROM jobs`,
    `WHERE job_id = ${jobId};`,
    ``,
    `-- 2) Metering rows (prefer billing_records, fallback job_settlements)`,
    `SELECT id, job_id, model_id, token_count, duration_ms, gross_cost_halala, currency, status, created_at, updated_at`,
    `FROM billing_records`,
    `WHERE job_id = ${jobId};`,
    ``,
    `SELECT id, job_id, duration_seconds, gpu_rate_per_second, gross_amount_halala, platform_fee_halala, provider_payout_halala, status, settled_at`,
    `FROM job_settlements`,
    `WHERE job_id = ${jobId};`,
    ``,
    `-- 3) Ledger postings for the transaction path`,
    `SELECT id, renter_id, amount_halala, direction, source, job_id, payment_ref, created_at`,
    `FROM renter_credit_ledger`,
    `WHERE renter_id = ${renterId}`,
    `  AND (job_id = ${jobId} OR payment_ref = ${paymentRef})`,
    `ORDER BY created_at ASC;`,
    ``,
    `-- 4) Payment/charge row`,
    `SELECT id, payment_id, moyasar_id, renter_id, amount_sar, amount_halala, status, source_type, payment_method,`,
    `       created_at, confirmed_at, refunded_at`,
    `FROM payments`,
    `WHERE renter_id = ${renterId}`,
    `  AND (payment_id = ${paymentRef} OR moyasar_id = ${paymentRef})`,
    `ORDER BY COALESCE(confirmed_at, created_at) DESC`,
    `LIMIT 1;`,
  ].join('\n');
}

function pickBestCandidate(db, limit = DEFAULT_CANDIDATE_LIMIT) {
  const capabilities = {
    jobs: tableExists(db, 'jobs'),
    payments: tableExists(db, 'payments'),
    renter_credit_ledger: tableExists(db, 'renter_credit_ledger'),
    billing_records: tableExists(db, 'billing_records'),
    job_settlements: tableExists(db, 'job_settlements'),
  };

  if (!capabilities.jobs) {
    return { capabilities, candidate: null, candidatesEvaluated: 0 };
  }

  const jobs = safeAll(
    db,
    `SELECT id, job_id, renter_id, provider_id, model, job_type, status, cost_halala,
            duration_minutes, started_at, completed_at, created_at
       FROM jobs
      WHERE job_id IS NOT NULL
        AND renter_id IS NOT NULL
      ORDER BY COALESCE(completed_at, started_at, created_at) DESC
      LIMIT ?`,
    [limit]
  );

  let best = null;
  for (const job of jobs) {
    const candidate = fetchCandidateForJob(db, capabilities, job);
    if (!best || candidate.score > best.score) {
      best = candidate;
    }
    if (candidate.score >= 10) {
      break;
    }
  }

  return {
    capabilities,
    candidate: best,
    candidatesEvaluated: jobs.length,
  };
}

function buildEvidenceBundle(db, options = {}) {
  const nowIso = options.nowIso || new Date().toISOString();
  const { capabilities, candidate, candidatesEvaluated } = pickBestCandidate(db, options.candidateLimit || DEFAULT_CANDIDATE_LIMIT);

  const bundle = {
    generated_at: nowIso,
    candidate_limit: options.candidateLimit || DEFAULT_CANDIDATE_LIMIT,
    candidates_evaluated: candidatesEvaluated,
    table_capabilities: capabilities,
    transaction_path: null,
    metering_record: null,
    payment_charge_row: null,
    ledger_postings: [],
    missing_linkage_fields: [],
    sql_command_pack: '',
    summary: '',
  };

  if (!candidate || !candidate.job) {
    bundle.summary = 'No suitable job candidate was found. Cannot build meter-to-charge-to-ledger evidence chain.';
    bundle.missing_linkage_fields.push({
      table: 'jobs',
      field: 'job_id/renter_id',
      message: 'No jobs rows with both job_id and renter_id were found in this database snapshot.',
      recommended_fix: 'Seed or sync production-like job data before generating first paid SAR evidence.',
    });
    return bundle;
  }

  bundle.transaction_path = {
    request_id: candidate.job.job_id,
    provider_id: candidate.job.provider_id,
    renter_id: candidate.job.renter_id,
    model: candidate.job.model,
    job_type: candidate.job.job_type,
    started_at: normalizeDate(candidate.job.started_at),
    completed_at: normalizeDate(candidate.job.completed_at),
    job_status: candidate.job.status,
  };

  bundle.metering_record = deriveMeteringRecord(candidate);
  bundle.payment_charge_row = candidate.payment
    ? {
      payment_row_id: candidate.payment.id,
      charge_id: candidate.payment.payment_id || candidate.payment.moyasar_id || null,
      payment_id: candidate.payment.payment_id || null,
      moyasar_id: candidate.payment.moyasar_id || null,
      renter_id: candidate.payment.renter_id,
      amount_sar: candidate.payment.amount_sar,
      amount_halala: candidate.payment.amount_halala,
      currency: 'SAR',
      status: candidate.payment.status,
      source_type: candidate.payment.source_type || null,
      payment_method: candidate.payment.payment_method || null,
      created_at: normalizeDate(candidate.payment.created_at),
      confirmed_at: normalizeDate(candidate.payment.confirmed_at),
      refunded_at: normalizeDate(candidate.payment.refunded_at),
    }
    : null;

  bundle.ledger_postings = deriveLedgerPostings(candidate);
  bundle.missing_linkage_fields = collectMissingLinkages(capabilities, candidate);
  bundle.sql_command_pack = buildSqlPack(candidate);

  if (bundle.missing_linkage_fields.length === 0) {
    bundle.summary = `Evidence chain built for request_id=${candidate.job.job_id} with metering, payment, and ledger linkage.`;
  } else {
    bundle.summary = `Evidence chain is partial for request_id=${candidate.job.job_id}; ${bundle.missing_linkage_fields.length} linkage gap(s) detected.`;
  }

  return bundle;
}

module.exports = {
  buildEvidenceBundle,
  pickBestCandidate,
  scoreCandidate,
};
