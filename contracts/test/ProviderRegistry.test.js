const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * ProviderRegistry — Hardhat test suite
 *
 * Covers:
 *   registerProvider    — happy path, duplicate, zero stake, wrong caller
 *   deregisterProvider  — happy path, stake returned, non-owner rejection
 *   recordJobCompletion — oracle updates, score increase, non-oracle rejection
 *   updateUptimeScore   — oracle updates, out-of-range rejection
 *   raiseDispute        — happy path, unregistered provider, empty reason
 *   resolveDispute      — provider fault / no fault, score impact, double-resolve
 *   getProviderScore    — score formula validation across edge cases
 *   setOracle           — owner update, non-owner rejection, zero address
 *   getProvider         — view returns correct struct
 *   getDispute          — view returns correct struct, not-found revert
 */
describe("ProviderRegistry", function () {
  // ── Fixtures ────────────────────────────────────────────────────────────────

  let registry, token;
  let owner, oracle, provider, renter, stranger;

  const STAKE   = ethers.parseUnits("100", 6); // 100 USDC-like tokens
  const JOB_ID  = 42n;
  const TOKENS  = 1_000n;

  beforeEach(async function () {
    [owner, oracle, provider, renter, stranger] = await ethers.getSigners();

    // Use MockUSDC as the stake token
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    token = await MockUSDC.deploy();

    // Mint stake tokens to provider and stranger
    await token.mint(provider.address, ethers.parseUnits("1000", 6));
    await token.mint(stranger.address, ethers.parseUnits("1000", 6));

    // Deploy registry
    const ProviderRegistry = await ethers.getContractFactory("ProviderRegistry");
    registry = await ProviderRegistry.deploy(await token.getAddress(), oracle.address);

    // Provider approves registry to pull stake
    await token.connect(provider).approve(await registry.getAddress(), ethers.MaxUint256);
    await token.connect(stranger).approve(await registry.getAddress(), ethers.MaxUint256);
  });

  // ── registerProvider ────────────────────────────────────────────────────────

  describe("registerProvider", function () {
    it("registers provider, locks stake, emits ProviderRegistered", async function () {
      const balBefore = await token.balanceOf(provider.address);

      await expect(registry.connect(provider).registerProvider(provider.address, STAKE))
        .to.emit(registry, "ProviderRegistered")
        .withArgs(provider.address, STAKE);

      // Stake held in contract
      expect(await token.balanceOf(await registry.getAddress())).to.equal(STAKE);
      expect(await token.balanceOf(provider.address)).to.equal(balBefore - STAKE);

      // Record stored correctly
      const rec = await registry.getProvider(provider.address);
      expect(rec.registered).to.be.true;
      expect(rec.stake).to.equal(STAKE);
      expect(rec.completedJobs).to.equal(0);
      expect(rec.disputes).to.equal(0);
      expect(rec.resolvedFaults).to.equal(0);
      expect(rec.uptimeScore).to.equal(10_000); // starts at 100 %
    });

    it("owner can register a provider on their behalf", async function () {
      // Owner calls registerProvider for provider (owner pays from provider's allowance)
      await expect(registry.connect(owner).registerProvider(provider.address, STAKE))
        .to.emit(registry, "ProviderRegistered")
        .withArgs(provider.address, STAKE);
    });

    it("reverts if provider is already registered", async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
      await expect(
        registry.connect(provider).registerProvider(provider.address, STAKE)
      ).to.be.revertedWith("Already registered");
    });

    it("reverts on zero stake", async function () {
      await expect(
        registry.connect(provider).registerProvider(provider.address, 0)
      ).to.be.revertedWith("Stake must be > 0");
    });

    it("reverts on zero provider address", async function () {
      await expect(
        registry.connect(owner).registerProvider(ethers.ZeroAddress, STAKE)
      ).to.be.revertedWith("Invalid provider address");
    });

    it("reverts when called by unauthorized stranger", async function () {
      await expect(
        registry.connect(stranger).registerProvider(provider.address, STAKE)
      ).to.be.revertedWith("Not authorised to register");
    });

    it("reverts when provider has insufficient token balance", async function () {
      const broke = renter; // renter has no tokens
      // Give approval but no balance
      await token.connect(broke).approve(await registry.getAddress(), ethers.MaxUint256);
      await expect(
        registry.connect(broke).registerProvider(broke.address, STAKE)
      ).to.be.reverted; // SafeERC20 transfer revert
    });
  });

  // ── deregisterProvider ──────────────────────────────────────────────────────

  describe("deregisterProvider", function () {
    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
    });

    it("deregisters and returns stake to provider", async function () {
      const balBefore = await token.balanceOf(provider.address);

      await expect(registry.connect(owner).deregisterProvider(provider.address))
        .to.emit(registry, "ProviderDeregistered")
        .withArgs(provider.address, STAKE);

      expect(await token.balanceOf(provider.address)).to.equal(balBefore + STAKE);
      expect(await token.balanceOf(await registry.getAddress())).to.equal(0);

      const rec = await registry.getProvider(provider.address);
      expect(rec.registered).to.be.false;
      expect(rec.stake).to.equal(0);
    });

    it("reverts if provider is not registered", async function () {
      await expect(
        registry.connect(owner).deregisterProvider(stranger.address)
      ).to.be.revertedWith("Not registered");
    });

    it("non-owner cannot deregister", async function () {
      await expect(
        registry.connect(stranger).deregisterProvider(provider.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ── recordJobCompletion ──────────────────────────────────────────────────────

  describe("recordJobCompletion", function () {
    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
    });

    it("increments completedJobs and tokensProcessed, emits ReputationUpdated", async function () {
      await expect(
        registry.connect(oracle).recordJobCompletion(provider.address, JOB_ID, TOKENS)
      )
        .to.emit(registry, "ReputationUpdated")
        // Score after 1 job: BASE(50) + jobs(1) + uptime(20 at 100%) = 71
        .withArgs(provider.address, 1n, TOKENS, 71n);

      const rec = await registry.getProvider(provider.address);
      expect(rec.completedJobs).to.equal(1);
      expect(rec.tokensProcessed).to.equal(TOKENS);
    });

    it("score increases with each completed job (up to +30 cap)", async function () {
      const scoreBefore = await registry.getProviderScore(provider.address);

      await registry.connect(oracle).recordJobCompletion(provider.address, JOB_ID, TOKENS);
      const scoreAfter = await registry.getProviderScore(provider.address);

      expect(scoreAfter).to.be.greaterThan(scoreBefore);
    });

    it("score is capped at 100 even with many completed jobs", async function () {
      // Record 50 jobs — far above the 30-job bonus cap
      for (let i = 0; i < 50; i++) {
        await registry.connect(oracle).recordJobCompletion(provider.address, BigInt(i), 100n);
      }
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.be.at.most(100n);
    });

    it("accumulates tokensProcessed across multiple calls", async function () {
      await registry.connect(oracle).recordJobCompletion(provider.address, 1n, 500n);
      await registry.connect(oracle).recordJobCompletion(provider.address, 2n, 700n);

      const rec = await registry.getProvider(provider.address);
      expect(rec.completedJobs).to.equal(2);
      expect(rec.tokensProcessed).to.equal(1200n);
    });

    it("reverts if caller is not oracle", async function () {
      await expect(
        registry.connect(stranger).recordJobCompletion(provider.address, JOB_ID, TOKENS)
      ).to.be.revertedWith("Only oracle");
    });

    it("reverts for unregistered provider", async function () {
      await expect(
        registry.connect(oracle).recordJobCompletion(stranger.address, JOB_ID, TOKENS)
      ).to.be.revertedWith("Provider not registered");
    });
  });

  // ── updateUptimeScore ────────────────────────────────────────────────────────

  describe("updateUptimeScore", function () {
    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
    });

    it("oracle updates uptime and emits UptimeUpdated", async function () {
      await expect(
        registry.connect(oracle).updateUptimeScore(provider.address, 8_500n)
      ).to.emit(registry, "UptimeUpdated");

      const rec = await registry.getProvider(provider.address);
      expect(rec.uptimeScore).to.equal(8_500n);
    });

    it("low uptime reduces score", async function () {
      const scoreBefore = await registry.getProviderScore(provider.address);
      // 0 % uptime
      await registry.connect(oracle).updateUptimeScore(provider.address, 0n);
      const scoreAfter = await registry.getProviderScore(provider.address);
      expect(scoreAfter).to.be.lessThan(scoreBefore);
    });

    it("reverts if uptime > 10 000 BPS", async function () {
      await expect(
        registry.connect(oracle).updateUptimeScore(provider.address, 10_001n)
      ).to.be.revertedWith("Score out of range");
    });

    it("reverts if caller is not oracle", async function () {
      await expect(
        registry.connect(stranger).updateUptimeScore(provider.address, 9_000n)
      ).to.be.revertedWith("Only oracle");
    });

    it("reverts for unregistered provider", async function () {
      await expect(
        registry.connect(oracle).updateUptimeScore(stranger.address, 9_000n)
      ).to.be.revertedWith("Provider not registered");
    });
  });

  // ── raiseDispute ──────────────────────────────────────────────────────────────

  describe("raiseDispute", function () {
    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
    });

    it("creates dispute, increments provider.disputes, emits DisputeRaised", async function () {
      const reason = "Job never completed — GPU idle for 2 hours";

      await expect(
        registry.connect(renter).raiseDispute(provider.address, JOB_ID, reason)
      )
        .to.emit(registry, "DisputeRaised")
        .withArgs(1n, provider.address, renter.address, JOB_ID, reason);

      expect(await registry.disputeCount()).to.equal(1n);

      const d = await registry.getDispute(1n);
      expect(d.provider).to.equal(provider.address);
      expect(d.renter).to.equal(renter.address);
      expect(d.jobId).to.equal(JOB_ID);
      expect(d.reason).to.equal(reason);
      expect(d.resolved).to.be.false;

      const rec = await registry.getProvider(provider.address);
      expect(rec.disputes).to.equal(1);
    });

    it("increments disputeId for each new dispute", async function () {
      await registry.connect(renter).raiseDispute(provider.address, 1n, "reason A");
      await registry.connect(renter).raiseDispute(provider.address, 2n, "reason B");
      expect(await registry.disputeCount()).to.equal(2n);
    });

    it("reverts for unregistered provider", async function () {
      await expect(
        registry.connect(renter).raiseDispute(stranger.address, JOB_ID, "bad provider")
      ).to.be.revertedWith("Provider not registered");
    });

    it("reverts with empty reason", async function () {
      await expect(
        registry.connect(renter).raiseDispute(provider.address, JOB_ID, "")
      ).to.be.revertedWith("Reason required");
    });
  });

  // ── resolveDispute ────────────────────────────────────────────────────────────

  describe("resolveDispute", function () {
    let disputeId;

    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
      const tx = await registry.connect(renter).raiseDispute(provider.address, JOB_ID, "no delivery");
      const receipt = await tx.wait();
      disputeId = 1n;
    });

    it("resolves in provider's favour: no score penalty, emits DisputeResolved", async function () {
      const scoreBefore = await registry.getProviderScore(provider.address);

      await expect(registry.connect(owner).resolveDispute(disputeId, false))
        .to.emit(registry, "DisputeResolved")
        .withArgs(disputeId, provider.address, false, scoreBefore);

      const d = await registry.getDispute(disputeId);
      expect(d.resolved).to.be.true;
      expect(d.providerFault).to.be.false;

      // No change to resolvedFaults
      const rec = await registry.getProvider(provider.address);
      expect(rec.resolvedFaults).to.equal(0);
    });

    it("resolves as provider fault: increments resolvedFaults, lowers score", async function () {
      const scoreBefore = await registry.getProviderScore(provider.address);

      await expect(registry.connect(owner).resolveDispute(disputeId, true))
        .to.emit(registry, "DisputeResolved");

      const rec = await registry.getProvider(provider.address);
      expect(rec.resolvedFaults).to.equal(1);

      const scoreAfter = await registry.getProviderScore(provider.address);
      expect(scoreAfter).to.be.lessThan(scoreBefore);
    });

    it("score reaches 0 after enough faults", async function () {
      // Register fresh disputes and resolve all as fault
      for (let i = 0; i < 10; i++) {
        const tx = await registry.connect(renter).raiseDispute(provider.address, BigInt(i + 100), `fault ${i}`);
        await tx.wait();
        await registry.connect(owner).resolveDispute(BigInt(i + 2), true);
      }
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.equal(0n);
    });

    it("reverts on double-resolve", async function () {
      await registry.connect(owner).resolveDispute(disputeId, false);
      await expect(
        registry.connect(owner).resolveDispute(disputeId, true)
      ).to.be.revertedWith("Already resolved");
    });

    it("reverts for non-existent dispute", async function () {
      await expect(
        registry.connect(owner).resolveDispute(999n, false)
      ).to.be.revertedWith("Dispute not found");
    });

    it("non-owner cannot resolve disputes", async function () {
      await expect(
        registry.connect(stranger).resolveDispute(disputeId, false)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  // ── getProviderScore — formula validation ────────────────────────────────────

  describe("getProviderScore — score formula", function () {
    beforeEach(async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
    });

    it("new provider starts at 70 (BASE=50 + UPTIME_BONUS=20 at 100% uptime)", async function () {
      const score = await registry.getProviderScore(provider.address);
      // BASE(50) + jobBonus(0) + uptimeBonus(20 at 10000/10000) - faults(0) = 70
      expect(score).to.equal(70n);
    });

    it("score after 1 job = 71 (BASE=50 + job=1 + uptime=20)", async function () {
      await registry.connect(oracle).recordJobCompletion(provider.address, 1n, 100n);
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.equal(71n);
    });

    it("score after 30 jobs = 100 (capped: 50+30+20=100)", async function () {
      for (let i = 0; i < 30; i++) {
        await registry.connect(oracle).recordJobCompletion(provider.address, BigInt(i), 10n);
      }
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.equal(100n);
    });

    it("one fault at 0 jobs drops score to 60 (70 - 10)", async function () {
      await registry.connect(renter).raiseDispute(provider.address, 1n, "failure");
      await registry.connect(owner).resolveDispute(1n, true);
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.equal(60n);
    });

    it("score is 0 when faults exceed all positive components", async function () {
      // 8 faults = 80 penalty; max positives = 100; so score = max(0, 100-80) = 20
      // 11 faults = 110 penalty > 100 → clamped to 0
      for (let i = 0; i < 30; i++) {
        await registry.connect(oracle).recordJobCompletion(provider.address, BigInt(i), 10n);
      }
      for (let i = 0; i < 11; i++) {
        await registry.connect(renter).raiseDispute(provider.address, BigInt(i + 50), `fault-${i}`);
        await registry.connect(owner).resolveDispute(BigInt(i + 1), true);
      }
      const score = await registry.getProviderScore(provider.address);
      expect(score).to.equal(0n);
    });

    it("reverts for unregistered provider", async function () {
      await expect(
        registry.getProviderScore(stranger.address)
      ).to.be.revertedWith("Provider not registered");
    });
  });

  // ── setOracle ────────────────────────────────────────────────────────────────

  describe("setOracle", function () {
    it("owner can update oracle and emits OracleUpdated", async function () {
      await expect(registry.connect(owner).setOracle(stranger.address))
        .to.emit(registry, "OracleUpdated")
        .withArgs(oracle.address, stranger.address);

      expect(await registry.oracle()).to.equal(stranger.address);
    });

    it("new oracle can record job completions after rotation", async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
      await registry.connect(owner).setOracle(stranger.address);

      await expect(
        registry.connect(stranger).recordJobCompletion(provider.address, 1n, 100n)
      ).to.emit(registry, "ReputationUpdated");

      // Old oracle no longer works
      await expect(
        registry.connect(oracle).recordJobCompletion(provider.address, 2n, 100n)
      ).to.be.revertedWith("Only oracle");
    });

    it("non-owner cannot update oracle", async function () {
      await expect(
        registry.connect(stranger).setOracle(stranger.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("reverts on zero address", async function () {
      await expect(
        registry.connect(owner).setOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle address");
    });
  });

  // ── getDispute ───────────────────────────────────────────────────────────────

  describe("getDispute", function () {
    it("reverts for non-existent dispute ID", async function () {
      await expect(registry.getDispute(999n)).to.be.revertedWith("Dispute not found");
    });
  });

  // ── disputeCount ─────────────────────────────────────────────────────────────

  describe("disputeCount", function () {
    it("starts at 0 and increments with each raised dispute", async function () {
      await registry.connect(provider).registerProvider(provider.address, STAKE);
      expect(await registry.disputeCount()).to.equal(0n);

      await registry.connect(renter).raiseDispute(provider.address, 1n, "a");
      expect(await registry.disputeCount()).to.equal(1n);

      await registry.connect(renter).raiseDispute(provider.address, 2n, "b");
      expect(await registry.disputeCount()).to.equal(2n);
    });
  });
});
