# DCP — GPU Compute Infrastructure for the Middle East

[![TypeScript](https://img.shields.io/badge/TypeScript-44.5%25-blue)](#tech-stack)
[![JavaScript](https://img.shields.io/badge/JavaScript-42.1%25-yellow)](#tech-stack)
[![Python](https://img.shields.io/badge/Python-7.3%25-green)](#sdks)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

DCP is a full-stack GPU compute platform that connects hardware providers with AI developers and enterprises who need on-demand GPU capacity. Providers register their NVIDIA GPUs and earn revenue; renters discover available machines, submit inference and training jobs, and pay per-use — with trustless escrow settlement on-chain.

**[Website](https://dcp.sa)** · **[Documentation](https://docs.dcp.sa)** · **[API Reference](https://api.dcp.sa/docs/ui)**

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        DCP Platform                              │
├──────────┬──────────┬──────────┬──────────┬──────────┬───────────┤
│ Frontend │ Backend  │ Escrow   │ P2P      │ SDKs     │ IDE       │
│ Next.js  │ Express  │ Solidity │ libp2p   │ Python   │ VSCode    │
│ React 18 │ SQLite   │ Base L2  │ DHT      │ Node.js  │ Extension │
└──────────┴──────────┴──────────┴──────────┴──────────┴───────────┘
```

The platform is composed of six major layers: a Next.js frontend with role-based dashboards, an Express.js backend API, on-chain escrow smart contracts on Base, a libp2p-based P2P discovery network, official SDKs in Python and Node.js, and a VSCode/Cursor IDE extension for submitting jobs directly from your editor.

## Features

**For GPU Providers** — Register machines, set hourly rates, monitor earnings and uptime, withdraw to your wallet. Reward tiers (Bronze / Silver / Gold) unlock higher visibility as you earn. A lightweight daemon handles heartbeat, job execution, and container lifecycle.

**For Renters** — Browse a live GPU marketplace with filters for VRAM, model, and price. Submit inference or training jobs via the dashboard, CLI, SDK, or IDE extension. Track spend, view logs in real-time (SSE streaming), and get 5% rebates on all rentals.

**For Admins** — Platform-wide KPIs, machine health monitoring, provider leaderboard, payout management, and price band controls.

**Payments & Escrow** — SAR-denominated billing via Moyasar payment gateway. On-chain USDC escrow on Base (75/25 provider/platform split) with EIP-712 signed claim proofs and automatic refund on timeout.

**P2P Discovery** — Decentralized provider discovery via libp2p Kademlia DHT. Providers announce GPU specs to the overlay network; renters query available capacity without relying on a central registry. Currently in phased rollout (centralized bootstrap → full peer-to-peer).

**AI Agent Workforce** — 23+ specialized agent personas (CEO, backend architect, DevOps, security engineer, SRE, etc.) that operate autonomously via Paperclip orchestration — handling code review, deployments, monitoring, and strategic planning.

**Bilingual** — Full English and Arabic support across the dashboard and documentation, including Arabic-optimized LLM model serving.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Express.js, SQLite (better-sqlite3), Zod validation |
| Blockchain | Solidity (Hardhat), ethers.js, Base Sepolia → Base mainnet |
| P2P | libp2p, Kademlia DHT, Noise encryption, yamux muxing |
| Payments | Moyasar (SAR), USDC on-chain escrow |
| Containers | Docker, Dockerode API, NVIDIA Container Toolkit |
| Testing | Playwright (E2E), Jest (unit/integration) |
| Deployment | Docker Compose, Vercel (frontend), VPS (backend + P2P) |
| Email | Resend API |
| Monitoring | Orchestration layer with Telegram alerts |

## Project Structure

```
dc1-platform/
├── app/                    # Next.js frontend (38+ routes)
│   ├── provider/           #   Provider dashboard
│   ├── renter/             #   Renter dashboard
│   ├── admin/              #   Admin dashboard
│   ├── marketplace/        #   GPU marketplace
│   ├── jobs/               #   Job submission & monitoring
│   ├── docs/               #   In-app documentation (EN/AR)
│   └── onboarding/         #   Guided setup flows
├── backend/                # Express.js API server
│   ├── src/                #   Route handlers, services, middleware
│   └── installers/         #   Provider daemon packages (26 OS/arch combos)
├── contracts/              # Solidity smart contracts (Escrow + MockUSDC)
├── p2p/                    # libp2p overlay network
│   ├── src/                #   Node factory, bootstrap, heartbeat protocol
│   └── python/             #   Job routing mesh (WebSocket)
├── sdk/
│   ├── python/             # Python SDK (dc1 package)
│   └── node/               # Node.js/TypeScript SDK
├── vscode-extension/       # VSCode/Cursor IDE extension (v0.4.0)
├── agents/                 # 23+ AI agent role definitions
├── orchestration/          # Checkpoint, failover, healthcheck, alerting
├── security/               # Guardian isolation module, container sandboxing
├── infra/                  # Docker templates, vLLM configs, nginx, deploy scripts
├── docs/                   # 250+ pages of documentation
├── packages/               # Shared packages and IDE extension core
├── e2e/                    # Playwright end-to-end tests
└── tests/                  # Unit, integration, load, smoke tests
```

## Quick Start

### Development

```bash
# Frontend
npm install
npm run dev
# → http://localhost:3000

# Backend
cd backend
npm install
node src/server.js
# → http://localhost:8083
```

### Docker (Production)

```bash
docker compose -f docker-compose.prod.yml up -d
```

This starts the frontend (port 3000), backend (port 8083), and healthcheck service (port 9090).

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
DC1_ADMIN_TOKEN=your-admin-token
DC1_HMAC_SECRET=your-hmac-secret

# Payments (optional — sandbox mode without)
MOYASAR_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...

# On-chain escrow (optional)
ESCROW_CONTRACT_ADDRESS=0x...
ESCROW_ORACLE_PRIVATE_KEY=0x...
BASE_RPC_URL=https://sepolia.base.org
```

## SDKs

### Python

```bash
pip install dc1
```

```python
import dc1

client = dc1.DC1Client(api_key="dc1-renter-xxx")
providers = client.providers.list()
job = client.jobs.submit("llm_inference", {
    "model": "mistral-7b",
    "prompt": "Explain GPU compute"
}, provider_id=1, duration_minutes=5)
result = client.jobs.wait(job.id)
```

### Node.js

```bash
npm install @dcp/sdk
```

```typescript
import { DC1Client } from "@dcp/sdk";

const client = new DC1Client({ apiKey: "dc1-renter-xxx" });
const providers = await client.providers.list();
const job = await client.jobs.submit("llm_inference", { model: "mistral-7b" });
```

## IDE Extension

The **DCP GPU Compute** extension for VSCode and Cursor lets you submit jobs, browse GPUs, stream logs, and manage your wallet without leaving your editor.

Install from the extension marketplace or build locally:

```bash
cd vscode-extension
npm install && npm run compile
```

Features include a provider sidebar with node status, GPU marketplace tree view, job submission commands, live log streaming, and a template catalog with 20+ pre-configured Docker environments.

## Smart Contracts

The escrow contract holds renter funds in USDC until job completion, then releases payment to the provider (75%) and platform (25%) upon verified proof-of-work via EIP-712 signatures.

```bash
cd contracts
npm install
npx hardhat test
npx hardhat run scripts/deploy.js --network baseSepolia
```

Currently deployed on Base Sepolia testnet. Mainnet deployment planned post-audit.

## API

The backend exposes a REST API with OpenAPI 3.0 documentation:

- **Providers** — Registration, heartbeat, capability reporting, earnings
- **Renters** — Registration, available GPU listing, wallet management
- **Jobs** — Submit, monitor, cancel, stream logs (SSE)
- **Models** — vLLM model catalog with pricing and Arabic model support
- **Templates** — 20+ Docker container templates (LLM, training, embedding, image gen)
- **Payments** — Moyasar integration, top-up, invoices, refunds
- **Admin** — KPIs, health monitoring, price adjustments, payouts

Interactive API docs available at `/api/docs/ui` when the backend is running.

## Documentation

Comprehensive docs live in the `/docs` directory and are served at [docs.dcp.sa](https://docs.dcp.sa):

- [Quickstart Guide](docs/quickstart.md) (also in [Arabic](docs/quickstart-ar.md))
- [API Reference](docs/api-reference.md) (also in [Arabic](docs/api-reference-ar.md))
- [Provider Setup Guide](docs/provider-guide.md)
- [SDK Guides](docs/sdk-guides.md)
- [Pricing Guide](docs/pricing-guide.md)
- [GPU Compatibility Matrix](docs/gpu-matrix.md)
- [Container Security](docs/container-security.md)
- [Escrow Integration](docs/ESCROW-INTEGRATION-GUIDE.md)
- [P2P Network Guide](docs/P2P-OPERATOR-CONFIG-GUIDE.md)
- [Migration from RunPod](docs/guides/migrate-runpod-to-dcp.md) · [Migration from Vast.ai](docs/guides/migrate-vast-to-dcp.md)

## Security

DCP enforces defense-in-depth across every layer: TLS on all public endpoints, cryptographic API keys (32-byte random), parameterized SQL, strict CORS allowlists, rate limiting, container sandboxing via the Guardian isolation module, and kernel capability dropping for untrusted workloads.

Compliant with PDPL (Saudi Personal Data Protection Law) and SAMA financial reporting requirements. Data residency planning for STC Cloud and AWS Bahrain.

See [SECURITY.md](SECURITY.md) for the full security architecture and responsible disclosure policy.

## Provider Requirements

| Requirement | Minimum |
|-------------|---------|
| GPU | NVIDIA, 8 GB+ VRAM |
| Docker | 20.10+ |
| NVIDIA Container Toolkit | Latest |
| Python | 3.8+ |
| OS | Ubuntu 20.04+ |

Pre-built installer packages are available for 26 OS/architecture combinations in `backend/installers/`.

## License

Proprietary — DCP Platform. All rights reserved.

## Links

- **Website**: [dcp.sa](https://dcp.sa)
- **Documentation**: [docs.dcp.sa](https://docs.dcp.sa)
- **API**: [api.dcp.sa](https://api.dcp.sa)
- **Support**: [support@dc1st.com](mailto:support@dc1st.com)
