// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProviderStake
 * @notice Provider collateral staking for DCP GPU compute marketplace.
 *
 * Providers stake DCP tokens (represented as native ETH in this contract for simplicity,
 * or can be adapted to an ERC-20 token). The stake acts as collateral — if a provider
 * misbehaves, the admin can slash their stake.
 *
 * Rules:
 * - Minimum stake: 100 ether (100 DCP tokens, 18 decimals)
 * - Lock period: 7 days before unstake is allowed
 * - Only owner (admin) can slash
 */
contract ProviderStake is Ownable, ReentrancyGuard {
    uint256 public constant MIN_STAKE = 100 ether;
    uint256 public constant LOCK_PERIOD = 7 days;

    struct Stake {
        uint256 amount;
        uint256 stakedAt;
        bool isActive;
    }

    mapping(address => Stake) public stakes;

    event Staked(address indexed provider, uint256 amount);
    event Unstaked(address indexed provider, uint256 amount);
    event Slashed(address indexed provider, uint256 amount, string reason);

    error BelowMinimum(uint256 sent, uint256 minimum);
    error AlreadyStaked();
    error NotStaked();
    error LockPeriodNotElapsed(uint256 unlocksAt);
    error InsufficientStake(uint256 requested, uint256 available);
    error TransferFailed();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Stake ETH as collateral. Must send at least MIN_STAKE.
     * @dev Provider must not already have an active stake. To top up, unstake first.
     */
    function stake() external payable nonReentrant {
        if (msg.value < MIN_STAKE) {
            revert BelowMinimum(msg.value, MIN_STAKE);
        }
        if (stakes[msg.sender].isActive) {
            revert AlreadyStaked();
        }

        stakes[msg.sender] = Stake({
            amount: msg.value,
            stakedAt: block.timestamp,
            isActive: true
        });

        emit Staked(msg.sender, msg.value);
    }

    /**
     * @notice Withdraw a partial or full stake after the lock period.
     * @param amount Amount to withdraw (in wei).
     */
    function unstake(uint256 amount) external nonReentrant {
        Stake storage s = stakes[msg.sender];
        if (!s.isActive) revert NotStaked();

        uint256 unlocksAt = s.stakedAt + LOCK_PERIOD;
        if (block.timestamp < unlocksAt) {
            revert LockPeriodNotElapsed(unlocksAt);
        }
        if (amount > s.amount) {
            revert InsufficientStake(amount, s.amount);
        }

        s.amount -= amount;
        if (s.amount == 0) {
            s.isActive = false;
        }

        emit Unstaked(msg.sender, amount);

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /**
     * @notice Slash a provider's stake. Slashed funds are held by this contract (owner can withdraw).
     * @param provider Address of the misbehaving provider.
     * @param amount Amount to slash (in wei).
     * @param reason Human-readable reason for the slash.
     */
    function slash(
        address provider,
        uint256 amount,
        string calldata reason
    ) external onlyOwner {
        Stake storage s = stakes[provider];
        if (!s.isActive) revert NotStaked();
        if (amount > s.amount) {
            revert InsufficientStake(amount, s.amount);
        }

        s.amount -= amount;
        if (s.amount == 0) {
            s.isActive = false;
        }

        emit Slashed(provider, amount, reason);
    }

    /**
     * @notice View a provider's stake record.
     */
    function getStake(address provider) external view returns (Stake memory) {
        return stakes[provider];
    }

    /**
     * @notice Owner can withdraw slashed funds accumulated in the contract.
     * @param amount Amount to withdraw.
     */
    function withdrawSlashed(uint256 amount) external onlyOwner nonReentrant {
        (bool ok, ) = owner().call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
