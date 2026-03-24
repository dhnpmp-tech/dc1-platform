# Escrow Frontend Payment Flow — Implementation Spec

> **Author**: Blockchain Engineer (DCP-905)
> **Audience**: Frontend Developer — implement this spec to wire the escrow payment flow into the DCP marketplace UI
> **Contract**: `Escrow.sol` on Base Sepolia (chainId 84532)
> **Payment token**: USDC (6 decimals) — `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
> **Event bridge**: `escrowListener.js` (DCP-903) — backend pushes status updates via REST/WebSocket
> **Status**: Spec only — contract address pending deployment (founder approval required)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Wallet Connection — MetaMask & WalletConnect](#2-wallet-connection--metamask--walletconnect)
3. [Network & Chain Validation](#3-network--chain-validation)
4. [EIP-712 Signature Flow](#4-eip-712-signature-flow)
5. [Job Submission with Escrow](#5-job-submission-with-escrow)
6. [PaymentReleased Event — Renter Confirmation UI](#6-paymentreleased-event--renter-confirmation-ui)
7. [DisputeRaised Event — Dispute Status UI](#7-disputeraised-event--dispute-status-ui)
8. [Escrow Status Polling](#8-escrow-status-polling)
9. [Error States & Handling](#9-error-states--handling)
10. [Environment Variables](#10-environment-variables)
11. [Component Reference](#11-component-reference)
12. [API Endpoints Reference](#12-api-endpoints-reference)
13. [Testing Checklist](#13-testing-checklist)

---

## 1. Architecture Overview

The DCP frontend does **not** call the Escrow contract directly in the standard flow.
All on-chain calls are made server-side by the Express backend. The frontend interacts
with the backend REST API and receives escrow status updates through polling or WebSocket.

However, the frontend **does** need to:
- Ask the renter to connect a wallet for identity verification and optional direct on-chain approval
- Display on-chain escrow status with Basescan links
- Listen for server-pushed events (PaymentReleased, DisputeRaised) and update the UI
- Handle wallet-related errors gracefully

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Next.js)                            │
│                                                                      │
│  ┌─────────────────┐     ┌──────────────────┐    ┌────────────────┐ │
│  │  WalletButton   │     │   JobSubmitFlow   │    │  JobStatusUI   │ │
│  │  (connect UI)   │     │  (EIP-712 sign)   │    │ (events/poll)  │ │
│  └────────┬────────┘     └────────┬──────────┘    └───────┬────────┘ │
│           │                       │                        │          │
│           ▼                       ▼                        ▼          │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              wagmi + viem  (wallet adapter layer)                │ │
│  └──────────────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────────────┼───────────────────────────────-┘
                                      │ MetaMask / WalletConnect
                                      ▼
                          ┌──────────────────────┐
                          │   User Wallet        │
                          │  (sign messages,     │
                          │   approve USDC)      │
                          └──────────────────────┘

Browser ──── REST API ────▶ Express Backend ──── ethers.js ────▶ Escrow.sol (Base Sepolia)
                │                     │
                │◀── escrow status ───┘
                │◀── PaymentReleased ─┘  (via DCP-903 event bridge → backend push)
                │◀── DisputeRaised ───┘
```

### Flow summary

| Step | Actor | Action |
|------|-------|--------|
| 1 | Renter | Connects wallet (MetaMask / WalletConnect) |
| 2 | Frontend | Validates network (must be Base Sepolia or Base mainnet) |
| 3 | Renter | Signs EIP-712 job creation message (identity + consent) |
| 4 | Frontend | POSTs job to backend with signed payload |
| 5 | Backend | Calls `depositAndLock()` on-chain, locks USDC |
| 6 | Frontend | Polls job status; shows "Escrow Locked" with Basescan link |
| 7 | Backend | Signs job completion; calls `claimLock()` |
| 8 | Backend | Emits `PaymentReleased` event via DCP-903 bridge |
| 9 | Frontend | Receives update; shows payment confirmation UI |
| 10a | Renter (optional) | Raises dispute via UI → backend emits `DisputeRaised` |
| 10b | Frontend | Shows dispute status; ops notified via `admin_alerts` |

---

## 2. Wallet Connection — MetaMask & WalletConnect

### Recommended library stack

```bash
# Install wagmi v2 + viem + WalletConnect
npm install wagmi viem @walletconnect/ethereum-provider @tanstack/react-query
```

### Wagmi configuration

```tsx
// lib/wagmi.ts
import { createConfig, http } from 'wagmi';
import { baseSepolia, base } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    injected(),  // MetaMask + browser wallets
    walletConnect({
      projectId: WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'DCP — Decentralized Compute Platform',
        description: 'GPU compute marketplace on Base L2',
        url: 'https://dcp.sa',
        icons: ['https://dcp.sa/favicon.ico'],
      },
    }),
  ],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org'),
    [base.id]:        http('https://mainnet.base.org'),
  },
});
```

### Root provider setup

