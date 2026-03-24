// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IEscrow {
    function claimLock(bytes32 jobId, bytes calldata proof) external;
    function cancelExpiredLock(bytes32 jobId) external;
}

/**
 * @title MaliciousToken
 * @notice ERC-20 token that attempts a reentrancy attack when its transfer() is called.
 *
 * Used ONLY in unit tests to verify the escrow's ReentrancyGuard prevents recursive calls.
 *
 * Attack scenario:
 *   1. Deploy Escrow with MaliciousToken as the "USDC" address.
 *   2. Renter deposits via depositAndLock (transfer FROM renter → contract).
 *   3. On claimLock, the Escrow calls transfer() to pay the provider.
 *   4. MaliciousToken.transfer() intercepts and calls claimLock again.
 *   5. ReentrancyGuard reverts the inner call → entire tx rolls back.
 */
contract MaliciousToken is ERC20 {
    address public target;   // Escrow contract address
    bytes32 public jobId;    // Job to attack
    bytes   public proof;    // Oracle proof reused in re-entrant call
    bool    public armed;    // Only attack once to avoid infinite loops

    constructor() ERC20("MaliciousToken", "MAL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Arm the re-entrancy attack before the claim is submitted.
    function arm(address _target, bytes32 _jobId, bytes calldata _proof) external {
        target = _target;
        jobId  = _jobId;
        proof  = _proof;
        armed  = true;
    }

    /**
     * @dev Override transfer to inject a re-entrant claimLock call when armed.
     *      The escrow calls this when paying the provider.
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false; // Disarm to prevent infinite recursion
            // Attempt re-entrant call — should revert with ReentrancyGuard
            IEscrow(target).claimLock(jobId, proof);
        }
        return super.transfer(to, amount);
    }
}
