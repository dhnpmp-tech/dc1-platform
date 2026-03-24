// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IEscrowClaim {
    function claimLock(bytes32 jobId, bytes calldata proof) external;
}

/**
 * @title MaliciousToken
 * @notice ERC-20 that attempts a reentrancy attack on Escrow.claimLock() when
 *         its transfer() is called.  Used only in unit tests to verify the
 *         escrow's ReentrancyGuard blocks recursive invocations.
 *
 * Attack flow:
 *   1. Deploy Escrow with MaliciousToken as the token address.
 *   2. Renter deposits via depositAndLock (transferFrom → escrow).
 *   3. claimLock triggers transfer() to pay the provider.
 *   4. MaliciousToken.transfer() calls back into claimLock.
 *   5. ReentrancyGuard reverts → entire tx rolls back.
 */
contract MaliciousToken is ERC20 {
    address public target;
    bytes32 public attackJobId;
    bytes   public attackProof;
    bool    public armed;

    constructor() ERC20("MaliciousToken", "MAL") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Arm the attack before submitting the claim.
    function arm(address _target, bytes32 _jobId, bytes calldata _proof) external {
        target      = _target;
        attackJobId = _jobId;
        attackProof = _proof;
        armed       = true;
    }

    /**
     * @dev Intercepts transfer() calls and injects a re-entrant claimLock.
     *      Self-disarms after the first attack to prevent infinite recursion.
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (armed) {
            armed = false; // one attempt only
            IEscrowClaim(target).claimLock(attackJobId, attackProof);
        }
        return super.transfer(to, amount);
    }
}
