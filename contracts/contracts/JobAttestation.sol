// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title JobAttestation
 * @notice EIP-712 provider job attestation with 24-hour challenge window and
 *         dispute escrow for DCP GPU compute jobs.
 *
 * Flow:
 *   1. Renter calls depositForJob(jobId, provider, amount) — USDC locked in this contract
 *   2. Provider runs the GPU job off-chain
 *   3. Provider signs a JobAttestation struct (EIP-712) and calls attestJob()
 *   4. Renter has CHALLENGE_WINDOW (default 24 h) to call challengeAttestation()
 *      — If no challenge: anyone may call releasePayment() after the window
 *      — If challenged: arbitrator calls resolveChallenge()
 *        • providerFault=true  → full refund to renter
 *        • providerFault=false → payment released to provider
 *
 * The EIP-712 attestation signature is verified on-chain, binding the provider's
 * wallet to the exact job output hash, token count, and duration.  This creates
 * a tamper-proof, publicly auditable completion record without revealing raw output.
 */
contract JobAttestation is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA     for bytes32;

    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Fee charged by DC1 platform on settlement (25 %)
    uint256 public constant FEE_BPS        = 2_500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Default challenge window after attestation (24 hours)
    uint256 public constant DEFAULT_CHALLENGE_WINDOW = 24 hours;

    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "JobAttestation(bytes32 jobId,address provider,address renter,"
        "uint256 tokensUsed,uint256 durationSecs,uint256 completedAt,bytes32 outputHash)"
    );

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @notice USDC contract
    IERC20 public immutable usdc;

    /// @notice Duration (seconds) renter has to challenge after attestation
    uint256 public challengeWindow;

    enum JobStatus {
        EMPTY,      // 0 — no deposit
        DEPOSITED,  // 1 — renter deposited, awaiting attestation
        ATTESTED,   // 2 — provider attested, challenge window open
        CHALLENGED, // 3 — renter filed a challenge
        RESOLVED,   // 4 — challenge resolved (payment released or refunded)
        RELEASED,   // 5 — payment released to provider (no challenge)
        REFUNDED    // 6 — payment returned to renter (provider fault)
    }

    struct AttestationData {
        bytes32 jobId;        // off-chain job UUID as bytes32
        address provider;     // provider wallet
        address renter;       // renter wallet
        uint256 tokensUsed;   // token count from metering
        uint256 durationSecs; // wall-clock runtime
        uint256 completedAt;  // unix timestamp of completion
        bytes32 outputHash;   // keccak256 of output (privacy-preserving)
    }

    struct JobRecord {
        address renter;
        address provider;
        uint256 amount;       // USDC deposited
        uint256 depositedAt;
        uint256 attestedAt;   // 0 if not yet attested
        JobStatus status;
        // Attestation data (populated on attestJob)
        uint256 tokensUsed;
        uint256 durationSecs;
        uint256 completedAt;
        bytes32 outputHash;
        // Challenge data
        string  challengeReason; // non-empty if challenged
    }

    /// @dev jobId → record
    mapping(bytes32 => JobRecord) private _jobs;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event JobDeposited(
        bytes32 indexed jobId,
        address indexed renter,
        address indexed provider,
        uint256 amount
    );

    event JobAttested(
        bytes32 indexed jobId,
        address indexed provider,
        uint256 tokensUsed,
        uint256 durationSecs,
        bytes32 outputHash,
        uint256 challengeDeadline
    );

    event ChallengeFiled(
        bytes32 indexed jobId,
        address indexed renter,
        string  reason
    );

    event ChallengeResolved(
        bytes32 indexed jobId,
        bool    providerFault,
        address recipient,
        uint256 amount
    );

    event PaymentReleased(
        bytes32 indexed jobId,
        address indexed provider,
        uint256 providerAmount,
        uint256 feeAmount
    );

    event PaymentRefunded(
        bytes32 indexed jobId,
        address indexed renter,
        uint256 amount
    );

    event ChallengeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param _usdc USDC token address
     */
    constructor(address _usdc)
        Ownable(msg.sender)
        EIP712("DCP JobAttestation", "1")
    {
        require(_usdc != address(0), "Invalid USDC address");
        usdc            = IERC20(_usdc);
        challengeWindow = DEFAULT_CHALLENGE_WINDOW;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Renter — deposit
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Renter locks USDC for a specific job before the provider runs it.
     * @param jobId    Unique job identifier (keccak256 of off-chain UUID)
     * @param provider Provider wallet address
     * @param amount   USDC amount (6 decimals)
     */
    function depositForJob(
        bytes32 jobId,
        address provider,
        uint256 amount
    ) external nonReentrant {
        require(_jobs[jobId].status == JobStatus.EMPTY, "Job already exists");
        require(provider != address(0), "Invalid provider");
        require(amount > 0,             "Amount must be > 0");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _jobs[jobId] = JobRecord({
            renter:          msg.sender,
            provider:        provider,
            amount:          amount,
            depositedAt:     block.timestamp,
            attestedAt:      0,
            status:          JobStatus.DEPOSITED,
            tokensUsed:      0,
            durationSecs:    0,
            completedAt:     0,
            outputHash:      bytes32(0),
            challengeReason: ""
        });

        emit JobDeposited(jobId, msg.sender, provider, amount);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Provider — attest
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Provider submits an EIP-712 signed job completion attestation.
     *         The signature must be from the provider wallet registered for this job.
     *
     * @param job       Attestation struct with job completion data
     * @param signature EIP-712 signature over the JobAttestation struct
     */
    function attestJob(
        AttestationData calldata job,
        bytes calldata signature
    ) external nonReentrant {
        JobRecord storage rec = _jobs[job.jobId];

        require(rec.status == JobStatus.DEPOSITED, "Job not in DEPOSITED state");
        require(job.provider == rec.provider,       "Provider mismatch");
        require(job.renter   == rec.renter,         "Renter mismatch");
        require(job.completedAt <= block.timestamp, "Completion time in future");
        require(job.tokensUsed > 0,                 "No tokens recorded");

        // Verify provider's EIP-712 signature over the attestation struct
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            job.jobId,
            job.provider,
            job.renter,
            job.tokensUsed,
            job.durationSecs,
            job.completedAt,
            job.outputHash
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(signer == rec.provider, "Invalid provider signature");

        // Store attestation data
        rec.status      = JobStatus.ATTESTED;
        rec.attestedAt  = block.timestamp;
        rec.tokensUsed  = job.tokensUsed;
        rec.durationSecs= job.durationSecs;
        rec.completedAt = job.completedAt;
        rec.outputHash  = job.outputHash;

        uint256 deadline = block.timestamp + challengeWindow;

        emit JobAttested(
            job.jobId,
            job.provider,
            job.tokensUsed,
            job.durationSecs,
            job.outputHash,
            deadline
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Renter — challenge
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Renter disputes a provider's attestation within the challenge window.
     * @param jobId  Job identifier
     * @param reason Human-readable dispute reason
     */
    function challengeAttestation(
        bytes32 jobId,
        string calldata reason
    ) external {
        JobRecord storage rec = _jobs[jobId];

        require(rec.status == JobStatus.ATTESTED,            "Not in ATTESTED state");
        require(msg.sender == rec.renter,                    "Only renter can challenge");
        require(block.timestamp <= rec.attestedAt + challengeWindow, "Challenge window closed");
        require(bytes(reason).length > 0,                   "Reason required");

        rec.status          = JobStatus.CHALLENGED;
        rec.challengeReason = reason;

        emit ChallengeFiled(jobId, msg.sender, reason);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Arbitrator — resolve
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Arbitrator (owner / DAO) resolves a challenge.
     * @param jobId         Job identifier
     * @param providerFault True → refund renter; False → release payment to provider
     */
    function resolveChallenge(bytes32 jobId, bool providerFault)
        external
        onlyOwner
        nonReentrant
    {
        JobRecord storage rec = _jobs[jobId];
        require(rec.status == JobStatus.CHALLENGED, "Not in CHALLENGED state");

        rec.status = JobStatus.RESOLVED;

        if (providerFault) {
            // Full refund to renter
            usdc.safeTransfer(rec.renter, rec.amount);
            emit ChallengeResolved(jobId, true, rec.renter, rec.amount);
            emit PaymentRefunded(jobId, rec.renter, rec.amount);
        } else {
            // Provider vindicated — release with fee split
            uint256 fee           = (rec.amount * FEE_BPS) / BPS_DENOMINATOR;
            uint256 providerAmount = rec.amount - fee;
            usdc.safeTransfer(rec.provider, providerAmount);
            usdc.safeTransfer(owner(),      fee);
            emit ChallengeResolved(jobId, false, rec.provider, providerAmount);
            emit PaymentReleased(jobId, rec.provider, providerAmount, fee);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Release — after challenge window
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Release escrowed payment to provider after the challenge window
     *         closes with no dispute.  Anyone may call this.
     * @param jobId Job identifier
     */
    function releasePayment(bytes32 jobId) external nonReentrant {
        JobRecord storage rec = _jobs[jobId];

        require(rec.status == JobStatus.ATTESTED, "Not in ATTESTED state");
        require(
            block.timestamp > rec.attestedAt + challengeWindow,
            "Challenge window still open"
        );

        rec.status = JobStatus.RELEASED;

        uint256 fee            = (rec.amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 providerAmount = rec.amount - fee;

        usdc.safeTransfer(rec.provider, providerAmount);
        usdc.safeTransfer(owner(),      fee);

        emit PaymentReleased(jobId, rec.provider, providerAmount, fee);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Views
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full job record (attestation + status).
     */
    function getAttestation(bytes32 jobId) external view returns (JobRecord memory) {
        return _jobs[jobId];
    }

    /**
     * @notice Returns the timestamp when the challenge window closes for an
     *         attested job (0 if not yet attested).
     */
    function challengeDeadline(bytes32 jobId) external view returns (uint256) {
        JobRecord storage rec = _jobs[jobId];
        if (rec.attestedAt == 0) return 0;
        return rec.attestedAt + challengeWindow;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the challenge window duration. Only callable by owner.
     * @param newWindow New window in seconds (must be >= 1 hour)
     */
    function setChallengeWindow(uint256 newWindow) external onlyOwner {
        require(newWindow >= 1 hours, "Window too short");
        emit ChallengeWindowUpdated(challengeWindow, newWindow);
        challengeWindow = newWindow;
    }
}
