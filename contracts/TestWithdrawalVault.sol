// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Fully backed test source with 60/120-second installments and an opt-in 3% loss.
/// @dev No admin, upgrade, cancellation, arbitrary execution or mutable payout destination.
contract TestWithdrawalVault is ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable paymentToken;
    uint256 public constant VERSION = 1;
    uint256 public constant FIRST_DELAY = 60;
    uint256 public constant FINAL_DELAY = 120;
    address public constant LOSS_SINK = address(0xdead);
    uint256 public nextRequestId = 1;
    uint256 public totalLiability;

    struct Request {
        address requester;
        uint256 expected;
        uint256 firstAmount;
        uint256 finalAmount;
        uint256 createdAt;
        uint256 paid;
        uint256 recovery;
        bool adverse;
    }
    mapping(uint256 => Request) public requests;
    event Requested(uint256 indexed requestId, address indexed requester, uint256 expected, bool adverse);
    event Paid(uint256 indexed requestId, uint256 amount);
    event RecoveryFunded(uint256 indexed requestId, uint256 amount);
    error InvalidRequest();
    error NotRequester();
    error InexactTransfer();

    constructor(IERC20 token) {
        require(address(token) != address(0));
        paymentToken = token;
    }

    function originate(uint256 expected, bool adverse) external nonReentrant returns (uint256 id) {
        if (expected < 100) revert InvalidRequest();
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), expected);
        if (paymentToken.balanceOf(address(this)) != beforeBalance + expected) revert InexactTransfer();
        uint256 loss = adverse ? expected * 3 / 100 : 0;
        if (loss != 0) _pay(LOSS_SINK, loss);
        uint256 first = expected * 40 / 100;
        id = nextRequestId++;
        requests[id] = Request(msg.sender, expected, first, expected - first - loss, block.timestamp, 0, 0, adverse);
        totalLiability += expected - loss;
        emit Requested(id, msg.sender, expected, adverse);
    }

    /// @return pending Scheduled cash not yet due; @return claimable Due cash plus funded recoveries.
    function status(uint256 id) public view returns (uint256 pending, uint256 claimable) {
        Request storage r = requests[id];
        if (r.requester == address(0)) revert InvalidRequest();
        uint256 vested = 0;
        if (block.timestamp >= r.createdAt + FIRST_DELAY) vested = r.firstAmount;
        if (block.timestamp >= r.createdAt + FINAL_DELAY) vested += r.finalAmount;
        pending = r.firstAmount + r.finalAmount - vested;
        claimable = vested + r.recovery - r.paid;
    }

    function collect(uint256 id) external nonReentrant returns (uint256 amount) {
        Request storage r = requests[id];
        if (msg.sender != r.requester) revert NotRequester();
        (, amount) = status(id);
        if (amount == 0) return 0;
        r.paid += amount;
        totalLiability -= amount;
        _pay(r.requester, amount);
        emit Paid(id, amount);
    }

    /// @notice Anyone may add backed later recovery; requester/owner authority never expires.
    function fundRecovery(uint256 id, uint256 amount) external nonReentrant {
        if (requests[id].requester == address(0) || amount == 0) revert InvalidRequest();
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InexactTransfer();
        requests[id].recovery += amount;
        totalLiability += amount;
        emit RecoveryFunded(id, amount);
    }

    function _pay(address to, uint256 amount) private {
        uint256 beforeFrom = paymentToken.balanceOf(address(this));
        uint256 beforeTo = paymentToken.balanceOf(to);
        paymentToken.safeTransfer(to, amount);
        if (
            paymentToken.balanceOf(address(this)) + amount != beforeFrom
                || paymentToken.balanceOf(to) != beforeTo + amount
        ) revert InexactTransfer();
    }
}