```tsx
// app/providers.tsx
'use client';

import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### WalletButton component

```tsx
// components/WalletButton.tsx
'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <span className="wallet-address">
          {address?.slice(0, 6)}…{address?.slice(-4)}
        </span>
        {chain && (
          <span className={`network-badge ${chain.id === baseSepolia.id ? 'testnet' : 'mainnet'}`}>
            {chain.name}
          </span>
        )}
        <button onClick={() => disconnect()} className="btn-disconnect">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect-options">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="btn-connect"
        >
          {isPending ? 'Connecting…' : `Connect ${connector.name}`}
        </button>
      ))}
      {error && (
        <p className="wallet-error">{getWalletErrorMessage(error)}</p>
      )}
    </div>
  );
}
```

### Connection state management

```tsx
// hooks/useWalletState.ts
import { useAccount, useChainId } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || baseSepolia.id);

export function useWalletState() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const chainId = useChainId();

  const isCorrectNetwork = chainId === TARGET_CHAIN_ID;
  const isReady = isConnected && isCorrectNetwork;

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isReconnecting,
    chainId,
    isCorrectNetwork,
    isReady,
  };
}
```

---

## 3. Network & Chain Validation

The frontend MUST validate the renter's wallet network before allowing job submission.
Attempting to submit on the wrong chain will cause the backend deposit to fail.

### NetworkGuard component

```tsx
// components/NetworkGuard.tsx
'use client';

import { useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || baseSepolia.id);
const TARGET_CHAIN_NAME = TARGET_CHAIN_ID === baseSepolia.id ? 'Base Sepolia' : 'Base';

interface NetworkGuardProps {
  children: React.ReactNode;
}

export function NetworkGuard({ children }: NetworkGuardProps) {
  const chainId = useChainId();
  const { switchChain, isPending, error } = useSwitchChain();

  if (chainId === TARGET_CHAIN_ID) {
    return <>{children}</>;
  }

  return (
    <div className="network-mismatch-banner">
      <div className="network-mismatch-content">
        <span className="icon">⚠️</span>
        <p>
          Your wallet is connected to the wrong network. DCP requires{' '}
          <strong>{TARGET_CHAIN_NAME}</strong>.
        </p>
        <button
          onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
          disabled={isPending}
          className="btn-switch-network"
        >
          {isPending ? 'Switching…' : `Switch to ${TARGET_CHAIN_NAME}`}
        </button>
        {error && <p className="network-error">{getWalletErrorMessage(error)}</p>}
      </div>
    </div>
  );
}
```

### Network validation hook

```tsx
// hooks/useNetworkValidation.ts
import { useChainId, useSwitchChain } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export function useNetworkValidation() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const TARGET = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || baseSepolia.id);

  return {
    isCorrectNetwork: chainId === TARGET,
    currentChainId: chainId,
    targetChainId: TARGET,
    switchToTarget: () => switchChain({ chainId: TARGET }),
    isSwitching: isPending,
  };
}
```

---

## 4. EIP-712 Signature Flow

The renter signs an EIP-712 typed message to authorize job creation. This signature:
1. Provides cryptographic proof that the renter approved the job parameters
2. Allows the backend to verify renter identity without storing private keys
3. Ties the job to a specific wallet address for on-chain escrow

**Note**: This signature is for job authorization identity only. The actual USDC transfer
is executed server-side by the backend's hot-wallet after signature verification.

### EIP-712 domain and types

```ts
// lib/escrowTypes.ts

export const ESCROW_DOMAIN = {
  name: 'DCP Escrow',
  version: '1',
  chainId: Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || 84532),
  verifyingContract: process.env.NEXT_PUBLIC_ESCROW_ADDRESS as `0x${string}`,
} as const;

export const JOB_CREATION_TYPES = {
  JobCreation: [
    { name: 'jobId',        type: 'string' },
    { name: 'gpuModel',     type: 'string' },
    { name: 'durationHours', type: 'uint256' },
    { name: 'maxCostUsdc',  type: 'uint256' },
    { name: 'renter',       type: 'address' },
    { name: 'nonce',        type: 'uint256' },
    { name: 'deadline',     type: 'uint256' },
  ],
} as const;

export interface JobCreationMessage {
  jobId:         string;
  gpuModel:      string;
  durationHours: bigint;
  maxCostUsdc:   bigint;   // 6 decimals — e.g., $5.00 = 5_000_000n
  renter:        `0x${string}`;
  nonce:         bigint;
  deadline:      bigint;   // unix timestamp (seconds) — signature expiry
}
```

### useSignJobCreation hook

```tsx
// hooks/useSignJobCreation.ts
import { useSignTypedData, useAccount } from 'wagmi';
import { ESCROW_DOMAIN, JOB_CREATION_TYPES, JobCreationMessage } from '@/lib/escrowTypes';

