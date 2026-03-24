// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProviderRegistry
 * @notice On-chain reputation registry for DCP GPU compute providers.
 *
 * Each provider may register once by staking ERC-20 tokens (DCP token or USDC
 * on testnet).  The DC1 backend oracle records job completions; renters raise
 * disputes; the owner (DAO multi-sig on mainnet) resolves them.
 *
 * Score formula (0–100):
 *   base        = 50
 *   jobBonus    = min(30, completedJobs)        — up to +30 from track record
 *   faultPenalty= resolvedFaults × 10            — -10 per proven fault
 *   uptimeBonus = (uptimeScore × 20) / 10 000   — up to +20 from oracle uptime
 *   score       = clamp(0, 100, base + jobBonus − faultPenalty + uptimeBonus)
 *
 * Compatible with Escrow.sol: providers registered here are the same addresses
 * used as the `provider` argument in depositAndLock / claimLock.
 */
contract ProviderRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ────────────────────────────────────────────────────────────────────────
    // Constants
    // ────────────────────────────────────────────────────────────────────────

    uint256 public constant UPTIME_DENOMINATOR = 10_000; // 10 000 BPS = 100 %
    uint256 public constant MAX_UPTIME_BONUS    = 20;
    uint256 public constant MAX_JOB_BONUS       = 30;
    uint256 public constant FAULT_PENALTY       = 10;    // points per resolved fault
    uint256 public constant BASE_SCORE          = 50;

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @notice Token accepted as stake (DCP token; USDC on testnet)
    IERC20 public immutable stakeToken;

    /// @notice DC1 backend address authorised to record job completions
    address public oracle;

    struct ProviderRecord {
        uint256 stake;           // tokens held in escrow
        uint256 completedJobs;   // total jobs marked complete by oracle
        uint256 tokensProcessed; // cumulative GPU-tokens across all jobs
        uint256 disputes;        // total disputes raised against provider
        uint256 resolvedFaults;  // disputes resolved as provider's fault
        uint256 uptimeScore;     // 0-10 000 BPS; set by oracle
        uint256 lastUpdated;     // unix timestamp of last oracle update
        bool    registered;
    }

    struct Dispute {
        address provider;
        address renter;
        uint256 jobId;
        string  reason;
        bool    resolved;
        bool    providerFault;
        uint256 createdAt;
    }

    /// @dev provider address → record
    mapping(address => ProviderRecord) private _providers;

    /// @dev auto-incrementing dispute counter (1-based so 0 == "no dispute")
    uint256 private _disputeCount;

    /// @dev disputeId → Dispute
    mapping(uint256 => Dispute) private _disputes;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event ProviderRegistered(address indexed provider, uint256 stake);
    event ProviderDeregistered(address indexed provider, uint256 stakeReturned);
    event ReputationUpdated(
        address indexed provider,
        uint256 completedJobs,
        uint256 tokensProcessed,
        uint256 newScore
    );
    event UptimeUpdated(address indexed provider, uint256 uptimeScore, uint256 newScore);
    event DisputeRaised(
        uint256 indexed disputeId,
        address indexed provider,
        address indexed renter,
        uint256 jobId,
        string  reason
    );
    event DisputeResolved(
        uint256 indexed disputeId,
        address indexed provider,
        bool    providerFault,
        uint256 newScore
    );
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param _stakeToken ERC-20 used for provider stakes
     * @param _oracle     DC1 backend signing address
     */
    constructor(address _stakeToken, address _oracle) Ownable(msg.sender) {
        require(_stakeToken != address(0), "Invalid stake token");
        require(_oracle    != address(0), "Invalid oracle address");
        stakeToken = IERC20(_stakeToken);
        oracle     = _oracle;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Registration
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a provider with a stake.  The provider must have
     *         approved this contract to spend `stake` tokens beforehand.
     *         Only the provider themselves (or the owner for onboarding) can
     *         register.
     * @param provider Wallet address of the GPU provider
     * @param stake    Token amount to lock as security deposit
     */
    function registerProvider(address provider, uint256 stake)
        external
        nonReentrant
    {
        require(
            msg.sender == provider || msg.sender == owner(),
            "Not authorised to register"
        );
        require(provider != address(0),            "Invalid provider address");
        require(!_providers[provider].registered,  "Already registered");
        require(stake > 0,                         "Stake must be > 0");

        stakeToken.safeTransferFrom(msg.sender == owner() ? provider : msg.sender, address(this), stake);

        _providers[provider] = ProviderRecord({
            stake:           stake,
            completedJobs:   0,
            tokensProcessed: 0,
            disputes:        0,
            resolvedFaults:  0,
            uptimeScore:     10_000, // assume 100 % until oracle reports otherwise
            lastUpdated:     block.timestamp,
            registered:      true
        });

        emit ProviderRegistered(provider, stake);
    }

    /**
     * @notice Deregister a provider and return their stake.
     *         Only callable by owner; prevents providers with unresolved disputes
     *         from rage-quitting.
     * @param provider Provider to deregister
     */
    function deregisterProvider(address provider) external onlyOwner nonReentrant {
        ProviderRecord storage rec = _providers[provider];
        require(rec.registered, "Not registered");

        uint256 stakeToReturn = rec.stake;
        rec.stake      = 0;
        rec.registered = false;

        if (stakeToReturn > 0) {
            stakeToken.safeTransfer(provider, stakeToReturn);
        }

        emit ProviderDeregistered(provider, stakeToReturn);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Oracle-driven reputation updates
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Record a completed GPU job.  Only callable by the oracle.
     * @param provider        Provider who ran the job
     * @param jobId           Job identifier (matches off-chain records)
     * @param tokensProcessed Number of GPU-tokens (or compute units) processed
     */
    function recordJobCompletion(
        address provider,
        uint256 jobId,
        uint256 tokensProcessed
    ) external {
        require(msg.sender == oracle, "Only oracle");
        require(_providers[provider].registered, "Provider not registered");

        ProviderRecord storage rec = _providers[provider];
        rec.completedJobs   += 1;
        rec.tokensProcessed += tokensProcessed;
        rec.lastUpdated      = block.timestamp;

        uint256 score = _computeScore(rec);
        emit ReputationUpdated(provider, rec.completedJobs, rec.tokensProcessed, score);

        // Suppress unused-variable warning for jobId while keeping it in the ABI
        jobId;
    }

    /**
     * @notice Update a provider's uptime score.  Only callable by the oracle.
     * @param provider    Provider address
     * @param uptimeScore 0-10 000 BPS (10 000 = 100 % uptime)
     */
    function updateUptimeScore(address provider, uint256 uptimeScore) external {
        require(msg.sender == oracle, "Only oracle");
        require(_providers[provider].registered, "Provider not registered");
        require(uptimeScore <= UPTIME_DENOMINATOR, "Score out of range");

        ProviderRecord storage rec = _providers[provider];
        rec.uptimeScore = uptimeScore;
        rec.lastUpdated = block.timestamp;

        uint256 score = _computeScore(rec);
        emit UptimeUpdated(provider, uptimeScore, score);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Dispute lifecycle
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Renter raises a dispute against a provider for a specific job.
     * @param provider Provider address
     * @param jobId    Off-chain job identifier
     * @param reason   Human-readable dispute reason
     * @return disputeId Unique identifier for this dispute
     */
    function raiseDispute(
        address provider,
        uint256 jobId,
        string calldata reason
    ) external returns (uint256 disputeId) {
        require(_providers[provider].registered, "Provider not registered");
        require(bytes(reason).length > 0,        "Reason required");

        _disputeCount += 1;
        disputeId = _disputeCount;

        _disputes[disputeId] = Dispute({
            provider:     provider,
            renter:       msg.sender,
            jobId:        jobId,
            reason:       reason,
            resolved:     false,
            providerFault: false,
            createdAt:    block.timestamp
        });

        _providers[provider].disputes += 1;

        emit DisputeRaised(disputeId, provider, msg.sender, jobId, reason);
    }

    /**
     * @notice Resolve a dispute.  Only callable by owner (DAO / admin).
     * @param disputeId    Dispute to resolve
     * @param providerFault True if the provider is at fault (score penalty applied)
     */
    function resolveDispute(uint256 disputeId, bool providerFault)
        external
        onlyOwner
    {
        Dispute storage d = _disputes[disputeId];
        require(d.createdAt != 0, "Dispute not found");
        require(!d.resolved,      "Already resolved");

        d.resolved      = true;
        d.providerFault = providerFault;

        if (providerFault) {
            _providers[d.provider].resolvedFaults += 1;
        }

        uint256 score = _computeScore(_providers[d.provider]);
        emit DisputeResolved(disputeId, d.provider, providerFault, score);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View functions
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the provider's weighted reputation score (0-100).
     */
    function getProviderScore(address provider) external view returns (uint256) {
        require(_providers[provider].registered, "Provider not registered");
        return _computeScore(_providers[provider]);
    }

    /**
     * @notice Returns the full provider record.
     */
    function getProvider(address provider) external view returns (ProviderRecord memory) {
        return _providers[provider];
    }

    /**
     * @notice Returns a dispute record by ID.
     */
    function getDispute(uint256 disputeId) external view returns (Dispute memory) {
        require(_disputes[disputeId].createdAt != 0, "Dispute not found");
        return _disputes[disputeId];
    }

    /**
     * @notice Total number of disputes ever raised.
     */
    function disputeCount() external view returns (uint256) {
        return _disputeCount;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the DC1 oracle address.
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Internal
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @dev Computes the weighted reputation score for a provider record.
     *
     *   score = clamp(0, 100,
     *             BASE_SCORE
     *             + min(MAX_JOB_BONUS, completedJobs)
     *             − resolvedFaults × FAULT_PENALTY
     *             + (uptimeScore × MAX_UPTIME_BONUS) / UPTIME_DENOMINATOR
     *           )
     */
    function _computeScore(ProviderRecord storage rec)
        internal
        view
        returns (uint256)
    {
        uint256 jobBonus    = rec.completedJobs < MAX_JOB_BONUS
                                ? rec.completedJobs
                                : MAX_JOB_BONUS;
        uint256 uptimeBonus = (rec.uptimeScore * MAX_UPTIME_BONUS) / UPTIME_DENOMINATOR;
        uint256 faultPenalty= rec.resolvedFaults * FAULT_PENALTY;

        uint256 positive = BASE_SCORE + jobBonus + uptimeBonus;
        if (faultPenalty >= positive) return 0;

        uint256 raw = positive - faultPenalty;
        return raw > 100 ? 100 : raw;
    }
}
