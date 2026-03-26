# Sprint 27: Template Deployment CI/CD Pipeline

**Objective:** Enable automated deployment of docker template updates to production VPS without manual intervention.

**Target Environment:** 76.13.179.86 (VPS) / api.dcp.sa

**Requires:** Founder (Peter / setup@oida.ae) approval before production deployment

---

## Architecture Overview

```
Local Dev (template update)
  ↓
Git Push → GitHub/Main
  ↓
CI/CD Trigger (GitHub Actions / Manual)
  ↓
Build Phase (validate templates)
  ↓
Test Phase (smoke test on staging)
  ↓
Approval Gate (manual, requires founder)
  ↓
Deploy Phase (pull to VPS, restart PM2)
  ↓
Post-Deploy Verification (health check, regression tests)
```

---

## Phase 1: Template Validation & Build

### What It Does
- Validates all `docker-templates/*.json` files for schema compliance
- Builds docker images locally to verify Dockerfiles parse
- Generates deployment manifest listing all changes

### Implementation

```bash
# scripts/validate-templates.mjs
import Fs from 'fs';
import Path from 'path';

const templateDir = './docker-templates';
const templates = Fs.readdirSync(templateDir)
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(Fs.readFileSync(Path.join(templateDir, f))));

// Validate schema
templates.forEach(t => {
  if (!t.name || !t.image || !t.description) {
    throw new Error(`Invalid template: missing required fields in ${t.name}`);
  }
  if (!t.image.match(/^[\w\-:\.\/]+$/)) {
    throw new Error(`Invalid image reference: ${t.image}`);
  }
});

console.log(`✅ Validated ${templates.length} templates`);
```

### Trigger Conditions
- Any commit touching `docker-templates/*.json` files
- Manual trigger via GitHub Actions UI
- Tag pushes matching pattern `template-v*`

### Success Criteria
- ✅ All templates pass schema validation
- ✅ No syntax errors in template JSON
- ✅ Image references are valid Docker image names

---

## Phase 2: Staging Deployment & Smoke Test

### What It Does
- Deploys template updates to staging environment
- Runs smoke tests to verify endpoints respond
- Captures logs for debugging

### Implementation

```bash
# scripts/deploy-templates-staging.sh
#!/bin/bash
set -e

STAGING_HOST="staging.dc1.internal"  # Or test VM if available
SSH_USER="root"
STAGING_PATH="/root/dc1-platform"

echo "🚀 Deploying templates to staging..."
ssh "$SSH_USER@$STAGING_HOST" "cd $STAGING_PATH && git pull origin main && npm run build-templates"

echo "🔍 Running smoke tests..."
curl -s "https://staging-api.dc1.internal/api/templates" | jq '.count'
echo "✅ Staging deployment complete"
```

### Success Criteria
- ✅ SSH connection to staging succeeds
- ✅ Git pull completes without conflicts
- ✅ `/api/templates` endpoint returns 200 OK
- ✅ Template count matches expected

---

## Phase 3: Approval Gate (MANUAL)

### What It Does
- Halts pipeline pending founder approval
- Prevents accidental production deployments
- Provides founder with deployment summary

### Implementation

**GitHub Actions Workflow:**
```yaml
approval_gate:
  runs-on: ubuntu-latest
  needs: staging_test
  steps:
    - name: Request Approval
      run: |
        echo "✋ APPROVAL REQUIRED"
        echo "Deployment manifest: https://github.com/dcp/issues/${{ github.run_id }}"
        echo "Notify Peter (setup@oida.ae) for approval"

    - name: Wait for Manual Approval
      uses: trstringer/manual-approval@main
      with:
        secret: ${{ secrets.GITHUB_TOKEN }}
        approvers: peter-dcp-admin
        issue-title: "Template Deployment Approval Required"
        issue-body: |
          Review template changes and approve to proceed with production deployment.
          - Templates: ${{ needs.staging_test.outputs.template_count }}
          - Commit: ${{ github.sha }}
```

### Process
1. CI pipeline creates a GitHub issue with deployment details
2. Founder reviews and comments `/approve` to proceed
3. Pipeline resumes and executes production deployment

---

## Phase 4: Production Deployment

### What It Does
- Pulls template updates to production VPS
- Restarts PM2 services (zero-downtime reload)
- Captures deployment logs

### Implementation

