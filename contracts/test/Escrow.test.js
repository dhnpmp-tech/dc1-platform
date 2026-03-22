const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * DC1 Escrow — Hardhat test suite
 *
 * Covers:
 *   depositAndLock  — happy path, duplicate, past expiry, zero amount
 *   claimLock       — happy path (75/25 split), relayer claim, bad signer, wrong caller, expired
 *   cancelExpiredLock — happy path, relayer cancel, not-yet-expired, wrong caller
 *   setOracle       — owner update, non-owner rejection
 *   setRelayer      — owner update, non-owner rejection
 *   getEscrow       — view returns correct struct
 */
describe("Escrow", function () {
  // ── Fixtures ───────────────────────────────────────────────────────────────

  let escrow, usdc;
  let owner, oracle, renter, provider, stranger;
  let relayer;

  // Shared test job
  const JOB_ID = ethers.keccak256(ethers.toUtf8Bytes("dc1-job-001"));
  const AMOUNT = ethers.parseUnits("10", 6); // 10 USDC
  const ONE_HOUR = 3600;

  // Sign a job-completion proof as oracle
  async function oracleSign(jobId, providerAddr, amount, signer) {
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
    const value = { jobId, provider: providerAddr, amount };
    return signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [owner, oracle, renter, provider, stranger] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    // Mint 100 USDC to renter
    await usdc.mint(renter.address, ethers.parseUnits("100", 6));

    // Deploy Escrow with oracle address
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(await usdc.getAddress(), oracle.address);
    relayer = owner;

    // Approve escrow to spend renter's USDC
    await usdc
      .connect(renter)
      .approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  // ── depositAndLock ────────────────────────────────────────────────────────

  describe("depositAndLock", function () {
    it("locks USDC and emits Deposited", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;

      await expect(
        escrow
          .connect(renter)
          .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry)
      )
        .to.emit(escrow, "Deposited")
        .withArgs(JOB_ID, renter.address, provider.address, AMOUNT, expiry);

      // Contract holds the USDC
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(AMOUNT);
    });

    it("stores correct EscrowRecord", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;
      await escrow
        .connect(renter)
        .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry);

      const record = await escrow.getEscrow(JOB_ID);
      expect(record.renter).to.equal(renter.address);
      expect(record.provider).to.equal(provider.address);
      expect(record.amount).to.equal(AMOUNT);
      expect(record.expiry).to.equal(expiry);
      expect(record.status).to.equal(1); // LOCKED
    });

    it("reverts on duplicate jobId", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;
      await escrow
        .connect(renter)
        .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry);

      await expect(
        escrow
          .connect(renter)
          .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry)
      ).to.be.revertedWith("Job already exists");
    });

    it("reverts if expiry is in the past", async function () {
      const pastExpiry = (await time.latest()) - 1;
      await expect(
        escrow
          .connect(renter)
          .depositAndLock(JOB_ID, provider.address, AMOUNT, pastExpiry)
      ).to.be.revertedWith("Expiry must be in future");
    });

    it("reverts on zero amount", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;
      await expect(
        escrow.connect(renter).depositAndLock(JOB_ID, provider.address, 0, expiry)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("reverts on zero provider address", async function () {
      const expiry = (await time.latest()) + ONE_HOUR;
      await expect(
        escrow
          .connect(renter)
          .depositAndLock(JOB_ID, ethers.ZeroAddress, AMOUNT, expiry)
      ).to.be.revertedWith("Invalid provider address");
    });
  });

  // ── claimLock ─────────────────────────────────────────────────────────────

  describe("claimLock", function () {
    let expiry;

    beforeEach(async function () {
      expiry = (await time.latest()) + ONE_HOUR;
      await escrow
        .connect(renter)
        .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry);
    });

    it("pays 75 % to provider and 25 % to owner on valid proof", async function () {
      const proof = await oracleSign(JOB_ID, provider.address, AMOUNT, oracle);

      const providerBalBefore = await usdc.balanceOf(provider.address);
      const ownerBalBefore = await usdc.balanceOf(owner.address);

      await expect(escrow.connect(provider).claimLock(JOB_ID, proof))
        .to.emit(escrow, "Claimed")
        .withArgs(
          JOB_ID,
          provider.address,
          (AMOUNT * 7500n) / 10000n,
          (AMOUNT * 2500n) / 10000n
        );

      expect(await usdc.balanceOf(provider.address)).to.equal(
        providerBalBefore + (AMOUNT * 7500n) / 10000n
      );
      expect(await usdc.balanceOf(owner.address)).to.equal(
        ownerBalBefore + (AMOUNT * 2500n) / 10000n
      );

      const record = await escrow.getEscrow(JOB_ID);
      expect(record.status).to.equal(2); // CLAIMED
    });

    it("allows relayer to claim on behalf of provider", async function () {
      const proof = await oracleSign(JOB_ID, provider.address, AMOUNT, oracle);

      const providerBalBefore = await usdc.balanceOf(provider.address);
      const ownerBalBefore = await usdc.balanceOf(owner.address);

      await expect(escrow.connect(relayer).claimLock(JOB_ID, proof))
        .to.emit(escrow, "Claimed")
        .withArgs(
          JOB_ID,
          provider.address,
          (AMOUNT * 7500n) / 10000n,
          (AMOUNT * 2500n) / 10000n
        );

      expect(await usdc.balanceOf(provider.address)).to.equal(
        providerBalBefore + (AMOUNT * 7500n) / 10000n
      );
      expect(await usdc.balanceOf(owner.address)).to.equal(
        ownerBalBefore + (AMOUNT * 2500n) / 10000n
      );
    });

    it("reverts with invalid oracle signature", async function () {
      // Stranger signs instead of oracle
      const badProof = await oracleSign(
        JOB_ID,
        provider.address,
        AMOUNT,
        stranger
      );
      await expect(
        escrow.connect(provider).claimLock(JOB_ID, badProof)
      ).to.be.revertedWith("Invalid oracle proof");
    });

    it("reverts if caller is not provider/relayer/owner", async function () {
      const proof = await oracleSign(JOB_ID, provider.address, AMOUNT, oracle);
      await expect(
        escrow.connect(stranger).claimLock(JOB_ID, proof)
      ).to.be.revertedWith("Not authorized to claim");
    });

    it("reverts after expiry", async function () {
      await time.increaseTo(expiry + 1);
      const proof = await oracleSign(JOB_ID, provider.address, AMOUNT, oracle);
      await expect(
        escrow.connect(provider).claimLock(JOB_ID, proof)
      ).to.be.revertedWith("Expired");
    });

    it("reverts on double-claim", async function () {
      const proof = await oracleSign(JOB_ID, provider.address, AMOUNT, oracle);
      await escrow.connect(provider).claimLock(JOB_ID, proof);
      await expect(
        escrow.connect(provider).claimLock(JOB_ID, proof)
      ).to.be.revertedWith("Not locked");
    });
  });

  // ── cancelExpiredLock ─────────────────────────────────────────────────────

  describe("cancelExpiredLock", function () {
    let expiry;

    beforeEach(async function () {
      expiry = (await time.latest()) + ONE_HOUR;
      await escrow
        .connect(renter)
        .depositAndLock(JOB_ID, provider.address, AMOUNT, expiry);
    });

    it("returns full amount to renter after expiry", async function () {
      await time.increaseTo(expiry + 1);

      const balBefore = await usdc.balanceOf(renter.address);

      await expect(escrow.connect(renter).cancelExpiredLock(JOB_ID))
        .to.emit(escrow, "Cancelled")
        .withArgs(JOB_ID, renter.address, AMOUNT);

      expect(await usdc.balanceOf(renter.address)).to.equal(
        balBefore + AMOUNT
      );

      const record = await escrow.getEscrow(JOB_ID);
      expect(record.status).to.equal(3); // CANCELLED
    });

    it("allows relayer to cancel after expiry", async function () {
      await time.increaseTo(expiry + 1);
      const balBefore = await usdc.balanceOf(renter.address);

      await expect(escrow.connect(relayer).cancelExpiredLock(JOB_ID))
        .to.emit(escrow, "Cancelled")
        .withArgs(JOB_ID, renter.address, AMOUNT);

      expect(await usdc.balanceOf(renter.address)).to.equal(
        balBefore + AMOUNT
      );
    });

    it("reverts before expiry", async function () {
      await expect(
        escrow.connect(renter).cancelExpiredLock(JOB_ID)
      ).to.be.revertedWith("Not expired yet");
    });

    it("reverts if caller is not renter/relayer/owner", async function () {
      await time.increaseTo(expiry + 1);
      await expect(
        escrow.connect(stranger).cancelExpiredLock(JOB_ID)
      ).to.be.revertedWith("Not authorized to cancel");
    });

    it("reverts on double-cancel", async function () {
      await time.increaseTo(expiry + 1);
      await escrow.connect(renter).cancelExpiredLock(JOB_ID);
      await expect(
        escrow.connect(renter).cancelExpiredLock(JOB_ID)
      ).to.be.revertedWith("Not locked");
    });
  });

  // ── setOracle ─────────────────────────────────────────────────────────────

  describe("setOracle", function () {
    it("owner can update oracle address", async function () {
      await expect(escrow.connect(owner).setOracle(stranger.address))
        .to.emit(escrow, "OracleUpdated")
        .withArgs(oracle.address, stranger.address);

      expect(await escrow.oracle()).to.equal(stranger.address);
    });

    it("non-owner cannot update oracle", async function () {
      await expect(
        escrow.connect(stranger).setOracle(stranger.address)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("reverts on zero address", async function () {
      await expect(
        escrow.connect(owner).setOracle(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid oracle address");
    });
  });

  // ── setRelayer ────────────────────────────────────────────────────────────

  describe("setRelayer", function () {
    it("owner can update relayer address", async function () {
      await expect(escrow.connect(owner).setRelayer(stranger.address))
        .to.emit(escrow, "RelayerUpdated")
        .withArgs(owner.address, stranger.address);

      expect(await escrow.relayer()).to.equal(stranger.address);
    });

    it("non-owner cannot update relayer", async function () {
      await expect(
        escrow.connect(stranger).setRelayer(stranger.address)
      ).to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("reverts on zero address", async function () {
      await expect(
        escrow.connect(owner).setRelayer(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid relayer address");
    });
  });

  // ── getEscrow ─────────────────────────────────────────────────────────────

  describe("getEscrow", function () {
    it("returns EMPTY record for unknown jobId", async function () {
      const unknownId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      const record = await escrow.getEscrow(unknownId);
      expect(record.status).to.equal(0); // EMPTY
      expect(record.amount).to.equal(0);
    });
  });
});
