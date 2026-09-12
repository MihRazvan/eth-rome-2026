// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IQualificationVerifier {
    /// gnark's generated verifier reverts on invalid proofs; successful return means valid.
    function verifyProof(bytes calldata proof, uint256[9] calldata input) external view;
}

/// @notice Isolated qualification experiment: authenticated admission + client-approved payment.
/// @dev A trusted issuer controls the revocation root. No anonymous-payment or work-quality claim.
contract QualificationEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes32 public constant JOB_DOMAIN = keccak256("QUALIFICATION_JOB_V1");
    address public immutable issuer;
    address public immutable arbitrator;
    uint256 public immutable issuerX;
    uint256 public immutable issuerY;
    IERC20 public immutable token;
    IQualificationVerifier public immutable verifier;
    uint256 public revocationRoot;
    uint256 public rootEpoch;
    uint256 public nextJob;

    enum Status {
        Open,
        Accepted,
        Submitted,
        Paid,
        Refunded,
        Disputed,
        Resolved
    }

    struct Job {
        address client;
        address worker;
        uint256 amount;
        uint256 qualificationClass;
        uint64 acceptBefore;
        uint64 submitBefore;
        uint64 reviewBefore;
        Status status;
        bytes32 terms;
        bytes32 deliverable;
    }
    mapping(uint256 => Job) public jobs;
    mapping(uint256 => bool) public consumedNullifiers;
    mapping(uint256 => bytes32) public documentDigests;

    error Unauthorized();
    error InvalidTerms();
    error WrongState();
    error Expired();
    error WrongStatement();
    error Replayed();

    event RootUpdated(uint256 indexed epoch, uint256 root);
    event JobFunded(uint256 indexed job, address indexed client, uint256 amount, uint256 qualificationClass);
    event Accepted(uint256 indexed job, address indexed worker, uint256 indexed nullifier, uint256 epoch);
    event Submitted(uint256 indexed job, bytes32 deliverable);
    event DocumentCommitted(uint256 indexed job, bytes32 contentRef, bytes32 sha256Digest);
    event Paid(uint256 indexed job, address indexed worker, uint256 amount);
    event Refunded(uint256 indexed job, uint256 amount);
    event Disputed(uint256 indexed job);
    event Resolved(uint256 indexed job, uint256 workerAmount, uint256 clientAmount);

    constructor(
        IERC20 token_,
        IQualificationVerifier verifier_,
        uint256 x_,
        uint256 y_,
        uint256 root_,
        address arbitrator_
    ) {
        if (
            address(token_).code.length == 0 || address(verifier_).code.length == 0 || x_ >= FIELD || y_ >= FIELD
                || root_ >= FIELD || root_ == 0 || arbitrator_ == address(0)
        ) revert InvalidTerms();
        issuer = msg.sender;
        arbitrator = arbitrator_;
        token = token_;
        verifier = verifier_;
        issuerX = x_;
        issuerY = y_;
        revocationRoot = root_;
        rootEpoch = 1;
        emit RootUpdated(1, root_);
    }

    function setRoot(uint256 root_) external {
        if (msg.sender != issuer) revert Unauthorized();
        if (root_ == 0 || root_ >= FIELD) revert InvalidTerms();
        revocationRoot = root_;
        rootEpoch++;
        emit RootUpdated(rootEpoch, root_);
    }

    function contextFor(uint256 id) public view returns (uint256) {
        return uint256(keccak256(abi.encode(JOB_DOMAIN, block.chainid, address(this), id))) % FIELD;
    }

    function createJob(
        uint256 amount,
        uint256 qualificationClass,
        uint64 acceptBefore,
        uint64 submitBefore,
        uint64 reviewBefore,
        bytes32 terms
    ) external nonReentrant returns (uint256 id) {
        if (
            amount == 0 || qualificationClass == 0 || qualificationClass > type(uint32).max || terms == bytes32(0)
                || block.timestamp >= acceptBefore || acceptBefore >= submitBefore || submitBefore >= reviewBefore
        ) revert InvalidTerms();
        id = ++nextJob;
        jobs[id] = Job(
            msg.sender,
            address(0),
            amount,
            qualificationClass,
            acceptBefore,
            submitBefore,
            reviewBefore,
            Status.Open,
            terms,
            bytes32(0)
        );
        // This prototype admits an ordinary exact-transfer test stablecoin only.
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - beforeBalance != amount) revert InvalidTerms();
        emit JobFunded(id, msg.sender, amount, qualificationClass);
    }

    /// @notice Anyone may relay the proof; it can assign only its proven beneficiary.
    function accept(uint256 id, bytes calldata proof, uint256[9] calldata input) external nonReentrant {
        Job storage job = jobs[id];
        if (job.client == address(0) || job.status != Status.Open) revert WrongState();
        if (block.timestamp >= job.acceptBefore || block.timestamp > input[4]) revert Expired();
        if (
            input[0] != issuerX || input[1] != issuerY || input[2] != revocationRoot
                || input[3] != job.qualificationClass || input[4] > job.acceptBefore || input[5] != contextFor(id)
                || input[6] == 0 || input[6] > type(uint160).max || input[7] >= FIELD || input[8] >= FIELD
        ) revert WrongStatement();
        if (consumedNullifiers[input[7]]) revert Replayed();
        verifier.verifyProof(proof, input);
        consumedNullifiers[input[7]] = true;
        job.worker = address(uint160(input[6]));
        job.status = Status.Accepted;
        emit Accepted(id, job.worker, input[7], rootEpoch);
    }

    function submit(uint256 id, bytes32 deliverable) external {
        _submit(id, deliverable);
    }

    /// Both storage locator and byte digest are committed by the assigned worker.
    /// Clients must match the retrieved envelope's SHA-256 before decrypting.
    function submitDocument(uint256 id, bytes32 contentRef, bytes32 sha256Digest) external {
        if (sha256Digest == bytes32(0)) revert InvalidTerms();
        _submit(id, contentRef);
        documentDigests[id] = sha256Digest;
        emit DocumentCommitted(id, contentRef, sha256Digest);
    }

    function _submit(uint256 id, bytes32 deliverable) internal {
        Job storage job = jobs[id];
        if (msg.sender != job.worker) revert Unauthorized();
        if (job.status != Status.Accepted) revert WrongState();
        if (block.timestamp > job.submitBefore) revert Expired();
        if (deliverable == bytes32(0)) revert InvalidTerms();
        job.deliverable = deliverable;
        job.status = Status.Submitted;
        emit Submitted(id, deliverable);
    }

    /// @notice Explicit client acceptance establishes payable completion, not the credential proof.
    function approveAndPay(uint256 id) external nonReentrant {
        Job storage job = jobs[id];
        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != Status.Submitted) revert WrongState();
        job.status = Status.Paid;
        token.safeTransfer(job.worker, job.amount);
        emit Paid(id, job.worker, job.amount);
    }

    /// @notice Agreed review timeout pays a timely submitted worker. This is an explicit policy.
    function claimAfterReview(uint256 id) external nonReentrant {
        Job storage job = jobs[id];
        if (msg.sender != job.worker) revert Unauthorized();
        if (job.status != Status.Submitted) revert WrongState();
        if (block.timestamp <= job.reviewBefore) revert Expired();
        job.status = Status.Paid;
        token.safeTransfer(job.worker, job.amount);
        emit Paid(id, job.worker, job.amount);
    }

    /// @notice Client can dispute timely submission before automatic review-timeout payout.
    function dispute(uint256 id) external {
        Job storage job = jobs[id];
        if (msg.sender != job.client) revert Unauthorized();
        if (job.status != Status.Submitted) revert WrongState();
        if (block.timestamp > job.reviewBefore) revert Expired();
        job.status = Status.Disputed;
        emit Disputed(id);
    }

    /// @notice Explicitly trusted experiment arbitrator resolves quality disputes; ZK does not judge work.
    function resolveDispute(uint256 id, uint256 workerAmount) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        Job storage job = jobs[id];
        if (job.status != Status.Disputed || workerAmount > job.amount) revert WrongState();
        job.status = Status.Resolved;
        if (workerAmount != 0) token.safeTransfer(job.worker, workerAmount);
        uint256 clientAmount = job.amount - workerAmount;
        if (clientAmount != 0) token.safeTransfer(job.client, clientAmount);
        emit Resolved(id, workerAmount, clientAmount);
    }

    /// @notice Only unaccepted or never-submitted expired jobs refund. Revocation does not claw back pay.
    function refund(uint256 id) external nonReentrant {
        Job storage job = jobs[id];
        if (msg.sender != job.client) revert Unauthorized();
        if (!((job.status == Status.Open && block.timestamp >= job.acceptBefore)
                    || (job.status == Status.Accepted && block.timestamp > job.submitBefore))) revert WrongState();
        job.status = Status.Refunded;
        token.safeTransfer(job.client, job.amount);
        emit Refunded(id, job.amount);
    }
}
