/**
 * DC1 Billing Reconciliation Routes
 * Penny-perfect verification + audit reports
 */

const express = require('express');
const router = express.Router();
const engine = require('../services/reconciliation-engine');

// GET /api/reconciliation/summary
router.get('/summary', (req, res) => {
  try {
    const result = engine.runFullReconciliation();
    res.json({
      totalCollectedHalala: result.totalCollectedHalala,
      totalPaidHalala: result.totalPaidHalala,
      dc1MarginHalala: result.dc1MarginHalala,
      discrepanciesCount: result.jobsFlagged,
      jobsChecked: result.jobsChecked,
      runAt: result.runAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Reconciliation failed', detail: error.message });
  }
});

// GET /api/reconciliation/jobs
router.get('/jobs', (req, res) => {
  try {
    const db = require('../db');
    const jobs = db.all("SELECT * FROM jobs WHERE status = 'completed'") || [];
    const breakdown = jobs.map(job => {
      const result = engine.verifyJobBilling(job.job_id || job.id);
      return {
        jobId: result.jobId,
        renterPaidHalala: result.renterPaid,
        providerEarnedHalala: result.providerEarned,
        dc1FeeHalala: result.dc1Fee,
        clean: result.clean
      };
    });
    res.json({ jobs: breakdown, count: breakdown.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch jobs', detail: error.message });
  }
});

// GET /api/reconciliation/discrepancies
router.get('/discrepancies', (req, res) => {
  try {
    const result = engine.runFullReconciliation();
    res.json({
      discrepancies: result.flaggedJobs,
      count: result.jobsFlagged
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch discrepancies', detail: error.message });
  }
});

// POST /api/reconciliation/verify/:job_id
router.post('/verify/:job_id', (req, res) => {
  try {
    const { job_id } = req.params;
    const billing = engine.verifyJobBilling(job_id);
    const proof = engine.verifyProofHash(job_id);
    res.json({ billing, proof });
  } catch (error) {
    res.status(500).json({ error: 'Verification failed', detail: error.message });
  }
});

// GET /api/reconciliation/report
router.get('/report', (req, res) => {
  try {
    const report = engine.generateReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Report generation failed', detail: error.message });
  }
});

module.exports = router;
