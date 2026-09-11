// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IERC20Probe {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Research probe: one owner's immutable, prefunded ERC-20 obligations.
/// @dev Assumes an ordinary exact-transfer ERC-20. No offchain exactly-once guarantee.
contract RepriseProbe {
    error Unauthorized();
    error InvalidTerms();
    error ExistingStep();
    error UnknownStep();
    error ActiveLease();
    error InvalidLease();
    error WrongEffect();
    error AlreadyPaid();
    error NotPaid();
    error AlreadyPublished();
    error Cancelled();
    error TokenFailure();
    error Reentered();

    struct Step {
        address recipient;
        uint256 amount;
        bytes32 effect;
        bool paid;
        uint256 paidEpoch;
        address paidBy;
        uint256 paidBlock;
        bytes32 receipt;
    }

    bytes32 public constant EFFECT_DOMAIN = keccak256("REPRISE_RESEARCH_PAYMENT_V1");
    bytes32 public constant RECEIPT_DOMAIN = keccak256("REPRISE_RESEARCH_RECEIPT_V1");
    address public immutable owner;
    IERC20Probe public immutable token;
    bytes32 public immutable job;
    uint256 public immutable leaseDuration;
    mapping(uint256 => Step) public steps;
    mapping(address => bool) public enrolled;
    address public worker;
    uint256 public epoch;
    uint256 public deadline;
    uint256 public unspent;
    bool public cancelled;
    bool private entered;

    event Approved(uint256 indexed step, bytes32 indexed effect);
    event LeaseAcquired(address indexed worker, uint256 indexed epoch, uint256 deadline);
    event Paid(uint256 indexed step, bytes32 indexed effect, uint256 epoch, address worker);
    event ReceiptPublished(uint256 indexed step, bytes32 indexed commitment, bytes32 evidence, uint256 epoch);
    event JobCancelled(uint256 refunded);

    constructor(IERC20Probe token_, bytes32 job_, uint256 duration_) {
        if (address(token_) == address(0) || duration_ == 0) revert InvalidTerms();
        owner = msg.sender;
        token = token_;
        job = job_;
        leaseDuration = duration_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (entered) revert Reentered();
        entered = true;
        _;
        entered = false;
    }

    function enroll(address candidate) external onlyOwner {
        if (candidate == address(0)) revert InvalidTerms();
        enrolled[candidate] = true;
    }

    function effectId(uint256 step, address recipient, uint256 amount) public view returns (bytes32) {
        return keccak256(
            abi.encode(EFFECT_DOMAIN, block.chainid, address(this), job, step, recipient, address(token), amount)
        );
    }

    /// @dev Only the principal can introduce a new semantic obligation. Terms cannot be replaced.
    function approveStep(uint256 step, address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (cancelled) revert Cancelled();
        if (recipient == address(0) || recipient == address(this) || amount == 0) revert InvalidTerms();
        if (steps[step].amount != 0) revert ExistingStep();
        bytes32 effect = effectId(step, recipient, amount);
        steps[step] = Step(recipient, amount, effect, false, 0, address(0), 0, bytes32(0));
        unspent += amount;
        if (!token.transferFrom(owner, address(this), amount)) revert TokenFailure();
        emit Approved(step, effect);
    }

    function acquireLease() external {
        if (!enrolled[msg.sender]) revert Unauthorized();
        if (worker != address(0) && block.timestamp < deadline) revert ActiveLease();
        worker = msg.sender;
        epoch += 1;
        deadline = block.timestamp + leaseDuration;
        emit LeaseAcquired(worker, epoch, deadline);
    }

    function requireLease(uint256 expectedEpoch) private view {
        if (msg.sender != worker || expectedEpoch != epoch || block.timestamp >= deadline) revert InvalidLease();
    }

    function pay(uint256 step, bytes32 expectedEffect, uint256 expectedEpoch) external nonReentrant {
        requireLease(expectedEpoch);
        if (cancelled) revert Cancelled();
        Step storage obligation = steps[step];
        if (obligation.amount == 0) revert UnknownStep();
        if (
            expectedEffect != obligation.effect
                || expectedEffect != effectId(step, obligation.recipient, obligation.amount)
        ) {
            revert WrongEffect();
        }
        if (obligation.paid) revert AlreadyPaid();
        obligation.paid = true;
        obligation.paidEpoch = epoch;
        obligation.paidBy = msg.sender;
        obligation.paidBlock = block.number;
        unspent -= obligation.amount;
        if (!token.transfer(obligation.recipient, obligation.amount)) revert TokenFailure();
        emit Paid(step, expectedEffect, epoch, msg.sender);
    }

    /// @notice Current worker publishes recovery evidence about an already observed payment.
    /// @dev Evidence is opaque. This establishes attribution, not the truth of external bytes.
    function publishReceipt(uint256 step, bytes32 evidence, uint256 expectedEpoch)
        external
        returns (bytes32 commitment)
    {
        requireLease(expectedEpoch);
        Step storage obligation = steps[step];
        if (!obligation.paid) revert NotPaid();
        if (obligation.receipt != bytes32(0)) revert AlreadyPublished();
        if (evidence == bytes32(0)) revert InvalidTerms();
        commitment = keccak256(
            abi.encode(
                RECEIPT_DOMAIN,
                obligation.effect,
                obligation.paidEpoch,
                obligation.paidBy,
                obligation.paidBlock,
                epoch,
                msg.sender,
                evidence
            )
        );
        obligation.receipt = commitment;
        emit ReceiptPublished(step, commitment, evidence, epoch);
    }

    /// @notice Paid effects stay paid; remaining prefunded obligations can no longer execute.
    function cancel() external onlyOwner nonReentrant {
        if (cancelled) revert Cancelled();
        cancelled = true;
        uint256 refund = unspent;
        unspent = 0;
        if (refund != 0 && !token.transfer(owner, refund)) revert TokenFailure();
        emit JobCancelled(refund);
    }
}
