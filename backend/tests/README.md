# Backend Test Runbook

## Runtime compatibility

- Backend tests depend on `better-sqlite3` native bindings.
- Supported Node runtimes follow the package engine range in `backend/node_modules/better-sqlite3/package.json` (`20.x` or newer majors listed there).

## If Jest fails with NODE_MODULE_VERSION mismatch

Symptom example:

`better_sqlite3.node was compiled against a different Node.js version`

Recovery steps:

1. Confirm current ABI:
   - `node -p "process.versions.modules"`
2. Rebuild the native module in backend:
   - `cd backend && npm rebuild better-sqlite3`
3. Re-run smoke tests:
   - `cd backend && npm run test:smoke`

## Recommended QA sequence

1. `npm run build`
2. `cd backend && npm run test:smoke`
3. `cd backend && npm run test:integration -- --runInBand`

## OpenRouter readiness gate

- Single-command readiness report:
  `cd backend && npm run test:openrouter:compliance`
- The harness exercises the real `/v1` router against mock providers and reports:
  model-list contract, auth/billing failures, streaming stability, tool-call roundtrip behavior, tool-definition passthrough, and mid-stream failure handling.
