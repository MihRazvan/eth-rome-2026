// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Permissionless, valueless test currency. Never production USDC.
contract TestUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100_000 * 1e6;
    constructor() ERC20("EXIT Test USDC", "testUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @dev Unlimited repeatable faucet deliberately makes this demonstration self-service.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
