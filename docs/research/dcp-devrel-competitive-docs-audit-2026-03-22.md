# Competitive Documentation and Developer Experience Audit (GPU Compute Platforms)

Date: 2026-03-22 (UTC)  
Owner: DevRel Engineer (DCP)

## Scope
Competitors reviewed:
- RunPod
- Vast.ai
- Akash Network
- Lambda
- CoreWeave
- Paperspace (DigitalOcean)
- SaladCloud
- Shadeform
- Fluidstack
- Together AI

Evaluation dimensions (1-5 each):
1. Documentation IA and navigation
2. Quickstart to first successful workload
3. API reference quality
4. Tutorials/guides depth
5. Community/support surfaces
6. Onboarding clarity (signup to first job)
7. SDK/CLI surface quality
8. Changelog/release communication

## Ranked comparison matrix

| Rank | Platform | Score (/40) | Notes |
|---|---:|---:|---|
| 1 | RunPod | 36 | Best balanced docs stack: clear product-mode navigation (Pods/Serverless/Flash), quickstarts, examples, CLI/API/docs/release notes connected in one surface. |
| 2 | Together AI | 35 | Strong API-first flow, clear quickstart, model guidance, explicit changelog/docs split, and good SDK examples (Python/TS/cURL side-by-side). |
| 3 | Vast.ai | 33 | Strong marketplace explainers and discoverability of SDK/CLI/API with direct path from docs home to first GPU rental actions. |
| 4 | CoreWeave | 32 | Enterprise-grade docs maturity: platform/products/reference/support split, pricing/security/observability/changelog discoverable. |
| 5 | Paperspace | 30 | Comprehensive references (API/CLI/SDK), clear machine lifecycle docs, and release-note cadence under DigitalOcean docs system. |
| 6 | Akash | 29 | Good separation by persona (developers/providers/node operators) and explicit API/SDK docs; stronger than average community exposure. |
| 7 | SaladCloud | 28 | Strong API usage guides and migration docs, but fragmented product surfaces can make initial path selection slower for new users. |
| 8 | Shadeform | 27 | Very good concise intro + tutorial library + API docs, but lighter depth than top-tier platforms on platform-scale operations and changelog maturity. |
| 9 | Lambda | 26 | Broad docs footprint and strong educational content, but onboarding is spread across product families and less linear for first workload setup. |
| 10 | Fluidstack | 24 | Clear enterprise platform positioning and API/CLI references, but less visible self-serve onboarding depth versus the strongest DX leaders. |

## Evidence snapshot (official docs, verified 2026-03-22 UTC)

| Platform | Evidence highlights |
|---|---|
| RunPod | Docs home exposes `Docs`, `Examples`, `Community`, `CLI`, `API`, `Models`, `Release notes`, with quickstarts across modes and API examples. |
| Together AI | Docs nav explicitly separates `Documentation`, `API Reference`, `Changelog`, `Guides`; quickstart includes Python/TS/cURL and OpenAI compatibility entry point. |
| Vast.ai | Docs home provides direct `SDK`, `CLI`, `API`, `QuickStart`, and marketplace pricing/instance concepts in the same flow. |
| CoreWeave | Docs root includes `Platform`, `Products`, `Reference`, `Support`, plus explicit `Changelog` and platform-level pricing/security/observability discoverability. |
| Paperspace | `Machines Reference` includes Paperspace API + CLI + Core API/SDK references, with linked release notes and support ecosystem. |
| Akash | Docs homepage is persona-oriented (`Developers`, `Providers`, `Node Operators`) and includes `API Documentation` and official SDK references. |
| SaladCloud | Public docs include API usage, quickstart tutorials, migration guides from competitors, and SDK docs (e.g., Python for transcription). |
| Shadeform | Intro page links directly to `Quickstart`, `Tutorial Library`, and `API Documentation`, with clear multi-cloud GPU positioning. |
| Lambda | Docs nav includes cloud API and extensive educational/tutorial sections, with forum/blog/youtube resources integrated. |
| Fluidstack | Docs include `Getting Started`, `Projects`, `Kubernetes`, `Slurm`, `API Reference`, and `CLI Reference`; positioning is strongly enterprise/managed infra. |

## Best practices DCP should adopt

1. Single-pane docs navigation that keeps `Quickstart`, `API Reference`, `SDKs`, `CLI`, and `Changelog` visible at all times.
2. Role-based onboarding paths from the first docs page:
- `Renter: submit first job`
- `Provider: register + daemon heartbeat`
- `Admin: token auth + health checks`
3. Side-by-side code examples (cURL, Node.js, Python) on every high-traffic endpoint.
4. First-job success checklists with exact expected responses and common failure recovery.
5. Explicit release notes/changelog discipline linked from docs nav, not buried in repo history.
6. Migration guides from key alternatives (`RunPod`, `Vast.ai`) with equivalent API flow mapping.
7. API auth section that is impossible to miss and includes both query-param and header variants used by DCP.