export function useSignJobCreation() {
  const { address } = useAccount();
  const { signTypedData, isPending, error, data: signature } = useSignTypedData();

  async function signJobCreation(params: {
    jobId:         string;
    gpuModel:      string;
    durationHours: number;
    maxCostUsdc:   number;   // in USDC units (not micro) — e.g., 5.00
    nonce:         number;
  }): Promise<string> {
    if (!address) throw new Error('Wallet not connected');

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5-minute window

    const message: JobCreationMessage = {
      jobId:         params.jobId,
      gpuModel:      params.gpuModel,
      durationHours: BigInt(params.durationHours),
      maxCostUsdc:   BigInt(Math.round(params.maxCostUsdc * 1_000_000)),
      renter:        address,
      nonce:         BigInt(params.nonce),
      deadline,
    };

    return new Promise((resolve, reject) => {
      signTypedData(
        {
          domain:      ESCROW_DOMAIN,
          types:       JOB_CREATION_TYPES,
          primaryType: 'JobCreation',
          message,
        },
        {
          onSuccess: resolve,
          onError: reject,
        }
      );
    });
  }

  return {
    signJobCreation,
    isPending,
    error,
    signature,
  };
}
```

### Signature verification (backend — for reference)

The frontend sends `signature` + `message` to the backend. The backend verifies:

```js
// backend/src/middleware/verifyJobSignature.js (reference — backend implementation)
const { ethers } = require('ethers');

const DOMAIN = {
  name:              'DCP Escrow',
  version:           '1',
  chainId:           84532,
  verifyingContract: process.env.ESCROW_CONTRACT_ADDRESS,
};

const TYPES = {
  JobCreation: [
    { name: 'jobId',         type: 'string' },
    { name: 'gpuModel',      type: 'string' },
    { name: 'durationHours', type: 'uint256' },
    { name: 'maxCostUsdc',   type: 'uint256' },
    { name: 'renter',        type: 'address' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'deadline',      type: 'uint256' },
  ],
};

async function verifyJobSignature(message, signature) {
  const recoveredAddress = ethers.verifyTypedData(DOMAIN, TYPES, message, signature);
  return recoveredAddress.toLowerCase() === message.renter.toLowerCase();
}
```

---

## 5. Job Submission with Escrow

### Full job submission flow (frontend)

```tsx
// components/JobSubmitFlow.tsx
'use client';

import { useState } from 'react';
import { useSignJobCreation } from '@/hooks/useSignJobCreation';
import { useWalletState } from '@/hooks/useWalletState';
import { NetworkGuard } from './NetworkGuard';

interface JobSubmitParams {
  gpuModel:      string;
  durationHours: number;
  templateId:    string;
  dockerImage?:  string;
}

export function JobSubmitFlow({ params }: { params: JobSubmitParams }) {
  const { address, isReady } = useWalletState();
  const { signJobCreation, isPending: isSigning } = useSignJobCreation();
  const [step, setStep] = useState<'idle' | 'signing' | 'submitting' | 'locked' | 'error'>('idle');
  const [jobId, setJobId] = useState<string | null>(null);
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit() {
    if (!address) return;
    setStep('signing');
    setErrorMsg(null);

    try {
      // 1. Get a nonce from the backend (replay-attack protection)
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'GET',
        headers: { 'x-wallet': address },
      });
      const { nonce, jobId: pendingJobId } = await nonceRes.json();

      // 2. Calculate max cost in USDC (frontend estimate — backend validates)
      const estimatedCostUsdc = await estimateJobCost(params.gpuModel, params.durationHours);

      // 3. Sign the job creation message via MetaMask / WalletConnect
      const signature = await signJobCreation({
        jobId:         pendingJobId,
        gpuModel:      params.gpuModel,
        durationHours: params.durationHours,
        maxCostUsdc:   estimatedCostUsdc,
        nonce,
      });

      setStep('submitting');

      // 4. POST to backend — backend handles depositAndLock on-chain
      const submitRes = await fetch('/api/jobs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId:         pendingJobId,
          gpuModel:      params.gpuModel,
          durationHours: params.durationHours,
          templateId:    params.templateId,
          dockerImage:   params.dockerImage,
          renterAddress: address,
          maxCostUsdc:   estimatedCostUsdc,
          nonce,
          signature,
        }),
      });

      if (!submitRes.ok) {
        const { error } = await submitRes.json();
        throw new Error(error || `Submission failed: ${submitRes.status}`);
      }

      const { job, escrowTxHash: txHash } = await submitRes.json();
      setJobId(job.id);
      setEscrowTxHash(txHash);
      setStep('locked');

    } catch (err: any) {
      setErrorMsg(getSubmitErrorMessage(err));
      setStep('error');
    }
  }

  if (step === 'locked' && jobId) {
    return <EscrowLockedConfirmation jobId={jobId} txHash={escrowTxHash} />;
  }

  return (
    <NetworkGuard>
      <div className="job-submit-panel">
        <JobCostPreview gpuModel={params.gpuModel} durationHours={params.durationHours} />

        {!isReady && (
          <div className="wallet-required-notice">
            <p>Connect your wallet to submit a job with on-chain escrow.</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isReady || step !== 'idle'}
          className="btn-submit-job"
        >
          {step === 'signing'    ? '⏳ Waiting for signature…' :
           step === 'submitting' ? '⏳ Locking escrow on-chain…' :
           'Submit Job with Escrow'}
        </button>

        {step === 'error' && errorMsg && (
          <EscrowErrorBanner message={errorMsg} onRetry={() => setStep('idle')} />
        )}
      </div>
    </NetworkGuard>
  );
}
```

### EscrowLockedConfirmation component

```tsx
// components/EscrowLockedConfirmation.tsx
'use client';

