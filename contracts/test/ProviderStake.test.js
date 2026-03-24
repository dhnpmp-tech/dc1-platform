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
 *
 * DCP-916 Edge Cases (tests 6–14):
 *   6. Multiple providers stake independently
 *   7. Slash before unstake reduces balance
 *   8. Slash entire stake → 0 balance + inactive
 *   9. Re-stake after full slash
 *  10. AlreadyStaked reverts
 *  11. Zero address handling
 *  12. InsufficientStake on over-unstake
 *  13. Partial unstake leaves stake active
 *  14. Owner withdraws slashed funds
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

  // ────────────────────────────────────────────────────────────────────────────
  // DCP-916 Edge Cases
  // ────────────────────────────────────────────────────────────────────────────

  // ── Test 6: Multiple providers stake independently ──────────────────────────
  it("6. Multiple providers stake independently with isolated balances", async function () {
    const signers = await ethers.getSigners();
    const provider1 = signers[1]; // same as provider
    const provider2 = signers[2]; // same as stranger
    const provider3 = signers[3];

    const stake1 = ethers.parseEther("100");
    const stake2 = ethers.parseEther("250");
    const stake3 = ethers.parseEther("500");

    await providerStake.connect(provider1).stake({ value: stake1 });
    await providerStake.connect(provider2).stake({ value: stake2 });
    await providerStake.connect(provider3).stake({ value: stake3 });

    const record1 = await providerStake.getStake(provider1.address);
    const record2 = await providerStake.getStake(provider2.address);
    const record3 = await providerStake.getStake(provider3.address);

    expect(record1.amount).to.equal(stake1);
    expect(record1.isActive).to.be.true;
    expect(record2.amount).to.equal(stake2);
    expect(record2.isActive).to.be.true;
    expect(record3.amount).to.equal(stake3);
    expect(record3.isActive).to.be.true;

    // Total ETH held in contract equals sum of all stakes
    const contractBalance = await ethers.provider.getBalance(
      await providerStake.getAddress()
    );
    expect(contractBalance).to.equal(stake1 + stake2 + stake3);
  });

  // ── Test 7: Slash reduces stake before unstake ──────────────────────────────
  it("7. Slash before unstake — slashed amount reduces withdrawable balance", async function () {
    const stakeAmount = ethers.parseEther("200");
    const slashAmount = ethers.parseEther("50");

    await providerStake.connect(provider).stake({ value: stakeAmount });
    await providerStake
      .connect(owner)
      .slash(provider.address, slashAmount, "SLA breach");

    // Verify stake is reduced
    const afterSlash = await providerStake.getStake(provider.address);
    expect(afterSlash.amount).to.equal(stakeAmount - slashAmount);
    expect(afterSlash.isActive).to.be.true;

    // Advance past lock period and unstake remaining balance
    await time.increase(LOCK_PERIOD + 1);
    const remaining = stakeAmount - slashAmount;

    await expect(providerStake.connect(provider).unstake(remaining))
      .to.emit(providerStake, "Unstaked")
      .withArgs(provider.address, remaining);

    const finalRecord = await providerStake.getStake(provider.address);
    expect(finalRecord.amount).to.equal(0n);
    expect(finalRecord.isActive).to.be.false;
  });

  // ── Test 8: Slash entire stake — fully slashed provider has 0 balance ───────
  it("8. Slash entire stake leaves provider with 0 balance and inactive", async function () {
    const stakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });

    await expect(
      providerStake
        .connect(owner)
        .slash(provider.address, stakeAmount, "full violation")
    )
      .to.emit(providerStake, "Slashed")
      .withArgs(provider.address, stakeAmount, "full violation");

    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(0n);
    expect(record.isActive).to.be.false;
  });

  // ── Test 9: Re-stake after full slash ───────────────────────────────────────
  it("9. Provider can re-stake after being fully slashed", async function () {
    const stakeAmount = ethers.parseEther("100");

    // Stake and get fully slashed
    await providerStake.connect(provider).stake({ value: stakeAmount });
    await providerStake
      .connect(owner)
      .slash(provider.address, stakeAmount, "full slash for re-stake test");

    // isActive is now false — re-stake should succeed
    await expect(
      providerStake.connect(provider).stake({ value: stakeAmount })
    )
      .to.emit(providerStake, "Staked")
      .withArgs(provider.address, stakeAmount);

    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(stakeAmount);
    expect(record.isActive).to.be.true;
  });

  // ── Test 10: Already-staked provider cannot stake again ─────────────────────
  it("10. Active provider cannot stake again (AlreadyStaked)", async function () {
    const stakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });

    await expect(
      providerStake.connect(provider).stake({ value: stakeAmount })
    ).to.be.revertedWithCustomError(providerStake, "AlreadyStaked");
  });

  // ── Test 11: Zero address handling ──────────────────────────────────────────
  it("11. getStake for zero address returns empty inactive record", async function () {
    const record = await providerStake.getStake(ethers.ZeroAddress);
    expect(record.amount).to.equal(0n);
    expect(record.isActive).to.be.false;
    expect(record.stakedAt).to.equal(0n);
  });

  // ── Test 12: Unstake cooldown — InsufficientStake on over-unstake ───────────
  it("12. Unstaking more than staked balance reverts with InsufficientStake", async function () {
    const stakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });
    await time.increase(LOCK_PERIOD + 1);

    const overAmount = stakeAmount + ethers.parseEther("1");
    await expect(
      providerStake.connect(provider).unstake(overAmount)
    ).to.be.revertedWithCustomError(providerStake, "InsufficientStake");
  });

  // ── Test 13: Partial unstake leaves remaining stake active ──────────────────
  it("13. Partial unstake leaves remaining balance active", async function () {
    const stakeAmount = ethers.parseEther("200");
    const unstakeAmount = ethers.parseEther("100");

    await providerStake.connect(provider).stake({ value: stakeAmount });
    await time.increase(LOCK_PERIOD + 1);

    await providerStake.connect(provider).unstake(unstakeAmount);

    const record = await providerStake.getStake(provider.address);
    expect(record.amount).to.equal(stakeAmount - unstakeAmount);
    expect(record.isActive).to.be.true;
  });

  // ── Test 14: Owner can withdraw slashed funds ────────────────────────────────
  it("14. Owner can withdraw slashed funds accumulated in contract", async function () {
    const stakeAmount = ethers.parseEther("100");
    const slashAmount = ethers.parseEther("40");

    await providerStake.connect(provider).stake({ value: stakeAmount });
    await providerStake
      .connect(owner)
      .slash(provider.address, slashAmount, "slash for withdrawal test");

    const ownerBalBefore = await ethers.provider.getBalance(owner.address);
    const tx = await providerStake.connect(owner).withdrawSlashed(slashAmount);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * tx.gasPrice;
    const ownerBalAfter = await ethers.provider.getBalance(owner.address);

    expect(ownerBalAfter).to.be.closeTo(
      ownerBalBefore + slashAmount - gasUsed,
      ethers.parseEther("0.001")
    );
  });
});