## DCP documentation gaps vs current standard

1. Docs IA is broad, but the primary developer path is not yet linear enough for "first successful API call in <10 minutes".
2. OpenAPI exists (`docs/openapi.yaml`) but endpoint examples and SDK mappings are inconsistent across pages.
3. Quickstart content is split across multiple files (`quickstart.md`, `quickstart.mdx`, guides) with some duplication risk.
4. Provider and renter onboarding are documented, but there is no canonical "golden path" page per persona with explicit checkpoints.
5. Changelog/release communication for docs and APIs is not surfaced as a first-class developer artifact.
6. Competitive migration content exists in parts, but not as a dedicated developer migration playbook.

## Recommendations for dcp.sa/docs

### P0 (launch-critical)
1. Build one canonical API-first quickstart lane with outcome checkpoints.
2. Normalize endpoint examples to cURL + Node + Python for provider/renter critical flows.
3. Add a top-level `Docs Changelog` page and link it in docs nav.
4. Add explicit auth matrix (providers/renters/admin) with header/query examples and error contracts.

### P1
1. Publish migration guides: `RunPod -> DCP`, `Vast.ai -> DCP`.
2. Add `time-to-first-job` KPI instrumentation guidance in docs.
3. Add troubleshooting decision trees for provider daemon onboarding and renter job submission.

### P2
1. Add interactive API explorer patterns around OpenAPI spec.
2. Expand SDK parity tables (what each SDK supports by endpoint).
3. Add tutorial bundles by use case: LLM inference, image generation, fine-tuning pipeline.

## Developer experience roadmap improvements

### 2 weeks
- Ship canonical quickstart lanes and auth matrix.
- Align OpenAPI examples with SDK README snippets.
- Publish docs changelog and release-note process.

### 4 weeks
- Publish migration guides from RunPod and Vast.ai.
- Add troubleshooting runbooks and first-job validation scripts.
- Add per-endpoint SDK parity table.

### 8 weeks
- Add interactive docs explorer and API scenario playground examples.
- Add structured telemetry guidance for onboarding funnel metrics.
- Expand multilingual (EN/AR) parity for advanced API and SDK pages.

## Implementation Checklist

| Priority | File path(s) | Exact change needed | Acceptance criteria | Suggested assignee |
|---|---|---|---|---|
| P0 | `docs/quickstart.mdx`, `docs/ar/quickstart.mdx` | Convert into canonical quickstart with 3 lanes: Renter API-first, Provider daemon-first, Admin verification. | New user can follow one lane start-to-finish and reach a successful API response with no external page hunting. | DevRel Engineer |
| P0 | `docs/api-reference.mdx`, `docs/ar/api-reference.mdx`, `docs/openapi.yaml` | Standardize examples for critical endpoints with cURL + Node + Python and ensure schema parity with OpenAPI. | Examples execute without contract drift; responses match OpenAPI spec shape. | DevRel + Backend Architect |
| P0 | `docs/README.md` and docs site nav config (where configured) | Add top-level links to `Quickstart`, `API Reference`, `SDK JS`, `SDK Python`, `Changelog`. | Developer can reach all five pages in one click from docs entry. | DevRel + Frontend |
| P0 | `docs/provider-guide.mdx`, `docs/renter-guide.mdx` | Add explicit auth matrix and error handling contract block (`{ "error": "..." }`) with header/query examples. | Auth setup failures drop; docs include no ambiguous auth paths. | DevRel |
| P1 | `docs/sdk-js.mdx`, `docs/sdk-python.mdx`, `sdk/node/README.md`, `sdk/python/README.md` | Add endpoint parity table and canonical first-job snippets aligned to backend routes. | SDK docs and READMEs produce same first-job result paths and payload semantics. | DevRel |
| P1 | `docs/guides/migrate-runpod-to-dcp.md` (new), `docs/guides/migrate-vast-to-dcp.md` (new) | Add migration playbooks mapping API/auth/compute workflow equivalents. | Users from those platforms can map concepts and perform first migration with documented steps. | DevRel |
| P2 | `docs/ops/runtime-verification.mdx`, `docs/qa/post-deploy-checklist.md` | Add DX reliability troubleshooting trees for onboarding blockers. | Repeated support issues map to documented fixes with deterministic next action. | DevRel + QA |

## Notes and constraints
- Ranking is weighted for **developer self-serve velocity**, not enterprise sales depth.
- Some competitor surfaces are enterprise-gated; scoring favors verifiable public docs surfaces.
- No invented pricing/rate claims were introduced for DCP recommendations.

## Sources
- https://docs.runpod.io/
- https://docs.vast.ai/
- https://akash.network/docs/
- https://docs.together.ai/
- https://docs.shadeform.ai/
- https://docs.fluidstack.io/
- https://docs.salad.com/
- https://docs.salad.com/reference/api-usage
- https://docs.digitalocean.com/products/paperspace/machines/reference/
- https://docs.coreweave.com/
- https://docs.lambda.ai/
