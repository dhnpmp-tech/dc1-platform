# SDK Publish Readiness Checklist

**Status:** Ready for publication (blocking on namespace registration)
**Target:** npm & PyPI publishing
**Last Updated:** 2026-03-23

---

## Overview

DCP provides official SDKs for Python and JavaScript/Node.js. Both wrap the REST API with typed methods, authentication, and polling helpers. This document tracks publication readiness.

---

## SDK Status

### Node.js SDK (`dc1-renter-sdk`)

| Component | Status | Notes |
|-----------|--------|-------|
| Job submit flow | ✅ Ready | Handles `{ success, job: {...} }` shape |
| Job polling | ✅ Ready | `jobs.get()` handles terminal states |
| Authentication | ✅ Ready | x-renter-key header |
| TypeScript types | ✅ Ready | Full type coverage |
| Integration tests | ✅ Ready | 5 metering validation tests |
| Documentation | ✅ Ready | Quickstart + API reference |
| **Publication Status** | ⏳ Blocked | Awaiting npm namespace registration |

### Python SDK (`dc1-sdk`)

| Component | Status | Notes |
|-----------|--------|-------|
| Job submit | ✅ Ready | Wraps POST /api/jobs/submit |
| Job polling | ✅ Ready | Handles 410 terminal states |
| Provider routes | ✅ Ready | /api/providers/me, /api/jobs/history |
| Authentication | ✅ Ready | x-renter-key header |
| Docstrings | ✅ Ready | Full API coverage |
| Examples | ✅ Ready | 3 quickstart examples |
| **Publication Status** | ⏳ Blocked | Awaiting PyPI registration |

---

## Pre-Publication Checklist

### Code Quality
- [x] All tests passing
- [x] Type hints (Python) / TypeScript types
- [x] No hardcoded credentials or secrets
- [x] CHANGELOG.md updated for v1.0.0
- [x] README.md with installation & quickstart
- [x] License file (MIT) included

### Documentation
- [x] API reference auto-generated
- [x] Quickstart examples work end-to-end
- [x] Error handling documented
- [x] Authentication guide clear
- [x] Troubleshooting section included

### Integration
- [x] Works with current API endpoints (api.dcp.sa)
- [x] Handles current domain (dcp.sa)
- [x] Key prefix correct (dc1-*)
- [x] Error responses handled correctly
- [x] Polling logic matches job lifecycle

### Package Metadata
- [x] Package name finalized
  - npm: `dc1-renter-sdk`
  - PyPI: `dc1-sdk`
- [x] Version: 1.0.0
- [x] Author/maintainer info set
- [x] License: MIT
- [x] Repository URL: github.com/dcp-org/sdk

---

## Blocking Issues

### 1. npm Namespace Registration

**Status:** ⏳ Pending
**Action Required:** Register `dc1-renter-sdk` on npm registry

```bash
# Once credentials available:
npm login
npm publish
```

**Timeline:** 24 hours after credentials available

### 2. PyPI Package Registration

**Status:** ⏳ Pending
**Action Required:** Register `dc1-sdk` on PyPI

```bash
# Once credentials available:
python -m twine upload dist/dc1-sdk-1.0.0.tar.gz
```

**Timeline:** 24 hours after credentials available

---

## Installation & Usage

### Node.js

```bash
npm install dc1-renter-sdk
```

```javascript
import { RenterClient } from 'dc1-renter-sdk';

const client = new RenterClient({
  apiUrl: 'https://api.dcp.sa',
  renterKey: process.env.DCP_RENTER_KEY,
});

// Submit a job
const job = await client.jobs.submit({
  model: 'Nemotron-12B',
  prompt: 'What is AI?',
  maxTokens: 100,
});

// Poll for completion
const result = await client.jobs.waitForCompletion(job.id);
console.log(result.output);
```

### Python

```bash
pip install dc1-sdk
```

```python
from dc1_sdk import RenterClient

client = RenterClient(
    api_url="https://api.dcp.sa",
    renter_key=os.getenv("DCP_RENTER_KEY"),
)

# Submit a job
job = client.jobs.submit(
    model="Nemotron-12B",
    prompt="What is AI?",
    max_tokens=100,
)

# Poll for completion
result = client.jobs.wait_for_completion(job.id)
print(result.output)
```

---

## Publication Timeline

| Task | Owner | ETA | Status |
|------|-------|-----|--------|
| Namespace registration (npm) | DevOps | Sprint 26 | ⏳ |
| Namespace registration (PyPI) | DevOps | Sprint 26 | ⏳ |
| Final integration test | QA | Sprint 26 | ⏳ |
| Publish to npm | DevRel | Sprint 26 | ⏳ |
| Publish to PyPI | DevRel | Sprint 26 | ⏳ |
| Update docs site | DevRel | Sprint 26 | ⏳ |
| Announce on blog | Marketing | Sprint 26+1 | ⏳ |

---

## Post-Publication Tasks

1. **Announce in Blog Post** — "Official DCP SDKs Now Available"
2. **Update Integration Guides** — Link SDKs in provider & renter docs
3. **Track Usage** — Monitor npm & PyPI download stats
4. **Support** — Monitor GitHub issues & Discord for SDK questions
5. **Patch Pipeline** — Establish release process for v1.0.1, v1.1.0, etc.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Package name already taken" | Check npm/PyPI registry; reserve alt names |
| "Auth token expired" | Refresh credentials in CI/CD |
| "Tests fail during publish" | Run full test suite before publish |
| "Documentation not updating" | Rebuild docs site; invalidate CDN cache |

---

## References

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules)
- [PyPI Packaging Guide](https://packaging.python.org/tutorials/packaging-projects/)
- [SDK API Reference](docs/api-reference.md#sdks)
- [DCP Integration Guides](docs/)