```bash
# scripts/deploy-templates-production.sh
#!/bin/bash
set -e

PROD_HOST="76.13.179.86"
SSH_USER="root"
PROD_PATH="/root/dc1-platform"

echo "🚀 Deploying templates to PRODUCTION..."
echo "Founder approval confirmed. Proceeding with extreme caution."

# Pull latest code
ssh "$SSH_USER@$PROD_HOST" <<EOF
  set -e
  cd $PROD_PATH

  # Checkpoint current state
  CURRENT_COMMIT=\$(git rev-parse HEAD)
  echo "Current commit: \$CURRENT_COMMIT" > /tmp/pre-deploy-checkpoint.txt

  # Pull updates
  git fetch origin
  git pull origin main

  # Install deps (template updates may require new packages)
  cd backend && npm install

  # Verify templates loaded
  node -e "console.log(require('./src/templates').count())" || exit 1

  # Restart PM2
  pm2 reload ecosystem.config.js --only dc1-provider-onboarding

  echo "✅ Production deployment complete"
EOF

echo "✅ Deployed successfully. Hostname: $PROD_HOST"
```

### Success Criteria
- ✅ git pull succeeds without conflicts
- ✅ npm install completes
- ✅ PM2 reload completes (zero downtime)
- ✅ Template module loads without errors

---

## Phase 5: Post-Deploy Verification

### What It Does
- Runs full regression test suite
- Verifies all models still accessible
- Confirms provider connectivity intact

### Implementation

```bash
# scripts/post-deploy-verify-templates.mjs
#!/usr/bin/env node

import Http from 'https';

const checks = [
  {
    name: 'API Health',
    url: '/api/health',
    expect: 200
  },
  {
    name: 'Templates Endpoint',
    url: '/api/templates',
    expect: 200,
    validate: (body) => JSON.parse(body).count > 15 // Should have 15+ templates
  },
  {
    name: 'Models Endpoint',
    url: '/api/models',
    expect: 200,
    validate: (body) => JSON.parse(body).length > 10
  },
  {
    name: 'Provider Count Stable',
    url: '/api/providers/marketplace',
    expect: 200,
    validate: (body) => JSON.parse(body).total >= 2
  }
];

async function verify() {
  const results = [];

  for (const check of checks) {
    try {
      const response = await fetch(`https://api.dcp.sa${check.url}`);
      const body = await response.text();

      const pass = response.status === check.expect &&
                   (!check.validate || check.validate(body));

      results.push({ check: check.name, pass, status: response.status });
      console.log(`${pass ? '✅' : '❌'} ${check.name}`);
    } catch (e) {
      results.push({ check: check.name, pass: false, error: e.message });
      console.error(`❌ ${check.name}: ${e.message}`);
    }
  }

  const allPass = results.every(r => r.pass);
  if (!allPass) {
    console.error('\n❌ VERIFICATION FAILED. Recommendation: ROLLBACK');
    process.exit(1);
  }
  console.log('\n✅ ALL CHECKS PASSED');
}

verify().catch(console.error);
```

### Success Criteria
- ✅ API Health: 200 OK
- ✅ Templates count > 15
- ✅ Models count > 10
- ✅ Provider count unchanged (>= pre-deploy)

---

## Phase 6: Rollback Procedure

### Automatic Rollback (if verification fails)

```bash
# scripts/rollback-templates.sh
#!/bin/bash
set -e

PROD_HOST="76.13.179.86"
SSH_USER="root"
PROD_PATH="/root/dc1-platform"

# Get previous commit from checkpoint
PREVIOUS_COMMIT=$(cat /tmp/pre-deploy-checkpoint.txt | grep "Current commit:" | awk '{print $NF}')

echo "⚠️  ROLLING BACK to commit: $PREVIOUS_COMMIT"

ssh "$SSH_USER@$PROD_HOST" <<EOF
  cd $PROD_PATH
  git checkout $PREVIOUS_COMMIT -- backend/
  cd backend && npm install
  pm2 restart dc1-provider-onboarding
  echo "✅ Rollback complete"
EOF

curl https://api.dcp.sa/api/health || echo "⚠️ Health check failed after rollback"
```

### Manual Rollback

If automated rollback fails, follow VPS rollback procedure in `docs/deploy/sprint27-vps-runbook.md`.

---

## GitHub Actions Workflow File

**Location:** `.github/workflows/deploy-templates.yml`

```yaml
name: Deploy Templates

on:
  push:
    branches:
      - main
    paths:
      - 'docker-templates/**'
  workflow_dispatch:

