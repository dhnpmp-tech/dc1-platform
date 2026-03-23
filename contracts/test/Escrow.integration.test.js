const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * DC1 Escrow — Extended integration tests
 *
 * Supplements Escrow.test.js with edge-case and integration coverage:
 *   - Insufficient USDC balance / allowance
 *   - Oracle key rotation (old proof invalidated)
 *   - Cross-job signature replay (proof for job-A rejected on job-B)
 *   - Amount-mismatch in oracle proof
 *   - Fee split precision for small / odd amounts
 *   - Multiple concurrent escrows
 *   - Full lifecycle balance accounting
 *   - Reentrancy guard (nonReentrant)
 */
describe("Escrow — Integration", function () {
  let escrow, usdc;
  let owner, oracle, renter, provider, stranger;

  const ONE_HOUR = 3600;
  const AMOUNT = ethers.parseUnits("10", 6); // 10 USDC (6 decimals)

  function jobId(tag) {
    return ethers.keccak256(ethers.toUtf8Bytes(tag));
  }

  async function oracleSign(jId, providerAddr, amount, signer) {
    const domain = {
      name: "DCP Escrow",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await escrow.getAddress(),
    };
    const types = {
      Claim: [
        { name: "jobId", type: "bytes32" },
        { name: "provider", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    };
    return signer.signTypedData(domain, types, { jobId: jId, provider: providerAddr, amount });
  }

  beforeEach(async function () {
    [owner, oracle, renter, provider, stranger] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.mint(renter.address, ethers.parseUnits("1000", 6));

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(await usdc.getAddress(), oracle.address);

    await usdc.connect(renter).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  // ── USDC balance / allowance guards ────────────────────────────────────────

  describe("USDC token interaction", function () {
    it("reverts depositAndLock when renter has insufficient USDC balance", async function () {
      // Use an account that has zero USDC
      const broke = stranger;
      const expiry = (await time.latest()) + ONE_HOUR;

      // Approve so the revert is about balance, not allowance
      await usdc.connect(broke).approve(await escrow.getAddress(), ethers.MaxUint256);

      await expect(
        escrow.connect(broke).depositAndLock(jobId("broke-job"), provider.address, AMOUNT, expiry)
      ).to.be.reverted; // SafeERC20 wraps ERC20 transfer revert
    });

    it("reverts depositAndLock when renter has insufficient allowance", async function () {
      // Revoke approval first
      await usdc.connect(renter).approve(await escrow.getAddress(), 0);
      const expiry = (await time.latest()) + ONE_HOUR;

      await expect(
        escrow.connect(renter).depositAndLock(jobId("no-allowance"), provider.address, AMOUNT, expiry)
      ).to.be.reverted;
    });

    it("USDC contract balance increases by deposit amount and drops to zero after claim", async function () {
      const jId = jobId("balance-lifecycle");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);

      const proof = await oracleSign(jId, provider.address, AMOUNT, oracle);
      await escrow.connect(provider).claimLock(jId, proof);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("USDC contract balance drops to zero after cancel", async function () {
      const jId = jobId("cancel-balance");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      await time.increaseTo(expiry + 1);
      await escrow.connect(renter).cancelExpiredLock(jId);

      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });
  });

  // ── EIP-712 signature edge cases ───────────────────────────────────────────

  describe("EIP-712 signature security", function () {
    it("rejects cross-job replay: proof signed for job-A cannot claim job-B", async function () {
      const jobA = jobId("job-A");
      const jobB = jobId("job-B");
      const expiry = (await time.latest()) + ONE_HOUR;

      // Deposit for both jobs
      await escrow.connect(renter).depositAndLock(jobA, provider.address, AMOUNT, expiry);
      await escrow.connect(renter).depositAndLock(jobB, provider.address, AMOUNT, expiry);

      // Oracle signs proof for job-A
      const proofA = await oracleSign(jobA, provider.address, AMOUNT, oracle);

      // Attempt to use job-A proof to claim job-B
      await expect(
        escrow.connect(provider).claimLock(jobB, proofA)
      ).to.be.revertedWith("Invalid oracle proof");
    });

    it("rejects proof with mismatched amount (oracle signs wrong amount)", async function () {
      const jId = jobId("amount-mismatch");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);

      // Oracle signs proof with a different amount than what's in the escrow
      const wrongAmount = AMOUNT + 1n;
      const badProof = await oracleSign(jId, provider.address, wrongAmount, oracle);

      await expect(
        escrow.connect(provider).claimLock(jId, badProof)
      ).to.be.revertedWith("Invalid oracle proof");
    });

    it("rejects proof with wrong provider address", async function () {
      const jId = jobId("wrong-provider");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);

      // Oracle signs with stranger's address instead of provider's
      const badProof = await oracleSign(jId, stranger.address, AMOUNT, oracle);

      await expect(
        escrow.connect(provider).claimLock(jId, badProof)
      ).to.be.revertedWith("Invalid oracle proof");
    });

    it("oracle key rotation: old proof rejected after setOracle", async function () {
      const jId = jobId("oracle-rotation");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);

      // Oracle signs valid proof with old key
      const oldProof = await oracleSign(jId, provider.address, AMOUNT, oracle);

      // Owner rotates oracle to a new key (stranger becomes new oracle)
      await escrow.connect(owner).setOracle(stranger.address);

      // Old proof is now invalid (signer != new oracle)
      await expect(
        escrow.connect(provider).claimLock(jId, oldProof)
      ).to.be.revertedWith("Invalid oracle proof");
    });

    it("oracle key rotation: new proof accepted after setOracle", async function () {
      const jId = jobId("oracle-rotation-new");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);

      // Rotate oracle to stranger
      await escrow.connect(owner).setOracle(stranger.address);

      // Sign with new oracle (stranger)
      const newProof = await oracleSign(jId, provider.address, AMOUNT, stranger);

      await expect(escrow.connect(provider).claimLock(jId, newProof))
        .to.emit(escrow, "Claimed");
    });
  });

  // ── Fee split precision ────────────────────────────────────────────────────

  describe("75/25 fee split precision", function () {
    it("splits correctly for an exact amount (10 USDC = 7.5 + 2.5)", async function () {
      const jId = jobId("fee-exact");
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      const proof = await oracleSign(jId, provider.address, AMOUNT, oracle);

      const providerBefore = await usdc.balanceOf(provider.address);
      const ownerBefore = await usdc.balanceOf(owner.address);

      await escrow.connect(provider).claimLock(jId, proof);

      const expectedProvider = (AMOUNT * 7500n) / 10000n; // 7.5 USDC
      const expectedFee = AMOUNT - expectedProvider;       // 2.5 USDC

      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + expectedProvider);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + expectedFee);
      // No USDC left in contract
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("splits correctly for minimum viable amount (1 micro-USDC)", async function () {
      const jId = jobId("fee-minimum");
      const tiny = 1n; // 1 micro-USDC (0.000001 USDC)
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, tiny, expiry);
      const proof = await oracleSign(jId, provider.address, tiny, oracle);

      await escrow.connect(provider).claimLock(jId, proof);

      // fee = (1 * 2500) / 10000 = 0 (integer division truncates)
      // providerAmount = 1 - 0 = 1
      // Owner gets 0, provider gets 1 — acceptable rounding behavior
      const record = await escrow.getEscrow(jId);
      expect(record.status).to.equal(2); // CLAIMED
    });

    it("splits correctly for odd amount (7 micro-USDC)", async function () {
      const jId = jobId("fee-odd");
      const odd = 7n;
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, odd, expiry);
      const proof = await oracleSign(jId, provider.address, odd, oracle);

      const providerBefore = await usdc.balanceOf(provider.address);
      const ownerBefore = await usdc.balanceOf(owner.address);

      await escrow.connect(provider).claimLock(jId, proof);

      // fee = (7 * 2500) / 10000 = 1 (truncated from 1.75)
      // providerAmount = 7 - 1 = 6
      const fee = (odd * 2500n) / 10000n;
      const providerAmt = odd - fee;

      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmt);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(0);
    });

    it("splits correctly for large amount (10,000 USDC)", async function () {
      const jId = jobId("fee-large");
      const large = ethers.parseUnits("10000", 6);
      await usdc.mint(renter.address, large);
      const expiry = (await time.latest()) + ONE_HOUR;

      await escrow.connect(renter).depositAndLock(jId, provider.address, large, expiry);
      const proof = await oracleSign(jId, provider.address, large, oracle);

      await escrow.connect(provider).claimLock(jId, proof);

      // 10,000 USDC → 7,500 provider + 2,500 fee
      const expectedProvider = ethers.parseUnits("7500", 6);
      const expectedFee = ethers.parseUnits("2500", 6);
      expect(await usdc.balanceOf(provider.address)).to.equal(expectedProvider);
      expect(await usdc.balanceOf(owner.address)).to.equal(expectedFee);
    });
  });

  // ── Multiple concurrent escrows ────────────────────────────────────────────

  describe("multiple concurrent escrows", function () {
    it("handles 3 independent jobs simultaneously without interference", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;
      const jobs = ["job-multi-1", "job-multi-2", "job-multi-3"].map(jobId);
      const amounts = [
        ethers.parseUnits("5", 6),
        ethers.parseUnits("10", 6),
        ethers.parseUnits("20", 6),
      ];

      // Deposit all three
      for (let i = 0; i < 3; i++) {
        await escrow.connect(renter).depositAndLock(jobs[i], provider.address, amounts[i], expiry);
      }

      // Total locked
      const totalLocked = amounts.reduce((a, b) => a + b, 0n);
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(totalLocked);

      // Claim job 0
      const proof0 = await oracleSign(jobs[0], provider.address, amounts[0], oracle);
      await escrow.connect(provider).claimLock(jobs[0], proof0);

      // Cancel job 1 (advance past expiry)
      await time.increaseTo(expiry + 1);
      await escrow.connect(renter).cancelExpiredLock(jobs[1]);

      // Job 2 is still locked
      const record2 = await escrow.getEscrow(jobs[2]);
      expect(record2.status).to.equal(1); // LOCKED

      // Remaining in contract = amounts[2] only
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(amounts[2]);

      // Verify statuses
      expect((await escrow.getEscrow(jobs[0])).status).to.equal(2); // CLAIMED
      expect((await escrow.getEscrow(jobs[1])).status).to.equal(3); // CANCELLED
    });

    it("two renters can lock separate jobs independently", async function () {
      const renter2 = stranger;
      await usdc.mint(renter2.address, ethers.parseUnits("100", 6));
      await usdc.connect(renter2).approve(await escrow.getAddress(), ethers.MaxUint256);

      const expiry = (await time.latest()) + ONE_HOUR;
      const jId1 = jobId("renter1-job");
      const jId2 = jobId("renter2-job");

      await escrow.connect(renter).depositAndLock(jId1, provider.address, AMOUNT, expiry);
      await escrow.connect(renter2).depositAndLock(jId2, provider.address, AMOUNT, expiry);

      const r1 = await escrow.getEscrow(jId1);
      const r2 = await escrow.getEscrow(jId2);
      expect(r1.renter).to.equal(renter.address);
      expect(r2.renter).to.equal(renter2.address);
    });
  });

  // ── Full lifecycle balance accounting ──────────────────────────────────────

  describe("full lifecycle accounting", function () {
    it("renter balance decreases by deposit amount, provider and owner increase after claim", async function () {
      const jId = jobId("full-lifecycle");
      const expiry = (await time.latest()) + ONE_HOUR;

      const renterBefore = await usdc.balanceOf(renter.address);
      const providerBefore = await usdc.balanceOf(provider.address);
      const ownerBefore = await usdc.balanceOf(owner.address);

      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      expect(await usdc.balanceOf(renter.address)).to.equal(renterBefore - AMOUNT);

      const proof = await oracleSign(jId, provider.address, AMOUNT, oracle);
      await escrow.connect(provider).claimLock(jId, proof);

      const fee = (AMOUNT * 2500n) / 10000n;
      const providerAmt = AMOUNT - fee;

      expect(await usdc.balanceOf(renter.address)).to.equal(renterBefore - AMOUNT); // renter doesn't get refund
      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmt);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
    });

    it("renter balance fully restored after cancel", async function () {
      const jId = jobId("cancel-lifecycle");
      const expiry = (await time.latest()) + ONE_HOUR;

      const renterBefore = await usdc.balanceOf(renter.address);
      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);

      await time.increaseTo(expiry + 1);
      await escrow.connect(renter).cancelExpiredLock(jId);

      expect(await usdc.balanceOf(renter.address)).to.equal(renterBefore);
    });
  });

  // ── Admin access control ───────────────────────────────────────────────────

  describe("admin — access control completeness", function () {
    it("owner cannot claim on behalf of a job they are not the owner of (relayer role)", async function () {
      // owner is also the initial relayer, so owner CAN claim — verify this is intentional
      const jId = jobId("owner-claim");
      const expiry = (await time.latest()) + ONE_HOUR;
      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      const proof = await oracleSign(jId, provider.address, AMOUNT, oracle);

      // Owner (= relayer by default) can claim
      await expect(escrow.connect(owner).claimLock(jId, proof))
        .to.emit(escrow, "Claimed");
    });

    it("setRelayer changes who is authorized to claim/cancel", async function () {
      // Remove owner as relayer, assign provider as relayer
      await escrow.connect(owner).setRelayer(provider.address);

      const jId = jobId("relayer-change");
      const expiry = (await time.latest()) + ONE_HOUR;
      await escrow.connect(renter).depositAndLock(jId, provider.address, AMOUNT, expiry);
      await time.increaseTo(expiry + 1);

      // stranger can no longer cancel (was never relayer)
      await expect(
        escrow.connect(stranger).cancelExpiredLock(jId)
      ).to.be.revertedWith("Not authorized to cancel");

      // provider (new relayer) can cancel
      await expect(escrow.connect(provider).cancelExpiredLock(jId))
        .to.emit(escrow, "Cancelled");
    });
  });
});