import { BasescanLink } from './BasescanLink';

interface Props {
  jobId: string;
  txHash: string | null;
}

export function EscrowLockedConfirmation({ jobId, txHash }: Props) {
  const chainId = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || 84532);
  const isTestnet = chainId === 84532;

  return (
    <div className="escrow-confirmation escrow-locked">
      <div className="confirmation-icon">🔒</div>
      <h3>Escrow Locked</h3>
      <p>Your USDC has been locked in the DCP escrow contract on Base. Your job will start shortly.</p>

      <div className="escrow-details">
        <div className="detail-row">
          <span className="label">Job ID</span>
          <span className="value monospace">{jobId.slice(0, 8)}…</span>
        </div>
        {txHash && (
          <div className="detail-row">
            <span className="label">Escrow Transaction</span>
            <BasescanLink txHash={txHash} isTestnet={isTestnet} />
          </div>
        )}
        <div className="detail-row">
          <span className="label">Status</span>
          <span className="value status-locked">🔒 Locked</span>
        </div>
      </div>

      <div className="escrow-info-box">
        <p>
          <strong>How this works:</strong> Your USDC is held in a smart contract.
          When your job completes, 75% goes to the compute provider and 25% is
          the DCP platform fee. If the job fails or expires, you get a full refund.
        </p>
        <a
          href={`https://${isTestnet ? 'sepolia.' : ''}basescan.org/address/${process.env.NEXT_PUBLIC_ESCROW_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link-view-contract"
        >
          View Escrow Contract on Basescan →
        </a>
      </div>
    </div>
  );
}
```

### BasescanLink component

```tsx
// components/BasescanLink.tsx

interface Props {
  txHash: string;
  isTestnet?: boolean;
}

export function BasescanLink({ txHash, isTestnet = true }: Props) {
  const base = isTestnet ? 'https://sepolia.basescan.org' : 'https://basescan.org';
  const shortHash = `${txHash.slice(0, 8)}…${txHash.slice(-6)}`;

  return (
    <a
      href={`${base}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="basescan-link"
    >
      {shortHash} ↗
    </a>
  );
}
```

---

## 6. PaymentReleased Event — Renter Confirmation UI

When the backend detects the `PaymentReleased` on-chain event (via DCP-903 escrow listener),
it updates the job status to `payment_released`. The frontend polls for this status change
and shows a payment confirmation UI.

### Job status polling hook

```tsx
// hooks/useJobStatus.ts
import { useState, useEffect, useRef } from 'react';

export type EscrowStatus = 'LOCKED' | 'CLAIMED' | 'CANCELLED' | 'payment_released' | 'disputed';

export interface JobStatusData {
  id:            string;
  status:        string;
  escrowStatus:  EscrowStatus | null;
  escrowTxHash:  string | null;
  claimTxHash:   string | null;
  payoutAmount:  number | null;  // USDC, 6 decimals
  updatedAt:     string;
}

const POLL_INTERVAL_MS = 8_000;  // 8 seconds — ~1 Base block

export function useJobStatus(jobId: string | null) {
  const [data, setData] = useState<JobStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) return;

    async function fetchStatus() {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const job = await res.json();
        setData(job);
        setError(null);

        // Stop polling when terminal state reached
        const terminal: string[] = ['payment_released', 'cancelled', 'disputed', 'failed'];
        if (terminal.includes(job.status) || terminal.includes(job.escrowStatus)) {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch (err: any) {
        setError(err.message);
      }
    }

    fetchStatus();
    timerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobId]);

  return { data, error };
}
```

### PaymentReleased UI component

```tsx
// components/PaymentReleasedConfirmation.tsx
'use client';

import { useEffect, useState } from 'react';
import { BasescanLink } from './BasescanLink';

interface Props {
  jobId:        string;
  txHash:       string | null;
  providerPct:  number;  // 75
  platformPct:  number;  // 25
  totalUsdc:    number;  // in USDC (e.g., 5.50)
}

export function PaymentReleasedConfirmation({ jobId, txHash, providerPct, platformPct, totalUsdc }: Props) {
  const isTestnet = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID) === 84532;
  const providerAmount = ((totalUsdc * providerPct) / 100).toFixed(2);
  const platformAmount = ((totalUsdc * platformPct) / 100).toFixed(2);

  return (
    <div className="escrow-confirmation escrow-released">
      <div className="confirmation-icon success">✅</div>
      <h3>Payment Released</h3>
      <p>Your job is complete. Payment has been released on-chain.</p>

      <div className="payment-breakdown">
        <h4>Payment Breakdown</h4>
        <div className="breakdown-row">
          <span>Compute Provider (75%)</span>
          <span className="amount">${providerAmount} USDC</span>
        </div>
        <div className="breakdown-row platform">
          <span>DCP Platform Fee (25%)</span>
          <span className="amount">${platformAmount} USDC</span>
        </div>
        <div className="breakdown-row total">
          <span>Total</span>
          <span className="amount">${totalUsdc.toFixed(2)} USDC</span>
        </div>
      </div>

      {txHash && (
        <div className="tx-confirmation">
          <span>On-chain confirmation:</span>
          <BasescanLink txHash={txHash} isTestnet={isTestnet} />
        </div>
      )}

      <div className="escrow-actions">
        <a href={`/jobs/${jobId}`} className="btn-view-results">
          View Job Results
        </a>
        <a href="/marketplace" className="btn-new-job">
          Launch Another Job
        </a>
      </div>
    </div>
  );
}
```

### Integrating payment status into job detail page

```tsx
// app/jobs/[jobId]/page.tsx (excerpt)
'use client';

