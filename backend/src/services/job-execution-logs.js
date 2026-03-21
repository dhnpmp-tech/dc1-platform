const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const LOG_ROOT = process.env.JOB_LOG_ROOT || '/opt/dcp/job-logs';
const FALLBACK_LOG_ROOT = path.join(process.cwd(), 'data', 'job-logs');
const GZIP_AFTER_MS = 24 * 60 * 60 * 1000;
let lastGzipSweepAt = 0;

function sanitizeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getAttemptLogPath(jobId, attemptNumber) {
  return getAttemptLogPathInRoot(LOG_ROOT, jobId, attemptNumber);
}

function getAttemptLogPathInRoot(root, jobId, attemptNumber) {
  const safeJobId = sanitizeSegment(jobId);
  const safeAttempt = Number.isInteger(Number(attemptNumber)) ? Number(attemptNumber) : 1;
  return path.join(root, safeJobId, `${safeAttempt}.log`);
}

function ensureLogDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function resolveWritableLogPath(jobId, attemptNumber) {
  const preferred = getAttemptLogPathInRoot(LOG_ROOT, jobId, attemptNumber);
  try {
    ensureLogDir(preferred);
    return preferred;
  } catch (_) {
    const fallback = getAttemptLogPathInRoot(FALLBACK_LOG_ROOT, jobId, attemptNumber);
    ensureLogDir(fallback);
    return fallback;
  }
}

function appendAttemptLogLines(jobId, attemptNumber, lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const filePath = resolveWritableLogPath(jobId, attemptNumber);
  const now = new Date().toISOString();
  const payload = lines
    .map((row) => {
      const level = String(row?.level || 'info').toLowerCase();
      const message = String(row?.message || '');
      return `[${now}] [${level}] ${message}`;
    })
    .join('\n');
  fs.appendFileSync(filePath, `${payload}\n`, 'utf8');
  maybeGzipOldLogs();
  return filePath;
}

function appendAttemptRawText(jobId, attemptNumber, text) {
  if (!text) return null;
  const filePath = resolveWritableLogPath(jobId, attemptNumber);
  fs.appendFileSync(filePath, String(text), 'utf8');
  maybeGzipOldLogs();
  return filePath;
}

function resolveAttemptLogPath(jobId, attemptNumber) {
  const candidates = [
    getAttemptLogPathInRoot(LOG_ROOT, jobId, attemptNumber),
    getAttemptLogPathInRoot(FALLBACK_LOG_ROOT, jobId, attemptNumber),
    getAttemptLogPathInRoot(path.join(os.tmpdir(), 'dcp-job-logs'), jobId, attemptNumber),
  ];
  for (const plain of candidates) {
    const gz = `${plain}.gz`;
    if (fs.existsSync(plain)) return { path: plain, gzipped: false };
    if (fs.existsSync(gz)) return { path: gz, gzipped: true };
  }
  return null;
}

function maybeGzipOldLogs() {
  const now = Date.now();
  if (now - lastGzipSweepAt < 60 * 60 * 1000) return;
  lastGzipSweepAt = now;
  try {
    walkAndGzip(LOG_ROOT, now);
  } catch (_) {}
}

function walkAndGzip(rootDir, nowTs) {
  if (!fs.existsSync(rootDir)) return;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkAndGzip(fullPath, nowTs);
      continue;
    }
    if (!entry.isFile() || !fullPath.endsWith('.log')) continue;
    try {
      const st = fs.statSync(fullPath);
      if ((nowTs - st.mtimeMs) < GZIP_AFTER_MS) continue;
      const data = fs.readFileSync(fullPath);
      const gzData = zlib.gzipSync(data, { level: zlib.constants.Z_BEST_SPEED });
      fs.writeFileSync(`${fullPath}.gz`, gzData);
      fs.unlinkSync(fullPath);
    } catch (_) {}
  }
}

module.exports = {
  LOG_ROOT,
  getAttemptLogPath,
  appendAttemptLogLines,
  appendAttemptRawText,
  resolveAttemptLogPath,
  maybeGzipOldLogs,
};
