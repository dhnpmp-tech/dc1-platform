const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * ProviderStake — Hardhat test suite
 *
 * Covers all 5 required scenarios:
 *   1. Provider can stake above minimum
 *   2. Provider cannot stake below minimum
 *   3. Provider can unstake after lock period
 *   4. Admin can slash a staked provider
 *   5. Non-admin cannot slash
 */
describe("ProviderStake", function () {
  let providerStake;
  let owner, provider, stranger;

  const MIN_STAKE = ethers.parseEther("100");
  const LOCK_PERIOD = 7 * 24 * 60 * 60; // 7 days in seconds

  beforeEach(async function () {
    [owner, provider, stranger] = await ethers.getSigners();

    const ProviderStake = await ethers.getContractFactory("ProviderStake");
    providerStake = await ProviderStake.deploy(owner.address);
    await providerStake.waitForDeployment();
  });

  // ── Test 1: Provider can stake above minimum ────────────────────────────────
  it("1. Provider can stake at or above minimum", async function () {
    const stakeAmount = ethers.parseEther("100"); // exactly MIN_STAKE

    await expect(
      providerStake.connect(provider).stake({ value: stakeAmount })
    )
      .to.emit(providerStake, "Staked")
      .withArgs(provider.address, stakeAmount);

    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(stakeAmount);
    expect(record.isActive).to.be.true;

    // Also works with more than minimum
    const [, provider2] = await ethers.getSigners();
    const [, , , provider3] = await ethers.getSigners();
    const largeStake = ethers.parseEther("250");
    await expect(
      providerStake.connect(provider3).stake({ value: largeStake })
    )
      .to.emit(providerStake, "Staked")
      .withArgs(provider3.address, largeStake);
  });

  // ── Test 2: Provider cannot stake below minimum ─────────────────────────────
  it("2. Provider cannot stake below minimum", async function () {
    const tooLittle = ethers.parseEther("99"); // 1 ETH below minimum

    await expect(
      providerStake.connect(provider).stake({ value: tooLittle })
    ).to.be.revertedWithCustomError(providerStake, "BelowMinimum");

    // Zero stake also rejected
    await expect(
      providerStake.connect(provider).stake({ value: 0 })
    ).to.be.revertedWithCustomError(providerStake, "BelowMinimum");

    // Confirm no stake was recorded
    const record = await providerStake.getStake(provider.address);
    expect(record.isActive).to.be.false;
  });

  // ── Test 3: Provider can unstake after lock period ──────────────────────────
  it("3. Provider can unstake after the 7-day lock period", async function () {
    const stakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });

    // Cannot unstake before lock period expires
    await expect(
      providerStake.connect(provider).unstake(stakeAmount)
    ).to.be.revertedWithCustomError(providerStake, "LockPeriodNotElapsed");

    // Advance time past the lock period
    await time.increase(LOCK_PERIOD + 1);

    const balanceBefore = await ethers.provider.getBalance(provider.address);

    const tx = await providerStake.connect(provider).unstake(stakeAmount);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;

    await expect(tx)
      .to.emit(providerStake, "Unstaked")
      .withArgs(provider.address, stakeAmount);

    const balanceAfter = await ethers.provider.getBalance(provider.address);
    expect(balanceAfter).to.be.closeTo(
      balanceBefore + stakeAmount - gasUsed,
      ethers.parseEther("0.001") // tolerance for gas estimation
    );

    const record = await providerStake.getStake(provider.address);
    expect(record.isActive).to.be.false;
    expect(record.amount).to.equal(0n);
  });

  // ── Test 4: Admin can slash a staked provider ───────────────────────────────
  it("4. Admin can slash a staked provider", async function () {
    const stakeAmount = ethers.parseEther("100");
    const slashAmount = ethers.parseEther("20");
    const reason = "missed SLA 3 consecutive times";

    await providerStake.connect(provider).stake({ value: stakeAmount });

    await expect(
      providerStake.connect(owner).slash(provider.address, slashAmount, reason)
    )
      .to.emit(providerStake, "Slashed")
      .withArgs(provider.address, slashAmount, reason);

    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(stakeAmount - slashAmount);
    expect(record.isActive).to.be.true; // still active (partial slash)

    // Full slash deactivates the stake
    const remaining = stakeAmount - slashAmount;
    await providerStake
      .connect(owner)
      .slash(provider.address, remaining, "repeated violation");
    const finalRecord = await providerStake.getStake(provider.address);
    expect(finalRecord.amount).to.equal(0n);
    expect(finalRecord.isActive).to.be.false;
  });

  // ── Test 5: Non-admin cannot slash ─────────────────────────────────────────
  it("5. Non-admin cannot slash a provider", async function () {
    const stakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });

    // stranger (non-owner) attempts to slash — must revert with OwnableUnauthorizedAccount
    await expect(
      providerStake
        .connect(stranger)
        .slash(provider.address, ethers.parseEther("10"), "malicious attempt")
    ).to.be.revertedWithCustomError(providerStake, "OwnableUnauthorizedAccount");

    // Provider's stake is untouched
    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(stakeAmount);
    expect(record.isActive).to.be.true;
  });
});