import { useJobStatus } from '@/hooks/useJobStatus';
import { EscrowStatusBadge } from '@/components/EscrowStatusBadge';
import { PaymentReleasedConfirmation } from '@/components/PaymentReleasedConfirmation';
import { DisputeStatusPanel } from '@/components/DisputeStatusPanel';
import { EscrowLockedConfirmation } from '@/components/EscrowLockedConfirmation';

export default function JobDetailPage({ params }: { params: { jobId: string } }) {
  const { data: job, error } = useJobStatus(params.jobId);

  if (!job) return <LoadingSkeleton />;

  return (
    <div className="job-detail">
      <JobHeader job={job} />

      {/* Escrow status section */}
      <section className="escrow-section">
        {job.status === 'running' && (
          <EscrowLockedConfirmation jobId={job.id} txHash={job.escrowTxHash} />
        )}
        {job.status === 'payment_released' && (
          <PaymentReleasedConfirmation
            jobId={job.id}
            txHash={job.claimTxHash}
            providerPct={75}
            platformPct={25}
            totalUsdc={(job.payoutAmount || 0) / 1_000_000}
          />
        )}
        {job.status === 'disputed' && (
          <DisputeStatusPanel jobId={job.id} disputeTxHash={job.disputeTxHash} />
        )}
        {job.status === 'cancelled' && (
          <EscrowRefundedBanner jobId={job.id} txHash={job.escrowTxHash} />
        )}
      </section>

      <JobResultsPanel job={job} />
    </div>
  );
}
```

---

## 7. DisputeRaised Event — Dispute Status UI

Renters can raise a dispute when:
- Job output is incorrect or incomplete
- Provider claimed funds but did not deliver
- Job completed but quality is unacceptable

The dispute flow routes through the backend (which controls the oracle signature).
The frontend shows dispute status and instructs the renter to wait for ops review.

### Raising a dispute

```tsx
// components/DisputeButton.tsx
'use client';

import { useState } from 'react';

interface Props {
  jobId:  string;
  onRaised: () => void;
}

