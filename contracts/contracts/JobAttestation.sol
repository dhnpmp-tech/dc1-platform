// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title JobAttestation
 * @notice EIP-712 provider job attestation with 24-hour challenge window and
 *         dispute escrow for DCP GPU compute jobs.
 */
contract JobAttestation is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA     for bytes32;

    // --- Errors ---

    /// @notice Thrown when verifyJob is called a second time for the same jobId
    error AlreadyVerified(bytes32 jobId);

    // --- Constants ---

    uint256 public constant FEE_BPS        = 2_500;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_CHALLENGE_WINDOW = 24 hours;

    bytes32 private constant ATTESTATION_TYPEHASH = keccak256(
        "JobAttestation(bytes32 jobId,address provider,address renter,"
        "uint256 tokensUsed,uint256 durationSecs,uint256 completedAt,bytes32 outputHash)"
    );

    // --- State ---

    IERC20 public immutable usdc;
    uint256 public challengeWindow;

    enum JobStatus {
        EMPTY, DEPOSITED, ATTESTED, CHALLENGED, RESOLVED, RELEASED, REFUNDED
    }

    struct AttestationData {
        bytes32 jobId;
        address provider;
        address renter;
        uint256 tokensUsed;
        uint256 durationSecs;
        uint256 completedAt;
        bytes32 outputHash;
    }

    struct JobRecord {
        address renter;
        address provider;
        uint256 amount;
        uint256 depositedAt;
        uint256 attestedAt;
        JobStatus status;
        uint256 tokensUsed;
        uint256 durationSecs;
        uint256 completedAt;
        bytes32 outputHash;
        string  challengeReason;
    }

    /// @notice On-chain record written by verifyJob (separate from escrow flow)
    struct VerifiedJobRecord {
        address provider;
        uint256 tokenCount;
        uint256 verifiedAt;
        bool    isVerified;
    }

    mapping(bytes32 => JobRecord)         private _jobs;
    mapping(bytes32 => VerifiedJobRecord) private _verifiedJobs;

    // --- Events ---

    event JobDeposited(bytes32 indexed jobId, address indexed renter, address indexed provider, uint256 amount);
    event JobAttested(bytes32 indexed jobId, address indexed provider, uint256 tokensUsed, uint256 durationSecs, bytes32 outputHash, uint256 challengeDeadline);
    event ChallengeFiled(bytes32 indexed jobId, address indexed renter, string reason);
    event ChallengeResolved(bytes32 indexed jobId, bool providerFault, address recipient, uint256 amount);
    event PaymentReleased(bytes32 indexed jobId, address indexed provider, uint256 providerAmount, uint256 feeAmount);
    event PaymentRefunded(bytes32 indexed jobId, address indexed renter, uint256 amount);
    event ChallengeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    /// @notice Emitted when a provider signature is verified and the record stored on-chain
    event JobVerified(bytes32 indexed jobId, address indexed provider, uint256 totalTokens);

    // --- Constructor ---

    constructor(address _usdc)
        Ownable(msg.sender)
        EIP712("DCP JobAttestation", "1")
    {
        require(_usdc != address(0), "Invalid USDC address");
        usdc            = IERC20(_usdc);
        challengeWindow = DEFAULT_CHALLENGE_WINDOW;
    }

    // --- Renter: deposit ---

    function depositForJob(bytes32 jobId, address provider, uint256 amount) external nonReentrant {
        require(_jobs[jobId].status == JobStatus.EMPTY, "Job already exists");
        require(provider != address(0), "Invalid provider");
        require(amount > 0,             "Amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        _jobs[jobId] = JobRecord({
            renter: msg.sender, provider: provider, amount: amount,
            depositedAt: block.timestamp, attestedAt: 0, status: JobStatus.DEPOSITED,
            tokensUsed: 0, durationSecs: 0, completedAt: 0,
            outputHash: bytes32(0), challengeReason: ""
        });
        emit JobDeposited(jobId, msg.sender, provider, amount);
    }

    // --- Provider: attest ---

    function attestJob(AttestationData calldata job, bytes calldata signature) external nonReentrant {
        JobRecord storage rec = _jobs[job.jobId];
        require(rec.status == JobStatus.DEPOSITED, "Job not in DEPOSITED state");
        require(job.provider == rec.provider,       "Provider mismatch");
        require(job.renter   == rec.renter,         "Renter mismatch");
        require(job.completedAt <= block.timestamp, "Completion time in future");
        require(job.tokensUsed > 0,                 "No tokens recorded");
        bytes32 structHash = keccak256(abi.encode(
            ATTESTATION_TYPEHASH,
            job.jobId, job.provider, job.renter,
            job.tokensUsed, job.durationSecs, job.completedAt, job.outputHash
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(signer == rec.provider, "Invalid provider signature");
        rec.status       = JobStatus.ATTESTED;
        rec.attestedAt   = block.timestamp;
        rec.tokensUsed   = job.tokensUsed;
        rec.durationSecs = job.durationSecs;
        rec.completedAt  = job.completedAt;
        rec.outputHash   = job.outputHash;
        uint256 deadline = block.timestamp + challengeWindow;
        emit JobAttested(job.jobId, job.provider, job.tokensUsed, job.durationSecs, job.outputHash, deadline);
    }

    // --- Renter: challenge ---

    function challengeAttestation(bytes32 jobId, string calldata reason) external {
        JobRecord storage rec = _jobs[jobId];
        require(rec.status == JobStatus.ATTESTED,                    "Not in ATTESTED state");
        require(msg.sender == rec.renter,                            "Only renter can challenge");
        require(block.timestamp <= rec.attestedAt + challengeWindow, "Challenge window closed");
        require(bytes(reason).length > 0,                            "Reason required");
        rec.status = JobStatus.CHALLENGED;
        rec.challengeReason = reason;
        emit ChallengeFiled(jobId, msg.sender, reason);
    }

    // --- Arbitrator: resolve ---

    function resolveChallenge(bytes32 jobId, bool providerFault) external onlyOwner nonReentrant {
        JobRecord storage rec = _jobs[jobId];
        require(rec.status == JobStatus.CHALLENGED, "Not in CHALLENGED state");
        rec.status = JobStatus.RESOLVED;
        if (providerFault) {
            usdc.safeTransfer(rec.renter, rec.amount);
            emit ChallengeResolved(jobId, true, rec.renter, rec.amount);
            emit PaymentRefunded(jobId, rec.renter, rec.amount);
        } else {
            uint256 fee            = (rec.amount * FEE_BPS) / BPS_DENOMINATOR;
            uint256 providerAmount = rec.amount - fee;
            usdc.safeTransfer(rec.provider, providerAmount);
            usdc.safeTransfer(owner(),      fee);
            emit ChallengeResolved(jobId, false, rec.provider, providerAmount);
            emit PaymentReleased(jobId, rec.provider, providerAmount, fee);
        }
    }

    // --- Release after window ---

    function releasePayment(bytes32 jobId) external nonReentrant {
        JobRecord storage rec = _jobs[jobId];
        require(rec.status == JobStatus.ATTESTED, "Not in ATTESTED state");
        require(block.timestamp > rec.attestedAt + challengeWindow, "Challenge window still open");
        rec.status = JobStatus.RELEASED;
        uint256 fee            = (rec.amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 providerAmount = rec.amount - fee;
        usdc.safeTransfer(rec.provider, providerAmount);
        usdc.safeTransfer(owner(),      fee);
        emit PaymentReleased(jobId, rec.provider, providerAmount, fee);
    }

    // --- Views ---

    function getAttestation(bytes32 jobId) external view returns (JobRecord memory) {
        return _jobs[jobId];
    }

    function challengeDeadline(bytes32 jobId) external view returns (uint256) {
        JobRecord storage rec = _jobs[jobId];
        if (rec.attestedAt == 0) return 0;
        return rec.attestedAt + challengeWindow;
    }

    /// @notice Returns the on-chain verification record for a job.
    function getJobRecord(bytes32 jobId) external view returns (VerifiedJobRecord memory) {
        return _verifiedJobs[jobId];
    }

    // --- Admin ---

    function setChallengeWindow(uint256 newWindow) external onlyOwner {
        require(newWindow >= 1 hours, "Window too short");
        emit ChallengeWindowUpdated(challengeWindow, newWindow);
        challengeWindow = newWindow;
    }

    // --- On-chain verification (signature-based, permissionless) ---

    /**
     * @notice Verify a job by checking the provider ECDSA personal-sign over
     *         (jobId, inputTokens, outputTokens). Anyone may submit; the signature
     *         ensures only the true key-holder can prove the claim.
     *
     * @param jobId        Unique job identifier
     * @param provider     Provider wallet that signed the message
     * @param inputTokens  Input token count from metering
     * @param outputTokens Output token count from metering
     * @param providerSig  eth_sign over keccak256(abi.encodePacked(jobId, inputTokens, outputTokens))
     * @return true on success (reverts on failure)
     */
    function verifyJob(
        bytes32 jobId,
        address provider,
        uint256 inputTokens,
        uint256 outputTokens,
        bytes calldata providerSig
    ) external returns (bool) {
        if (_verifiedJobs[jobId].isVerified) revert AlreadyVerified(jobId);

        bytes32 messageHash   = keccak256(abi.encodePacked(jobId, inputTokens, outputTokens));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer        = ethSignedHash.recover(providerSig);
        require(signer == provider, "Invalid provider signature");

        uint256 totalTokens = inputTokens + outputTokens;

        _verifiedJobs[jobId] = VerifiedJobRecord({
            provider:   provider,
            tokenCount: totalTokens,
            verifiedAt: block.timestamp,
            isVerified: true
        });

        emit JobVerified(jobId, provider, totalTokens);
        return true;
    }
}
