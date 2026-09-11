// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TestWithdrawalVault} from "./TestWithdrawalVault.sol";

/// @notice Atomic sale of the entire remaining claim bundle, including cash and later recoveries.
/// @dev Immutable source admission. Supports only exact-transfer, non-rebasing payment tokens.
contract ExitMarket is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable paymentToken;
    TestWithdrawalVault public immutable source;
    uint256 public nextClaimId = 1;
    uint256 public totalCash;

    struct Position {
        address owner;
        uint256 sourceRequestId;
        uint256 ownershipEpoch;
        uint256 depletion;
        uint256 cash;
        uint256 withdrawn;
        uint256 purchasePrice;
    }

    struct PurchaseQuote {
        address maker;
        address seller;
        address buyer;
        uint256 claimId;
        address source;
        uint256 sourceVersion;
        address paymentToken;
        uint256 netPayment;
        uint256 feeAmount;
        address feeRecipient;
        uint256 ownershipEpoch;
        uint256 depletion;
        uint256 deadline;
        bytes32 nonce;
        bytes32 underwritingHash;
    }
    bytes32 public constant QUOTE_TYPEHASH = keccak256(
        "PurchaseQuote(address maker,address seller,address buyer,uint256 claimId,address source,uint256 sourceVersion,address paymentToken,uint256 netPayment,uint256 feeAmount,address feeRecipient,uint256 ownershipEpoch,uint256 depletion,uint256 deadline,bytes32 nonce,bytes32 underwritingHash)"
    );
    mapping(uint256 => Position) public positions;
    mapping(address => mapping(bytes32 => bool)) public unavailable;
    event Originated(
        uint256 indexed claimId,
        uint256 indexed sourceRequestId,
        address indexed owner,
        uint256 expectedAmount,
        bool adverse
    );
    event Accepted(
        uint256 indexed claimId,
        address indexed seller,
        address indexed buyer,
        address maker,
        uint256 netPayment,
        uint256 feeAmount,
        bytes32 nonce,
        uint256 ownershipEpoch
    );
    event Collected(uint256 indexed claimId, uint256 amount);
    event Withdrawn(uint256 indexed claimId, address indexed owner, uint256 amount, uint256 depletion);
    event Cancelled(address indexed maker, bytes32 indexed nonce);
    error Unauthorized();
    error InvalidQuote();
    error StaleQuote();
    error ExpiredQuote();
    error UnavailableQuote();
    error InvalidSignature();
    error InexactTransfer();
    error InvalidAmount();

    constructor(TestWithdrawalVault vault) EIP712("EXIT", "1") {
        source = vault;
        paymentToken = vault.paymentToken();
    }

    function originate(uint256 expectedAmount, bool adverse) external nonReentrant returns (uint256 id) {
        _transferExact(msg.sender, address(this), expectedAmount);
        paymentToken.forceApprove(address(source), expectedAmount);
        uint256 requestId = source.originate(expectedAmount, adverse);
        id = nextClaimId++;
        positions[id] = Position(msg.sender, requestId, 0, 0, 0, 0, 0);
        emit Originated(id, requestId, msg.sender, expectedAmount, adverse);
    }

    function hashQuote(PurchaseQuote calldata q) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(QUOTE_TYPEHASH, q)));
    }

    /// @notice Seller explicitly accepts exact signed terms; standing approvals are never acceptance.
    function accept(PurchaseQuote calldata q, bytes calldata signature) external nonReentrant {
        Position storage p = positions[q.claimId];
        if (msg.sender != p.owner || q.seller != msg.sender) revert Unauthorized();
        if (
            q.maker == address(0) || q.buyer == address(0) || q.buyer == address(this) || q.buyer == q.seller
                || q.maker == q.seller || q.maker == address(this) || q.source != address(source)
                || q.sourceVersion != source.VERSION() || q.paymentToken != address(paymentToken) || q.netPayment == 0
                || (q.feeAmount != 0
                    && (q.feeRecipient == address(0)
                        || q.feeRecipient == q.maker
                        || q.feeRecipient == q.seller
                        || q.feeRecipient == address(this)))
        ) revert InvalidQuote();
        if (q.ownershipEpoch != p.ownershipEpoch || q.depletion != p.depletion) revert StaleQuote();
        if (block.timestamp > q.deadline) revert ExpiredQuote();
        if (unavailable[q.maker][q.nonce]) revert UnavailableQuote();
        if (!SignatureChecker.isValidSignatureNow(q.maker, hashQuote(q), signature)) revert InvalidSignature();
        unavailable[q.maker][q.nonce] = true;
        p.owner = q.buyer;
        p.ownershipEpoch++;
        p.purchasePrice = q.netPayment + q.feeAmount;
        _transferExact(q.maker, q.seller, q.netPayment);
        if (q.feeAmount != 0) _transferExact(q.maker, q.feeRecipient, q.feeAmount);
        // All mutating market entry points share one guard; receipt has no callbacks/operators.
        if (p.owner != q.buyer || p.ownershipEpoch != q.ownershipEpoch + 1 || p.depletion != q.depletion) {
            revert StaleQuote();
        }
        emit Accepted(q.claimId, q.seller, q.buyer, q.maker, q.netPayment, q.feeAmount, q.nonce, p.ownershipEpoch);
    }

    function cancel(bytes32 nonce) external nonReentrant {
        unavailable[msg.sender][nonce] = true;
        emit Cancelled(msg.sender, nonce);
    }

    /// @notice Permissionless servicing always credits this claim; collecting alone removes no rights.
    function collect(uint256 id) external nonReentrant returns (uint256 amount) {
        Position storage p = positions[id];
        if (p.owner == address(0)) revert Unauthorized();
        uint256 beforeBalance = paymentToken.balanceOf(address(this));
        amount = source.collect(p.sourceRequestId);
        if (paymentToken.balanceOf(address(this)) != beforeBalance + amount) revert InexactTransfer();
        p.cash += amount;
        totalCash += amount;
        emit Collected(id, amount);
    }

    function withdraw(uint256 id, uint256 amount) external nonReentrant {
        Position storage p = positions[id];
        if (msg.sender != p.owner) revert Unauthorized();
        if (amount == 0 || amount > p.cash) revert InvalidAmount();
        p.cash -= amount;
        p.withdrawn += amount;
        p.depletion += amount;
        totalCash -= amount;
        _transferExact(address(this), p.owner, amount);
        emit Withdrawn(id, p.owner, amount, p.depletion);
    }

    function remaining(uint256 id) external view returns (uint256 pending, uint256 claimable, uint256 cash) {
        Position storage p = positions[id];
        (pending, claimable) = source.status(p.sourceRequestId);
        cash = p.cash;
    }

    function _transferExact(address from, address to, uint256 amount) private {
        uint256 beforeFrom = paymentToken.balanceOf(from);
        uint256 beforeTo = paymentToken.balanceOf(to);
        if (from == address(this)) paymentToken.safeTransfer(to, amount);
        else paymentToken.safeTransferFrom(from, to, amount);
        if (paymentToken.balanceOf(from) + amount != beforeFrom || paymentToken.balanceOf(to) != beforeTo + amount) {
            revert InexactTransfer();
        }
    }
}
