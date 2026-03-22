// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DC1 Escrow
 * @notice Trustless payment escrow for DC1 GPU compute jobs on Base L2.
 *
 * Flow:
 *   1. Renter calls depositAndLock(jobId, provider, amount, expiry)
 *      — USDC is pulled from renter and held in this contract
 *   2. Job runs on provider hardware
 *   3. DC1 backend oracle signs job completion; provider/relayer/owner calls claimLock(jobId, proof)
 *      — 75% goes to provider, 25% goes to contract owner (DC1 fee)
 *   4. If the job expires unclaimed, renter calls cancelExpiredLock(jobId)
 *      — full amount returned to renter or relayer/oracle admin
 *
 * Payment token: USDC (6 decimals) on Base Sepolia / Base mainnet
 * Oracle:        DC1 backend signing key (set on deploy, updateable by owner)
 * Fee:           2500 BPS = 25%
 */
contract Escrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ────────────────────────────────────────────────────────────────────────
    // Constants & immutables
    // ────────────────────────────────────────────────────────────────────────

    /// @notice USDC contract (immutable — set at deploy time)
    IERC20 public immutable usdc;

    /// @notice DC1 fee in basis points (25 %)
    uint256 public constant FEE_BPS = 2500;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ────────────────────────────────────────────────────────────────────────
    // State
    // ────────────────────────────────────────────────────────────────────────

    /// @notice DC1 backend address that signs job-completion proofs
    address public oracle;
    address public relayer;

    enum EscrowStatus {
        EMPTY,     // 0 — never used
        LOCKED,    // 1 — funds held, job running
        CLAIMED,   // 2 — provider paid
        CANCELLED  // 3 — renter refunded
    }

    struct EscrowRecord {
        address renter;
        address provider;
        uint256 amount;
        uint256 expiry;
        EscrowStatus status;
    }

    /// @dev jobId → escrow record
    mapping(bytes32 => EscrowRecord) private _escrows;

    // ────────────────────────────────────────────────────────────────────────
    // Events
    // ────────────────────────────────────────────────────────────────────────

    event Deposited(
        bytes32 indexed jobId,
        address indexed renter,
        address indexed provider,
        uint256 amount,
        uint256 expiry
    );

    event Claimed(
        bytes32 indexed jobId,
        address indexed provider,
        uint256 providerAmount,
        uint256 feeAmount
    );

    event Cancelled(
        bytes32 indexed jobId,
        address indexed renter,
        uint256 amount
    );

    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    // ────────────────────────────────────────────────────────────────────────
    // Constructor
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @param _usdc   USDC token address (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
     * @param _oracle DC1 backend signing address
     */
    constructor(address _usdc, address _oracle) Ownable(msg.sender) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_oracle != address(0), "Invalid oracle address");
        usdc = IERC20(_usdc);
        oracle = _oracle;
        relayer = msg.sender;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Core escrow functions
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Renter deposits USDC and locks it for a specific job.
     * @param jobId    Unique job identifier (keccak256 of DC1 job UUID)
     * @param provider Provider wallet address that will run the job
     * @param amount   USDC amount in micro-USDC (6 decimals)
     * @param expiry   Unix timestamp after which renter can cancel
     */
    function depositAndLock(
        bytes32 jobId,
        address provider,
        uint256 amount,
        uint256 expiry
    ) external nonReentrant {
        require(_escrows[jobId].status == EscrowStatus.EMPTY, "Job already exists");
        require(provider != address(0), "Invalid provider address");
        require(amount > 0, "Amount must be > 0");
        require(expiry > block.timestamp, "Expiry must be in future");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        _escrows[jobId] = EscrowRecord({
            renter: msg.sender,
            provider: provider,
            amount: amount,
            expiry: expiry,
            status: EscrowStatus.LOCKED
        });

        emit Deposited(jobId, msg.sender, provider, amount, expiry);
    }

    /**
     * @notice Provider claims escrowed funds after job completion.
     *         Requires a valid ECDSA signature from the DC1 oracle confirming completion.
     *
     * @param jobId Unique job identifier
     * @param proof Oracle signature over keccak256(abi.encodePacked(jobId, provider, amount))
     *
     * Fee split: 75 % → provider, 25 % → DC1 (contract owner)
     */
    function claimLock(bytes32 jobId, bytes calldata proof) external nonReentrant {
        EscrowRecord storage escrow = _escrows[jobId];

        require(escrow.status == EscrowStatus.LOCKED, "Not locked");
        require(
            msg.sender == escrow.provider || msg.sender == relayer || msg.sender == owner(),
            "Not authorized to claim"
        );
        require(block.timestamp <= escrow.expiry, "Expired");

        // Verify oracle signature: sign( keccak256(jobId || provider || amount) )
        bytes32 messageHash = keccak256(
            abi.encodePacked(jobId, escrow.provider, escrow.amount)
        );
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address signer = ethSignedHash.recover(proof);
        require(signer == oracle, "Invalid oracle proof");

        escrow.status = EscrowStatus.CLAIMED;

        uint256 fee = (escrow.amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 providerAmount = escrow.amount - fee;

        usdc.safeTransfer(escrow.provider, providerAmount);
        usdc.safeTransfer(owner(), fee);

        emit Claimed(jobId, escrow.provider, providerAmount, fee);
    }

    /**
     * @notice Renter reclaims funds if the job expired without being claimed.
     * @param jobId Unique job identifier
     */
    function cancelExpiredLock(bytes32 jobId) external nonReentrant {
        EscrowRecord storage escrow = _escrows[jobId];

        require(escrow.status == EscrowStatus.LOCKED, "Not locked");
        require(block.timestamp > escrow.expiry, "Not expired yet");
        require(
            msg.sender == escrow.renter || msg.sender == relayer || msg.sender == owner(),
            "Not authorized to cancel"
        );

        escrow.status = EscrowStatus.CANCELLED;

        usdc.safeTransfer(escrow.renter, escrow.amount);

        emit Cancelled(jobId, escrow.renter, escrow.amount);
    }

    /**
     * @notice Read escrow record for a job.
     * @param jobId Unique job identifier
     * @return EscrowRecord struct
     */
    function getEscrow(bytes32 jobId) external view returns (EscrowRecord memory) {
        return _escrows[jobId];
    }

    // ────────────────────────────────────────────────────────────────────────
    // Admin
    // ────────────────────────────────────────────────────────────────────────

    /**
     * @notice Update the DC1 oracle signing address. Only callable by owner.
     * @param newOracle New oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle address");
        emit OracleUpdated(oracle, newOracle);
        oracle = newOracle;
    }

    /**
     * @notice Update the authorized relayer used by backend automation.
     *         Relayer and/or owner can claim and cancel on-chain escrows.
     * @param newRelayer New relayer address
     */
    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "Invalid relayer address");
        emit RelayerUpdated(relayer, newRelayer);
        relayer = newRelayer;
    }
}
