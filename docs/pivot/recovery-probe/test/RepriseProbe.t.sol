// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RepriseProbe, IERC20Probe} from "../src/RepriseProbe.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function chainId(uint256) external;
}

contract ExactToken is IERC20Probe {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public failTransfers;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setFailTransfers(bool fail) external {
        failTransfers = fail;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfers) return false;
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) private {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract RepriseProbeTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    ExactToken private token;
    RepriseProbe private reprise;
    address private constant A = address(0xA11CE);
    address private constant B = address(0xB0B);
    address private constant PAYEE = address(0xCAFE);
    address private constant ATTACKER = address(0xBAD);
    uint256 private constant AMOUNT = 17_000_000;
    bytes32 private effect;

    function setUp() public {
        token = new ExactToken();
        reprise = new RepriseProbe(token, keccak256("approved-job-1"), 60);
        token.mint(address(this), AMOUNT * 10);
        token.approve(address(reprise), type(uint256).max);
        reprise.enroll(A);
        reprise.enroll(B);
        reprise.approveStep(1, PAYEE, AMOUNT);
        effect = reprise.effectId(1, PAYEE, AMOUNT);
        vm.prank(A);
        reprise.acquireLease();
    }

    function check(bool result, string memory message) private pure {
        require(result, message);
    }

    function paid() private view returns (bool result) {
        (,,, result,,,,) = reprise.steps(1);
    }

    function receipt() private view returns (bytes32 result) {
        (,,,,,,, result) = reprise.steps(1);
    }

    function takeover() private {
        vm.warp(reprise.deadline());
        vm.prank(B);
        reprise.acquireLease();
    }

    function testCrashAfterPaymentBeforeAckThenRecoverWithoutSecondPayment() public {
        vm.prank(A);
        reprise.pay(1, effect, 1);
        check(token.balanceOf(PAYEE) == AMOUNT && paid(), "actual initial payment");
        check(receipt() == bytes32(0), "no ack/checkpoint before crash");
        takeover();
        vm.expectRevert(RepriseProbe.AlreadyPaid.selector);
        vm.prank(B);
        reprise.pay(1, effect, 2);
        vm.prank(B);
        bytes32 recovered = reprise.publishReceipt(1, keccak256("B recovered chain payment"), 2);
        check(receipt() == recovered && recovered != bytes32(0), "authoritative B publication");
        check(token.balanceOf(PAYEE) == AMOUNT, "no duplicate transfer");
        (,,,, uint256 paidEpoch, address paidBy,,) = reprise.steps(1);
        check(paidEpoch == 1 && paidBy == A, "original payer provenance retained");
    }

    function testStaleWorkerCannotPayNewStepOrPublishAfterTakeover() public {
        vm.prank(A);
        reprise.pay(1, effect, 1);
        reprise.approveStep(2, PAYEE, AMOUNT);
        bytes32 next = reprise.effectId(2, PAYEE, AMOUNT);
        takeover();
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(A);
        reprise.pay(2, next, 1);
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(A);
        reprise.pay(2, next, 2);
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(A);
        reprise.publishReceipt(1, keccak256("late ack"), 1);
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(B);
        reprise.pay(2, next, 1);
        vm.prank(B);
        reprise.pay(2, next, 2);
        check(token.balanceOf(PAYEE) == AMOUNT * 2, "only two distinct owner approvals paid");
    }

    function testWorkerCannotInventStepOrAlterRecipientOrAmount() public {
        vm.expectRevert(RepriseProbe.Unauthorized.selector);
        vm.prank(A);
        reprise.approveStep(2, PAYEE, AMOUNT);
        vm.expectRevert(RepriseProbe.UnknownStep.selector);
        vm.prank(A);
        reprise.pay(2, effect, 1);
        bytes32 wrongRecipient = reprise.effectId(1, ATTACKER, AMOUNT);
        vm.expectRevert(RepriseProbe.WrongEffect.selector);
        vm.prank(A);
        reprise.pay(1, wrongRecipient, 1);
        bytes32 wrongAmount = reprise.effectId(1, PAYEE, AMOUNT + 1);
        vm.expectRevert(RepriseProbe.WrongEffect.selector);
        vm.prank(A);
        reprise.pay(1, wrongAmount, 1);
        vm.expectRevert(RepriseProbe.ExistingStep.selector);
        reprise.approveStep(1, ATTACKER, AMOUNT);
        check(token.balanceOf(PAYEE) == 0 && token.balanceOf(ATTACKER) == 0, "no altered payment");
    }

    function testReplayAfterPaymentAndReceiptRejected() public {
        vm.prank(A);
        reprise.pay(1, effect, 1);
        vm.expectRevert(RepriseProbe.AlreadyPaid.selector);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        vm.prank(A);
        reprise.publishReceipt(1, keccak256("receipt"), 1);
        takeover();
        vm.expectRevert(RepriseProbe.AlreadyPublished.selector);
        vm.prank(B);
        reprise.publishReceipt(1, keccak256("replacement"), 2);
        check(token.balanceOf(PAYEE) == AMOUNT, "replay no transfer");
    }

    function testExpiredLeaseAndEarlyTakeoverRejected() public {
        vm.expectRevert(RepriseProbe.ActiveLease.selector);
        vm.prank(B);
        reprise.acquireLease();
        vm.expectRevert(RepriseProbe.Unauthorized.selector);
        vm.prank(ATTACKER);
        reprise.acquireLease();
        vm.warp(reprise.deadline());
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        vm.expectRevert(RepriseProbe.InvalidLease.selector);
        vm.prank(A);
        reprise.publishReceipt(1, keccak256("expired"), 1);
        vm.prank(B);
        reprise.acquireLease();
        vm.prank(B);
        reprise.pay(1, effect, 2);
        check(token.balanceOf(PAYEE) == AMOUNT, "B works at exact expiry boundary");
    }

    function testCancelRefundsUnpaidAndPreservesPaidRecovery() public {
        reprise.approveStep(2, PAYEE, AMOUNT);
        bytes32 next = reprise.effectId(2, PAYEE, AMOUNT);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        uint256 beforeRefund = token.balanceOf(address(this));
        vm.expectRevert(RepriseProbe.Unauthorized.selector);
        vm.prank(A);
        reprise.cancel();
        reprise.cancel();
        check(token.balanceOf(address(this)) == beforeRefund + AMOUNT, "unspent returned");
        check(token.balanceOf(address(reprise)) == 0 && reprise.unspent() == 0, "escrow drained exactly");
        takeover();
        vm.expectRevert(RepriseProbe.Cancelled.selector);
        vm.prank(B);
        reprise.pay(2, next, 2);
        vm.expectRevert(RepriseProbe.Cancelled.selector);
        reprise.approveStep(3, PAYEE, AMOUNT);
        vm.prank(B);
        reprise.publishReceipt(1, keccak256("paid before cancellation"), 2);
        check(paid() && token.balanceOf(PAYEE) == AMOUNT, "paid obligation irreversible here");
    }

    function testUnpaidOrEmptyEvidenceCannotFinalize() public {
        vm.expectRevert(RepriseProbe.NotPaid.selector);
        vm.prank(A);
        reprise.publishReceipt(1, keccak256("invented"), 1);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        vm.expectRevert(RepriseProbe.InvalidTerms.selector);
        vm.prank(A);
        reprise.publishReceipt(1, bytes32(0), 1);
    }

    function testTokenTransferFailureDoesNotConsumePayment() public {
        token.setFailTransfers(true);
        vm.expectRevert(RepriseProbe.TokenFailure.selector);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        check(!paid() && reprise.unspent() == AMOUNT, "failure rolls back consumption");
        token.setFailTransfers(false);
        vm.prank(A);
        reprise.pay(1, effect, 1);
        check(paid() && token.balanceOf(PAYEE) == AMOUNT, "retry succeeds once");
    }

    function testEffectDomainsBindChainContractJobStepTokenRecipientAmount() public {
        bytes32 manuallyBound = keccak256(
            abi.encode(
                reprise.EFFECT_DOMAIN(),
                block.chainid,
                address(reprise),
                reprise.job(),
                uint256(1),
                PAYEE,
                address(token),
                AMOUNT
            )
        );
        check(effect == manuallyBound, "all required fields bound");
        RepriseProbe other = new RepriseProbe(token, reprise.job(), 60);
        check(effect != other.effectId(1, PAYEE, AMOUNT), "contract domain");
        check(effect != reprise.effectId(2, PAYEE, AMOUNT), "step domain");
        vm.chainId(block.chainid + 1);
        check(effect != reprise.effectId(1, PAYEE, AMOUNT), "chain domain");
        vm.expectRevert(RepriseProbe.WrongEffect.selector);
        vm.prank(A);
        reprise.pay(1, effect, 1);
    }

    function testFuzzRepeatedTakeoversCannotRepay(uint8 rawCount) public {
        vm.prank(A);
        reprise.pay(1, effect, 1);
        uint256 count = uint256(rawCount) % 20 + 1;
        for (uint256 i; i < count; ++i) {
            address current = i % 2 == 0 ? B : A;
            vm.warp(reprise.deadline());
            vm.prank(current);
            reprise.acquireLease();
            uint256 currentEpoch = reprise.epoch();
            vm.expectRevert(RepriseProbe.AlreadyPaid.selector);
            vm.prank(current);
            reprise.pay(1, effect, currentEpoch);
        }
        check(token.balanceOf(PAYEE) == AMOUNT, "one transfer across all takeover attempts");
    }
}
