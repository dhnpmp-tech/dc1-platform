# Playground to Production: A Practical DCP Workflow

DCP gives teams a clear path from fast browser experimentation to repeatable API-driven container jobs. You can validate outputs in minutes, then formalize the same workload for production pipelines.

## Who this is for
- Startup teams validating AI features before committing engineering time to infrastructure.
- ML engineers who need a practical migration path from manual runs to automated jobs.
- Product teams that want usage visibility before scaling workload volume.

## Why this workflow works
Many teams lose time by jumping straight into infrastructure design before they confirm prompt shape, output quality, and model fit. DCP reduces that risk by splitting adoption into two stages:
- Stage 1: quick validation in browser flows.
- Stage 2: repeatable execution through renter APIs and container-based jobs.

## Step 1: Run the first workload in Playground
Start with the renter experience and run a small, representative workload.

What to capture during this first run:
- Prompt or input shape that matches your product use case.
- Output structure your app actually needs.
- Basic success criteria (latency tolerance, quality threshold, retry behavior).

## Step 2: Save your baseline parameters
Before moving to API automation, document the exact configuration that produced acceptable results.

Suggested baseline fields:
- Model name and version.
- Input prompt template.
- Output schema (plain text, JSON shape, or file output expectation).
- Timeout and retry assumptions.

This baseline becomes your handoff contract between experimentation and production integration.

## Step 3: Move to container jobs through API
After validation, transition to renter API-driven execution for repeatability. Use the same baseline parameters from Step 2 and submit jobs through backend flows.

Operational benefits of this step:
- Consistent submission format for team workflows.
- Clear job lifecycle visibility (`pending`, `queued`, `running`, `done`).
- Better handoff from prototype scripts to product services.

## Step 4: Add production safeguards
Before scaling job volume, apply a lightweight operational checklist:
- Verify estimate visibility before each paid run.
- Confirm settlement behavior and balance updates after completion.
- Add polling or status checks in your client flow.
- Track failed jobs and retries with explicit logging.

## Suggested implementation sequence
1. Create renter account and run first browser workflow.
2. Validate one complete output chain with your target model.
3. Convert the validated prompt/config into API submission payloads.
4. Add monitoring and billing checks before increasing workload concurrency.

## Common mistakes to avoid
- Skipping baseline capture and re-discovering parameters later.
- Mixing experiment prompts and production prompts without versioning.
- Treating one successful run as production readiness.

## CTA
### Start the workflow now
- Register renter account: `/renter/register`
- Run onboarding steps: `/docs/quickstart`
- Review renter job flow: `/docs/renter-guide`
- Check API endpoints before integration: `/docs/api`
