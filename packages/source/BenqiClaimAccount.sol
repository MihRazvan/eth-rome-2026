// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IStakedAvax {
    function submit() external payable returns (uint256);
    function requestUnlock(uint256 shares) external;
    function redeem(uint256 index) external;
    function redeemOverdueShares(uint256 index) external;
    function cancelUnlockRequest(uint256 index) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address,uint256) external returns (bool);
    function getUnlockRequestCount(address) external view returns (uint256);
}

/// @notice Source-admission prototype. Not wired into the production test-vault market.
/// One source, one origin request, current owner controls supported cash and share recovery.
contract BenqiClaimAccount {
    IStakedAvax public immutable source;
    address public owner;
    uint256 public epoch;
    uint256 public depletion;
    bool public originated;
    bool private entered;
    error Unauthorized();
    error InvalidState();
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    modifier guarded() { if (entered) revert InvalidState(); entered = true; _; entered = false; }
    constructor(address source_, address owner_) {
        if (source_.code.length == 0 || owner_ == address(0)) revert InvalidState();
        source = IStakedAvax(source_); owner = owner_;
    }
    function originate() external payable onlyOwner guarded {
        if (originated || msg.value == 0) revert InvalidState();
        originated = true;
        uint256 shares = source.submit{value: msg.value}();
        source.requestUnlock(shares);
    }
    function transferOwnership(address next) external onlyOwner guarded {
        if (next == address(0) || next == address(this)) revert InvalidState();
        owner = next; ++epoch;
    }
    // Permissionless servicing always retains assets in this account for the current owner.
    function collect() external guarded { source.redeem(0); }
    function recoverOverdue() external guarded { source.redeemOverdueShares(0); }
    function cancel() external onlyOwner guarded { source.cancelUnlockRequest(0); ++depletion; }
    function withdrawCash() external onlyOwner guarded {
        uint256 amount = address(this).balance;
        if (amount == 0) revert InvalidState();
        ++depletion;
        (bool ok,) = owner.call{value: amount}("");
        if (!ok) revert InvalidState();
    }
    function withdrawShares() external onlyOwner guarded {
        uint256 amount = source.balanceOf(address(this));
        if (amount == 0) revert InvalidState();
        ++depletion;
        if (!source.transfer(owner, amount)) revert InvalidState();
    }
    receive() external payable {}
}