export function DisputeButton({ jobId, onRaised }: Props) {
  const [step, setStep] = useState<'idle' | 'confirming' | 'submitting' | 'done' | 'error'>('idle');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleRaiseDispute() {
    setStep('submitting');
    try {
      const res = await fetch(`/api/jobs/${jobId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || `Failed: ${res.status}`);
      }
      setStep('done');
      onRaised();
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep('error');
    }
  }

  if (step === 'idle') {
    return (
      <button
        onClick={() => setStep('confirming')}
        className="btn-dispute"
      >
        Raise Dispute
      </button>
    );
  }

  if (step === 'confirming') {
    return (
      <div className="dispute-confirm-dialog">
        <h4>Raise a Dispute</h4>
        <p>
          Raising a dispute will pause payment release and notify the DCP operations
          team for manual review. This process may take up to 24 hours.
        </p>
        <textarea
          placeholder="Describe the issue with this job (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="dispute-reason-input"
        />
        <div className="dispute-actions">
          <button
            onClick={handleRaiseDispute}
            disabled={!reason.trim() || step === 'submitting'}
            className="btn-confirm-dispute"
          >
            Confirm Dispute
          </button>
          <button onClick={() => setStep('idle')} className="btn-cancel">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="dispute-raised-notice">
        ⚠️ Dispute raised. Our team has been notified and will review within 24 hours.
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="dispute-error">
        <p>Failed to raise dispute: {errorMsg}</p>
        <button onClick={() => setStep('idle')} className="btn-retry">Retry</button>
      </div>
    );
  }

  return (
    <div className="dispute-submitting">
      ⏳ Submitting dispute…
    </div>
  );
}
```

### DisputeStatusPanel component

```tsx
// components/DisputeStatusPanel.tsx
'use client';

import { BasescanLink } from './BasescanLink';

interface Props {
  jobId:        string;
  disputeTxHash: string | null;
}

export function DisputeStatusPanel({ jobId, disputeTxHash }: Props) {
  const isTestnet = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID) === 84532;

  return (
    <div className="dispute-status-panel">
      <div className="status-icon dispute">⚠️</div>
      <h3>Dispute Under Review</h3>

      <div className="dispute-timeline">
        <div className="timeline-step done">
          <span className="step-icon">✓</span>
          <span>Dispute raised — DCP ops team notified</span>
        </div>
        <div className="timeline-step active">
          <span className="step-icon">⏳</span>
          <span>Manual review in progress (up to 24 hours)</span>
        </div>
        <div className="timeline-step pending">
          <span className="step-icon">○</span>
          <span>Resolution — refund or payment release</span>
        </div>
      </div>

      {disputeTxHash && (
        <div className="dispute-tx">
          <span>Dispute transaction:</span>
          <BasescanLink txHash={disputeTxHash} isTestnet={isTestnet} />
        </div>
      )}

      <div className="dispute-info">
        <h4>What happens next?</h4>
        <ul>
          <li>The DCP operations team will review the job output and provider logs.</li>
          <li>If the dispute is upheld, you will receive a full USDC refund.</li>
          <li>If the dispute is rejected, payment is released to the provider.</li>
          <li>You will be notified via email and in-app notification.</li>
        </ul>
      </div>

      <div className="dispute-contact">
        <p>
          Need urgent assistance?{' '}
          <a href="mailto:support@dcp.sa">support@dcp.sa</a>
        </p>
      </div>
    </div>
  );
}
```

---

## 8. Escrow Status Polling

### EscrowStatusBadge component

```tsx
// components/EscrowStatusBadge.tsx

type Status = 'LOCKED' | 'CLAIMED' | 'CANCELLED' | 'payment_released' | 'disputed' | 'EMPTY';

const STATUS_CONFIG: Record<Status, { label: string; className: string; icon: string }> = {
  EMPTY:            { label: 'No Escrow',        className: 'status-empty',    icon: '○' },
  LOCKED:           { label: 'Escrow Locked',    className: 'status-locked',   icon: '🔒' },
  CLAIMED:          { label: 'Payment Released', className: 'status-claimed',  icon: '✅' },
  CANCELLED:        { label: 'Refunded',         className: 'status-cancelled',icon: '↩️' },
  payment_released: { label: 'Payment Released', className: 'status-released', icon: '✅' },
  disputed:         { label: 'Dispute Pending',  className: 'status-disputed', icon: '⚠️' },
};

interface Props {
  status: Status;
}

export function EscrowStatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['EMPTY'];
  return (
    <span className={`escrow-badge ${config.className}`}>
      {config.icon} {config.label}
    </span>
  );
}
```

### EscrowRefundedBanner component

```tsx
// components/EscrowRefundedBanner.tsx
'use client';

import { BasescanLink } from './BasescanLink';

interface Props {
  jobId:  string;
  txHash: string | null;
}

export function EscrowRefundedBanner({ jobId, txHash }: Props) {
  const isTestnet = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID) === 84532;

  return (
    <div className="escrow-confirmation escrow-cancelled">
      <div className="confirmation-icon">↩️</div>
      <h3>USDC Refunded</h3>
      <p>
        This job was cancelled or expired before completion. Your USDC has been
        returned to the DCP hot-wallet and credited to your account balance.
      </p>
      {txHash && (
        <div className="refund-tx">
          <span>Refund transaction:</span>
          <BasescanLink txHash={txHash} isTestnet={isTestnet} />
        </div>
      )}
    </div>
  );
}
```

---

## 9. Error States & Handling

### Wallet error messages

```ts
// lib/walletErrors.ts

export function getWalletErrorMessage(error: Error | null): string {
  if (!error) return '';

  const msg = error.message.toLowerCase();

  // User rejections
  if (msg.includes('user rejected') || msg.includes('user denied')) {
    return 'Transaction cancelled. You can try again when ready.';
  }
  if (msg.includes('user closed modal') || msg.includes('modal closed')) {
    return 'Wallet dialog closed. Click "Connect Wallet" to try again.';
  }

  // Network errors
  if (msg.includes('wrong network') || msg.includes('chain mismatch')) {
    return 'Wrong network. Please switch to Base Sepolia in your wallet.';
  }
  if (msg.includes('chain id') || msg.includes('chainid')) {
    return 'Network mismatch. DCP requires Base Sepolia (Chain ID 84532).';
  }

  // Balance errors
  if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
    return 'Insufficient balance. You need USDC on Base Sepolia to submit a job.';
  }

  // Gas errors
  if (msg.includes('gas required exceeds allowance') || msg.includes('out of gas')) {
    return 'Transaction ran out of gas. Please try again.';
  }

  // Allowance errors
  if (msg.includes('allowance') || msg.includes('transfer amount exceeds allowance')) {
    return 'USDC approval needed. The backend will handle this automatically.';
  }

  // Contract revert errors
  if (msg.includes('job already exists')) {
    return 'This job has already been submitted. Check your job history.';
  }
  if (msg.includes('invalid oracle proof')) {
    return 'Payment verification failed. Contact support@dcp.sa.';
  }
  if (msg.includes('not expired yet')) {
    return 'Job is still running. You can cancel after the job expires.';
  }
  if (msg.includes('not locked')) {
    return 'No escrow found for this job. Contact support@dcp.sa.';
  }

  // Connectivity
  if (msg.includes('network request failed') || msg.includes('fetch failed')) {
    return 'Network error. Check your internet connection and try again.';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'Request timed out. The Base network may be congested — try again.';
  }

  // MetaMask-specific
  if (msg.includes('metamask') && msg.includes('not installed')) {
    return 'MetaMask is not installed. Install MetaMask or use WalletConnect.';
  }
  if (msg.includes('-32603') || msg.includes('internal error')) {
    return 'Wallet internal error. Refresh the page and try again.';
  }

  // Generic fallback
  return `Wallet error: ${error.message}`;
}

export function getSubmitErrorMessage(error: Error | null): string {
  if (!error) return '';

  const msg = error.message.toLowerCase();

  if (msg.includes('signature') || msg.includes('sign')) {
    return 'Signature failed. Please try again and approve the signing request.';
  }
  if (msg.includes('insufficient usdc') || msg.includes('balance')) {
    return 'Insufficient USDC balance. Top up your DCP account to submit jobs.';
  }
  if (msg.includes('provider not found') || msg.includes('no provider')) {
    return 'No compute provider available for this GPU tier. Try another model.';
  }
  if (msg.includes('deadline')) {
    return 'Signature expired. Please try again — signatures are valid for 5 minutes.';
  }
  if (msg.includes('nonce')) {
    return 'Nonce mismatch. Refresh the page and try again.';
  }

  return getWalletErrorMessage(error);
}
```

### EscrowErrorBanner component

```tsx
// components/EscrowErrorBanner.tsx

interface Props {
  message: string;
  onRetry?: () => void;
}

export function EscrowErrorBanner({ message, onRetry }: Props) {
  return (
    <div className="escrow-error-banner" role="alert">
      <div className="error-icon">⚠️</div>
      <div className="error-content">
        <p className="error-message">{message}</p>
        <div className="error-actions">
          {onRetry && (
            <button onClick={onRetry} className="btn-retry">
              Try Again
            </button>
          )}
          <a href="mailto:support@dcp.sa" className="link-support">
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
```

### Error state inventory

| Error | Cause | Frontend Handling |
|-------|-------|-------------------|
| User rejected transaction | Renter clicked "Reject" in wallet | Show dismissable banner; allow retry |
| Wrong network | Wallet on Ethereum mainnet/other | Show NetworkGuard; offer one-click switch |
| Insufficient balance | Renter has no USDC on Base Sepolia | Show balance warning with top-up link |
| Signature expired | >5 minutes since signing | Offer retry (new nonce fetched automatically) |
| Nonce mismatch | Race condition / stale nonce | Refresh page instruction |
| Provider unavailable | No active provider for GPU tier | Show alternative GPU models |
| Contract revert: job exists | Duplicate submission | Show link to existing job |
| Contract revert: not expired | Early cancel attempt | Show expiry countdown timer |
| Network request failed | Backend or RPC down | Retry with exponential backoff; show status |
| MetaMask not installed | User has no wallet extension | Show install link + WalletConnect fallback |
| Wallet locked | User's wallet is locked | Show "unlock your wallet" instruction |

---

## 10. Environment Variables

### Next.js frontend

```bash
# .env.local (not committed — copy from .env.example)

# Required — set after Escrow.sol deployment
NEXT_PUBLIC_ESCROW_ADDRESS=0x...        # Deployed Escrow.sol contract address
NEXT_PUBLIC_BASE_CHAIN_ID=84532         # 84532 = Base Sepolia, 8453 = Base mainnet

# Optional — defaults shown
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # Get from https://cloud.walletconnect.com
```

### Basescan URL helper

```ts
// lib/basescan.ts

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID || 84532);

export const basescanBase = CHAIN_ID === 84532
  ? 'https://sepolia.basescan.org'
  : 'https://basescan.org';

export function txLink(hash: string)     { return `${basescanBase}/tx/${hash}`; }
export function addressLink(addr: string){ return `${basescanBase}/address/${addr}`; }
export function contractCode(addr: string){ return `${addr}#code`; }
```

---

## 11. Component Reference

| Component | File | Purpose |
|-----------|------|---------|
| `WalletButton` | `components/WalletButton.tsx` | Connect / disconnect wallet |
| `NetworkGuard` | `components/NetworkGuard.tsx` | Block UI if wrong network; offer switch |
| `JobSubmitFlow` | `components/JobSubmitFlow.tsx` | Full job submission with EIP-712 signing |
| `EscrowLockedConfirmation` | `components/EscrowLockedConfirmation.tsx` | Post-deposit "locked" state |
| `PaymentReleasedConfirmation` | `components/PaymentReleasedConfirmation.tsx` | Post-claim payment breakdown |
| `DisputeButton` | `components/DisputeButton.tsx` | Raise dispute UI |
| `DisputeStatusPanel` | `components/DisputeStatusPanel.tsx` | Dispute under review display |
| `EscrowStatusBadge` | `components/EscrowStatusBadge.tsx` | Status pill for job list/detail |
| `EscrowRefundedBanner` | `components/EscrowRefundedBanner.tsx` | Cancellation / refund confirmation |
| `EscrowErrorBanner` | `components/EscrowErrorBanner.tsx` | Error display with retry |
| `BasescanLink` | `components/BasescanLink.tsx` | On-chain tx link |

| Hook | File | Purpose |
|------|------|---------|
| `useWalletState` | `hooks/useWalletState.ts` | Wallet connection + network state |
| `useSignJobCreation` | `hooks/useSignJobCreation.ts` | EIP-712 typed data signing |
| `useJobStatus` | `hooks/useJobStatus.ts` | Polling job + escrow status |
| `useNetworkValidation` | `hooks/useNetworkValidation.ts` | Network check + switch |

---

## 12. API Endpoints Reference

These are the backend endpoints the frontend escrow UI depends on.
All require `Authorization: Bearer <jwt>` except where noted.

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/auth/nonce` | Get signing nonce + pending job ID |
| `POST` | `/api/jobs/submit` | Submit job with EIP-712 sig; triggers escrow lock |
| `GET`  | `/api/jobs/:id` | Get job status, escrowStatus, escrowTxHash |
| `POST` | `/api/jobs/:id/dispute` | Raise dispute (triggers DisputeRaised event) |
| `GET`  | `/api/admin/escrow-chain/status` | Escrow service health (admin only) |

### POST `/api/jobs/submit` — Request body

```json
{
  "jobId":         "uuid-v4-string",
  "gpuModel":      "RTX 4090",
  "durationHours": 2,
  "templateId":    "arabic-rag-complete",
  "dockerImage":   null,
  "renterAddress": "0xabc...def",
  "maxCostUsdc":   5.50,
  "nonce":         12345,
  "signature":     "0x..."
}
```

### GET `/api/jobs/:id` — Response shape (escrow fields)

```json
{
  "id":            "uuid",
  "status":        "payment_released",
  "escrowStatus":  "CLAIMED",
  "escrowTxHash":  "0xabc...",
  "claimTxHash":   "0xdef...",
  "disputeTxHash": null,
  "payoutAmount":  5500000,
  "updatedAt":     "2026-03-24T10:00:00Z"
}
```

---

## 13. Testing Checklist

### Unit tests

- [ ] `getWalletErrorMessage` returns correct string for each error type
- [ ] `useSignJobCreation` encodes EIP-712 message correctly (snapshot test)
- [ ] `EscrowStatusBadge` renders correct icon and label for each status
- [ ] `JobSubmitFlow` shows signing state when `isPending=true`
- [ ] `DisputeButton` transitions through `idle → confirming → submitting → done`

### Integration tests (wallet mocked)

- [ ] Connecting MetaMask populates wallet address in `WalletButton`
- [ ] Wrong network shows `NetworkGuard` with switch button
- [ ] Successful switch hides `NetworkGuard` and enables submit
- [ ] Job submit flow: sign → submit → `EscrowLockedConfirmation` shown
- [ ] User rejection on signing shows `EscrowErrorBanner` with retry

### E2E tests (Base Sepolia testnet)

- [ ] Full flow: connect wallet → sign → submit → escrow locked on-chain
- [ ] `useJobStatus` poll detects `payment_released` status within 2 poll cycles
- [ ] `PaymentReleasedConfirmation` renders with correct USDC amounts
- [ ] Dispute flow: `DisputeButton` → `DisputeStatusPanel` → `admin_alerts` row created
- [ ] Basescan links open correct URL for testnet vs mainnet

### Error state testing

- [ ] Reject signature → `"Transaction cancelled"` message shown
- [ ] Wrong network → NetworkGuard shown, switch works
- [ ] Backend 503 → `"Network error"` message shown
- [ ] Expired nonce (>5 min) → retry refreshes nonce and re-signs
- [ ] `NEXT_PUBLIC_ESCROW_ADDRESS` not set → console warning, no crash

---

## Appendix: Escrow Contract Events Reference

Events emitted by `Escrow.sol` that the backend bridges to the frontend:

| Event | Solidity signature | Triggered when |
|-------|-------------------|----------------|
| `Deposited` | `Deposited(bytes32 jobId, address renter, address provider, uint256 amount, uint256 expiry)` | `depositAndLock()` called |
| `Claimed` | `Claimed(bytes32 jobId, address provider, uint256 providerAmount, uint256 feeAmount)` | `claimLock()` called |
| `Cancelled` | `Cancelled(bytes32 jobId, address renter, uint256 amount)` | `cancelExpiredLock()` called |
| `PaymentReleased` | `PaymentReleased(bytes32 jobId, address provider, uint256 amount)` | DCP-903 bridge after claim |
| `DisputeRaised` | `DisputeRaised(bytes32 jobId, address renter)` | DCP-903 bridge after dispute |

The frontend never subscribes to these events directly. It reads the backend-reconciled
status from `GET /api/jobs/:id`. The DCP-903 escrow listener translates on-chain events
into database row updates that the API exposes.

---

*Spec version: 1.0 — 2026-03-24 — Blockchain Engineer (DCP-905)*
*Hand off to: Frontend Developer for implementation*
*Dependency: `NEXT_PUBLIC_ESCROW_ADDRESS` will be set after founder approves deployment*