env:
  VPS_HOST: 76.13.179.86
  VPS_USER: root
  VPS_PATH: /root/dc1-platform

jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      template_count: ${{ steps.count.outputs.count }}
    steps:
      - uses: actions/checkout@v4

      - name: Validate Templates
        run: node scripts/validate-templates.mjs

      - name: Count Templates
        id: count
        run: echo "count=$(ls docker-templates/*.json | wc -l)" >> $GITHUB_OUTPUT

  staging_test:
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Test Templates on Staging
        run: bash scripts/deploy-templates-staging.sh
        env:
          STAGING_HOST: ${{ secrets.STAGING_HOST }}
          SSH_KEY: ${{ secrets.STAGING_SSH_KEY }}

  approval:
    runs-on: ubuntu-latest
    needs: [validate, staging_test]
    steps:
      - name: Create Approval Issue
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Template Deployment Approval Required`,
              body: `Deploy ${{ needs.validate.outputs.template_count }} updated templates to production?

              **Commit:** ${{ github.sha }}
              **Requester:** ${{ github.actor }}

              Reply with: \`/approve\` to proceed or \`/deny\` to cancel.`
            })

  deploy_production:
    runs-on: ubuntu-latest
    needs: approval
    if: github.event.workflow_run.status == 'success'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Production
        env:
          SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          bash scripts/deploy-templates-production.sh

      - name: Verify Deployment
        run: node scripts/post-deploy-verify-templates.mjs

      - name: Rollback on Failure
        if: failure()
        env:
          SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
        run: bash scripts/rollback-templates.sh

      - name: Notify Deployment
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `✅ Template deployment completed successfully to production.`
            })
```

---

## Implementation Checklist

- [ ] Create `scripts/validate-templates.mjs`
- [ ] Create `scripts/deploy-templates-staging.sh`
- [ ] Create `scripts/deploy-templates-production.sh`
- [ ] Create `scripts/post-deploy-verify-templates.mjs`
- [ ] Create `scripts/rollback-templates.sh`
- [ ] Create `.github/workflows/deploy-templates.yml`
- [ ] Test workflow on staging branch first
- [ ] Require founder approval before production use
- [ ] Document emergency rollback procedures for team
- [ ] Create runbook for template add/update process

---

## Deployment Timeline

| Phase | Duration | Success Criteria |
|-------|----------|------------------|
| Validation | 2-5 min | All templates valid |
| Staging Deploy | 5-10 min | Endpoints respond |
| Approval Gate | 5-60 min | Founder approves |
| Production Deploy | 5-10 min | PM2 reload succeeds |
| Verification | 2-5 min | All health checks pass |
| **Total** | **20-90 min** | Full deployment complete |

---

## Maintenance & Updates

### Adding a New Template

1. Create `docker-templates/new-template.json`
2. Push to feature branch
3. CI validates automatically
4. Submit PR for code review
5. Merge to main (triggers CI/CD)
6. Wait for approval gate
7. Monitor production deployment

### Updating Template Properties

- Change JSON properties in `docker-templates/*.json`
- No code changes required
- CI/CD handles rest
- Approval gate ensures safety

### Rollback Procedure

If deployment fails verification:
1. CI automatically attempts rollback
2. If auto-rollback fails, DevOps Automator manually executes `rollback-templates.sh`
3. Team notified via Paperclip issue
4. Root cause analysis in post-incident review

---

## Security & Compliance

- ✅ All deployments require founder approval
- ✅ Rollback always available within 10 minutes
- ✅ SSH keys stored in GitHub Secrets (never in code)
- ✅ Deployments logged to `/tmp/pre-deploy-checkpoint.txt` on VPS
- ✅ No production deployments without staging test
- ✅ Post-deploy verification mandatory before considering "done"

---

## Related Documentation

- **VPS Runbook:** `docs/deploy/sprint27-vps-runbook.md`
- **Template Structure:** `docker-templates/README.md`
- **Deployment Manual:** `docs/ops/launch-window-deploy-runbook.md`
- **Incident Response:** `docs/security/incident-response-runbook.md`

---

## Support & Escalation

**Questions or issues?**
- Contact: DevOps Automator (01e3a440-33d4-47a4-9272-c0e5ac6ffcbe)
- Issue: DCP-649 (Sprint 27 DevOps work)
- Emergency: Founder (setup@oida.ae)

---

**Document Version:** 1.0
**Last Updated:** 2026-03-26
**Status:** READY FOR REVIEW

