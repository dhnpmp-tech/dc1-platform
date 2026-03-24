const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * JobAttestation — Hardhat test suite
 *
 * Covers:
 *   depositForJob          — happy path, duplicate, zero amount, zero provider
 *   attestJob              — valid EIP-712 sig, wrong signer, provider mismatch,
 *                            renter mismatch, future completedAt, zero tokens
 *   challengeAttestation   — happy path, window closed, wrong caller, no reason,
 *                            wrong state
 *   resolveChallenge       — provider fault (refund), provider vindicated (release+fee),
 *                            wrong state, non-owner
 *   releasePayment         — after window, before window, wrong state
 *   setChallengeWindow     — owner update, too-short window, non-owner
 *   challengeDeadline      — before and after attestation
 *   Full dispute flow      — deposit → attest → challenge → resolve (both outcomes)
 *   Happy path flow        — deposit → attest → release (no challenge)
 */
describe("JobAttestation", function () {
  // ── Fixtures ────────────────────────────────────────────────────────────────

  let contract, usdc;
  let owner, provider, renter, stranger;

  const AMOUNT   = ethers.parseUnits("10", 6); // 10 USDC
  const JOB_ID   = ethers.keccak256(ethers.toUtf8Bytes("dc1-job-attest-001"));
  const ONE_HOUR = 3_600;
  const ONE_DAY  = 86_400;

  // Build and sign a valid AttestationData struct
  async function makeAttestation(overrides = {}) {
    const base = {
      jobId:       JOB_ID,
      provider:    provider.address,
      renter:      renter.address,
      tokensUsed:  1_000n,
      durationSecs:3_600n,
      completedAt: BigInt(await time.latest()),
      outputHash:  ethers.keccak256(ethers.toUtf8Bytes("output-data")),
    };
    return { ...base, ...overrides };
  }

  async function signAttestation(att, signer) {
    const domain = {
      name:              "DCP JobAttestation",
      version:           "1",
      chainId:           (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await contract.getAddress(),
    };
    // Type name must match the string used in ATTESTATION_TYPEHASH in the contract
    const types = {
      JobAttestation: [
        { name: "jobId",       type: "bytes32" },
        { name: "provider",    type: "address" },
        { name: "renter",      type: "address" },
        { name: "tokensUsed",  type: "uint256" },
        { name: "durationSecs",type: "uint256" },
        { name: "completedAt", type: "uint256" },
        { name: "outputHash",  type: "bytes32" },
      ],
    };
    return signer.signTypedData(domain, types, att);
  }

  beforeEach(async function () {
    [owner, provider, renter, stranger] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.mint(renter.address, ethers.parseUnits("1000", 6));

    const JobAttestation = await ethers.getContractFactory("JobAttestation");
    contract = await JobAttestation.deploy(await usdc.getAddress());

    await usdc.connect(renter).approve(await contract.getAddress(), ethers.MaxUint256);
  });

  // ── depositForJob ────────────────────────────────────────────────────────────

  describe("depositForJob", function () {
    it("locks USDC and emits JobDeposited", async function () {
      await expect(
        contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT)
      )
        .to.emit(contract, "JobDeposited")
        .withArgs(JOB_ID, renter.address, provider.address, AMOUNT);

      expect(await usdc.balanceOf(await contract.getAddress())).to.equal(AMOUNT);

      const rec = await contract.getAttestation(JOB_ID);
      expect(rec.renter).to.equal(renter.address);
      expect(rec.provider).to.equal(provider.address);
      expect(rec.amount).to.equal(AMOUNT);
      expect(rec.status).to.equal(1); // DEPOSITED
    });

    it("reverts on duplicate jobId", async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      await expect(
        contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT)
      ).to.be.revertedWith("Job already exists");
    });

    it("reverts on zero amount", async function () {
      await expect(
        contract.connect(renter).depositForJob(JOB_ID, provider.address, 0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("reverts on zero provider address", async function () {
      await expect(
        contract.connect(renter).depositForJob(JOB_ID, ethers.ZeroAddress, AMOUNT)
      ).to.be.revertedWith("Invalid provider");
    });

    it("reverts when renter has insufficient balance", async function () {
      await usdc.connect(stranger).approve(await contract.getAddress(), ethers.MaxUint256);
      await expect(
        contract.connect(stranger).depositForJob(JOB_ID, provider.address, AMOUNT)
      ).to.be.reverted;
    });
  });

  // ── attestJob ────────────────────────────────────────────────────────────────

  describe("attestJob", function () {
    beforeEach(async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
    });

    it("records attestation and emits JobAttested on valid provider signature", async function () {
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);

      await expect(contract.connect(provider).attestJob(att, sig))
        .to.emit(contract, "JobAttested")
        .withArgs(
          JOB_ID,
          provider.address,
          att.tokensUsed,
          att.durationSecs,
          att.outputHash,
          (v) => v > 0n  // challengeDeadline is a future timestamp
        );

      const rec = await contract.getAttestation(JOB_ID);
      expect(rec.status).to.equal(2); // ATTESTED
      expect(rec.tokensUsed).to.equal(att.tokensUsed);
      expect(rec.outputHash).to.equal(att.outputHash);
    });

    it("sets challengeDeadline to attestedAt + challengeWindow", async function () {
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);

      const deadline = await contract.challengeDeadline(JOB_ID);
      const window   = await contract.challengeWindow();
      const rec      = await contract.getAttestation(JOB_ID);

      expect(deadline).to.equal(rec.attestedAt + window);
    });

    it("reverts with wrong signer (stranger signs instead of provider)", async function () {
      const att = await makeAttestation();
      const sig = await signAttestation(att, stranger);
      await expect(contract.connect(provider).attestJob(att, sig))
        .to.be.revertedWith("Invalid provider signature");
    });

    it("reverts when provider address in attestation mismatches job record", async function () {
      const att = await makeAttestation({ provider: stranger.address });
      const sig = await signAttestation(att, stranger);
      await expect(contract.connect(stranger).attestJob(att, sig))
        .to.be.revertedWith("Provider mismatch");
    });

    it("reverts when renter address in attestation mismatches job record", async function () {
      const att = await makeAttestation({ renter: stranger.address });
      const sig = await signAttestation(att, provider);
      await expect(contract.connect(provider).attestJob(att, sig))
        .to.be.revertedWith("Renter mismatch");
    });

    it("reverts when completedAt is in the future", async function () {
      const att = await makeAttestation({ completedAt: BigInt(await time.latest()) + 3600n });
      const sig = await signAttestation(att, provider);
      await expect(contract.connect(provider).attestJob(att, sig))
        .to.be.revertedWith("Completion time in future");
    });

    it("reverts when tokensUsed is zero", async function () {
      const att = await makeAttestation({ tokensUsed: 0n });
      const sig = await signAttestation(att, provider);
      await expect(contract.connect(provider).attestJob(att, sig))
        .to.be.revertedWith("No tokens recorded");
    });

    it("reverts if job is not in DEPOSITED state", async function () {
      // Attest once
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);

      // Attempt to attest again
      await expect(contract.connect(provider).attestJob(att, sig))
        .to.be.revertedWith("Job not in DEPOSITED state");
    });
  });

  // ── challengeAttestation ─────────────────────────────────────────────────────

  describe("challengeAttestation", function () {
    beforeEach(async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);
    });

    it("files challenge and emits ChallengeFiled", async function () {
      const reason = "Output was corrupted — hash mismatch";

      await expect(contract.connect(renter).challengeAttestation(JOB_ID, reason))
        .to.emit(contract, "ChallengeFiled")
        .withArgs(JOB_ID, renter.address, reason);

      const rec = await contract.getAttestation(JOB_ID);
      expect(rec.status).to.equal(3); // CHALLENGED
      expect(rec.challengeReason).to.equal(reason);
    });

    it("reverts when challenge window has closed", async function () {
      await time.increase(ONE_DAY + 1);
      await expect(
        contract.connect(renter).challengeAttestation(JOB_ID, "too late")
      ).to.be.revertedWith("Challenge window closed");
    });

    it("reverts when caller is not the renter", async function () {
      await expect(
        contract.connect(stranger).challengeAttestation(JOB_ID, "stranger challenge")
      ).to.be.revertedWith("Only renter can challenge");
    });

    it("reverts with empty reason", async function () {
      await expect(
        contract.connect(renter).challengeAttestation(JOB_ID, "")
      ).to.be.revertedWith("Reason required");
    });

    it("reverts if job is not in ATTESTED state", async function () {
      // File a challenge to move to CHALLENGED state
      await contract.connect(renter).challengeAttestation(JOB_ID, "first challenge");
      // Attempt a second challenge
      await expect(
        contract.connect(renter).challengeAttestation(JOB_ID, "second challenge")
      ).to.be.revertedWith("Not in ATTESTED state");
    });
  });

  // ── resolveChallenge ─────────────────────────────────────────────────────────

  describe("resolveChallenge", function () {
    beforeEach(async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);
      await contract.connect(renter).challengeAttestation(JOB_ID, "disputed output");
    });

    it("refunds renter fully on providerFault=true", async function () {
      const renterBefore = await usdc.balanceOf(renter.address);

      await expect(contract.connect(owner).resolveChallenge(JOB_ID, true))
        .to.emit(contract, "ChallengeResolved")
        .withArgs(JOB_ID, true, renter.address, AMOUNT)
        .to.emit(contract, "PaymentRefunded")
        .withArgs(JOB_ID, renter.address, AMOUNT);

      expect(await usdc.balanceOf(renter.address)).to.equal(renterBefore + AMOUNT);
      expect(await usdc.balanceOf(await contract.getAddress())).to.equal(0);

      const rec = await contract.getAttestation(JOB_ID);
      expect(rec.status).to.equal(4); // RESOLVED
    });

    it("releases 75/25 split on providerFault=false (provider vindicated)", async function () {
      const providerBefore = await usdc.balanceOf(provider.address);
      const ownerBefore    = await usdc.balanceOf(owner.address);

      const fee            = (AMOUNT * 2500n) / 10000n;
      const providerAmount = AMOUNT - fee;

      await expect(contract.connect(owner).resolveChallenge(JOB_ID, false))
        .to.emit(contract, "ChallengeResolved")
        .withArgs(JOB_ID, false, provider.address, providerAmount)
        .to.emit(contract, "PaymentReleased")
        .withArgs(JOB_ID, provider.address, providerAmount, fee);

      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmount);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
    });

    it("reverts if job is not in CHALLENGED state", async function () {
      // Resolve once
      await contract.connect(owner).resolveChallenge(JOB_ID, false);
      // Attempt to resolve again
      await expect(
        contract.connect(owner).resolveChallenge(JOB_ID, true)
      ).to.be.revertedWith("Not in CHALLENGED state");
    });

    it("reverts if non-owner tries to resolve", async function () {
      await expect(
        contract.connect(stranger).resolveChallenge(JOB_ID, true)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });

  // ── releasePayment ───────────────────────────────────────────────────────────

  describe("releasePayment", function () {
    beforeEach(async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);
    });

    it("releases 75/25 split after challenge window, emits PaymentReleased", async function () {
      await time.increase(ONE_DAY + 1);

      const providerBefore = await usdc.balanceOf(provider.address);
      const ownerBefore    = await usdc.balanceOf(owner.address);
      const fee            = (AMOUNT * 2500n) / 10000n;
      const providerAmount = AMOUNT - fee;

      await expect(contract.connect(stranger).releasePayment(JOB_ID))
        .to.emit(contract, "PaymentReleased")
        .withArgs(JOB_ID, provider.address, providerAmount, fee);

      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmount);
      expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + fee);
      expect(await usdc.balanceOf(await contract.getAddress())).to.equal(0);

      const rec = await contract.getAttestation(JOB_ID);
      expect(rec.status).to.equal(5); // RELEASED
    });

    it("reverts before challenge window expires", async function () {
      await expect(
        contract.connect(provider).releasePayment(JOB_ID)
      ).to.be.revertedWith("Challenge window still open");
    });

    it("reverts if job is not in ATTESTED state", async function () {
      // Challenge it first
      await contract.connect(renter).challengeAttestation(JOB_ID, "dispute");
      await time.increase(ONE_DAY + 1);

      await expect(
        contract.connect(provider).releasePayment(JOB_ID)
      ).to.be.revertedWith("Not in ATTESTED state");
    });
  });

  // ── setChallengeWindow ────────────────────────────────────────────────────────

  describe("setChallengeWindow", function () {
    it("owner can update challenge window and emits ChallengeWindowUpdated", async function () {
      const newWindow = 48 * 3600; // 48 hours

      await expect(contract.connect(owner).setChallengeWindow(newWindow))
        .to.emit(contract, "ChallengeWindowUpdated")
        .withArgs(ONE_DAY, newWindow);

      expect(await contract.challengeWindow()).to.equal(newWindow);
    });

    it("reverts if window is too short (< 1 hour)", async function () {
      await expect(
        contract.connect(owner).setChallengeWindow(3599)
      ).to.be.revertedWith("Window too short");
    });

    it("non-owner cannot update window", async function () {
      await expect(
        contract.connect(stranger).setChallengeWindow(ONE_DAY * 2)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("new window applies to subsequent attestations", async function () {
      await contract.connect(owner).setChallengeWindow(2 * ONE_HOUR); // 2 hours

      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);

      const deadline = await contract.challengeDeadline(JOB_ID);
      const rec      = await contract.getAttestation(JOB_ID);
      expect(deadline).to.equal(rec.attestedAt + 2n * BigInt(ONE_HOUR));
    });
  });

  // ── verifyJob ────────────────────────────────────────────────────────────────

  describe("verifyJob", function () {
    const VJ_JOB_ID     = ethers.keccak256(ethers.toUtf8Bytes("dc1-verify-job-001"));
    const INPUT_TOKENS  = 500n;
    const OUTPUT_TOKENS = 750n;
    const TOTAL_TOKENS  = INPUT_TOKENS + OUTPUT_TOKENS;

    // Provider signs keccak256(abi.encodePacked(jobId, inputTokens, outputTokens))
    // using Ethereum personal-sign.
    async function signVerifyJob(jobId, inputTokens, outputTokens, signer) {
      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "uint256"],
        [jobId, inputTokens, outputTokens]
      );
      return signer.signMessage(ethers.getBytes(messageHash));
    }

    it("verifyJob emits JobVerified event", async function () {
      const sig = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      await expect(
        contract.connect(stranger).verifyJob(VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig)
      )
        .to.emit(contract, "JobVerified")
        .withArgs(VJ_JOB_ID, provider.address, TOTAL_TOKENS);
    });

    it("verifyJob stores correct token counts", async function () {
      const sig = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      await contract.connect(stranger).verifyJob(
        VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig
      );
      const rec = await contract.getJobRecord(VJ_JOB_ID);
      expect(rec.provider).to.equal(provider.address);
      expect(rec.tokenCount).to.equal(TOTAL_TOKENS);
      expect(rec.isVerified).to.be.true;
      expect(rec.verifiedAt).to.be.greaterThan(0n);
    });

    it("verifyJob reverts on invalid signature", async function () {
      const sig = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, stranger);
      await expect(
        contract.connect(renter).verifyJob(VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig)
      ).to.be.revertedWith("Invalid provider signature");
    });

    it("verifyJob reverts on duplicate jobId", async function () {
      const sig = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      await contract.connect(stranger).verifyJob(
        VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig
      );
      const sig2 = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      await expect(
        contract.connect(stranger).verifyJob(VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig2)
      )
        .to.be.revertedWithCustomError(contract, "AlreadyVerified")
        .withArgs(VJ_JOB_ID);
    });

    it("getJobRecord returns correct data after verification", async function () {
      const sig = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      await contract.connect(stranger).verifyJob(
        VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sig
      );
      const rec = await contract.getJobRecord(VJ_JOB_ID);
      expect(rec.provider).to.equal(provider.address);
      expect(rec.tokenCount).to.equal(TOTAL_TOKENS);
      expect(rec.verifiedAt).to.be.greaterThan(0n);
      expect(rec.isVerified).to.be.true;
    });

    it("only provider who signed can verify", async function () {
      const sigFromProvider = await signVerifyJob(VJ_JOB_ID, INPUT_TOKENS, OUTPUT_TOKENS, provider);
      // Claiming stranger as provider fails — signer != stranger
      await expect(
        contract.connect(renter).verifyJob(
          VJ_JOB_ID, stranger.address, INPUT_TOKENS, OUTPUT_TOKENS, sigFromProvider
        )
      ).to.be.revertedWith("Invalid provider signature");
      // Correct provider passes
      await expect(
        contract.connect(renter).verifyJob(
          VJ_JOB_ID, provider.address, INPUT_TOKENS, OUTPUT_TOKENS, sigFromProvider
        )
      )
        .to.emit(contract, "JobVerified")
        .withArgs(VJ_JOB_ID, provider.address, TOTAL_TOKENS);
    });
  });

  // ── challengeDeadline ────────────────────────────────────────────────────────

  describe("challengeDeadline", function () {
    it("returns 0 before attestation", async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      expect(await contract.challengeDeadline(JOB_ID)).to.equal(0);
    });

    it("returns a future timestamp after attestation", async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);

      const deadline = await contract.challengeDeadline(JOB_ID);
      expect(deadline).to.be.greaterThan(await time.latest());
    });
  });

  // ── Full dispute flow ────────────────────────────────────────────────────────

  describe("full dispute flow", function () {
    it("deposit → attest → challenge → resolve as provider fault → renter refunded", async function () {
      // 1. Deposit
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);

      // 2. Attest
      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);
      expect((await contract.getAttestation(JOB_ID)).status).to.equal(2); // ATTESTED

      // 3. Challenge
      await contract.connect(renter).challengeAttestation(JOB_ID, "GPU crashed mid-job");
      expect((await contract.getAttestation(JOB_ID)).status).to.equal(3); // CHALLENGED

      // 4. Resolve (provider at fault)
      const renterBefore = await usdc.balanceOf(renter.address);
      await contract.connect(owner).resolveChallenge(JOB_ID, true);
      expect((await contract.getAttestation(JOB_ID)).status).to.equal(4); // RESOLVED
      expect(await usdc.balanceOf(renter.address)).to.equal(renterBefore + AMOUNT);
    });

    it("deposit → attest → challenge → resolve as no fault → provider paid", async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);

      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);
      await contract.connect(renter).challengeAttestation(JOB_ID, "Bogus dispute");

      const providerBefore = await usdc.balanceOf(provider.address);
      await contract.connect(owner).resolveChallenge(JOB_ID, false);

      const fee            = (AMOUNT * 2500n) / 10000n;
      const providerAmount = AMOUNT - fee;
      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmount);
    });

    it("deposit → attest → (no challenge) → release after window", async function () {
      await contract.connect(renter).depositForJob(JOB_ID, provider.address, AMOUNT);

      const att = await makeAttestation();
      const sig = await signAttestation(att, provider);
      await contract.connect(provider).attestJob(att, sig);

      // Advance past challenge window
      await time.increase(ONE_DAY + 1);

      const providerBefore = await usdc.balanceOf(provider.address);
      await contract.connect(stranger).releasePayment(JOB_ID); // anyone can trigger

      const fee            = (AMOUNT * 2500n) / 10000n;
      const providerAmount = AMOUNT - fee;
      expect(await usdc.balanceOf(provider.address)).to.equal(providerBefore + providerAmount);
      expect((await contract.getAttestation(JOB_ID)).status).to.equal(5); // RELEASED
    });
  });
});
